import type { Express } from "express";
import type { Server } from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcrypt";
import multer from "multer";
import sharp from "sharp";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { db } from "./db";
import { pool } from "./db";
import { api } from "@shared/routes";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertMessageSchema, insertShopSuggestionSchema, insertSavedSearchSchema, insertReviewSchema, insertEventSchema, insertOfferSchema, insertOrderSchema, insertFeedbackSchema, listings, listingAnalytics, favorites, collections, insertCollectionSchema, wishlists, insertWishlistSchema, loyaltyPoints, loyaltyTransactions, loyaltyPointValues, neighborhoodEvents, neighborhoodParticipants, insertNeighborhoodEventSchema, shippingOptions, insertShippingOptionSchema, communityTips, tipVotes, insertCommunityTipSchema, orders, offers, disputeMessages, events, payouts, insertPayoutSchema, verificationRequests } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, lt, sql, count, desc, gte, and, or, gt, inArray } from "drizzle-orm";
import { saleEventTypes, saleTypeLabels, isSaleEventType } from "@shared/schema";
import { sendMessageNotification, sendSearchAlert, sendOfferNotification, sendBoostExpiryNotification, sendListingSoldNotification, sendReviewNotification, sendVerificationStatusEmail, sendOrderStatusEmail, sendFeedbackToSupport } from "./email";
import { authStorage } from "./replit_integrations/auth/storage";
import { z } from "zod";
import { moderateContent } from "./moderation";
import { setupWebSocket, sendToUser, isUserOnline, getOnlineUsers } from "./websocket";
import { getSession } from "./replit_integrations/auth";

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function awardLoyaltyPoints(userId: string, type: string, description: string, dedupeKey?: string) {
  try {
    const pts = (loyaltyPointValues as any)[type];
    if (!pts) return;
    if (dedupeKey) {
      const [existing] = await db.select({ id: loyaltyTransactions.id }).from(loyaltyTransactions)
        .where(and(eq(loyaltyTransactions.userId, userId), eq(loyaltyTransactions.type, type), eq(loyaltyTransactions.description, dedupeKey)))
        .limit(1);
      if (existing) return;
    }
    let [record] = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.userId, userId));
    if (!record) {
      [record] = await db.insert(loyaltyPoints).values({ userId, points: 0, lifetimePoints: 0, tier: "bronze" }).returning();
    }
    await db.update(loyaltyPoints).set({
      points: record.points + pts,
      lifetimePoints: record.lifetimePoints + pts,
      updatedAt: new Date(),
    }).where(eq(loyaltyPoints.id, record.id));
    await db.insert(loyaltyTransactions).values({ userId, points: pts, type, description: dedupeKey || description });
  } catch (err) {
    console.error("[loyalty] Failed to award points:", type, userId, err);
  }
}

// Where uploaded item photos / videos are stored on disk.
//
// IMPORTANT (production / Railway): the container filesystem is EPHEMERAL —
// every deploy rebuilds it and wipes anything written at runtime. That is why
// listing photos "break" after a push: the files vanish and the <img> falls
// back to the logo. To keep photos permanently, mount a Railway Volume and
// point this at it by setting the UPLOADS_DIR env var (e.g. /data/uploads).
// In local dev (no env var set) it defaults to <project>/uploads as before.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `vid-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files allowed"));
  },
});

const BOOST_PRICES: Record<string, Record<number, { amount: number; label: string }>> = {
  category: {
    7: { amount: 199, label: "Category Bump — 7 days" },
    14: { amount: 299, label: "Category Bump — 14 days" },
    30: { amount: 499, label: "Category Bump — 30 days" },
  },
  featured: {
    7: { amount: 499, label: "Main Page Featured — 7 days" },
    14: { amount: 799, label: "Main Page Featured — 14 days" },
    30: { amount: 1299, label: "Main Page Featured — 30 days" },
  },
  spotlight: {
    7: { amount: 999, label: "Spotlight — 7 days" },
    14: { amount: 1699, label: "Spotlight — 14 days" },
    30: { amount: 2499, label: "Spotlight — 30 days" },
  },
};

const VALID_DURATIONS = [7, 14, 30] as const;
type BoostDuration = typeof VALID_DURATIONS[number];

async function autoPopulateNearbyShops(city: string, country: string) {
  try {
    const existingListings = await storage.getListings({ city, isShop: true });
    if (existingListings.length >= 5) return;

    const query = encodeURIComponent(`thrift shop in ${city}, ${country}`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: { "User-Agent": "YARDEES/1.0 (marketplace app)" },
    });
    if (!res.ok) return;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return;

    const botUserId = "yardees-bot";
    const existingTitles = new Set(existingListings.map((l: any) => l.title.toLowerCase()));

    for (const place of results) {
      const name = place.display_name?.split(",")[0]?.trim();
      if (!name || existingTitles.has(name.toLowerCase())) continue;

      try {
        await storage.createListing(botUserId, {
          title: name,
          description: `Discovered shop in ${city}. Visit to explore their selection of secondhand and thrift items.`,
          price: 0,
          category: "Other",
          address: place.display_name || "",
          country: country || "",
          city: city || "",
          sellerContact: "",
          photos: ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"],
          isShop: true,
          privacyLevel: "open",
          listingType: "individual",
          subCategories: [],
          isBoosted: false,
          currency: "USD",
          isNegotiable: false,
          isBundle: false,
          bundleItems: "",
          pickupAvailability: "",
          phone: "",
          website: "",
          hours: "",
          condition: null,
          lat: place.lat || null,
          lng: place.lon || null,
        } as any);
      } catch {}
    }
  } catch {}
}

