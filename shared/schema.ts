import { pgTable, text, serial, integer, timestamp, varchar, boolean, jsonb, real, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export * from "./models/auth";

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  listingType: text("listing_type").notNull().default("individual"),
  category: text("category").notNull(),
  subCategories: text("sub_categories").array(),
  address: text("address").notNull(),
  country: text("country").notNull().default("USA"),
  city: text("city").notNull().default("Austin"),
  photos: text("photos").array().notNull(),
  videos: text("videos").array(),
  sellerContact: text("seller_contact").notNull(),
  isShop: boolean("is_shop").notNull().default(false),
  privacyLevel: text("privacy_level").notNull().default("hidden"),
  isBoosted: boolean("is_boosted").notNull().default(false),
  boostType: text("boost_type"),
  boostExpiresAt: timestamp("boost_expires_at"),
  isSold: boolean("is_sold").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  // Condition
  condition: text("condition"),  // 'new' | 'like_new' | 'good' | 'fair' | 'poor'
  // Pricing options
  isNegotiable: boolean("is_negotiable").notNull().default(false),
  inPersonPrice: integer("in_person_price"),  // cents, null = same as price
  // Bundle
  isBundle: boolean("is_bundle").notNull().default(false),
  bundleItems: text("bundle_items"),  // free-text description of what's in the bundle
  // Pickup scheduling
  pickupAvailability: text("pickup_availability"),  // free-text or JSON timeframes
  // Shop details
  phone: text("phone"),
  website: text("website"),
  hours: text("hours"),
  // Currency
  currency: varchar("currency").notNull().default("USD"),
  lat: varchar("lat"),
  lng: varchar("lng"),
  isDonation: boolean("is_donation").notNull().default(false),
  donationRecipient: text("donation_recipient"),
  isLive: boolean("is_live").notNull().default(false),
  liveStartedAt: timestamp("live_started_at"),
  expiresAt: timestamp("expires_at"),
  saleStartDate: timestamp("sale_start_date"),
  saleEndDate: timestamp("sale_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull(),
  receiverId: varchar("receiver_id").notNull(),
  listingId: integer("listing_id"),
  content: text("content").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shopSuggestions = pgTable("shop_suggestions", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  userId: varchar("user_id").notNull(),
  phone: text("phone"),
  website: text("website"),
  hours: text("hours"),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationRequests = pgTable("verification_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  listingId: integer("listing_id"),
  sellerId: varchar("seller_id"),
  documentUrl: text("document_url").notNull(),
  status: text("status").notNull().default("pending"),
  sellerNote: text("seller_note"),
  adminNote: text("admin_note"),
  expiryDate: timestamp("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  listingId: integer("listing_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  label: text("label").notNull(),
  query: jsonb("query").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  reporterId: varchar("reporter_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"),
  adminResponse: text("admin_response"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = [
  "Furniture", "Clothing", "Electronics", "Books", "Toys",
  "Home & Garden", "Sports", "Antiques", "Vintage", "Tools",
  "Collectibles", "Jewelry", "Appliances", "Baby & Kids", "Other"
] as const;

export const conditions = ["new", "like_new", "good", "fair", "poor"] as const;
export const conditionLabels: Record<string, string> = {
  new: "New", like_new: "Like New", good: "Good", fair: "Fair", poor: "Poor"
};

// Sale-event listing types — all behave like the original "yard_sale":
// they have start/end dates, auto-create calendar events, appear on the map,
// support "happening now" detection, and auto-expire after their end date.
export const saleEventTypes = [
  "yard_sale",
  "estate_sale",
  "garage_sale",
  "moving_sale",
  "rummage_sale",
  "flea_market",
  "tag_sale",
  "barn_sale",
  "storage_sale",
] as const;

// All listing types: every sale-event type plus the single-item "individual" type.
export const listingTypes = [...saleEventTypes, "individual"] as const;

// Human-readable labels for each sale-event type (used in UI badges, the
// listing form dropdown, SEO descriptions and auto-created event titles).
export const saleTypeLabels: Record<string, string> = {
  yard_sale: "Yard Sale",
  estate_sale: "Estate Sale",
  garage_sale: "Garage Sale",
  moving_sale: "Moving Sale",
  rummage_sale: "Rummage Sale",
  flea_market: "Flea Market",
  tag_sale: "Tag Sale",
  barn_sale: "Barn Sale",
  storage_sale: "Storage / Liquidation Sale",
};

// True when a listing type is one of the date-driven sale-event types.
export function isSaleEventType(type?: string | null): boolean {
  return !!type && (saleEventTypes as readonly string[]).includes(type);
}

export const boostTypes = ["category", "featured", "spotlight"] as const;

export const reportReasons = [
  "Spam or scam",
  "Offensive content",
  "Incorrect category",
  "Item already sold",
  "Duplicate listing",
  "Other",
] as const;

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
});
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;

export const currencies = ["USD", "CAD", "GBP", "EUR", "AUD", "MXN"] as const;
export const currencySymbols: Record<string, string> = {
  USD: "$", CAD: "CA$", GBP: "£", EUR: "€", AUD: "A$", MXN: "MX$",
};

export const insertListingSchema = createInsertSchema(listings, {
  listingType: z.enum(listingTypes).default("individual"),
  category: z.enum(categories),
  subCategories: z.array(z.enum(categories)).optional(),
  photos: z.array(z.string()).min(2, "At least 2 photos required").max(20, "Maximum 20 photos allowed"),
  price: z.coerce.number().min(0, "Price must be positive"),
  privacyLevel: z.enum(['open', 'hidden', 'request', 'verified']),
  boostType: z.enum(boostTypes).nullable().optional(),
  condition: z.enum(conditions).nullable().optional(),
  inPersonPrice: z.coerce.number().min(0).nullable().optional(),
  currency: z.enum(currencies).default("USD"),
  saleStartDate: z.coerce.date().nullable().optional(),
  saleEndDate: z.coerce.date().nullable().optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertShopSuggestionSchema = createInsertSchema(shopSuggestions).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertVerificationRequestSchema = createInsertSchema(verificationRequests).omit({
  id: true,
  createdAt: true,
  status: true,
  userId: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  status: true,
  reporterId: true,
});

export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;
export type CreateListingRequest = InsertListing;
export type UpdateListingRequest = Partial<InsertListing>;
export type ListingResponse = Listing;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type ShopSuggestion = typeof shopSuggestions.$inferSelect;
export type InsertShopSuggestion = z.infer<typeof insertShopSuggestionSchema>;

export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type InsertVerificationRequest = z.infer<typeof insertVerificationRequestSchema>;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id"),
  reviewerId: varchar("reviewer_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  sellerReply: text("seller_reply"),
  sellerReplyAt: timestamp("seller_reply_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews, {
  rating: z.coerce.number().min(1).max(5),
}).omit({ id: true, createdAt: true });
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  listingId: integer("listing_id"),
  title: text("title").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull().default("USA"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  photos: text("photos").array(),
  isNeighborhood: boolean("is_neighborhood").notNull().default(false),
  maxParticipants: integer("max_participants").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventRsvps = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventParticipants = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  address: text("address").notNull(),
  description: text("description"),
  lat: varchar("lat"),
  lng: varchar("lng"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true, userId: true, createdAt: true,
});
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventRsvp = typeof eventRsvps.$inferSelect;
export type EventParticipant = typeof eventParticipants.$inferSelect;

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  buyerId: varchar("buyer_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  counterAmount: integer("counter_amount"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true, buyerId: true, createdAt: true, updatedAt: true, status: true,
});
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  buyerId: varchar("buyer_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  offerId: integer("offer_id"),
  amount: integer("amount").notNull(),
  platformFee: integer("platform_fee").notNull().default(0),
  sellerPayout: integer("seller_payout").notNull().default(0),
  currency: varchar("currency").notNull().default("USD"),
  stripeSessionId: varchar("stripe_session_id"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  shippingAddress: text("shipping_address"),
  trackingNumber: varchar("tracking_number"),
  trackingCarrier: varchar("tracking_carrier"),
  status: text("status").notNull().default("pending"),
  escrowStatus: text("escrow_status").notNull().default("none"),
  escrowReleaseDate: timestamp("escrow_release_date"),
  disputeReason: text("dispute_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true, buyerId: true, createdAt: true, updatedAt: true, status: true, escrowStatus: true, escrowReleaseDate: true, disputeReason: true,
});
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export const disputeMessages = pgTable("dispute_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDisputeMessageSchema = createInsertSchema(disputeMessages).omit({
  id: true, createdAt: true,
});
export type DisputeMessage = typeof disputeMessages.$inferSelect;
export type InsertDisputeMessage = z.infer<typeof insertDisputeMessageSchema>;

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: varchar("referrer_id").notNull(),
  referredUserId: varchar("referred_user_id"),
  referralCode: varchar("referral_code").notNull(),
  boostCredits: integer("boost_credits").default(0),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Referral = typeof referrals.$inferSelect;

export const listingAnalytics = pgTable("listing_analytics", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ListingAnalytic = typeof listingAnalytics.$inferSelect;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  email: text("email"),
  status: text("status").notNull().default("new"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const feedbackTypes = ["bug", "feature", "feedback"] as const;
export const feedbackStatuses = ["new", "reviewed", "resolved"] as const;

export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, status: true, adminNote: true, createdAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  maxPrice: integer("max_price"),
  keywords: text("keywords").array(),
  isActive: boolean("is_active").notNull().default(true),
  lastNotifiedAt: timestamp("last_notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWishlistSchema = createInsertSchema(wishlists).omit({ id: true, lastNotifiedAt: true, createdAt: true });
export type InsertWishlist = z.infer<typeof insertWishlistSchema>;
export type Wishlist = typeof wishlists.$inferSelect;

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  emoji: text("emoji"),
  coverImage: text("cover_image"),
  categories: text("categories").array(),
  keywords: text("keywords").array(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({ id: true, createdAt: true });
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collections.$inferSelect;

export const loyaltyPoints = pgTable("loyalty_points", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  points: integer("points").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  tier: varchar("tier").notNull().default("bronze"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type LoyaltyPoints = typeof loyaltyPoints.$inferSelect;

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  points: integer("points").notNull(),
  type: varchar("type").notNull(),
  description: text("description"),
  referenceId: varchar("reference_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;

export const loyaltyTiers = ["bronze", "silver", "gold", "platinum"] as const;
export const loyaltyPointValues = {
  listing_created: 10,
  listing_sold: 50,
  purchase_made: 25,
  review_written: 15,
  referral: 100,
  daily_login: 5,
  first_listing: 50,
} as const;

export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  startingPrice: integer("starting_price").notNull(),
  reservePrice: integer("reserve_price"),
  currentBid: integer("current_bid"),
  currentBidderId: varchar("current_bidder_id"),
  bidCount: integer("bid_count").notNull().default(0),
  endsAt: timestamp("ends_at").notNull(),
  status: varchar("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAuctionSchema = createInsertSchema(auctions).omit({ id: true, currentBid: true, currentBidderId: true, bidCount: true, status: true, createdAt: true });
export type InsertAuction = z.infer<typeof insertAuctionSchema>;
export type Auction = typeof auctions.$inferSelect;

export const bids = pgTable("bids", {
  id: serial("id").primaryKey(),
  auctionId: integer("auction_id").notNull(),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Bid = typeof bids.$inferSelect;

export const neighborhoodEvents = pgTable("neighborhood_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  organizerId: varchar("organizer_id").notNull(),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  participantCount: integer("participant_count").notNull().default(0),
  maxParticipants: integer("max_participants"),
  coverImage: text("cover_image"),
  isPublic: boolean("is_public").notNull().default(true),
  status: varchar("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertNeighborhoodEventSchema = createInsertSchema(neighborhoodEvents).omit({ id: true, participantCount: true, status: true, createdAt: true });
export type InsertNeighborhoodEvent = z.infer<typeof insertNeighborhoodEventSchema>;
export type NeighborhoodEvent = typeof neighborhoodEvents.$inferSelect;

export const neighborhoodParticipants = pgTable("neighborhood_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: varchar("user_id").notNull(),
  listingIds: integer("listing_ids").array(),
  boothInfo: text("booth_info"),
  joinedAt: timestamp("joined_at").defaultNow(),
});
export type NeighborhoodParticipant = typeof neighborhoodParticipants.$inferSelect;

export const shippingOptions = pgTable("shipping_options", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  method: varchar("method").notNull(),
  price: integer("price").notNull().default(0),
  estimatedDays: varchar("estimated_days"),
  isFree: boolean("is_free").notNull().default(false),
});
export const insertShippingOptionSchema = createInsertSchema(shippingOptions).omit({ id: true });
export type InsertShippingOption = z.infer<typeof insertShippingOptionSchema>;
export type ShippingOption = typeof shippingOptions.$inferSelect;

export const communityTips = pgTable("community_tips", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: varchar("category").notNull().default("general"),
  upvotes: integer("upvotes").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCommunityTipSchema = createInsertSchema(communityTips).omit({ id: true, upvotes: true, isFeatured: true, createdAt: true });
export type InsertCommunityTip = z.infer<typeof insertCommunityTipSchema>;
export type CommunityTip = typeof communityTips.$inferSelect;

export const tipVotes = pgTable("tip_votes", {
  id: serial("id").primaryKey(),
  tipId: integer("tip_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type TipVote = typeof tipVotes.$inferSelect;

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"),
  bankName: varchar("bank_name"),
  accountHolderName: varchar("account_holder_name"),
  accountLastFour: varchar("account_last_four"),
  accountNumber: varchar("account_number"),
  accountType: varchar("account_type"),
  routingNumber: varchar("routing_number"),
  swiftCode: varchar("swift_code"),
  bankAddress: varchar("bank_address"),
  paypalEmail: varchar("paypal_email"),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  adminNote: text("admin_note"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true, status: true, adminNote: true, processedAt: true, createdAt: true,
});
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export const payoutStatuses = ["pending", "processing", "completed", "rejected"] as const;

export const shippingCarriers = ["UPS", "USPS", "FedEx", "DHL", "Canada Post", "Royal Mail", "Other"] as const;
export const offerStatuses = ["pending", "accepted", "rejected", "countered", "expired"] as const;
export const orderStatuses = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
export const verificationLevels = ["unverified", "email_verified", "id_verified", "trusted_seller"] as const;
export const escrowStatuses = ["none", "held", "released", "disputed", "refunded"] as const;

export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type AdminSetting = typeof adminSettings.$inferSelect;