async function ensureAdminSettingsTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW())`);
  } catch (e) { console.log("[db] admin_settings table check:", e); }
}

async function createIndexes() {
  const indexStatements = [
    "CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city)",
    "CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(country)",
    "CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category)",
    "CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_listings_is_sold ON listings(is_sold)",
    "CREATE INDEX IF NOT EXISTS idx_listings_is_shop ON listings(is_shop)",
    "CREATE INDEX IF NOT EXISTS idx_listings_is_boosted ON listings(is_boosted)",
    "CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)",
    "CREATE INDEX IF NOT EXISTS idx_listings_expires_at ON listings(expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON listings(listing_type)",
    "CREATE INDEX IF NOT EXISTS idx_listings_browse ON listings(is_sold, expires_at, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON listings USING gin(title gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages(listing_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read)",
    "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, listing_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false",
    "CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id)",
    "CREATE INDEX IF NOT EXISTS idx_favorites_user_listing ON favorites(user_id, listing_id)",
    "CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id)",
    "CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_id)",
    "CREATE INDEX IF NOT EXISTS idx_offers_seller ON offers(seller_id)",
    "CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers(listing_id)",
    "CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id)",
    "CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id)",
    "CREATE INDEX IF NOT EXISTS idx_analytics_listing ON listing_analytics(listing_id)",
    "CREATE INDEX IF NOT EXISTS idx_analytics_created ON listing_analytics(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_analytics_listing_date ON listing_analytics(listing_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_events_city ON events(city)",
    "CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date)",
    "CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON event_rsvps(event_id)",
    "CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)",
    "CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)",
    "CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code)",
    "CREATE INDEX IF NOT EXISTS idx_shop_suggestions_listing ON shop_suggestions(listing_id)",
    "CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_requests(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false",
    "CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)",
  ];

  const client = await pool.connect();
  try {
    for (const stmt of indexStatements) {
      try {
        await client.query(stmt);
      } catch {}
    }
    console.log("[db] Database indexes created/verified");
  } finally {
    client.release();
  }
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again in a minute." },
  skip: (req) => req.path.startsWith("/api/shops/photo/"),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts. Please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Upload limit reached. Please wait before uploading more." },
});

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many feedback submissions. Please try again later." },
});

async function runScheduledCleanup() {
  try {
    const expiredBoosts = await storage.expireBoosts();
    if (expiredBoosts.length > 0) {
      console.log(`[cleanup] Auto-expired ${expiredBoosts.length} boosts`);
      for (const expired of expiredBoosts) {
        sendBoostExpiryNotification(expired.userId, expired.id, expired.title).catch(() => {});
        storage.createNotification({
          userId: expired.userId,
          type: "boost_expired",
          title: "Boost expired",
          body: `The boost on "${expired.title}" has expired. Re-boost to keep it visible.`,
          link: `/listing/${expired.id}`,
        }).catch(() => {});
      }
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const deletedAnalytics = await db.delete(listingAnalytics)
      .where(lt(listingAnalytics.createdAt, ninetyDaysAgo));
    console.log("[cleanup] Purged analytics older than 90 days");

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const expiredListings = await db.select({ id: listings.id, photos: listings.photos })
      .from(listings)
      .where(lt(listings.expiresAt, sixMonthsAgo));

    for (const listing of expiredListings) {
      if (listing.photos) {
        for (const photo of listing.photos) {
          if (photo.startsWith("/uploads/")) {
            const filePath = path.join(UPLOADS_DIR, photo.replace("/uploads/", ""));
            try { fs.unlinkSync(filePath); } catch {}
          }
        }
      }
      await db.delete(listings).where(eq(listings.id, listing.id));
    }
    if (expiredListings.length > 0) {
      console.log(`[cleanup] Removed ${expiredListings.length} listings expired >6 months`);
    }

    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM sessions WHERE expire < NOW()`);
      console.log("[cleanup] Purged expired sessions");
    } finally {
      client.release();
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const staleShipped = await db.select().from(orders)
      .where(and(
        eq(orders.status, "shipped"),
        eq(orders.escrowStatus, "held"),
        lt(orders.updatedAt, fourteenDaysAgo)
      ));
    for (const order of staleShipped) {
      const [released] = await db.update(orders).set({
        status: "delivered",
        escrowStatus: "released",
        escrowReleaseDate: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(orders.id, order.id), eq(orders.status, "shipped"), eq(orders.escrowStatus, "held"))).returning();
      if (!released) continue;

      const listing = await storage.getListing(order.listingId).catch(() => null);
      const itemTitle = listing?.title || `Order #${order.id}`;

      if (listing) {
        await storage.updateListing(order.listingId, order.sellerId, { isSold: true }).catch(() => {});
        awardLoyaltyPoints(order.sellerId, "listing_sold", `Sold: "${itemTitle}"`, `sold_listing_${listing.id}`);
      }

      const seller = await storage.getUser(order.sellerId);
      if (seller) {
        const newCount = (seller.transactionCount || 0) + 1;
        const updates: any = { transactionCount: newCount };
        if (newCount >= 5 && seller.verificationLevel === 'id_verified') {
          updates.verificationLevel = 'trusted_seller';
        }
        await db.update(users).set(updates).where(eq(users.id, order.sellerId));
      }

      storage.createNotification({
        userId: order.sellerId,
        type: "order_update",
        title: "Payment Auto-Released!",
        body: `Funds for "${itemTitle}" have been automatically released after 14 days. Payout: $${((order.sellerPayout || order.amount) / 100).toFixed(2)}.`,
        link: "/orders",
      }).catch(() => {});

      storage.createNotification({
        userId: order.buyerId,
        type: "order_update",
        title: "Order Auto-Completed",
        body: `Your order for "${itemTitle}" has been auto-completed after 14 days. Funds released to seller.`,
        link: "/orders",
      }).catch(() => {});

      console.log(`[escrow] Auto-released order #${order.id} after 14 days`);
    }
    if (staleShipped.length > 0) {
      console.log(`[escrow] Auto-released ${staleShipped.length} shipped orders older than 14 days`);
    }

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const stalePending = await db.select().from(orders)
      .where(and(
        eq(orders.status, "pending"),
        lt(orders.createdAt, fourDaysAgo)
      ));
    for (const order of stalePending) {
      const [cancelled] = await db.update(orders).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(and(eq(orders.id, order.id), eq(orders.status, "pending"))).returning();
      if (!cancelled) continue;

      const listing = await storage.getListing(order.listingId).catch(() => null);
      const itemTitle = listing?.title || `Order #${order.id}`;

      if (listing) {
        const [otherActiveOrder] = await db.select({ id: orders.id }).from(orders)
          .where(and(
            eq(orders.listingId, order.listingId),
            sql`${orders.id} != ${order.id}`,
            or(eq(orders.status, "paid"), eq(orders.status, "shipped"), eq(orders.status, "delivered"))
          )).limit(1);
        if (!otherActiveOrder) {
          await storage.updateListing(order.listingId, order.sellerId, { isSold: false }).catch(() => {});
        }
      }

      if (order.offerId) {
        await db.update(offers).set({ status: "expired" }).where(eq(offers.id, order.offerId)).catch(() => {});
      }

      storage.createNotification({
        userId: order.sellerId,
        type: "order_update",
        title: "Unpaid Order Cancelled",
        body: `The buyer did not pay for "${itemTitle}" within 4 days. Your listing has been relisted.`,
        link: "/orders",
      }).catch(() => {});

      storage.createNotification({
        userId: order.buyerId,
        type: "order_update",
        title: "Order Cancelled — Payment Expired",
        body: `Your order for "${itemTitle}" was cancelled because payment was not completed within 4 days.`,
        link: "/orders",
      }).catch(() => {});

      console.log(`[cleanup] Auto-cancelled unpaid order #${order.id} after 4 days`);
    }
    if (stalePending.length > 0) {
      console.log(`[cleanup] Auto-cancelled ${stalePending.length} unpaid pending orders older than 4 days`);
    }

    const expiredYardSales = await db.select({ id: listings.id, title: listings.title, userId: listings.userId, listingType: listings.listingType })
      .from(listings)
      .where(and(
        inArray(listings.listingType, saleEventTypes as unknown as string[]),
        eq(listings.isSold, false),
        lt(listings.saleEndDate, new Date())
      ));
    for (const ys of expiredYardSales) {
      await db.update(listings).set({ isSold: true }).where(eq(listings.id, ys.id));
      const saleLabel = saleTypeLabels[ys.listingType] || "Sale";
      storage.createNotification({
        userId: ys.userId,
        type: "listing_update",
        title: `${saleLabel} Ended`,
        body: `Your listing "${ys.title}" has been automatically deactivated because the sale date has passed.`,
        link: "/dashboard",
      }).catch(() => {});
    }
    if (expiredYardSales.length > 0) {
      console.log(`[cleanup] Auto-deactivated ${expiredYardSales.length} expired sale-event listings`);
    }

    const allVerifications = await storage.getAllVerifications();
    const now = new Date();
    let expiredVerifications = 0;
    for (const v of allVerifications) {
      if (v.status === "approved" && v.expiryDate && new Date(v.expiryDate) <= now) {
        await storage.updateVerificationStatus(v.id, "expired");
        await storage.updateUserVerificationLevel(v.userId, "unverified");
        storage.createNotification({
          userId: v.userId,
          type: "verification_expired",
          title: "Verification Expired",
          body: "Your ID verification has expired. Please submit a new ID document to maintain your verified status.",
          link: "/verify",
        }).catch(() => {});
        sendVerificationStatusEmail(v.userId, "expired").catch(() => {});
        expiredVerifications++;
      }
    }
    if (expiredVerifications > 0) {
      console.log(`[cleanup] Expired ${expiredVerifications} verification(s) — users set to unverified`);
    }

    const uploadFiles = fs.readdirSync(UPLOADS_DIR);
    if (uploadFiles.length > 0) {
      const allPhotos = await db.select({ photos: listings.photos }).from(listings);
      const referencedFiles = new Set<string>();
      for (const row of allPhotos) {
        if (row.photos) {
          for (const photo of row.photos) {
            if (photo.startsWith("/uploads/")) {
              referencedFiles.add(photo.replace("/uploads/", ""));
            }
          }
        }
      }
      let orphanCount = 0;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      for (const file of uploadFiles) {
        if (!referencedFiles.has(file)) {
          const filePath = path.join(UPLOADS_DIR, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < oneDayAgo) {
              fs.unlinkSync(filePath);
              orphanCount++;
            }
          } catch {}
        }
      }
      if (orphanCount > 0) console.log(`[cleanup] Removed ${orphanCount} orphaned uploads`);
    }
  } catch (err: any) {
    console.error("[cleanup] Error:", err.message);
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanupScheduler() {
  runScheduledCleanup().catch(() => {});
  cleanupInterval = setInterval(() => {
    runScheduledCleanup().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Google AdSense requires its ad-serving domains to be whitelisted across
        // script/frame/img/connect, otherwise the browser blocks ads silently.
        scriptSrc: [
          "'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net",
          "https://pagead2.googlesyndication.com", "https://*.googlesyndication.com",
          "https://partner.googleadservices.com", "https://www.googletagservices.com",
          "https://adservice.google.com", "https://*.adtrafficquality.google",
          "https://*.g.doubleclick.net", "https://www.google.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.tile.openstreetmap.org",
          "https://commons.wikimedia.org", "https://upload.wikimedia.org",
          "https://*.googlesyndication.com", "https://*.g.doubleclick.net",
          "https://www.google.com", "https://*.gstatic.com", "https://*.adtrafficquality.google",
        ],
        connectSrc: [
          "'self'", "https://nominatim.openstreetmap.org", "https://ipapi.co", "https://ipwho.is",
          "https://pagead2.googlesyndication.com", "https://*.googlesyndication.com",
          "https://*.g.doubleclick.net", "https://*.google.com", "https://*.adtrafficquality.google",
          "wss:", "ws:",
        ],
        workerSrc: ["'self'"],
        // Ads render inside iframes, so the ad-serving frame domains must be allowed
        // (previously 'none', which blocked every AdSense ad from displaying).
        frameSrc: [
          "'self'", "https://googleads.g.doubleclick.net", "https://*.g.doubleclick.net",
          "https://*.googlesyndication.com", "https://www.google.com", "https://*.adtrafficquality.google",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  app.use(compression());
  app.use("/api", apiLimiter);
  app.set("trust proxy", 1);

  ensureAdminSettingsTable().catch(() => {});
  createIndexes().catch(() => {});
  startCleanupScheduler();

  storage.expireBoosts().then((expired) => {
    if (expired.length > 0) {
      console.log(`[startup] Auto-expired ${expired.length} boosts past their expiration date`);
      for (const item of expired) {
        sendBoostExpiryNotification(item.userId, item.id, item.title).catch(() => {});
      }
    }
  }).catch(() => {});

  const sessionParser = getSession();
  setupWebSocket(httpServer, sessionParser);

  app.get("/api/messages/online", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.json({ onlineUsers: [] });
      const convos = await storage.getConversations(userId);
      const partnerIds = new Set(convos.map((c: any) => c.otherId));
      const allOnline = getOnlineUsers();
      const relevantOnline = allOnline.filter((id: string) => partnerIds.has(id));
      res.json({ onlineUsers: relevantOnline });
    } catch {
      res.json({ onlineUsers: [] });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString(), memory: process.memoryUsage() });
  });

  app.use("/api/login", authLimiter);
  app.use("/api/register", authLimiter);

  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/admin.html", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.resolve(process.cwd(), "public/admin.html"));
  });

  app.get("/yardees-logo.png", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(path.resolve(process.cwd(), "public/yardees-logo.png"));
  });

  app.use("/uploads", async (req, res, next) => {
    const sanitized = path.basename(req.path);
    if (sanitized !== req.path.replace(/^\//, "")) return res.status(400).send("Invalid path");
    const filePath = path.join(UPLOADS_DIR, sanitized);
    if (!filePath.startsWith(UPLOADS_DIR)) return res.status(400).send("Invalid path");

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return next();
    }

    const requestedUrl = `/uploads/${sanitized}`;
    try {
      const { verificationRequests } = await import("@shared/schema");
      const verifRows = await db.select({
        listingId: verificationRequests.listingId,
      }).from(verificationRequests).where(eq(verificationRequests.documentUrl, requestedUrl));

      if (verifRows.length > 0) {
        const listingId = verifRows[0].listingId;
        if (listingId) {
          const listing = await storage.getListing(listingId);
          if (listing?.isSold) {
            if (!isAdmin(req)) {
              return res.status(403).json({ message: "This document is no longer accessible" });
            }
          }
        }
      }
    } catch {}

    const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", etag);
    res.setHeader("Vary", "Accept-Encoding");
    res.sendFile(filePath);
  });

  // ─── File Upload ────────────────────────────────────────────────────────────
  app.post("/api/upload", isAuthenticated, uploadLimiter, upload.single("photo"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No file provided" });

    const originalPath = req.file.path;
    const ext = path.extname(req.file.filename);
    const baseName = path.basename(req.file.filename, ext);

    try {
      const optimizedName = `opt_${baseName}.jpg`;
      const thumbName = `thumb_${baseName}.jpg`;
      const optimizedPath = path.join(UPLOADS_DIR, optimizedName);
      const thumbPath = path.join(UPLOADS_DIR, thumbName);

      await sharp(originalPath)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(optimizedPath);

      await sharp(originalPath)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toFile(thumbPath);

      fs.unlink(originalPath, () => {});

      res.json({ url: `/uploads/${optimizedName}`, thumbnail: `/uploads/${thumbName}` });
    } catch (err) {
      res.json({ url: `/uploads/${req.file.filename}`, thumbnail: `/uploads/${req.file.filename}` });
    }
  });

  app.post("/api/upload/video", isAuthenticated, uploadLimiter, videoUpload.single("video"), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ message: "No video file provided" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  app.get("/api/listings/locations", async (_req, res) => {
    try {
      const rows = await db
        .select({ country: listings.country, city: listings.city })
        .from(listings)
        .where(and(eq(listings.isSold, false), or(gt(listings.expiresAt, new Date()), sql`${listings.expiresAt} IS NULL`)))
        .groupBy(listings.country, listings.city)
        .orderBy(listings.country, listings.city);
      const grouped: Record<string, string[]> = {};
      for (const r of rows) {
        if (!r.country) continue;
        if (!grouped[r.country]) grouped[r.country] = [];
        if (r.city && !grouped[r.country].includes(r.city)) grouped[r.country].push(r.city);
      }
      res.json(grouped);
    } catch {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // ─── Listings ────────────────────────────────────────────────────────────────
  app.get(api.listings.list.path, async (req, res) => {
    try {
      // listingType is extracted before validation because the shared input
      // schema only knows the legacy "yard_sale"/"individual" values. We accept
      // any sale-event type plus the "sale_event" meta-filter (any sale event).
      const { limit: rawLimit, offset: rawOffset, listingType: rawListingType, ...rest } = req.query;
      const query = api.listings.list.input?.parse(rest) || {};
      let listingType: string | undefined;
      if (typeof rawListingType === "string" && rawListingType !== "all") {
        if (rawListingType === "sale_event" || rawListingType === "individual" || isSaleEventType(rawListingType)) {
          listingType = rawListingType;
        }
      }
      const limit = Math.min(parseInt(rawLimit as string) || 40, 100);
      const offset = parseInt(rawOffset as string) || 0;
      const result = await storage.getListingsPaginated({ ...query, listingType, limit, offset } as any);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: "Invalid query parameters" });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid listing ID" });
      const listing = await storage.getListing(id);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      const viewKey = `view:${id}:${req.ip}`;
      const viewCache = (global as any).__viewDedup = (global as any).__viewDedup || new Map<string, number>();
      const now = Date.now();
      const lastView = viewCache.get(viewKey);
      if (!lastView || now - lastView > 300000) {
        viewCache.set(viewKey, now);
        storage.incrementViewCount(id).catch(() => {});
        storage.trackView(id, (req.query.source as string) || 'direct').catch(() => {});
      }
      if (viewCache.size > 5000) {
        const cutoff = now - 600000;
        for (const [k, t] of viewCache) { if (t < cutoff) viewCache.delete(k); }
        if (viewCache.size > 5000) {
          const entries = [...viewCache.entries()].sort((a, b) => a[1] - b[1]);
          for (let i = 0; i < entries.length - 2500; i++) viewCache.delete(entries[i][0]);
        }
      }
      const result = { ...listing };
      if (listing.privacyLevel === "verified") {
        const viewerId = (req as any).user?.claims?.sub;
        const isListingOwner = viewerId && viewerId === listing.userId;
        if (!isListingOwner) {
          let canSeeAddress = false;
          if (viewerId) {
            const verif = await storage.getListingVerificationStatus(viewerId, id);
            if (verif?.status === "approved") canSeeAddress = true;
            if (!canSeeAddress) {
              const globalVerif = await storage.getVerificationStatus(viewerId);
              if (globalVerif?.status === "approved") canSeeAddress = true;
            }
            if (!canSeeAddress) {
              const viewer = await storage.getUser(viewerId);
              if (viewer?.verificationLevel === "id_verified" || viewer?.verificationLevel === "trusted_seller") {
                const listingVerif = await storage.getListingVerificationStatus(viewerId, id);
                if (listingVerif?.status === "approved") canSeeAddress = true;
              }
            }
          }
          if (!canSeeAddress) {
            result.address = "";
          }
        }
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/search/suggestions", async (req, res) => {
    try {
      const q = req.query.q as string;
      if (!q) return res.json({ titles: [], categories: [] });
      const suggestions = await storage.getSearchSuggestions(q);
      res.json(suggestions);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/search/trending", async (_req, res) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const trending = await db
        .select({
          category: listings.category,
          totalViews: sql<number>`COALESCE(SUM(${listings.viewCount}), 0)`.as("total_views"),
        })
        .from(listings)
        .where(
          and(
            eq(listings.isSold, false),
            gte(listings.createdAt, sevenDaysAgo)
          )
        )
        .groupBy(listings.category)
        .orderBy(sql`total_views DESC`)
        .limit(5);

      res.json(trending.map((t) => t.category));
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/wishlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await db.select().from(wishlists)
        .where(eq(wishlists.userId, userId))
        .orderBy(desc(wishlists.createdAt));
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wishlists" });
    }
  });

  app.post("/api/wishlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = insertWishlistSchema.parse({ ...req.body, userId });
      const [wishlist] = await db.insert(wishlists).values(input).returning();
      res.status(201).json(wishlist);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create wishlist" });
    }
  });

  app.delete("/api/wishlists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await db.delete(wishlists).where(and(eq(wishlists.id, Number(req.params.id)), eq(wishlists.userId, userId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete wishlist" });
    }
  });

  app.get("/api/loyalty", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let [record] = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.userId, userId));
      if (!record) {
        [record] = await db.insert(loyaltyPoints).values({ userId, points: 0, lifetimePoints: 0, tier: "bronze" }).returning();
      }
      const transactions = await db.select().from(loyaltyTransactions)
        .where(eq(loyaltyTransactions.userId, userId))
        .orderBy(desc(loyaltyTransactions.createdAt))
        .limit(50);
      const tier = record.lifetimePoints >= 5000 ? "platinum" : record.lifetimePoints >= 2000 ? "gold" : record.lifetimePoints >= 500 ? "silver" : "bronze";
      if (tier !== record.tier) {
        await db.update(loyaltyPoints).set({ tier }).where(eq(loyaltyPoints.id, record.id));
        record = { ...record, tier };
      }
      res.json({ ...record, transactions });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch loyalty data" });
    }
  });

  app.post("/api/loyalty/claim-daily", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [existing] = await db.select().from(loyaltyTransactions)
        .where(and(
          eq(loyaltyTransactions.userId, userId),
          eq(loyaltyTransactions.type, "daily_login"),
          gte(loyaltyTransactions.createdAt, today)
        )).limit(1);
      if (existing) return res.status(400).json({ message: "Already claimed today" });

      let [record] = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.userId, userId));
      if (!record) {
        [record] = await db.insert(loyaltyPoints).values({ userId, points: 0, lifetimePoints: 0, tier: "bronze" }).returning();
      }
      const pts = loyaltyPointValues.daily_login;
      await db.update(loyaltyPoints).set({
        points: record.points + pts,
        lifetimePoints: record.lifetimePoints + pts,
        updatedAt: new Date(),
      }).where(eq(loyaltyPoints.id, record.id));
      await db.insert(loyaltyTransactions).values({
        userId, points: pts, type: "daily_login", description: "Daily login bonus",
      });
      res.json({ points: pts, total: record.points + pts });
    } catch (err) {
      res.status(500).json({ message: "Failed to claim daily bonus" });
    }
  });

  app.get("/api/barcode/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 1 && data.product) {
          return res.json({
            found: true,
            source: "openfoodfacts",
            title: data.product.product_name || "",
            brand: data.product.brands || "",
            category: data.product.categories || "",
            image: data.product.image_url || "",
            description: data.product.generic_name || "",
          });
        }
      }
      const openLibRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`);
      if (openLibRes.ok) {
        const olData = await openLibRes.json();
        const key = `ISBN:${code}`;
        if (olData[key]) {
          return res.json({
            found: true,
            source: "openlibrary",
            title: olData[key].title || "",
            authors: olData[key].authors?.map((a: any) => a.name).join(", ") || "",
            publishers: olData[key].publishers?.map((p: any) => p.name).join(", ") || "",
            image: olData[key].cover?.medium || "",
            publishDate: olData[key].publish_date || "",
          });
        }
      }
      res.json({ found: false });
    } catch (err) {
      res.status(500).json({ message: "Barcode lookup failed" });
    }
  });

  // === NEIGHBORHOOD EVENTS ===
  app.get("/api/neighborhood-events", async (req, res) => {
    try {
      const { city, country } = req.query;
      const conditions: any[] = [eq(neighborhoodEvents.status, "upcoming")];
      if (country) conditions.push(eq(neighborhoodEvents.country, country as string));
      if (city) conditions.push(eq(neighborhoodEvents.city, city as string));
      const results = await db.select().from(neighborhoodEvents)
        .where(and(...conditions))
        .orderBy(neighborhoodEvents.startDate)
        .limit(50);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post("/api/neighborhood-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = insertNeighborhoodEventSchema.parse({ ...req.body, organizerId: userId });
      if (input.city) input.city = capitalizeWords(input.city.trim());
      if (input.country) input.country = capitalizeWords(input.country.trim());
      const [event] = await db.insert(neighborhoodEvents).values(input).returning();
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.post("/api/neighborhood-events/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = Number(req.params.id);
      const [existing] = await db.select().from(neighborhoodParticipants)
        .where(and(eq(neighborhoodParticipants.eventId, eventId), eq(neighborhoodParticipants.userId, userId)));
      if (existing) return res.status(400).json({ message: "Already joined" });
      await db.insert(neighborhoodParticipants).values({ eventId, userId, boothInfo: req.body.boothInfo });
      await db.update(neighborhoodEvents).set({
        participantCount: sql`participant_count + 1`,
      }).where(eq(neighborhoodEvents.id, eventId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to join event" });
    }
  });

  // === SHIPPING OPTIONS ===
  app.get("/api/listings/:id/shipping", async (req, res) => {
    try {
      const opts = await db.select().from(shippingOptions)
        .where(eq(shippingOptions.listingId, Number(req.params.id)));
      res.json(opts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch shipping" });
    }
  });

  app.post("/api/listings/:id/shipping", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = Number(req.params.id);
      const [listing] = await db.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.userId, userId)));
      if (!listing) return res.status(403).json({ message: "You can only add shipping to your own listings" });
      const input = insertShippingOptionSchema.parse({ ...req.body, listingId });
      const [opt] = await db.insert(shippingOptions).values(input).returning();
      res.json(opt);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to add shipping option" });
    }
  });

  // === COMMUNITY TIPS ===
  app.get("/api/tips", async (req, res) => {
    try {
      const { category } = req.query;
      let allTips = await db.select().from(communityTips).orderBy(desc(communityTips.upvotes)).limit(50);
      if (category && category !== "all") {
        allTips = allTips.filter(t => t.category === category);
      }
      res.json(allTips);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });

  app.post("/api/tips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const input = insertCommunityTipSchema.parse({ ...req.body, userId });
      const [tip] = await db.insert(communityTips).values(input).returning();
      res.status(201).json(tip);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to create tip" });
    }
  });

  app.post("/api/tips/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tipId = Number(req.params.id);
      const [existing] = await db.select().from(tipVotes)
        .where(and(eq(tipVotes.tipId, tipId), eq(tipVotes.userId, userId)));
      if (existing) {
        await db.delete(tipVotes).where(eq(tipVotes.id, existing.id));
        await db.update(communityTips).set({ upvotes: sql`upvotes - 1` }).where(eq(communityTips.id, tipId));
        return res.json({ voted: false });
      }
      await db.insert(tipVotes).values({ tipId, userId });
      await db.update(communityTips).set({ upvotes: sql`upvotes + 1` }).where(eq(communityTips.id, tipId));
      res.json({ voted: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  app.get("/api/collections", async (_req, res) => {
    try {
      const now = new Date();
      const allCollections = await db.select().from(collections)
        .where(eq(collections.isActive, true))
        .orderBy(collections.sortOrder);
      const active = allCollections.filter(c => {
        if (c.startDate && c.endDate) {
          return now >= c.startDate && now <= c.endDate;
        }
        return true;
      });
      res.json(active);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.get("/api/collections/:slug", async (req, res) => {
    try {
      const [collection] = await db.select().from(collections)
        .where(eq(collections.slug, req.params.slug)).limit(1);
      if (!collection) return res.status(404).json({ message: "Collection not found" });

      const searchConditions: any[] = [
        eq(listings.isSold, false),
        or(sql`${listings.expiresAt} IS NULL`, gt(listings.expiresAt, new Date())),
      ];

      const orConditions: any[] = [];
      if (collection.categories?.length) {
        for (const cat of collection.categories) {
          orConditions.push(eq(listings.category, cat));
        }
      }
      if (collection.keywords?.length) {
        for (const kw of collection.keywords) {
          orConditions.push(sql`(${listings.title} ILIKE ${'%' + kw + '%'} OR ${listings.description} ILIKE ${'%' + kw + '%'})`);
        }
      }
      if (orConditions.length) {
        searchConditions.push(or(...orConditions));
      }

      const items = await db.select().from(listings)
        .where(and(...searchConditions))
        .orderBy(desc(listings.isBoosted), desc(listings.createdAt))
        .limit(60);

      res.json({ collection, listings: items });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch collection" });
    }
  });

  app.get("/api/price-suggestion", async (req, res) => {
    try {
      const { category, condition } = req.query;
      if (!category) return res.status(400).json({ message: "Category required" });

      const conditions: any[] = [
        eq(listings.isSold, true),
        eq(listings.category, category as string),
        gt(listings.price, 0),
      ];
      if (condition && condition !== "any") {
        conditions.push(eq(listings.condition, condition as string));
      }

      const result = await db.select({
        avg: sql<number>`ROUND(AVG(${listings.price}))`,
        min: sql<number>`MIN(${listings.price})`,
        max: sql<number>`MAX(${listings.price})`,
        count: count(),
      }).from(listings).where(and(...conditions));

      const stats = result[0];
      if (!stats || stats.count === 0) {
        return res.json({ available: false });
      }

      res.json({
        available: true,
        avg: Number(stats.avg),
        min: Number(stats.min),
        max: Number(stats.max),
        sampleSize: Number(stats.count),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get price suggestion" });
    }
  });

  app.get("/api/categories/featured", async (req, res) => {
    try {
      const countryFilter = req.query.country as string | undefined;
      const cityFilter = req.query.city as string | undefined;

      const conditions: any[] = [
        eq(listings.isSold, false),
        or(sql`${listings.expiresAt} IS NULL`, gt(listings.expiresAt, new Date())),
      ];

      if (countryFilter) {
        conditions.push(eq(listings.country, countryFilter));
      }
      if (cityFilter) {
        conditions.push(eq(listings.city, cityFilter));
      }

      const sampleImageSubquery = countryFilter
        ? sql<string>`(SELECT photos[1] FROM ${listings} l2 WHERE l2.category = ${listings}.category AND l2.is_sold = false AND array_length(l2.photos, 1) > 0 AND l2.country = ${countryFilter} ${cityFilter ? sql`AND l2.city = ${cityFilter}` : sql``} ORDER BY l2.is_boosted DESC, l2.created_at DESC LIMIT 1)`.as("sample_image")
        : sql<string>`(SELECT photos[1] FROM ${listings} l2 WHERE l2.category = ${listings}.category AND l2.is_sold = false AND array_length(l2.photos, 1) > 0 ORDER BY l2.is_boosted DESC, l2.created_at DESC LIMIT 1)`.as("sample_image");

      const limitParam = req.query.limit as string | undefined;
      const queryLimit = limitParam === "all" ? 100 : 6;

      const results = await db
        .select({
          category: listings.category,
          boostedCount: sql<number>`COUNT(*) FILTER (WHERE ${listings.isBoosted} = true)`.as("boosted_count"),
          totalCount: sql<number>`COUNT(*)`.as("total_count"),
          sampleImage: sampleImageSubquery,
        })
        .from(listings)
        .where(and(...conditions))
        .groupBy(listings.category)
        .orderBy(sql`boosted_count DESC`, sql`total_count DESC`)
        .limit(queryLimit);

      const featured = results
        .filter(r => r.totalCount > 0)
        .map(r => ({
          name: r.category,
          boostedCount: Number(r.boostedCount),
          totalCount: Number(r.totalCount),
          sampleImage: r.sampleImage || null,
        }));

      res.json(featured);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/listings/:id/similar", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const listing = await storage.getListing(id);
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      const similar = await storage.getSimilarListings(id, listing.category, listing.city);
      res.json(similar);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.listings.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.listings.create.input.parse(req.body);
      if (input.city) input.city = capitalizeWords(input.city.trim());
      if (input.country) input.country = capitalizeWords(input.country.trim());
      const userId = req.user.claims.sub;

      const contentToCheck = `${input.title} ${input.description || ""}`;
      const modResult = moderateContent(contentToCheck);
      if (modResult.severity === "high") {
        return res.status(400).json({ message: "Your listing contains prohibited content and cannot be published." });
      }

      const listing = await storage.createListing(userId, input);

      if (!modResult.isClean) {
        storage.reportListing("system", {
          listingId: listing.id,
          reason: "Auto-flagged by content moderation",
          details: `Severity: ${modResult.severity}. Flagged terms: ${modResult.flaggedWords.join(", ")}`,
        }).catch(() => {});
      }

      if (listing.isShop && listing.city) {
        autoPopulateNearbyShops(listing.city, listing.country).catch(() => {});
      }

      if (isSaleEventType(listing.listingType) && (listing as any).saleStartDate && (listing as any).saleEndDate) {
        try {
          const saleLabel = saleTypeLabels[listing.listingType] || "Sale";
          await storage.createEvent(userId, {
            listingId: listing.id,
            title: listing.title,
            description: listing.description || `${saleLabel} at ${listing.address}`,
            address: listing.address,
            city: listing.city,
            country: listing.country,
            startDate: new Date((listing as any).saleStartDate),
            endDate: new Date((listing as any).saleEndDate),
            photos: listing.photos?.slice(0, 3) || [],
            isNeighborhood: false,
            maxParticipants: 0,
          });
          console.log(`[events] Auto-created event for ${listing.listingType} listing #${listing.id}`);
        } catch (err) {
          console.error(`[events] Failed to auto-create event for listing #${listing.id}:`, err);
        }
      }

      // Check for saved search matches and send email alerts
      const allSavedSearches = await storage.getAllSavedSearches();
      for (const savedSearch of allSavedSearches) {
        if (savedSearch.userId === userId) continue; // Don't alert the creator

        const query = savedSearch.query as any;
        let isMatch = true;

        if (query.category && query.category !== "all" && listing.category !== query.category) isMatch = false;
        if (query.listingType && query.listingType !== "all") {
          // "sale_event" is a meta-filter matching any sale-event type.
          if (query.listingType === "sale_event") {
            if (!isSaleEventType(listing.listingType)) isMatch = false;
          } else if (listing.listingType !== query.listingType) {
            isMatch = false;
          }
        }
        if (query.country && !listing.country.toLowerCase().includes(query.country.toLowerCase())) isMatch = false;
        if (query.city && !listing.city.toLowerCase().includes(query.city.toLowerCase())) isMatch = false;
        if (query.minPrice && listing.price < parseInt(query.minPrice, 10)) isMatch = false;
        if (query.maxPrice && listing.price > parseInt(query.maxPrice, 10)) isMatch = false;
        if (query.isShop !== undefined && listing.isShop !== query.isShop) isMatch = false;

        if (isMatch) {
          sendSearchAlert(savedSearch.userId, listing.id, savedSearch.label);
        }
      }

      const activeWishlists = await db.select().from(wishlists).where(eq(wishlists.isActive, true));
      for (const wish of activeWishlists) {
        if (wish.userId === userId) continue;
        let matches = false;
        if (wish.category && wish.category !== listing.category) continue;
        if (wish.maxPrice && listing.price > wish.maxPrice) continue;
        const searchText = `${listing.title} ${listing.description}`.toLowerCase();
        if (wish.keywords?.length) {
          matches = wish.keywords.some(kw => searchText.includes(kw.toLowerCase()));
        } else if (wish.title) {
          matches = searchText.includes(wish.title.toLowerCase());
        }
        if (matches) {
          storage.createNotification({
            userId: wish.userId,
            type: "wishlist_match",
            title: `Match found: "${wish.title}"`,
            body: `"${listing.title}" matches your wishlist item`,
            link: `/listing/${listing.id}`,
          }).catch(() => {});
        }
      }

      awardLoyaltyPoints(userId, "listing_created", `Created listing: "${listing.title}"`, `created_listing_${listing.id}`);

      res.status(201).json(listing);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.listings.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.listings.update.input.parse(req.body);
      const userId = req.user.claims.sub;

      const editContent = `${input.title || ""} ${input.description || ""}`.trim();
      if (editContent) {
        const editModResult = moderateContent(editContent);
        if (editModResult.severity === "high") {
          return res.status(400).json({ message: "Your listing contains prohibited content and cannot be saved." });
        }
        if (!editModResult.isClean) {
          const listingId = Number(req.params.id);
          storage.reportListing("system", {
            listingId,
            reason: "Auto-flagged by content moderation (edit)",
            details: `Severity: ${editModResult.severity}. Flagged terms: ${editModResult.flaggedWords.join(", ")}`,
          }).catch(() => {});
        }
      }

      const listingId = Number(req.params.id);
      const oldListing = await storage.getListing(listingId);
      const listing = await storage.updateListing(listingId, userId, input);

      if (oldListing && input.price !== undefined && input.price < oldListing.price) {
        const oldFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: oldListing.currency || "USD" }).format(oldListing.price / 100);
        const newFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: listing.currency || "USD" }).format(listing.price / 100);
        const favUsers = await db.select({ userId: favorites.userId }).from(favorites).where(eq(favorites.listingId, listingId));
        for (const fav of favUsers) {
          if (fav.userId !== userId) {
            storage.createNotification({
              userId: fav.userId,
              type: "price_drop",
              title: `Price drop on "${listing.title}"`,
              body: `Price dropped from ${oldFormatted} to ${newFormatted}`,
              link: `/listing/${listingId}`,
            }).catch(() => {});
          }
        }
      }

      if (isSaleEventType(listing.listingType) && (listing as any).saleStartDate && (listing as any).saleEndDate) {
        try {
          const saleLabel = saleTypeLabels[listing.listingType] || "Sale";
          const existingEvents = await db.select().from(events).where(eq(events.listingId, listingId));
          if (existingEvents.length > 0) {
            await db.update(events).set({
              title: listing.title,
              description: listing.description || `${saleLabel} at ${listing.address}`,
              address: listing.address,
              city: listing.city,
              country: listing.country,
              startDate: new Date((listing as any).saleStartDate),
              endDate: new Date((listing as any).saleEndDate),
              photos: listing.photos?.slice(0, 3) || [],
            }).where(eq(events.listingId, listingId));
          } else {
            await storage.createEvent(userId, {
              listingId: listingId,
              title: listing.title,
              description: listing.description || `${saleLabel} at ${listing.address}`,
              address: listing.address,
              city: listing.city,
              country: listing.country,
              startDate: new Date((listing as any).saleStartDate),
              endDate: new Date((listing as any).saleEndDate),
              photos: listing.photos?.slice(0, 3) || [],
              isNeighborhood: false,
              maxParticipants: 0,
            });
          }
        } catch (err) {
          console.error(`[events] Failed to sync event for listing #${listingId}:`, err);
        }
      }

      res.json(listing);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Listing not found or unauthorized" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.listings.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteListing(Number(req.params.id), userId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Boost Listing (Stripe) ──────────────────────────────────────────────────
  app.get("/api/boost/prices", (_req, res) => {
    res.json(BOOST_PRICES);
  });

  app.post("/api/listings/:id/boost/checkout", isAuthenticated, async (req: any, res) => {
    const boostType = req.body.boostType as "category" | "featured" | "spotlight";
    const duration = Number(req.body.duration) as BoostDuration;
    if (!boostType || !BOOST_PRICES[boostType]) {
      return res.status(400).json({ message: "Invalid boost type. Must be 'category', 'featured', or 'spotlight'." });
    }
    if (!VALID_DURATIONS.includes(duration)) {
      return res.status(400).json({ message: "Invalid duration. Must be 7, 14, or 30." });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(503).json({ message: "Payment system not configured", missingStripe: true });
    }

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" as any });
      const listingId = Number(req.params.id);
      const listing = await storage.getListing(listingId);
      if (!listing) return res.status(404).json({ message: "Listing not found" });

      const priceInfo = BOOST_PRICES[boostType][duration];
      let chargeAmount = priceInfo.amount;

      const creditDiscount = Number(req.body.useCredits) || 0;
      if (creditDiscount > 0) {
        const user = await storage.getUser(req.user.claims.sub);
        const availableCredits = user?.boostCredits ?? 0;
        const creditsToUse = Math.min(creditDiscount, availableCredits);
        const creditValueCents = creditsToUse * 100;
        chargeAmount = Math.max(0, chargeAmount - creditValueCents);

        if (chargeAmount === 0) {
          return res.status(400).json({ message: "No payment needed. Use the credits endpoint instead." });
        }
      }

      const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
      const description = boostType === "spotlight"
        ? "Your listing gets premium spotlight treatment with maximum visibility"
        : boostType === "featured"
          ? "Your listing will appear featured on the main page"
          : "Your listing will appear boosted within its category";

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `${priceInfo.label} — ${listing.title}`,
              description,
            },
            unit_amount: chargeAmount,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/boost/success?listingId=${listingId}&boostType=${boostType}&duration=${duration}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/listing/${listingId}`,
        metadata: { listingId: String(listingId), boostType, duration: String(duration), userId: req.user.claims.sub, creditsUsed: String(creditDiscount || 0) },
      });

      res.json({ checkoutUrl: session.url });
    } catch (err: any) {
      console.error("Stripe error:", err);
      res.status(500).json({ message: "Payment setup failed" });
    }
  });

  app.post("/api/listings/:id/boost/confirm", isAuthenticated, async (req: any, res) => {
    const { sessionId } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ message: "Payment system not configured" });

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" as any });
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(402).json({ message: "Payment not completed" });
      }

      const metaBoostType = (session.metadata?.boostType || "category") as "category" | "featured" | "spotlight";
      const metaDuration = Number(session.metadata?.duration) || 7;
      const validDuration = VALID_DURATIONS.includes(metaDuration as BoostDuration) ? metaDuration : 7;

      const listingId = Number(session.metadata?.listingId) || Number(req.params.id);
      const metaUserId = session.metadata?.userId || req.user.claims.sub;

      const creditsUsed = Number(session.metadata?.creditsUsed) || 0;
      if (creditsUsed > 0) {
        await storage.deductBoostCredits(metaUserId, creditsUsed);
      }

      const listing = await storage.boostListing(listingId, metaUserId, metaBoostType, validDuration);
      res.json(listing);
    } catch (err: any) {
      console.error("Boost confirmation error:", err?.message || err);
      res.status(500).json({ message: "Boost confirmation failed" });
    }
  });

  // Credit-based boosting (no Stripe needed)
  app.post("/api/listings/:id/boost/credits", isAuthenticated, async (req: any, res) => {
    try {
      const boostType = req.body.boostType as "category" | "featured" | "spotlight";
      const duration = Number(req.body.duration) as BoostDuration;
      if (!boostType || !BOOST_PRICES[boostType]) {
        return res.status(400).json({ message: "Invalid boost type." });
      }
      if (!VALID_DURATIONS.includes(duration)) {
        return res.status(400).json({ message: "Invalid duration." });
      }

      const priceInfo = BOOST_PRICES[boostType][duration];
      const creditsNeeded = Math.ceil(priceInfo.amount / 100);

      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const availableCredits = user?.boostCredits ?? 0;

      if (availableCredits < creditsNeeded) {
        return res.status(400).json({
          message: `Not enough credits. Need ${creditsNeeded}, have ${availableCredits}.`,
          creditsNeeded,
          availableCredits,
        });
      }

      const listingId = Number(req.params.id);
      const listing = await storage.getListing(listingId);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.userId !== userId) return res.status(403).json({ message: "Not your listing" });

      await storage.deductBoostCredits(userId, creditsNeeded);
      const boosted = await storage.boostListing(listingId, userId, boostType, duration);
      res.json(boosted);
    } catch (err: any) {
      res.status(500).json({ message: "Credit boost failed" });
    }
  });

  app.post(api.listings.boost.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.getListing(Number(req.params.id));
      if (!listing || listing.userId !== userId) return res.status(404).json({ message: "Not found" });
      if (listing.isBoosted) {
        const updated = await storage.updateListing(Number(req.params.id), userId, {
          isBoosted: false,
          boostType: null,
          boostExpiresAt: null,
        } as any);
        res.json(updated);
      } else {
        res.status(402).json({ message: "Use the boost page to purchase a boost for your listing.", redirectTo: `/boost/${req.params.id}` });
      }
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Shop Suggestions ────────────────────────────────────────────────────────
  app.get("/api/listings/:id/suggestions", async (req, res) => {
    try {
      const suggestions = await storage.getShopSuggestions(Number(req.params.id));
      res.json(suggestions);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/listings/:id/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertShopSuggestionSchema.parse({ ...req.body, listingId: Number(req.params.id), userId });
      const suggestion = await storage.submitShopSuggestion(userId, data);
      res.status(201).json(suggestion);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/listings/:id/suggestions/:sid/apply", isAuthenticated, async (req: any, res) => {
    try {
      await storage.applyShopSuggestion(Number(req.params.sid), req.user.claims.sub);
      res.json({ success: true });
    } catch (err: any) {
      if (err.message === "Unauthorized") return res.status(403).json({ message: "Unauthorized" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Messages ────────────────────────────────────────────────────────────────
  app.get("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const convos = await storage.getConversations(req.user.claims.sub);
      res.json(convos);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const msgCount = await storage.getUnreadCount(userId);
      const verifRequests = await storage.getVerificationRequestsForSeller(userId);
      const pendingVerif = verifRequests.filter(r => r.status === "pending").length;
      res.json({ count: msgCount + pendingVerif, messageCount: msgCount, verificationCount: pendingVerif });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/messages/thread", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherId, listingId } = req.query as { otherId: string; listingId?: string };
      if (!otherId) return res.status(400).json({ message: "otherId required" });
      const lid = listingId ? Number(listingId) : null;
      await storage.markThreadRead(userId, otherId, lid);
      const thread = await storage.getThread(userId, otherId, lid);
      res.json(thread);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const senderId = req.user.claims.sub;
      const data = insertMessageSchema.parse({ ...req.body, senderId });

      const msgModResult = moderateContent(data.content);
      if (msgModResult.severity === "high") {
        return res.status(400).json({ message: "Your message contains prohibited content and cannot be sent." });
      }

      const msg = await storage.sendMessage(senderId, data);

      if (!msgModResult.isClean && data.listingId) {
        storage.reportListing("system", {
          listingId: data.listingId,
          reason: "Auto-flagged message by content moderation",
          details: `Severity: ${msgModResult.severity}. From user: ${senderId}. Flagged terms: ${msgModResult.flaggedWords.join(", ")}`,
        }).catch(() => {});
      }

      sendToUser(data.receiverId, {
        type: "new_message",
        message: msg,
      });

      sendToUser(senderId, {
        type: "message_sent",
        message: msg,
      });

      if (!isUserOnline(data.receiverId)) {
        sendMessageNotification(data.receiverId, senderId, data.listingId || null, data.content);
        storage.createNotification({
          userId: data.receiverId,
          type: "message",
          title: "New message received",
          body: data.content.length > 100 ? data.content.slice(0, 100) + "..." : data.content,
          link: `/messages?otherId=${senderId}${data.listingId ? `&listingId=${data.listingId}` : ""}`,
        }).catch(() => {});
      }

      res.status(201).json(msg);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/messages/conversation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherId, listingId } = req.query;
      if (!otherId) return res.status(400).json({ message: "otherId is required" });
      const parsedListingId = listingId ? parseInt(listingId as string) : null;
      await storage.deleteConversation(userId, otherId as string, parsedListingId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Profile ─────────────────────────────────────────────────────────────────
  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const { firstName, lastName, displayName, profileImageUrl, email, bio, phone, website, city, country, favoriteCategories, storefrontBio, storefrontTagline, storefrontBanner } = req.body;
      if (email !== undefined) {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return res.status(400).json({ message: "Please enter a valid email address" });
        }
        const existing = await authStorage.getUserByEmail(trimmed);
        if (existing && existing.id !== req.user.claims.sub) {
          return res.status(409).json({ message: "That email is already in use by another account" });
        }
      }
      if (bio !== undefined && typeof bio === "string" && bio.length > 500) {
        return res.status(400).json({ message: "Bio must be 500 characters or less" });
      }
      if (favoriteCategories !== undefined) {
        if (!Array.isArray(favoriteCategories)) {
          return res.status(400).json({ message: "Favorite categories must be an array" });
        }
        if (favoriteCategories.length > 5) {
          return res.status(400).json({ message: "You can select up to 5 favorite categories" });
        }
        const validCategories = ["Furniture", "Clothing", "Electronics", "Books", "Toys", "Home & Garden", "Sports", "Antiques", "Vintage", "Tools", "Collectibles", "Jewelry", "Appliances", "Baby & Kids", "Other"];
        const allValid = favoriteCategories.every((c: any) => typeof c === "string" && validCategories.includes(c));
        if (!allValid) {
          return res.status(400).json({ message: "Invalid category selected" });
        }
      }
      if (phone !== undefined && typeof phone === "string" && phone.length > 20) {
        return res.status(400).json({ message: "Phone number is too long" });
      }
      if (website !== undefined && typeof website === "string" && website.length > 200) {
        return res.status(400).json({ message: "Website URL is too long" });
      }
      if (city !== undefined && typeof city === "string" && city.length > 100) {
        return res.status(400).json({ message: "City name is too long" });
      }
      if (country !== undefined && typeof country === "string" && country.length > 100) {
        return res.status(400).json({ message: "Country name is too long" });
      }
      if (storefrontBio !== undefined && typeof storefrontBio === "string" && storefrontBio.length > 1000) {
        return res.status(400).json({ message: "Storefront bio must be 1000 characters or less" });
      }
      if (storefrontTagline !== undefined && typeof storefrontTagline === "string" && storefrontTagline.length > 100) {
        return res.status(400).json({ message: "Tagline must be 100 characters or less" });
      }
      const updated = await storage.updateUserProfile(req.user.claims.sub, {
        firstName, lastName, displayName, profileImageUrl,
        email: email?.trim().toLowerCase(),
        bio, phone, website,
        city: city ? capitalizeWords(city.trim()) : city,
        country: country ? capitalizeWords(country.trim()) : country,
        favoriteCategories,
        storefrontBio, storefrontTagline, storefrontBanner,
      });
      res.json({
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        profileImageUrl: updated.profileImageUrl,
        verificationLevel: updated.verificationLevel,
        bio: updated.bio,
        phone: updated.phone,
        website: updated.website,
        city: updated.city,
        country: updated.country,
        favoriteCategories: updated.favoriteCategories,
        storefrontBio: updated.storefrontBio,
        storefrontTagline: updated.storefrontTagline,
        storefrontBanner: updated.storefrontBanner,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/profile/storefront", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.userId;
      const { bio, banner, tagline } = req.body;
      await db.update(users).set({
        storefrontBio: bio || null,
        storefrontBanner: banner || null,
        storefrontTagline: tagline || null,
      }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to update storefront" });
    }
  });

  app.get("/api/users/:userId/storefront", async (req, res) => {
    try {
      const [user] = await db.select({
        id: users.id,
        displayName: users.displayName,
        firstName: users.firstName,
        profileImageUrl: users.profileImageUrl,
        bio: users.bio,
        website: users.website,
        city: users.city,
        country: users.country,
        favoriteCategories: users.favoriteCategories,
        storefrontBio: users.storefrontBio,
        storefrontBanner: users.storefrontBanner,
        storefrontTagline: users.storefrontTagline,
        verificationLevel: users.verificationLevel,
        sellerRating: users.sellerRating,
        reviewCount: users.reviewCount,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, req.params.userId)).limit(1);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch storefront" });
    }
  });

  app.patch("/api/profile/email-notifications", isAuthenticated, async (req: any, res) => {
    try {
      const { enabled, preferences } = req.body;
      const userId = req.user?.claims?.sub || req.user?.userId;

      if (preferences) {
        const validKeys = ["messages", "offers", "reviews", "orders", "marketing"];
        const sanitized: Record<string, boolean> = {};
        for (const key of validKeys) {
          if (key in preferences) sanitized[key] = !!preferences[key];
        }
        await authStorage.updateNotificationPreferences(userId, sanitized);
      }

      if (typeof enabled === "boolean") {
        await authStorage.updateEmailNotifications(userId, enabled);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Verification ────────────────────────────────────────────────────────────
  app.get("/api/verification/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const latestRequest = await storage.getVerificationStatus(userId);
      const verificationLevel = user?.verificationLevel || "unverified";
      const isGloballyVerified = verificationLevel === "id_verified" || verificationLevel === "trusted_seller";
      res.json({
        request: latestRequest || null,
        verificationLevel,
        isGloballyVerified,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/verification/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const allRequests = await db.select().from(verificationRequests)
        .where(eq(verificationRequests.userId, userId))
        .orderBy(desc(verificationRequests.createdAt));
      res.json(allRequests);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/verification/submit", isAuthenticated, upload.single("document"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listingId = req.body.listingId ? Number(req.body.listingId) : undefined;
      const user = await storage.getUser(userId);
      const isGloballyVerified = user?.verificationLevel === "id_verified" || user?.verificationLevel === "trusted_seller";

      if (listingId && isGloballyVerified) {
        const listing = await storage.getListing(listingId);
        if (!listing) return res.status(404).json({ message: "Listing not found" });
        if (listing.userId === userId) return res.status(400).json({ message: "Cannot verify for your own listing" });
        const existingApproved = await storage.getVerificationStatus(userId);
        const docUrl = existingApproved?.documentUrl || "/verified-user";
        const request = await storage.submitVerificationRequest(userId, docUrl, listingId, listing.userId);
        return res.status(201).json(request);
      }

      if (!req.file) return res.status(400).json({ message: "No document provided" });
      const documentUrl = `/uploads/${req.file.filename}`;
      let sellerId: string | undefined;
      if (listingId) {
        const listing = await storage.getListing(listingId);
        if (!listing) return res.status(404).json({ message: "Listing not found" });
        if (listing.userId === userId) return res.status(400).json({ message: "Cannot verify for your own listing" });
        sellerId = listing.userId;
      }
      const request = await storage.submitVerificationRequest(userId, documentUrl, listingId, sellerId);
      res.status(201).json(request);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/verification/listing/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const listingId = Number(req.params.listingId);
      const listing = await storage.getListing(listingId);
      const status = await storage.getListingVerificationStatus(req.user.claims.sub, listingId);
      if (status && listing?.isSold) {
        return res.json({ ...status, documentUrl: null, listingDeactivated: true });
      }
      res.json(status || null);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/verification/seller-requests", isAuthenticated, async (req: any, res) => {
    try {
      const requests = await storage.getVerificationRequestsForSeller(req.user.claims.sub);
      const enriched = await Promise.all(requests.map(async (r) => {
        const buyer = await storage.getUser(r.userId);
        const listing = r.listingId ? await storage.getListing(r.listingId) : null;
        const listingDeactivated = listing ? listing.isSold : false;
        return {
          ...r,
          documentUrl: listingDeactivated ? null : r.documentUrl,
          buyerName: buyer ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || buyer.email : 'Unknown',
          buyerEmail: buyer?.email || null,
          listingTitle: listing?.title || null,
          listingDeactivated,
        };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/verification/seller-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { status, sellerNote } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const allRequests = await storage.getVerificationRequestsForSeller(req.user.claims.sub);
      const request = allRequests.find(r => r.id === Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Verification request not found" });
      await storage.updateVerificationRequestStatus(Number(req.params.id), status, sellerNote);
      if (status === "approved") {
        const listing = request.listingId ? await storage.getListing(request.listingId) : null;
        const listingTitle = listing?.title || "your requested listing";
        await storage.createNotification({
          userId: request.userId,
          type: "verification_approved",
          title: "ID Verification Approved",
          body: request.listingId
            ? `Your ID has been verified for listing "${listingTitle}". You can now view the address.`
            : "Your ID has been verified by the seller.",
          link: request.listingId ? `/listing/${request.listingId}` : "/dashboard",
        });
        const messageContent = request.listingId
          ? `✅ Your ID has been verified! You can now view the full address for "${listingTitle}". View listing: /listing/${request.listingId}`
          : "✅ Your ID has been verified! You can now view the listing details.";
        await storage.sendMessage(req.user.claims.sub, {
          senderId: req.user.claims.sub,
          receiverId: request.userId,
          listingId: request.listingId || null,
          content: messageContent,
        });
      } else if (status === "rejected") {
        const listing = request.listingId ? await storage.getListing(request.listingId) : null;
        const listingTitle = listing?.title || "your requested listing";
        await storage.createNotification({
          userId: request.userId,
          type: "verification_rejected",
          title: "ID Verification Update",
          body: sellerNote
            ? `Your ID verification was not approved. Seller note: ${sellerNote}`
            : "Your ID verification was not approved. You may resubmit with a clearer document.",
          link: "/verify",
        });
        const rejectMessage = sellerNote
          ? `❌ Your ID verification for "${listingTitle}" was not approved. Note: ${sellerNote}. Feel free to reply here if you have any questions.`
          : `❌ Your ID verification for "${listingTitle}" was not approved. You may resubmit with a clearer document. Feel free to reply here if you have any questions.`;
        await storage.sendMessage(req.user.claims.sub, {
          senderId: req.user.claims.sub,
          receiverId: request.userId,
          listingId: request.listingId || null,
          content: rejectMessage,
        });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/verification/request-review/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const buyerId = req.user.claims.sub;
      const listingId = Number(req.params.listingId);
      const listing = await storage.getListing(listingId);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.userId === buyerId) return res.status(400).json({ message: "Cannot request review for your own listing" });
      if (listing.privacyLevel !== "verified") return res.status(400).json({ message: "This listing does not require verification" });

      const buyer = await storage.getUser(buyerId);
      const isGloballyVerified = buyer?.verificationLevel === "id_verified" || buyer?.verificationLevel === "trusted_seller";

      const existingRequest = await storage.getListingVerificationStatus(buyerId, listingId);
      if (existingRequest && existingRequest.status === "pending") {
        return res.status(400).json({ message: "You already have a pending review request for this listing." });
      }
      if (existingRequest && existingRequest.status === "approved") {
        return res.status(400).json({ message: "Your ID is already approved for this listing." });
      }

      let docUrl: string;
      if (isGloballyVerified) {
        const existingApproved = await storage.getVerificationStatus(buyerId);
        docUrl = existingApproved?.documentUrl || "/verified-user";
      } else {
        const buyerVerification = await storage.getVerificationStatus(buyerId);
        if (!buyerVerification || buyerVerification.status === "rejected") {
          return res.status(400).json({ message: "You must submit your ID first before requesting a review.", redirectTo: "/verify" });
        }
        docUrl = buyerVerification.documentUrl;
      }

      const buyerName = buyer ? `${buyer.firstName || ''}  ${buyer.lastName || ''}`.trim() || buyer.email : 'A buyer';

      await storage.submitVerificationRequest(buyerId, docUrl, listingId, listing.userId);

      await storage.createNotification({
        userId: listing.userId,
        type: "verification_request",
        title: "ID Review Request",
        body: `${buyerName} is requesting you review their ID to access your listing "${listing.title}".`,
        link: "/messages",
      });

      await storage.sendMessage(buyerId, {
        senderId: buyerId,
        receiverId: listing.userId,
        listingId: listingId,
        content: `🔒 Hi, I've submitted my ID for verification to view the address for "${listing.title}". Please review it when you get a chance! View listing: /listing/${listingId}`,
      });

      res.json({ success: true, message: "Review request sent to the seller." });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Google Places Autocomplete (proxy to keep API key secure) ──────────────
  app.get("/api/places/autocomplete", async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY_JAVA || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Google Places API key not configured" });
    const { input } = req.query as { input?: string };
    if (!input || input.length < 3) return res.json({ predictions: [] });
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", input);
      url.searchParams.set("types", "address");
      url.searchParams.set("key", apiKey);
      const response = await fetch(url.toString());
      const data = await response.json() as any;
      res.json({ predictions: (data.predictions || []).map((p: any) => ({ description: p.description, placeId: p.place_id })) });
    } catch {
      res.json({ predictions: [] });
    }
  });

  app.get("/api/places/details", async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY_JAVA || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Google Places API key not configured" });
    const { placeId } = req.query as { placeId?: string };
    if (!placeId) return res.status(400).json({ message: "placeId required" });
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "formatted_address,geometry,address_components");
      url.searchParams.set("key", apiKey);
      const response = await fetch(url.toString());
      const data = await response.json() as any;
      const result = data.result || {};
      const components = result.address_components || [];
      const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || "";
      res.json({
        formattedAddress: result.formatted_address || "",
        lat: result.geometry?.location?.lat,
        lng: result.geometry?.location?.lng,
        city: getComp("locality") || getComp("sublocality") || getComp("administrative_area_level_2"),
        country: getComp("country"),
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch place details" });
    }
  });

  // ─── Google Maps API Key (for frontend map) ─────────────────────────────────
  app.get("/api/maps/key", (_req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY_JAVA || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: "Google Maps API key not configured" });
    }
    res.json({ key: apiKey });
  });

  // ─── Nearby Shops ────────────────────────────────────────────────────────────
  // Primary source is Google Places (rich data: ratings, photos, hours). When the
  // Google key is missing or the API errors/returns nothing, we transparently fall
  // back to OpenStreetMap's Overpass API, which is FREE and needs no key. Overpass
  // covers exactly the store types users want: charity/donation shops (Salvation
  // Army, Value Village, Goodwill), second-hand stores, and variety/discount
  // "bin" stores (Krazy Binz and similar). This guarantees stores always show.

  // Map a UI category keyword (e.g. "donation center", "discount shop") to the
  // set of OpenStreetMap `shop=*` tag values we should query for.
  const osmShopTagsForCategory = (q?: string): string[] => {
    const s = (q || "").toLowerCase();
    if (s.includes("donation") || s.includes("charity")) return ["charity"];
    if (s.includes("discount") || s.includes("variety") || s.includes("dollar") || s.includes("bin")) return ["variety_store"];
    if (s.includes("thrift") || s.includes("used") || s.includes("second")) return ["second_hand", "charity"];
    return ["charity", "second_hand", "variety_store"]; // "All"
  };

  // Overpass is a shared, free, heavily rate-limited public service. To stay a
  // good citizen (and to keep stores loading fast even under load) we:
  //   1) cache results in-memory per rounded location/radius/category, and
  //   2) try several public Overpass mirrors in turn if one is busy (HTTP 429)
  //      or unreachable. A descriptive User-Agent is required etiquette.
  const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  const OVERPASS_UA = "YARDEES/1.0 (https://www.yardees.net)";
  const OVERPASS_TTL = 15 * 60 * 1000; // 15 minutes
  const overpassCache = new Map<string, { ts: number; data: any[] }>();

  // Query OpenStreetMap Overpass for second-hand / charity / discount stores near
  // a point. Returns the same shape the frontend already expects from Google.
  const fetchOverpassShops = async (lat: number, lon: number, radius: number, query?: string) => {
    const tags = osmShopTagsForCategory(query);

    // Serve a cached response when we have a recent one for ~the same spot.
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)},${radius},${tags.join("+")}`;
    const cached = overpassCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < OVERPASS_TTL) return cached.data;
    const around = `around:${radius},${lat},${lon}`;
    const clauses: string[] = [];
    for (const tag of tags) {
      clauses.push(`node["shop"="${tag}"](${around});`);
      clauses.push(`way["shop"="${tag}"](${around});`);
    }
    // Also include regular clothing stores explicitly flagged as second-hand.
    if (tags.includes("second_hand")) {
      clauses.push(`node["shop"="clothes"]["second_hand"~"yes|only"](${around});`);
      clauses.push(`way["shop"="clothes"]["second_hand"~"yes|only"](${around});`);
    }
    const ql = `[out:json][timeout:25];(${clauses.join("")});out center 80;`;

    // Try each mirror until one responds successfully (handles 429 rate limits
    // and transient outages on any single endpoint).
    let data: any = null;
    let lastStatus = 0;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": OVERPASS_UA,
          },
          body: "data=" + encodeURIComponent(ql),
          // Cap each mirror so one hanging endpoint can't stall the whole request.
          signal: AbortSignal.timeout(9000),
        });
        if (!response.ok) {
          lastStatus = response.status;
          continue; // busy/blocked → try the next mirror
        }
        data = await response.json();
        break;
      } catch {
        continue; // network error → try the next mirror
      }
    }
    if (!data) throw new Error(`All Overpass mirrors failed (last status ${lastStatus})`);

    const toRad = (d: number) => (d * Math.PI) / 180;
    const distanceMeters = (la: number, lo: number) => {
      const R = 6371000;
      const dLa = toRad(la - lat);
      const dLo = toRad(lo - lon);
      const a = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(la)) * Math.sin(dLo / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };

    const labelFor = (shop: string) =>
      shop === "charity" ? "Charity / Thrift Shop"
      : shop === "variety_store" ? "Variety / Discount Store"
      : "Second-hand Store";

    const seen = new Set<string>();
    const mapped = (data.elements || [])
      .map((el: any) => {
        const tg = el.tags || {};
        const elat = el.lat ?? el.center?.lat;
        const elon = el.lon ?? el.center?.lon;
        if (elat == null || elon == null) return null;
        const name = tg.name || tg.brand || labelFor(tg.shop);
        const addrParts = [
          [tg["addr:housenumber"], tg["addr:street"]].filter(Boolean).join(" "),
          tg["addr:city"],
          tg["addr:postcode"],
        ].filter(Boolean);
        const address = addrParts.join(", ") || tg["addr:full"] || "";
        // OpenStreetMap occasionally carries a photo: either a Wikimedia Commons
        // file name or a direct image URL hosted on Wikimedia. We only accept
        // Wikimedia-hosted images so the photo always loads under our strict
        // Content-Security-Policy (arbitrary third-party hosts would be blocked).
        let photoUrl: string | null = null;
        const commons = tg["wikimedia_commons"];
        if (commons && /^File:/i.test(commons)) {
          photoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons.replace(/^File:/i, ""))}?width=400`;
        } else if (tg.image && /^https?:\/\/(upload|commons)\.wikimedia\.org\//i.test(tg.image)) {
          photoUrl = tg.image;
        }
        return {
          id: `osm:${el.type}:${el.id}`,
          name,
          address,
          rating: undefined,
          userRatingsTotal: undefined,
          types: [tg.shop].filter(Boolean),
          isOpen: undefined,
          photoRef: null,
          photoUrl,
          website: tg.website || tg["contact:website"] || null,
          phone: tg.phone || tg["contact:phone"] || null,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`.trim() || `${elat},${elon}`)}`,
          location: { lat: elat, lng: elon },
          source: "osm",
          _dist: distanceMeters(elat, elon),
        };
      })
      .filter(Boolean)
      // De-duplicate stores that appear as both a node and a way (~same spot).
      .filter((it: any) => {
        const key = `${it.name}|${Math.round(it._dist / 50)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: any, b: any) => a._dist - b._dist)
      .slice(0, 60)
      .map(({ _dist, ...rest }: any) => rest);

    overpassCache.set(cacheKey, { ts: Date.now(), data: mapped });
    return mapped;
  };

  app.get("/api/shops/nearby", async (req, res) => {
    const { lat, lon, query, radius } = req.query as { lat?: string; lon?: string; query?: string; radius?: string };
    if (!lat || !lon) return res.status(400).json({ message: "lat and lon are required" });

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      return res.status(400).json({ message: "lat and lon must be valid numbers" });
    }
    const searchRadius = Math.min(Math.max(parseInt(radius || "10000", 10) || 10000, 1000), 50000);

    const apiKey = process.env.GOOGLE_API_KEY_JAVA || process.env.GOOGLE_PLACES_API_KEY;

    // 1) Try Google Places first (when a key is configured).
    if (apiKey) {
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        url.searchParams.set("location", `${latNum},${lonNum}`);
        url.searchParams.set("radius", String(searchRadius));
        url.searchParams.set("keyword", query || "thrift store discount shop used goods donation center");
        url.searchParams.set("type", "store");
        url.searchParams.set("key", apiKey);

        const response = await fetch(url.toString());
        const data: any = await response.json();
        const results = (data.status === "OK" ? data.results || [] : []).map((place: any) => ({
          id: place.place_id,
          name: place.name,
          address: place.vicinity,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          types: place.types,
          isOpen: place.opening_hours?.open_now,
          photoRef: place.photos?.[0]?.photo_reference || null,
          photoUrl: null,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`,
          location: place.geometry?.location,
          source: "google",
        }));

        // Only return Google data when it actually produced stores; otherwise fall
        // through to the free OpenStreetMap source so the user still sees results.
        if (results.length > 0) return res.json(results);
      } catch {
        // Network/parse error → fall through to Overpass.
      }
    }

    // 2) Keyless OpenStreetMap fallback (works even if Google billing/key is down).
    try {
      const osmResults = await fetchOverpassShops(latNum, lonNum, searchRadius, query);
      return res.json(osmResults);
    } catch (err) {
      // Every source is temporarily unavailable (e.g. all Overpass mirrors busy).
      // Return an empty list (200) so the UI shows a friendly "no shops found"
      // state and can retry, instead of a hard error.
      return res.json([]);
    }
  });

  app.get("/api/shops/details/:placeId", async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY_JAVA || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(503).json({ message: "Not configured" });
    try {
      const { placeId } = req.params;
      if (!placeId || placeId.length > 300) return res.status(400).json({ message: "Invalid place ID" });
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "name,formatted_address,formatted_phone_number,website,opening_hours,rating,user_ratings_total,reviews,photos,geometry,types,url,price_level,business_status");
      url.searchParams.set("key", apiKey);
      const response = await fetch(url.toString());
      const data: any = await response.json();
      if (data.status !== "OK") return res.status(502).json({ message: `Google API error: ${data.status}` });
      const p = data.result;
      res.json({
        id: placeId,
        name: p.name,
        address: p.formatted_address,
        phone: p.formatted_phone_number || null,
        website: p.website || null,
        rating: p.rating,
        userRatingsTotal: p.user_ratings_total,
        hours: p.opening_hours?.weekday_text || null,
        isOpen: p.opening_hours?.open_now,
        photos: (p.photos || []).slice(0, 6).map((ph: any) => ph.photo_reference),
        mapsUrl: p.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}&query_place_id=${placeId}`,
        location: p.geometry?.location,
        types: p.types || [],
        priceLevel: p.price_level,
        businessStatus: p.business_status,
        reviews: (p.reviews || []).slice(0, 5).map((r: any) => ({
          author: r.author_name,
          rating: r.rating,
          text: r.text,
          time: r.relative_time_description,
          profilePhoto: r.profile_photo_url,
        })),
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch shop details" });
    }
  });

  app.get("/api/shops/photo/:photoRef", async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY_JAVA || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(503).send("Not configured");
    try {
      const photoRef = req.params.photoRef;
      if (!photoRef || photoRef.length > 2000) return res.status(400).send("Invalid ref");
      const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) return res.status(502).send("Photo unavailable");
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch {
      res.status(500).send("Failed to fetch photo");
    }
  });

  // ─── Mark as Sold ────────────────────────────────────────────────────────────
  app.patch("/api/listings/:id/sold", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { isSold } = req.body;
      const listing = await storage.markSold(Number(req.params.id), userId, !!isSold);
      if (isSold && listing) {
        sendListingSoldNotification(listing.userId, listing.title, listing.id).catch(() => {});
        storage.createNotification({
          userId: listing.userId,
          type: "listing_sold",
          title: "Item Sold!",
          body: `Your listing "${listing.title}" has been marked as sold. Congratulations!`,
          link: `/listing/${listing.id}`,
        }).catch(() => {});
        awardLoyaltyPoints(listing.userId, "listing_sold", `Sold listing: "${listing.title}"`, `sold_listing_${listing.id}`);
      }
      res.json(listing);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/listings/:id/renew", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const listing = await storage.renewListing(Number(req.params.id), userId);
      res.json(listing);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Seller Profile ──────────────────────────────────────────────────────────
  app.get("/api/seller/:userId/listings", async (req, res) => {
    try {
      const items = await storage.getListings({ userId: req.params.userId });
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Reports ─────────────────────────────────────────────────────────────────
  app.post("/api/listings/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const { insertReportSchema } = await import("@shared/schema");
      const reporterId = req.user.claims.sub;
      const data = insertReportSchema.parse({ ...req.body, listingId: Number(req.params.id) });
      const report = await storage.reportListing(reporterId, data);
      res.status(201).json(report);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Wallet / Payouts ──────────────────────────────────────────────────────────
  app.get("/api/wallet/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const releasedOrders = await db.select({
        sellerPayout: orders.sellerPayout,
        currency: orders.currency,
      }).from(orders).where(and(
        eq(orders.sellerId, userId),
        eq(orders.escrowStatus, "released")
      ));

      const totalEarnings = releasedOrders.reduce((sum, o) => sum + (o.sellerPayout || 0), 0);

      const completedPayouts = await db.select({
        amount: payouts.amount,
      }).from(payouts).where(and(
        eq(payouts.userId, userId),
        eq(payouts.status, "completed")
      ));
      const totalWithdrawn = completedPayouts.reduce((sum, p) => sum + p.amount, 0);

      const pendingPayouts = await db.select({
        amount: payouts.amount,
      }).from(payouts).where(and(
        eq(payouts.userId, userId),
        or(eq(payouts.status, "pending"), eq(payouts.status, "processing"))
      ));
      const pendingWithdrawal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

      const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawal;
      const currency = releasedOrders.length > 0 ? releasedOrders[0].currency : "USD";

      res.json({
        totalEarnings,
        totalWithdrawn,
        pendingWithdrawal,
        availableBalance,
        currency,
        orderCount: releasedOrders.length,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/wallet/payouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userPayouts = await db.select().from(payouts)
        .where(eq(payouts.userId, userId))
        .orderBy(desc(payouts.createdAt));
      res.json(userPayouts);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/wallet/withdraw", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, bankName, accountHolderName, accountLastFour, accountNumber, accountType, routingNumber, swiftCode, bankAddress, paymentMethod, paypalEmail } = req.body;

      const allowedMethods = ["bank_transfer", "wire_transfer", "paypal"];
      if (!paymentMethod || !allowedMethods.includes(paymentMethod)) {
        return res.status(400).json({ message: "Invalid payment method. Choose bank_transfer, wire_transfer, or paypal." });
      }
      if (!amount || amount < 500) {
        return res.status(400).json({ message: "Minimum withdrawal amount is $5.00" });
      }
      if (paymentMethod === "paypal") {
        if (!paypalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
          return res.status(400).json({ message: "A valid PayPal email address is required" });
        }
      } else if (paymentMethod === "bank_transfer") {
        if (!accountHolderName || !accountNumber || !bankName || !routingNumber) {
          return res.status(400).json({ message: "Account holder name, bank name, account number, and routing number are all required for bank transfers" });
        }
        if (accountType && !["checking", "savings"].includes(accountType)) {
          return res.status(400).json({ message: "Account type must be 'checking' or 'savings'" });
        }
      } else if (paymentMethod === "wire_transfer") {
        if (!accountHolderName || !accountNumber || !bankName || !swiftCode) {
          return res.status(400).json({ message: "Account holder name, bank name, account number, and SWIFT/BIC code are all required for wire transfers" });
        }
      }

      const result = await db.transaction(async (tx) => {
        const releasedOrders = await tx.select({ sellerPayout: orders.sellerPayout })
          .from(orders).where(and(eq(orders.sellerId, userId), eq(orders.escrowStatus, "released")));
        const totalEarnings = releasedOrders.reduce((sum, o) => sum + (o.sellerPayout || 0), 0);

        const completedPayouts = await tx.select({ amount: payouts.amount })
          .from(payouts).where(and(eq(payouts.userId, userId), eq(payouts.status, "completed")));
        const totalWithdrawn = completedPayouts.reduce((sum, p) => sum + p.amount, 0);

        const pendingPayouts = await tx.select({ amount: payouts.amount })
          .from(payouts).where(and(eq(payouts.userId, userId), or(eq(payouts.status, "pending"), eq(payouts.status, "processing"))));
        const pendingWithdrawal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

        const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawal;

        if (amount > availableBalance) {
          throw new Error("Insufficient balance for this withdrawal");
        }

        const isBank = paymentMethod !== "paypal";
        const derivedLastFour = accountNumber ? accountNumber.slice(-4) : (accountLastFour || null);
        const [payout] = await tx.insert(payouts).values({
          userId,
          amount,
          currency: "USD",
          bankName: isBank ? (bankName || null) : null,
          accountHolderName: isBank ? accountHolderName : null,
          accountLastFour: isBank ? derivedLastFour : null,
          accountNumber: isBank ? (accountNumber || null) : null,
          accountType: isBank ? (accountType || null) : null,
          routingNumber: isBank ? (routingNumber || null) : null,
          swiftCode: isBank ? (swiftCode || null) : null,
          bankAddress: isBank ? (bankAddress || null) : null,
          paypalEmail: paymentMethod === "paypal" ? paypalEmail : null,
          paymentMethod: paymentMethod || "bank_transfer",
        }).returning();
        return payout;
      });

      const payout = result;

      storage.createNotification({
        userId,
        type: "order_update",
        title: "Withdrawal Requested",
        body: `Your withdrawal of $${(amount / 100).toFixed(2)} has been submitted and is being reviewed.`,
        link: "/wallet",
      }).catch(() => {});

      const adminUserIds = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
      for (const adminId of adminUserIds) {
        storage.createNotification({
          userId: adminId,
          type: "order_update",
          title: "New Payout Request",
          body: `A seller has requested a withdrawal of $${(amount / 100).toFixed(2)}.`,
          link: "/admin",
        }).catch(() => {});
      }

      res.status(201).json(payout);
    } catch (err: any) {
      if (err.message === "Insufficient balance for this withdrawal") {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/payouts", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const allPayouts = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
      const enriched = await Promise.all(allPayouts.map(async (p) => {
        const user = await authStorage.getUser(p.userId).catch(() => null);
        return {
          ...p,
          username: user?.displayName || user?.firstName || "Unknown",
          email: user?.email || null,
        };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/payouts/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const payoutId = Number(req.params.id);
      const { status, adminNote } = req.body;
      if (!["processing", "completed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const validTransitions: Record<string, string[]> = {
        pending: ["processing", "completed", "rejected"],
        processing: ["completed", "rejected"],
      };

      const [existing] = await db.select({ status: payouts.status }).from(payouts).where(eq(payouts.id, payoutId));
      if (!existing) return res.status(404).json({ message: "Payout not found" });

      const allowed = validTransitions[existing.status];
      if (!allowed || !allowed.includes(status)) {
        return res.status(400).json({ message: `Cannot change status from '${existing.status}' to '${status}'` });
      }

      const updates: any = { status, adminNote: adminNote || null };
      if (status === "completed" || status === "rejected") {
        updates.processedAt = new Date();
      }

      const [updated] = await db.update(payouts).set(updates)
        .where(eq(payouts.id, payoutId)).returning();
      if (!updated) return res.status(404).json({ message: "Payout not found" });

      const methodLabel = updated.paymentMethod === "paypal" ? "PayPal account" : "bank account";
      const statusText = status === "completed" ? `processed and sent to your ${methodLabel}`
        : status === "rejected" ? "rejected" : "being processed";
      storage.createNotification({
        userId: updated.userId,
        type: "order_update",
        title: status === "completed" ? "Payout Sent!" : status === "rejected" ? "Payout Rejected" : "Payout Processing",
        body: `Your withdrawal of $${(updated.amount / 100).toFixed(2)} has been ${statusText}.${adminNote ? ` Note: ${adminNote}` : ""}`,
        link: "/wallet",
      }).catch(() => {});

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Admin ────────────────────────────────────────────────────────────────────
  const ADMIN_TOKEN_TTL = 24 * 60 * 60 * 1000;
  const adminTokens = new Map<string, number>();

  function cleanExpiredTokens() {
    const now = Date.now();
    for (const [token, expiresAt] of adminTokens) {
      if (now > expiresAt) adminTokens.delete(token);
    }
  }
  setInterval(cleanExpiredTokens, 60 * 60 * 1000);

  const isAdmin = (req: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const expiresAt = adminTokens.get(token);
      if (expiresAt && Date.now() < expiresAt) return true;
      if (expiresAt) adminTokens.delete(token);
    }
    if ((req.session as any)?.adminAuthed) return true;
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
    if (adminIds.length === 0) return false;
    const userId = req.user?.claims?.sub;
    return !!userId && adminIds.includes(userId);
  };

  async function getAdminPasswordHash(): Promise<string | null> {
    try {
      const result = await db.execute(sql`SELECT value FROM admin_settings WHERE key = 'admin_password_hash'`);
      const rows = result.rows as any[];
      return rows.length > 0 ? rows[0].value : null;
    } catch { return null; }
  }

  async function setAdminPasswordHash(hash: string): Promise<void> {
    await db.execute(sql`INSERT INTO admin_settings (key, value, updated_at) VALUES ('admin_password_hash', ${hash}, NOW()) ON CONFLICT (key) DO UPDATE SET value = ${hash}, updated_at = NOW()`);
  }

  app.get("/api/admin/password-status", async (_req, res) => {
    const hash = await getAdminPasswordHash();
    res.json({ hasPassword: hash !== null });
  });

  app.post("/api/admin/login", authLimiter, async (req: any, res) => {
    const { password } = req.body;
    const hash = await getAdminPasswordHash();

    if (hash === null) {
      const token = crypto.randomBytes(32).toString("hex");
      adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL);
      (req.session as any).adminAuthed = true;
      req.session.save((err: any) => {
        if (err) console.log("[admin] Session save warning:", err);
        res.json({ success: true, token, noPassword: true });
      });
      return;
    }

    const match = await bcrypt.compare(password || "", hash);
    if (match) {
      const token = crypto.randomBytes(32).toString("hex");
      adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL);
      (req.session as any).adminAuthed = true;
      req.session.save((err: any) => {
        if (err) console.log("[admin] Session save warning:", err);
        res.json({ success: true, token });
      });
    } else {
      res.status(401).json({ message: "Incorrect password" });
    }
  });

  app.post("/api/admin/set-password", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
      const hash = await bcrypt.hash(newPassword, 10);
      await setAdminPasswordHash(hash);
      console.log("[admin] Admin password set successfully");
      res.json({ success: true });
    } catch (err) {
      console.error("Admin set password error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/admin/change-password", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { currentPassword, newPassword } = req.body;
      const existingHash = await getAdminPasswordHash();
      if (existingHash) {
        const match = await bcrypt.compare(currentPassword || "", existingHash);
        if (!match) return res.status(401).json({ message: "Current password is incorrect" });
      }
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });
      const hash = await bcrypt.hash(newPassword, 10);
      await setAdminPasswordHash(hash);
      adminTokens.clear();
      const token = crypto.randomBytes(32).toString("hex");
      adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL);
      console.log("[admin] Admin password changed successfully");
      res.json({ success: true, token });
    } catch (err) {
      console.error("Admin password change error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/admin/logout", async (req: any, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      adminTokens.delete(authHeader.slice(7));
    }
    (req.session as any).adminAuthed = false;
    req.session.save(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/admin/check", async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const sessionAuthed = !!req.user?.claims?.sub;
    const passwordAuthed = !!(req.session as any)?.adminAuthed;
    const tokenAuthed = !!(req.headers.authorization?.startsWith("Bearer ") && adminTokens.has(req.headers.authorization.slice(7)));
    res.json({ isAdmin: isAdmin(req), sessionAuthed, passwordAuthed: passwordAuthed || tokenAuthed });
  });

  app.get("/api/admin/verifications", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const verifications = await storage.getAllVerifications();
      const enriched = await Promise.all(verifications.map(async (v) => {
        const user = await authStorage.getUser(v.userId).catch(() => null);
        const fullUser = await storage.getUser(v.userId);
        return {
          ...v,
          username: user?.displayName || user?.firstName || "Unknown",
          profileImageUrl: user?.profileImageUrl || null,
          email: user?.email || null,
          verificationLevel: fullUser?.verificationLevel || "unverified",
        };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/verifications/user/:userId", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const userId = req.params.userId;
      const user = await storage.getUser(userId);
      const authUser = await authStorage.getUser(userId).catch(() => null);
      const allRequests = await db.select().from(verificationRequests)
        .where(eq(verificationRequests.userId, userId))
        .orderBy(desc(verificationRequests.createdAt));
      res.json({
        user: {
          id: userId,
          username: authUser?.displayName || authUser?.firstName || "Unknown",
          email: authUser?.email || null,
          verificationLevel: user?.verificationLevel || "unverified",
          profileImageUrl: user?.profileImageUrl || null,
        },
        requests: allRequests,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/verifications/:id", async (req: any, res) => {
    if (!isAdmin(req)) {
      console.log("[admin] PATCH verification denied - session adminAuthed:", (req.session as any)?.adminAuthed, "user:", req.user?.claims?.sub);
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { status, adminNote, expiryDate } = req.body;
      if (!["approved", "rejected", "pending", "expired"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const verifications = await storage.getAllVerifications();
      const verification = verifications.find(v => v.id === Number(req.params.id));
      if (!verification) return res.status(404).json({ message: "Verification not found" });
      const parsedExpiry = expiryDate ? new Date(expiryDate) : undefined;
      await storage.updateVerificationStatus(Number(req.params.id), status, adminNote || undefined, parsedExpiry);
      if (status === "approved") {
        await storage.updateUserVerificationLevel(verification.userId, "id_verified");
        const expiryMsg = parsedExpiry ? ` Your verification expires on ${parsedExpiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. You'll need to re-verify before then.` : '';
        console.log(`[admin] Verification #${req.params.id} approved for user ${verification.userId} — set to id_verified${parsedExpiry ? `, expires ${parsedExpiry.toISOString()}` : ''}`);
        sendVerificationStatusEmail(verification.userId, "approved").catch(() => {});
        storage.createNotification({
          userId: verification.userId,
          type: "verification_approved",
          title: "Identity Verified! 🎉",
          body: `Congratulations! Your identity has been verified. You now have a verified badge on your profile!${expiryMsg}`,
          link: "/dashboard",
        }).catch(() => {});
      } else if (status === "rejected") {
        await storage.updateUserVerificationLevel(verification.userId, "unverified");
        console.log(`[admin] Verification #${req.params.id} rejected for user ${verification.userId}`);
        sendVerificationStatusEmail(verification.userId, "rejected").catch(() => {});
        storage.createNotification({
          userId: verification.userId,
          type: "verification_rejected",
          title: "Verification Update",
          body: "Your verification request was not approved. Please review the requirements and try again.",
          link: "/verify",
        }).catch(() => {});
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[admin] Verification update error:", err.message);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/reports", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const reports = await storage.getReports();
      res.json(reports);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/reports/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { status, response } = req.body;
      if (!["dismissed", "removed", "pending"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const allReports = await storage.getReports();
      const report = allReports.find(r => r.id === Number(req.params.id));
      if (!report) return res.status(404).json({ message: "Report not found" });
      await storage.updateReportStatus(Number(req.params.id), status, response || undefined);

      if (report && (status === "dismissed" || status === "removed")) {
        const listingTitle = report.listing?.title || "a listing";
        let notifBody = `Your report on "${listingTitle}" has been ${status}.`;
        if (response) notifBody += ` Admin note: ${response}`;
        storage.createNotification({
          userId: report.reporterId,
          type: "report_resolved",
          title: "Your report has been reviewed",
          body: notifBody,
          link: report.listing ? `/listing/${report.listingId}` : undefined,
        }).catch(() => {});
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/users", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers.map(u => ({ ...u, passwordHash: undefined })));
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/users/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { firstName, lastName, email, verificationLevel, bio, city, country } = req.body;
      const updates: Record<string, any> = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (verificationLevel !== undefined) updates.verificationLevel = verificationLevel;
      if (bio !== undefined) updates.bio = bio;
      if (city !== undefined) updates.city = city;
      if (country !== undefined) updates.country = country;
      updates.updatedAt = new Date();
      await db.update(users).set(updates).where(eq(users.id, req.params.id));
      const [updated] = await db.select().from(users).where(eq(users.id, req.params.id));
      res.json({ ...updated, passwordHash: undefined });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/admin/users/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      await db.delete(users).where(eq(users.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ---------------------------------------------------------------------------
  // Self-service account deletion (REQUIRED by Apple App Store Guideline 5.1.1(v)
  // for any app that lets users create an account).
  //
  // This endpoint:
  //   1. Refuses deletion if the user has in-flight orders or open disputes
  //      where another party has financial stake (prevents losing the other
  //      party's records mid-transaction).
  //   2. Inside a single DB transaction, deletes all rows owned by or
  //      referencing this user across every relevant table. The schema has
  //      no FK constraints, so cascade is performed manually here.
  //   3. Deletes the user row last.
  //   4. Destroys the session so the cookie is invalid going forward.
  // ---------------------------------------------------------------------------
  app.delete("/api/account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // 1. Block if user has active orders (money in motion). Completed
      // (delivered+released), cancelled, or refunded orders are fine to delete.
      const activeStatuses = ["pending", "paid", "shipped", "disputed"];
      const openOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            or(eq(orders.buyerId, userId), eq(orders.sellerId, userId)),
            sql`${orders.status} = ANY(${activeStatuses})`
          )
        );
      if (openOrders.length > 0) {
        return res.status(409).json({
          message:
            "You have active orders or disputes. Please resolve them (complete delivery, confirm refund, or contact support) before deleting your account.",
          activeOrderCount: openOrders.length,
        });
      }

      // 2. Transactional cascade across every user-linked table.
      // Tables without an imported drizzle binding use raw SQL.
      await db.transaction(async (tx) => {
        // Listings owned by user (also auto-removes from search indexes)
        await tx.delete(listings).where(eq(listings.userId, userId));

        // Messages where user is sender OR receiver
        await tx.execute(
          sql`DELETE FROM messages WHERE sender_id = ${userId} OR receiver_id = ${userId}`
        );

        // Favorites / saved searches / wishlists (all user-owned)
        await tx.delete(favorites).where(eq(favorites.userId, userId));
        await tx.execute(sql`DELETE FROM saved_searches WHERE user_id = ${userId}`);
        await tx.delete(wishlists).where(eq(wishlists.userId, userId));

        // Reports filed BY user (reports filed AGAINST user stay for moderation history)
        await tx.execute(sql`DELETE FROM reports WHERE reporter_id = ${userId}`);

        // Shop suggestions
        await tx.execute(sql`DELETE FROM shop_suggestions WHERE user_id = ${userId}`);

        // Verification requests (user or seller)
        await tx.execute(
          sql`DELETE FROM verification_requests WHERE user_id = ${userId} OR seller_id = ${userId}`
        );

        // Reviews user wrote (reviews ABOUT user are deleted too — they reference
        // a now-nonexistent seller and would orphan in the UI)
        await tx.execute(
          sql`DELETE FROM reviews WHERE reviewer_id = ${userId} OR seller_id = ${userId}`
        );

        // Events & RSVPs & participants
        await tx.delete(events).where(eq(events.userId, userId));
        await tx.execute(sql`DELETE FROM event_rsvps WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM event_participants WHERE user_id = ${userId}`);

        // Offers (user as buyer or seller). Safe because we already blocked
        // active orders; any remaining offers are stale/closed.
        await tx.delete(offers).where(or(eq(offers.buyerId, userId), eq(offers.sellerId, userId)));

        // Completed/cancelled orders + their dispute messages
        const userOrders = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId)));
        for (const o of userOrders) {
          await tx.delete(disputeMessages).where(eq(disputeMessages.orderId, o.id));
        }
        await tx.delete(orders).where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId)));

        // Referrals (user as referrer or referred)
        await tx.execute(
          sql`DELETE FROM referrals WHERE referrer_id = ${userId} OR referred_user_id = ${userId}`
        );

        // Notifications
        await tx.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);

        // Loyalty
        await tx.delete(loyaltyPoints).where(eq(loyaltyPoints.userId, userId));
        await tx.delete(loyaltyTransactions).where(eq(loyaltyTransactions.userId, userId));

        // Auctions & bids
        await tx.execute(sql`DELETE FROM bids WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM auctions WHERE seller_id = ${userId}`);

        // Neighborhood events
        await tx
          .delete(neighborhoodParticipants)
          .where(eq(neighborhoodParticipants.userId, userId));
        await tx.execute(sql`DELETE FROM neighborhood_events WHERE organizer_id = ${userId}`);

        // Community tips & votes
        await tx.delete(communityTips).where(eq(communityTips.userId, userId));
        await tx.delete(tipVotes).where(eq(tipVotes.userId, userId));

        // Payouts (financial history — also goes since user is leaving)
        await tx.delete(payouts).where(eq(payouts.userId, userId));

        // Listing analytics rows referencing this user's listings are already
        // gone (FK by listingId, listings already deleted above).

        // 3. Finally the user row itself.
        await tx.delete(users).where(eq(users.id, userId));
      });

      // 4. Destroy session.
      req.logout?.((err: any) => {
        if (err) console.error("logout after account delete failed:", err);
        req.session?.destroy?.(() => {
          res.clearCookie("connect.sid");
          res.json({ success: true, message: "Account deleted" });
        });
      });
    } catch (err) {
      console.error("DELETE /api/account failed:", err);
      res
        .status(500)
        .json({ message: "Failed to delete account. Please contact support@yardees.net." });
    }
  });

  app.get("/api/admin/listings", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string || undefined;
      const result = await storage.getListingsPaginated({ includeSold: true, includeExpired: true, search, limit, offset });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/admin/listings/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { listings, favorites, messages, reports: reportsTable, offers, shippingOptions } = await import("@shared/schema");
      const listingId = Number(req.params.id);
      await db.delete(favorites).where(eq(favorites.listingId, listingId)).catch(() => {});
      await db.delete(messages).where(eq(messages.listingId, listingId)).catch(() => {});
      await db.delete(reportsTable).where(eq(reportsTable.listingId, listingId)).catch(() => {});
      await db.delete(offers).where(eq(offers.listingId, listingId)).catch(() => {});
      await db.delete(shippingOptions).where(eq(shippingOptions.listingId, listingId)).catch(() => {});
      await db.delete(listings).where(eq(listings.id, listingId));
      res.json({ success: true });
    } catch (err) {
      console.error("Admin delete listing error:", err);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });

  app.get("/api/admin/stats", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { listings, reports: reportsTable, verificationRequests } = await import("@shared/schema");
      const [userCount] = await db.select({ total: count() }).from(users);
      const [listingCount] = await db.select({ total: count() }).from(listings);
      const [activeCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isSold, false));
      const [soldCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isSold, true));
      const [shopCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isShop, true));
      const [pendingReportCount] = await db.select({ total: count() }).from(reportsTable).where(eq(reportsTable.status, "pending"));
      const [totalReportCount] = await db.select({ total: count() }).from(reportsTable);
      const [pendingVerifCount] = await db.select({ total: count() }).from(verificationRequests).where(eq(verificationRequests.status, "pending"));
      const [totalVerifCount] = await db.select({ total: count() }).from(verificationRequests);
      res.json({
        totalUsers: userCount?.total || 0,
        totalListings: listingCount?.total || 0,
        activeListings: activeCount?.total || 0,
        soldListings: soldCount?.total || 0,
        shopListings: shopCount?.total || 0,
        pendingReports: pendingReportCount?.total || 0,
        pendingVerifications: pendingVerifCount?.total || 0,
        totalReports: totalReportCount?.total || 0,
        totalVerifications: totalVerifCount?.total || 0,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/analytics", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const newUsersPerDay = await db.select({
        date: sql<string>`DATE(${users.createdAt})`.as('date'),
        count: count(),
      }).from(users)
        .where(gte(users.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`);

      const newListingsPerDay = await db.select({
        date: sql<string>`DATE(${listings.createdAt})`.as('date'),
        count: count(),
      }).from(listings)
        .where(gte(listings.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${listings.createdAt})`)
        .orderBy(sql`DATE(${listings.createdAt})`);

      const [usersBeforeWindow] = await db.select({ total: count() }).from(users)
        .where(lt(users.createdAt, thirtyDaysAgo));
      const userBaseline = usersBeforeWindow?.total || 0;

      const dailyUserGrowth = await db.select({
        date: sql<string>`DATE(${users.createdAt})`.as('date'),
        count: count(),
      }).from(users)
        .where(gte(users.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${users.createdAt})`)
        .orderBy(sql`DATE(${users.createdAt})`);

      let userRunning = userBaseline;
      const dailyUserGrowthWithCumulative = dailyUserGrowth.map(d => {
        userRunning += d.count;
        return { date: d.date, count: d.count, cumulative: userRunning };
      });

      const [listingsBeforeWindow] = await db.select({ total: count() }).from(listings)
        .where(lt(listings.createdAt, thirtyDaysAgo));
      const listingBaseline = listingsBeforeWindow?.total || 0;

      const dailyListingGrowth = await db.select({
        date: sql<string>`DATE(${listings.createdAt})`.as('date'),
        count: count(),
      }).from(listings)
        .where(gte(listings.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${listings.createdAt})`)
        .orderBy(sql`DATE(${listings.createdAt})`);

      const categoryBreakdown = await db.select({
        category: listings.category,
        count: count(),
      }).from(listings)
        .groupBy(listings.category)
        .orderBy(desc(count()));

      const cityDistribution = await db.select({
        city: listings.city,
        country: listings.country,
        count: count(),
      }).from(listings)
        .groupBy(listings.city, listings.country)
        .orderBy(desc(count()))
        .limit(20);

      const [activeCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isSold, false));
      const [soldCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isSold, true));
      const [totalUsers] = await db.select({ total: count() }).from(users);
      const [boostedCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isBoosted, true));
      const [shopCount] = await db.select({ total: count() }).from(listings).where(eq(listings.isShop, true));

      const listingTypeBreakdown = await db.select({
        type: listings.listingType,
        count: count(),
      }).from(listings)
        .groupBy(listings.listingType)
        .orderBy(desc(count()));

      const conditionBreakdown = await db.select({
        condition: listings.condition,
        count: count(),
      }).from(listings)
        .where(sql`${listings.condition} IS NOT NULL`)
        .groupBy(listings.condition)
        .orderBy(desc(count()));

      let listingRunning = listingBaseline;
      const dailyListingGrowthWithCumulative = dailyListingGrowth.map(d => {
        listingRunning += d.count;
        return { date: d.date, count: d.count, cumulative: listingRunning };
      });

      const [orderCount] = await db.select({ total: count() }).from(orders);
      const [paidOrders] = await db.select({
        total: count(),
        revenue: sql<number>`COALESCE(SUM(amount), 0)`.as('revenue'),
        fees: sql<number>`COALESCE(SUM(platform_fee), 0)`.as('fees'),
      }).from(orders).where(
        or(eq(orders.status, "paid"), eq(orders.status, "shipped"), eq(orders.status, "delivered"))
      );
      const [pendingOrderCount] = await db.select({ total: count() }).from(orders).where(eq(orders.status, "pending"));
      const [disputedOrderCount] = await db.select({ total: count() }).from(orders).where(eq(orders.escrowStatus, "disputed"));

      const revenuePerDay = await db.select({
        date: sql<string>`DATE(${orders.createdAt})`.as('date'),
        revenue: sql<number>`COALESCE(SUM(amount), 0)`.as('revenue'),
        count: count(),
      }).from(orders)
        .where(and(
          gte(orders.createdAt, thirtyDaysAgo),
          or(eq(orders.status, "paid"), eq(orders.status, "shipped"), eq(orders.status, "delivered"))
        ))
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      const [avgOrderValue] = await db.select({
        avg: sql<number>`COALESCE(AVG(amount), 0)`.as('avg'),
      }).from(orders).where(
        or(eq(orders.status, "paid"), eq(orders.status, "shipped"), eq(orders.status, "delivered"))
      );

      res.json({
        newUsersPerDay,
        newListingsPerDay,
        dailyUserGrowth: dailyUserGrowthWithCumulative,
        dailyListingGrowth: dailyListingGrowthWithCumulative,
        userBaseline,
        listingBaseline,
        categoryBreakdown,
        cityDistribution,
        listingTypeBreakdown,
        conditionBreakdown,
        activeSoldBreakdown: {
          active: activeCount?.total || 0,
          sold: soldCount?.total || 0,
        },
        totalUsers: totalUsers?.total || 0,
        totalBoosted: boostedCount?.total || 0,
        totalShops: shopCount?.total || 0,
        orderStats: {
          totalOrders: orderCount?.total || 0,
          paidOrders: paidOrders?.total || 0,
          pendingOrders: pendingOrderCount?.total || 0,
          disputedOrders: disputedOrderCount?.total || 0,
          totalRevenue: Number(paidOrders?.revenue) || 0,
          platformFees: Number(paidOrders?.fees) || 0,
          avgOrderValue: Number(avgOrderValue?.avg) || 0,
        },
        revenuePerDay,
      });
    } catch (err) {
      console.error("Admin analytics error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Favorites ───────────────────────────────────────────────────────────────
  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const listings = await storage.getUserFavorites(req.user.claims.sub);
      res.json(listings);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/favorites/:listingId/status", isAuthenticated, async (req: any, res) => {
    try {
      const isFavorited = await storage.isFavorited(req.user.claims.sub, Number(req.params.listingId));
      res.json({ isFavorited });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/favorites/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      const fav = await storage.addFavorite(req.user.claims.sub, Number(req.params.listingId));
      res.status(201).json(fav);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/favorites/:listingId", isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeFavorite(req.user.claims.sub, Number(req.params.listingId));
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Saved Searches ──────────────────────────────────────────────────────────
  app.get("/api/saved-searches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const searches = await storage.getSavedSearches(userId);
      res.json(searches);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/saved-searches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertSavedSearchSchema.parse(req.body);
      const search = await storage.createSavedSearch(userId, data);
      res.status(201).json(search);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.deleteSavedSearch(Number(req.params.id), userId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Reviews ───────────────────────────────────────────────────────────────
  app.post("/api/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertReviewSchema.parse({ ...req.body, reviewerId: userId });

      if (data.sellerId === userId) {
        return res.status(400).json({ message: "You cannot review yourself." });
      }

      const alreadyReviewed = await storage.hasReviewedSeller(userId, data.sellerId);
      if (alreadyReviewed) {
        return res.status(400).json({ message: "You have already reviewed this seller." });
      }

      const hasInteracted = await storage.hasInteractedWithSeller(userId, data.sellerId);
      if (!hasInteracted) {
        return res.status(403).json({ message: "You can only review sellers you've purchased from — through a completed order or accepted offer." });
      }

      if (data.comment) {
        const reviewModResult = moderateContent(data.comment);
        if (reviewModResult.severity === "high") {
          return res.status(400).json({ message: "Your review contains prohibited content and cannot be submitted." });
        }
        if (!reviewModResult.isClean && data.listingId) {
          storage.reportListing("system", {
            listingId: data.listingId,
            reason: "Auto-flagged review by content moderation",
            details: `Severity: ${reviewModResult.severity}. From user: ${userId}. Flagged terms: ${reviewModResult.flaggedWords.join(", ")}`,
          }).catch(() => {});
        }
      }

      const review = await storage.createReview(data);
      if (data.sellerId) {
        const reviewer = await authStorage.getUser(userId);
        const listing = data.listingId ? await storage.getListing(data.listingId) : null;
        const reviewerName = reviewer?.displayName || "A buyer";
        sendReviewNotification(data.sellerId, reviewerName, data.rating, listing?.title || "your listing").catch(() => {});
        storage.createNotification({
          userId: data.sellerId,
          type: "review",
          title: "New Review Received",
          body: `${reviewerName} left a ${data.rating}-star review on "${listing?.title || "your listing"}"`,
          link: `/listing/${data.listingId}`,
        }).catch(() => {});
      }
      awardLoyaltyPoints(userId, "review_written", `Wrote a review`, `review_${review.id}`);
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/reviews/:id/reply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const reviewId = Number(req.params.id);
      if (isNaN(reviewId)) return res.status(400).json({ message: "Invalid review ID" });

      const { reply } = req.body;
      if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
        return res.status(400).json({ message: "Reply text is required" });
      }

      const updated = await storage.replyToReview(reviewId, userId, reply.trim());

      storage.createNotification({
        userId: updated.reviewerId,
        type: "review_reply",
        title: "Seller replied to your review",
        body: `The seller replied: "${reply.trim().substring(0, 100)}${reply.trim().length > 100 ? '...' : ''}"`,
        link: `/seller/${updated.sellerId}`,
      }).catch(() => {});

      res.json(updated);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Review not found" });
      if (err.message?.includes("Unauthorized")) return res.status(403).json({ message: "Not authorized" });
      if (err.message?.includes("already replied")) return res.status(400).json({ message: "Already replied to this review" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/reviews/:sellerId/can-review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sellerId = req.params.sellerId;
      if (userId === sellerId) return res.json({ canReview: false, reason: "own_profile" });
      const alreadyReviewed = await storage.hasReviewedSeller(userId, sellerId);
      if (alreadyReviewed) return res.json({ canReview: false, reason: "already_reviewed" });
      const hasInteracted = await storage.hasInteractedWithSeller(userId, sellerId);
      if (!hasInteracted) return res.json({ canReview: false, reason: "no_interaction" });
      return res.json({ canReview: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/reviews/:sellerId", async (req, res) => {
    try {
      const reviews = await storage.getReviewsForSeller(req.params.sellerId);
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/reviews/:sellerId/summary", async (req, res) => {
    try {
      const summary = await storage.getReviewSummary(req.params.sellerId);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Events ───────────────────────────────────────────────────────────────
  app.get("/api/events", async (req, res) => {
    try {
      const regularEvents = await storage.getEvents(req.query);

      const nConditions: any[] = [];
      if (req.query.country) nConditions.push(eq(neighborhoodEvents.country, req.query.country as string));
      if (req.query.city) nConditions.push(eq(neighborhoodEvents.city, req.query.city as string));
      const nResults = await db.select().from(neighborhoodEvents)
        .where(nConditions.length > 0 ? and(...nConditions) : undefined)
        .orderBy(neighborhoodEvents.startDate)
        .limit(50);

      const mapped = nResults.map((ne) => ({
        id: ne.id + 1000000,
        userId: ne.organizerId,
        listingId: null,
        title: ne.title,
        description: ne.description,
        address: ne.neighborhood,
        city: ne.city,
        country: ne.country,
        startDate: ne.startDate,
        endDate: ne.endDate,
        photos: ne.coverImage ? [ne.coverImage] : [],
        isNeighborhood: true,
        maxParticipants: ne.maxParticipants || 0,
        createdAt: ne.startDate,
        rsvpCount: ne.participantCount,
        _neighborhoodEventId: ne.id,
      }));

      const combined = [...regularEvents, ...mapped].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      res.json(combined);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEventById(Number(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      const rsvps = await storage.getEventRsvps(event.id);
      res.json({ ...event, rsvpCount: rsvps.length, rsvps, requiresVerification: false, linkedListingId: null });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/listings/:id/event", async (req, res) => {
    try {
      const listingId = Number(req.params.id);
      const allEvents = await db.select().from(events).where(eq(events.listingId, listingId)).limit(1);
      if (!allEvents.length) return res.status(404).json({ message: "No event found for this listing" });
      const event = allEvents[0];
      const rsvps = await storage.getEventRsvps(event.id);
      res.json({ ...event, rsvpCount: rsvps.length, rsvps });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      if (data.city) data.city = capitalizeWords(data.city.trim());
      if (data.country) data.country = capitalizeWords(data.country.trim());
      const event = await storage.createEvent(req.user.claims.sub, data);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/events/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      const eventId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const event = await storage.getEventById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const rsvp = await storage.rsvpEvent(eventId, userId);
      res.status(201).json(rsvp);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/events/:id/rsvp", isAuthenticated, async (req: any, res) => {
    try {
      await storage.cancelRsvp(Number(req.params.id), req.user.claims.sub);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/events/:id/ics", async (req, res) => {
    try {
      const event = await storage.getEventById(Number(req.params.id));
      if (!event) return res.status(404).json({ message: "Event not found" });
      const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const sanitizeICS = (str: string) =>
        str.replace(/[\\;,\n\r]/g, (c) => c === '\n' ? '\\n' : c === '\r' ? '' : '\\' + c);
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//YARDEES//EN',
        'BEGIN:VEVENT',
        `DTSTART:${formatDate(event.startDate)}`,
        `DTEND:${formatDate(event.endDate)}`,
        `SUMMARY:${sanitizeICS(event.title)}`,
        `DESCRIPTION:${sanitizeICS(event.description || '')}`,
        `LOCATION:${sanitizeICS(`${event.address}, ${event.city}, ${event.country}`)}`,
        `UID:event-${event.id}@yardees`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      res.set('Content-Type', 'text/calendar');
      res.set('Content-Disposition', `attachment; filename="yardees-event-${event.id}.ics"`);
      res.send(ics);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Bulk Import ──────────────────────────────────────────────────────────
  app.get("/api/listings/bulk-import/template", (_req, res) => {
    const csv = "title,description,price,category,condition,currency,address,city,country\n" +
      '"Example Item","A great item for sale",1999,Electronics,good,USD,"123 Main St",Austin,USA\n';
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="yardees-import-template.csv"');
    res.send(csv);
  });

  app.post("/api/listings/bulk-import", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const csvContent = fs.readFileSync(req.file.path, 'utf-8');
      const lines = csvContent.split('\n').filter(l => l.trim());
      if (lines.length < 2) return res.status(400).json({ message: "CSV must have header + at least 1 row" });
      if (lines.length > 101) return res.status(400).json({ message: "Maximum 100 listings per import" });

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const requiredHeaders = ['title', 'description', 'price', 'category'];
      const missing = requiredHeaders.filter(h => !headers.includes(h));
      if (missing.length > 0) return res.status(400).json({ message: `Missing required columns: ${missing.join(', ')}` });

      const results = { created: 0, failed: 0, errors: [] as string[] };
      const userId = req.user.claims.sub;
      const validCategories = ["Furniture", "Clothing", "Electronics", "Books", "Toys", "Home & Garden", "Sports", "Antiques", "Vintage", "Tools", "Collectibles", "Jewelry", "Appliances", "Baby & Kids", "Other"];
      const validConditions = ["new", "like_new", "good", "fair", "poor"];
      const validCurrencies = ["USD", "CAD", "GBP", "EUR", "AUD", "MXN"];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (const ch of lines[i]) {
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
            current += ch;
          }
          values.push(current.trim());
          const row: any = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          if (!row.title || row.title.length < 2) throw new Error("Title too short");
          if (!row.description || row.description.length < 5) throw new Error("Description too short");
          const price = parseInt(row.price, 10);
          if (isNaN(price) || price < 0) throw new Error("Invalid price");
          const category = validCategories.includes(row.category) ? row.category : 'Other';
          const condition = validConditions.includes(row.condition) ? row.condition : null;
          const currency = validCurrencies.includes(row.currency) ? row.currency : 'USD';

          await storage.createListing(userId, {
            title: row.title.substring(0, 200),
            description: row.description.substring(0, 5000),
            price,
            category,
            condition,
            currency,
            address: (row.address || '').substring(0, 500),
            city: (row.city || 'Austin').substring(0, 100),
            country: (row.country || 'USA').substring(0, 100),
            photos: ['/uploads/placeholder.png', '/uploads/placeholder.png'],
            sellerContact: '',
            listingType: 'individual',
            privacyLevel: 'open',
            isShop: false,
            isBoosted: false,
            isSold: false,
            isNegotiable: false,
            isBundle: false,
            viewCount: 0,
          } as any);
          results.created++;
        } catch (rowErr: any) {
          results.failed++;
          results.errors.push(`Row ${i}: ${rowErr.message || 'Validation error'}`);
        }
      }
      fs.unlinkSync(req.file.path);
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Offers ───────────────────────────────────────────────────────────────
  app.get("/api/offers", isAuthenticated, async (req: any, res) => {
    try {
      const offers = await storage.getOffers(req.user.claims.sub);
      res.json(offers);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/offers", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertOfferSchema.parse(req.body);
      const offer = await storage.createOffer(req.user.claims.sub, data);

      const listing = await storage.getListing(offer.listingId);
      if (listing) {
        storage.createNotification({
          userId: offer.sellerId,
          type: "offer",
          title: "New offer on your listing",
          body: `You received an offer of ${(offer.amount / 100).toFixed(2)} on "${listing.title}"`,
          link: "/offers",
        }).catch(() => {});

        const buyer = await authStorage.getUser(req.user.claims.sub);
        sendOfferNotification(
          offer.sellerId,
          listing.title,
          offer.amount,
          offer.currency,
          buyer?.displayName || "A buyer"
        ).catch(() => {});
      }

      res.status(201).json(offer);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/offers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status, counterAmount } = req.body;
      const validStatuses = ["accepted", "rejected", "countered"];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

      const existingOffer = await storage.getOfferById(Number(req.params.id));
      if (!existingOffer) return res.status(404).json({ message: "Offer not found" });
      if (existingOffer.sellerId !== userId && existingOffer.buyerId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this offer" });
      }

      const isSeller = existingOffer.sellerId === userId;
      const isBuyer = existingOffer.buyerId === userId;

      if (["accepted", "rejected", "expired"].includes(existingOffer.status)) {
        return res.status(400).json({ message: "This offer has already been resolved" });
      }

      if (status === "countered") {
        if (!isSeller) return res.status(403).json({ message: "Only the seller can counter offers" });
        if (existingOffer.status !== "pending") return res.status(400).json({ message: "Can only counter pending offers" });
        if (!counterAmount || typeof counterAmount !== "number" || !Number.isInteger(counterAmount) || counterAmount <= 0) {
          return res.status(400).json({ message: "Counter amount must be a positive integer (cents)" });
        }
      }
      if ((status === "accepted" || status === "rejected") && isBuyer && existingOffer.status !== "countered") {
        return res.status(403).json({ message: "You can only accept or decline a counter-offer" });
      }
      if ((status === "accepted" || status === "rejected") && isSeller && existingOffer.status !== "pending") {
        return res.status(403).json({ message: "You can only accept or reject pending offers" });
      }

      const offer = await storage.updateOfferStatus(Number(req.params.id), status, status === "countered" ? counterAmount : undefined);

      if (status === "countered") {
        const listing = await storage.getListing(offer.listingId);
        storage.createNotification({
          userId: offer.buyerId,
          type: "offer_update",
          title: "Counter-Offer Received",
          body: `The seller has countered your offer on "${listing?.title || "an item"}" with ${(counterAmount! / 100).toFixed(2)}. Review and respond now.`,
          link: "/offers",
        }).catch(() => {});
        if (listing) sendOrderStatusEmail(offer.buyerId, 0, "countered", listing.title).catch(() => {});
      }

      if (status === "accepted") {
        const finalAmount = isBuyer && existingOffer.counterAmount ? existingOffer.counterAmount : offer.amount;
        const existingOrders = await db.select({ id: orders.id }).from(orders)
          .where(eq(orders.offerId, offer.id)).limit(1);
        if (existingOrders.length > 0) {
          return res.json(offer);
        }
        const listing = await storage.getListing(offer.listingId);
        if (listing) {
          const platformFee = Math.round(finalAmount * 0.05);
          const sellerPayout = finalAmount - platformFee;
          const order = await storage.createOrder({
            listingId: offer.listingId,
            buyerId: offer.buyerId,
            sellerId: offer.sellerId,
            offerId: offer.id,
            amount: finalAmount,
            platformFee,
            sellerPayout,
            currency: offer.currency,
          });

          if (isBuyer) {
            storage.createNotification({
              userId: offer.sellerId,
              type: "order_update",
              title: "Counter-Offer Accepted",
              body: `The buyer accepted your counter-offer of ${(finalAmount / 100).toFixed(2)} on "${listing.title}".`,
              link: "/orders",
            }).catch(() => {});
          } else {
            storage.createNotification({
              userId: offer.buyerId,
              type: "order_update",
              title: "Offer Accepted — Pay Now!",
              body: `Your offer of ${(finalAmount / 100).toFixed(2)} on "${listing.title}" was accepted. Complete your purchase now.`,
              link: "/orders",
            }).catch(() => {});
          }

          sendOrderStatusEmail(offer.buyerId, order.id, "accepted", listing.title).catch(() => {});
        }
      }

      if (status === "rejected" && isBuyer) {
        const listing = await storage.getListing(offer.listingId);
        storage.createNotification({
          userId: offer.sellerId,
          type: "offer_update",
          title: "Counter-Offer Declined",
          body: `The buyer declined your counter-offer on "${listing?.title || "an item"}".`,
          link: "/offers",
        }).catch(() => {});
      }

      res.json(offer);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Orders ───────────────────────────────────────────────────────────────
  app.get("/api/orders", isAuthenticated, async (req: any, res) => {
    try {
      const rawOrders = await storage.getOrders(req.user.claims.sub);
      const enriched = await Promise.all(rawOrders.map(async (order) => {
        const [listing, buyer, seller] = await Promise.all([
          storage.getListing(order.listingId).catch(() => null),
          authStorage.getUser(order.buyerId).catch(() => null),
          authStorage.getUser(order.sellerId).catch(() => null),
        ]);
        return {
          ...order,
          listingTitle: listing?.title || null,
          buyerName: buyer?.displayName || buyer?.firstName || null,
          sellerName: seller?.displayName || seller?.firstName || null,
        };
      }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const existingOrder = await storage.getOrderById(Number(req.params.id));
      if (!existingOrder) return res.status(404).json({ message: "Order not found" });
      if (existingOrder.buyerId !== userId && existingOrder.sellerId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this order" });
      }

      const isSeller = existingOrder.sellerId === userId;
      const isBuyer = existingOrder.buyerId === userId;

      const allowedFields = ["trackingNumber", "trackingCarrier", "shippingAddress"];
      const sanitized: any = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) sanitized[key] = req.body[key];
      }

      if (req.body.status) {
        const requestedStatus = req.body.status;
        if (requestedStatus === "delivered") {
          return res.status(400).json({ message: "Use the confirm-delivery endpoint to confirm delivery" });
        }
        const validTransitions: Record<string, { next: string; role: "seller" | "buyer" }[]> = {
          paid: [{ next: "shipped", role: "seller" }],
        };
        const allowed = validTransitions[existingOrder.status];
        const match = allowed?.find(t => t.next === requestedStatus);
        if (!match) {
          return res.status(400).json({ message: `Cannot transition from "${existingOrder.status}" to "${requestedStatus}"` });
        }
        if ((match.role === "seller" && !isSeller) || (match.role === "buyer" && !isBuyer)) {
          return res.status(403).json({ message: "You are not authorized for this status change" });
        }
        sanitized.status = requestedStatus;
      }

      const order = await storage.updateOrder(Number(req.params.id), sanitized);
      if (sanitized.status) {
        const listing = order.listingId ? await storage.getListing(order.listingId) : null;
        const notifyUserId = userId === order.buyerId ? order.sellerId : order.buyerId;
        const itemTitle = listing?.title || "Order item";
        sendOrderStatusEmail(notifyUserId, order.id, sanitized.status, itemTitle).catch(() => {});
        storage.createNotification({
          userId: notifyUserId,
          type: "order_update",
          title: "Order Update",
          body: `Order for "${itemTitle}" has been updated to: ${sanitized.status}`,
          link: "/orders",
        }).catch(() => {});
      }
      res.json(order);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Order Checkout (Stripe) ──────────────────────────────────────────────
  const PLATFORM_FEE_PERCENT = 5;

  app.post("/api/orders/:id/checkout", isAuthenticated, async (req: any, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ message: "Payment system not configured" });

    try {
      const userId = req.user.claims.sub;
      const order = await storage.getOrderById(Number(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyerId !== userId) return res.status(403).json({ message: "Only the buyer can pay for this order" });
      if (order.status !== "pending") return res.status(400).json({ message: "This order has already been paid or is no longer active" });

      const listing = await storage.getListing(order.listingId);
      const itemTitle = listing?.title || `Order #${order.id}`;

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" as any });

      if (order.stripeSessionId) {
        try {
          const existingSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
          if (existingSession.payment_status === "paid") {
            return res.status(400).json({ message: "This order has already been paid" });
          }
          if (existingSession.status === "open") {
            return res.json({ checkoutUrl: existingSession.url });
          }
        } catch {}
      }

      const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;

      const orderCurrency = (order.currency || "usd").toLowerCase();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: orderCurrency,
            product_data: {
              name: itemTitle,
              description: `Purchase from YARDEES marketplace`,
            },
            unit_amount: order.amount,
          },
          quantity: 1,
        }],
        mode: "payment",
        shipping_address_collection: {
          allowed_countries: ["US","CA","GB","AU","DE","FR","ES","IT","NL","BE","AT","CH","SE","NO","DK","FI","IE","PT","PL","CZ","HU","RO","BG","HR","SK","SI","LT","LV","EE","MT","CY","LU","GR","JP","KR","SG","HK","NZ","MX","BR","AR","CL","CO","PE","ZA","IL","AE","SA","IN","TH","MY","PH","ID","VN","TW","TR","NG","KE","GH","EG"],
        },
        success_url: `${origin}/orders/payment-success?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/orders`,
        metadata: {
          orderId: String(order.id),
          buyerId: userId,
          sellerId: order.sellerId,
          listingId: String(order.listingId),
        },
      });

      await storage.updateOrder(order.id, { stripeSessionId: session.id } as any);
      res.json({ checkoutUrl: session.url });
    } catch (err: any) {
      console.error("[checkout] Stripe error:", err);
      res.status(500).json({ message: "Payment setup failed. Please try again." });
    }
  });

  app.post("/api/orders/:id/payment-confirm", isAuthenticated, async (req: any, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(503).json({ message: "Payment system not configured" });

    try {
      const userId = req.user.claims.sub;
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ message: "Session ID required" });

      const order = await storage.getOrderById(Number(req.params.id));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyerId !== userId) return res.status(403).json({ message: "Not authorized" });
      if (order.status !== "pending") return res.status(400).json({ message: "Order already processed" });
      if (order.stripeSessionId && order.stripeSessionId !== sessionId) {
        return res.status(400).json({ message: "Invalid payment session" });
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" as any });
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(402).json({ message: "Payment not completed" });
      }

      if (session.metadata?.orderId !== String(order.id) || session.metadata?.buyerId !== userId) {
        return res.status(403).json({ message: "Payment session does not match this order" });
      }

      if (session.amount_total !== order.amount) {
        return res.status(400).json({ message: "Payment amount mismatch" });
      }

      let shippingAddr = "";
      const sessAny = session as any;
      if (sessAny.shipping_details?.address) {
        const a = sessAny.shipping_details.address;
        const name = sessAny.shipping_details.name || "";
        const parts = [
          name,
          a.line1,
          a.line2,
          [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
          a.country,
        ].filter(Boolean);
        shippingAddr = parts.join("\n");
      }

      const [updated] = await db.update(orders).set({
        status: "paid",
        escrowStatus: "held",
        stripePaymentIntentId: session.payment_intent as string,
        ...(shippingAddr ? { shippingAddress: shippingAddr } : {}),
        updatedAt: new Date(),
      }).where(and(eq(orders.id, order.id), eq(orders.status, "pending"))).returning();
      if (!updated) return res.status(409).json({ message: "Order is no longer available for payment" });

      const listing = await storage.getListing(order.listingId);
      const itemTitle = listing?.title || `Order #${order.id}`;

      const shippingNotice = shippingAddr
        ? `\n\nShip to:\n${shippingAddr}`
        : "\n\nThe buyer did not provide a shipping address. Please contact them for delivery details.";

      storage.createNotification({
        userId: order.sellerId,
        type: "order_update",
        title: "Payment Received!",
        body: `The buyer has paid $${(order.amount / 100).toFixed(2)} for "${itemTitle}". Ship it to complete the order.${shippingNotice}`,
        link: "/orders",
      }).catch(() => {});

      sendOrderStatusEmail(order.sellerId, order.id, "paid", itemTitle).catch(() => {});

      awardLoyaltyPoints(userId, "purchase_completed", `Purchased: "${itemTitle}"`, `purchase_order_${order.id}`);

      res.json(updated);
    } catch (err: any) {
      console.error("[checkout] Confirm error:", err);
      res.status(500).json({ message: "Payment confirmation failed" });
    }
  });

  // ─── Referrals ────────────────────────────────────────────────────────────
  app.get("/api/referral/code", isAuthenticated, async (req: any, res) => {
    try {
      const code = await storage.generateReferralCode(req.user.claims.sub);
      res.json({ code });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/referral/stats", isAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getReferralStats(req.user.claims.sub);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/referral/apply", isAuthenticated, async (req: any, res) => {
    try {
      const { referralCode } = req.body;
      const userId = req.user.claims.sub;
      if (!referralCode) return res.status(400).json({ message: "Referral code required" });
      await storage.applyReferral(referralCode, userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Analytics ────────────────────────────────────────────────────────────
  app.get("/api/analytics/overview", isAuthenticated, async (req: any, res) => {
    try {
      const overview = await storage.getAnalyticsOverview(req.user.claims.sub);
      res.json(overview);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/analytics/listings", isAuthenticated, async (req: any, res) => {
    try {
      const analytics = await storage.getListingAnalytics(req.user.claims.sub);
      res.json(analytics);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/analytics/views-over-time", isAuthenticated, async (req: any, res) => {
    try {
      const days = Number(req.query.days) || 30;
      const data = await storage.getViewsOverTime(req.user.claims.sub, days);
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Donation Mode ──────────────────────────────────────────────────────
  app.patch("/api/listings/:id/donate", isAuthenticated, async (req: any, res) => {
    try {
      const { isDonation, donationRecipient } = req.body;
      const listing = await storage.markDonation(Number(req.params.id), req.user.claims.sub, isDonation, donationRecipient);
      res.json(listing);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Live Status ──────────────────────────────────────────────────────
  app.post("/api/listings/:id/live", isAuthenticated, async (req: any, res) => {
    try {
      const listing = await storage.goLive(Number(req.params.id), req.user.claims.sub);
      res.json(listing);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/listings/:id/offline", isAuthenticated, async (req: any, res) => {
    try {
      const listing = await storage.goOffline(Number(req.params.id), req.user.claims.sub);
      res.json(listing);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: "Not found" });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Neighborhood Events ──────────────────────────────────────────────
  app.get("/api/events/:id/participants", async (req, res) => {
    try {
      const participants = await storage.getEventParticipants(Number(req.params.id));
      res.json(participants);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/events/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const participant = await storage.joinNeighborhoodEvent(
        Number(req.params.id), req.user.claims.sub, req.body
      );
      res.status(201).json(participant);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/events/:id/leave", isAuthenticated, async (req: any, res) => {
    try {
      await storage.leaveNeighborhoodEvent(Number(req.params.id), req.user.claims.sub);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Escrow / Order Protection ────────────────────────────────────────
  app.post("/api/orders/:id/confirm-delivery", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const order = await storage.confirmDelivery(Number(req.params.id), userId);

      const listing = order.listingId ? await storage.getListing(order.listingId).catch(() => null) : null;
      const itemTitle = listing?.title || `Order #${order.id}`;

      storage.createNotification({
        userId: order.sellerId,
        type: "order_update",
        title: "Payment Released! 🎉",
        body: `The buyer confirmed delivery of "${itemTitle}". Your payout of ${((order.sellerPayout || order.amount) / 100).toFixed(2)} is being released.`,
        link: "/orders",
      }).catch(() => {});

      storage.createNotification({
        userId: order.buyerId,
        type: "order_update",
        title: "Order Complete",
        body: `You confirmed delivery of "${itemTitle}". Payment has been released to the seller.`,
        link: "/orders",
      }).catch(() => {});

      sendOrderStatusEmail(order.sellerId, order.id, "delivered", itemTitle).catch(() => {});

      if (listing) {
        await storage.updateListing(order.listingId, order.sellerId, { isSold: true }).catch(() => {});
        awardLoyaltyPoints(order.sellerId, "listing_sold", `Sold: "${itemTitle}"`, `sold_listing_${listing.id}`);
        awardLoyaltyPoints(order.buyerId, "purchase_completed", `Purchased: "${itemTitle}"`, `purchase_${order.id}`);
      }

      const seller = await storage.getUser(order.sellerId);
      if (seller) {
        const newCount = (seller.transactionCount || 0) + 1;
        const updates: any = { transactionCount: newCount };
        if (newCount >= 5 && seller.verificationLevel === 'id_verified') {
          updates.verificationLevel = 'trusted_seller';
        }
        await db.update(users).set(updates).where(eq(users.id, order.sellerId));
      }

      res.json(order);
    } catch (err: any) {
      if (err.message?.includes("not found") || err.message?.includes("unauthorized")) return res.status(404).json({ message: err.message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/orders/:id/dispute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { reason } = req.body;
      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ message: "Please provide a detailed reason (at least 10 characters)" });
      }
      const order = await storage.disputeOrder(Number(req.params.id), userId, reason);

      const listing = await storage.getListing(order.listingId);
      const itemTitle = listing?.title || `Order #${order.id}`;
      const otherParty = userId === order.buyerId ? order.sellerId : order.buyerId;
      const role = userId === order.buyerId ? "buyer" : "seller";

      storage.createNotification({
        userId: otherParty,
        type: "order_update",
        title: "Order Disputed",
        body: `The ${role} has filed a dispute on "${itemTitle}". Reason: ${reason.substring(0, 100)}`,
        link: "/orders",
      }).catch(() => {});

      sendOrderStatusEmail(otherParty, order.id, "disputed", itemTitle).catch(() => {});

      const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
      for (const adminId of adminIds) {
        storage.createNotification({
          userId: adminId,
          type: "order_update",
          title: "⚠️ New Dispute Filed",
          body: `A ${role} has filed a dispute on Order #${order.id} ("${itemTitle}"). Amount: $${(order.amount / 100).toFixed(2)}. Reason: ${reason.substring(0, 100)}`,
          link: "/admin.html",
        }).catch(() => {});
      }

      res.json(order);
    } catch (err: any) {
      if (err.message?.includes("not found") || err.message?.includes("unauthorized")) return res.status(404).json({ message: err.message });
      if (err.message?.includes("Can only")) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Dispute Chat ─────────────────────────────────────────────────────
  app.get("/api/orders/:id/dispute-chat", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const adminAuthed = isAdmin(req);
      if (!userId && !adminAuthed) return res.status(401).json({ message: "Unauthorized" });

      const orderId = Number(req.params.id);
      const order = await storage.getOrderById(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
      const isParty = adminAuthed || (userId && (userId === order.buyerId || userId === order.sellerId || adminIds.includes(userId)));
      if (!isParty) return res.status(403).json({ message: "Not authorized" });

      const msgs = await db.select().from(disputeMessages)
        .where(eq(disputeMessages.orderId, orderId))
        .orderBy(disputeMessages.createdAt);

      const senderIds = [...new Set(msgs.map(m => m.senderId))];
      const senderMap: Record<string, string> = {};
      for (const sid of senderIds) {
        const u = await authStorage.getUser(sid);
        senderMap[sid] = u?.displayName || u?.firstName || "User";
      }
      for (const adminId of adminIds) {
        senderMap[adminId] = "YARDEES Support";
      }

      const enriched = msgs.map(m => ({
        ...m,
        senderName: senderMap[m.senderId] || "Unknown",
      }));

      res.json(enriched);
    } catch (err) {
      console.error("Dispute chat GET error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/orders/:id/dispute-chat", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const adminAuthed = isAdmin(req);
      if (!userId && !adminAuthed) return res.status(401).json({ message: "Unauthorized" });

      const orderId = Number(req.params.id);
      const { content } = req.body;
      if (!content || content.trim().length === 0) return res.status(400).json({ message: "Message cannot be empty" });
      if (content.trim().length > 2000) return res.status(400).json({ message: "Message too long (max 2000 characters)" });

      const order = await storage.getOrderById(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.escrowStatus !== "disputed") return res.status(400).json({ message: "Order is not in dispute" });

      const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
      const isAdminUser = adminAuthed || (userId && adminIds.includes(userId));
      const isBuyer = userId === order.buyerId;
      const isSeller = userId === order.sellerId;
      if (!isBuyer && !isSeller && !isAdminUser) return res.status(403).json({ message: "Not authorized" });

      const senderRole = isAdminUser ? "admin" : isBuyer ? "buyer" : "seller";
      const senderId = userId || adminIds[0] || "admin";

      const [msg] = await db.insert(disputeMessages).values({
        orderId,
        senderId,
        senderRole,
        content: content.trim(),
      }).returning();

      const user = userId ? await authStorage.getUser(userId) : null;
      const senderName = isAdminUser ? "YARDEES Support" : (user?.displayName || user?.firstName || "User");

      const notifyIds = [order.buyerId, order.sellerId, ...adminIds].filter(id => id !== senderId);
      const listing = await storage.getListing(order.listingId);
      const itemTitle = listing?.title || `Order #${orderId}`;
      for (const nid of [...new Set(notifyIds)]) {
        storage.createNotification({
          userId: nid,
          type: "order_update",
          title: "New Dispute Message",
          body: `${senderName} sent a message in the dispute for "${itemTitle}"`,
          link: `/orders`,
        }).catch(() => {});
      }

      res.json({ ...msg, senderName });
    } catch (err) {
      console.error("Dispute chat POST error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Reputation Score ─────────────────────────────────────────────────
  app.get("/api/users/:userId/reputation", async (req, res) => {
    try {
      const reputation = await storage.getReputationScore(req.params.userId);
      res.json(reputation);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Seller Verification Badges ──────────────────────────────────────────
  app.get("/api/users/:userId/verification", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        level: user.verificationLevel || 'unverified',
        phoneVerified: user.phoneVerified || false,
        transactionCount: user.transactionCount || 0,
        sellerRating: user.sellerRating,
        reviewCount: user.reviewCount || 0,
        profileImageUrl: user.profileImageUrl || null,
        displayName: user.displayName || null,
        firstName: user.firstName || null,
      });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Notifications ──────────────────────────────────────────────────────
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const notifs = await storage.getNotifications(req.user.claims.sub);
      res.json(notifs);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.claims.sub);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markNotificationRead(Number(req.params.id), userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      await storage.markAllNotificationsRead(req.user.claims.sub);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ─── Feedback ──────────────────────────────────────────────────────
  app.post("/api/feedback", feedbackLimiter, async (req, res) => {
    try {
      const parsed = insertFeedbackSchema.parse(req.body);
      const result = await storage.createFeedback({ ...parsed, email: parsed.email || undefined });

      sendFeedbackToSupport({
        type: parsed.type,
        message: parsed.message,
        email: parsed.email || undefined,
      }).catch(() => {});

      res.json(result);
    } catch (err: any) {
      if (err.errors) return res.status(400).json({ message: "Invalid feedback data", errors: err.errors });
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/feedback", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const items = await storage.getAllFeedback();
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/feedback/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { status, adminNote } = req.body;
      const result = await storage.updateFeedbackStatus(Number(req.params.id), status, adminNote);
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get("/api/admin/disputes", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { orders: ordersTable, listings } = await import("@shared/schema");
      const disputed = await db
        .select({
          id: ordersTable.id,
          listingId: ordersTable.listingId,
          buyerId: ordersTable.buyerId,
          sellerId: ordersTable.sellerId,
          amount: ordersTable.amount,
          platformFee: ordersTable.platformFee,
          sellerPayout: ordersTable.sellerPayout,
          status: ordersTable.status,
          escrowStatus: ordersTable.escrowStatus,
          disputeReason: ordersTable.disputeReason,
          createdAt: ordersTable.createdAt,
          updatedAt: ordersTable.updatedAt,
          listingTitle: listings.title,
        })
        .from(ordersTable)
        .leftJoin(listings, eq(ordersTable.listingId, listings.id))
        .where(eq(ordersTable.escrowStatus, "disputed"))
        .orderBy(ordersTable.updatedAt);
      res.json(disputed);
    } catch (err) {
      console.error("Admin disputes error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch("/api/admin/disputes/:id", async (req: any, res) => {
    if (!isAdmin(req)) return res.status(403).json({ message: "Forbidden" });
    try {
      const { orders: ordersTable } = await import("@shared/schema");
      const orderId = Number(req.params.id);
      const { action, adminNote } = req.body;

      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.escrowStatus !== "disputed") return res.status(400).json({ message: "Order is not in disputed state" });

      let newEscrowStatus: string;
      let notifTitle: string;
      let notifBody: string;

      if (action === "release") {
        newEscrowStatus = "released";
        notifTitle = "Dispute Resolved — Funds Released";
        notifBody = `The dispute on Order #${orderId} has been resolved. Funds have been released to the seller.`;
      } else if (action === "refund") {
        newEscrowStatus = "refunded";
        notifTitle = "Dispute Resolved — Refund Issued";
        notifBody = `The dispute on Order #${orderId} has been resolved. A refund has been issued to the buyer.`;
      } else {
        return res.status(400).json({ message: "Invalid action. Use 'release' or 'refund'." });
      }

      const [updated] = await db.update(ordersTable).set({
        escrowStatus: newEscrowStatus,
        updatedAt: new Date(),
      }).where(and(eq(ordersTable.id, orderId), eq(ordersTable.escrowStatus, "disputed"))).returning();

      if (!updated) {
        return res.status(409).json({ message: "Dispute was already resolved by another admin." });
      }

      storage.createNotification({
        userId: order.buyerId,
        type: "order_update",
        title: notifTitle,
        body: notifBody + (adminNote ? ` Note: ${adminNote}` : ""),
        link: "/orders",
      }).catch(() => {});

      storage.createNotification({
        userId: order.sellerId,
        type: "order_update",
        title: notifTitle,
        body: notifBody + (adminNote ? ` Note: ${adminNote}` : ""),
        link: "/orders",
      }).catch(() => {});

      sendOrderStatusEmail(order.buyerId, orderId, newEscrowStatus as any, `Order #${orderId}`).catch(() => {});
      sendOrderStatusEmail(order.sellerId, orderId, newEscrowStatus as any, `Order #${orderId}`).catch(() => {});

      res.json(updated);
    } catch (err) {
      console.error("Admin resolve dispute error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return httpServer;
}
