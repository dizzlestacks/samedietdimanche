import { db } from "./db";
import { users } from "@shared/models/auth";
import {
  listings,
  messages,
  shopSuggestions,
  verificationRequests,
  favorites,
  reports,
  savedSearches,
  reviews,
  events,
  eventRsvps,
  eventParticipants,
  offers,
  orders,
  referrals,
  listingAnalytics,
  notifications,
  feedback,
  categories,
  saleEventTypes,
  type CreateListingRequest,
  type UpdateListingRequest,
  type ListingResponse,
  type Message,
  type InsertMessage,
  type ShopSuggestion,
  type InsertShopSuggestion,
  type VerificationRequest,
  type Favorite,
  type Report,
  type InsertReport,
  type SavedSearch,
  type InsertSavedSearch,
  type Review,
  type InsertReview,
  type Event,
  type InsertEvent,
  type EventRsvp,
  type EventParticipant,
  type Offer,
  type InsertOffer,
  type Order,
  type InsertOrder,
  type Referral,
  type ListingAnalytic,
  type Notification,
} from "@shared/schema";
import { eq, desc, asc, and, ilike, gte, lte, or, sql, gt, count, inArray, avg, isNull } from "drizzle-orm";

export interface IStorage {
  getListings(params: any): Promise<ListingResponse[]>;
  getListingsPaginated(params: any): Promise<{ items: ListingResponse[]; total: number; hasMore: boolean }>;
  getListing(id: number): Promise<ListingResponse | undefined>;
  createListing(userId: string, listing: CreateListingRequest): Promise<ListingResponse>;
  updateListing(id: number, userId: string, updates: UpdateListingRequest): Promise<ListingResponse>;
  deleteListing(id: number, userId: string): Promise<void>;
  boostListing(id: number, userId: string, boostType: "category" | "featured" | "spotlight", durationDays?: number): Promise<ListingResponse>;
  deductBoostCredits(userId: string, amount: number): Promise<void>;
  expireBoosts(): Promise<Array<{ id: number; userId: string; title: string }>>;
  markSold(id: number, userId: string, isSold: boolean): Promise<ListingResponse>;
  renewListing(id: number, userId: string): Promise<ListingResponse>;
  incrementViewCount(id: number): Promise<void>;

  sendMessage(senderId: string, data: InsertMessage): Promise<Message>;
  getConversations(userId: string): Promise<any[]>;
  getThread(userId: string, otherId: string, listingId: number | null): Promise<Message[]>;
  markThreadRead(userId: string, senderId: string, listingId: number | null): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  deleteConversation(userId: string, otherId: string, listingId: number | null): Promise<void>;

  submitShopSuggestion(userId: string, data: InsertShopSuggestion): Promise<ShopSuggestion>;
  getShopSuggestions(listingId: number): Promise<ShopSuggestion[]>;
  applyShopSuggestion(id: number, ownerId: string): Promise<void>;

  submitVerificationRequest(userId: string, documentUrl: string, listingId?: number, sellerId?: string): Promise<VerificationRequest>;
  getVerificationStatus(userId: string): Promise<VerificationRequest | undefined>;
  getListingVerificationStatus(userId: string, listingId: number): Promise<VerificationRequest | undefined>;
  getVerificationRequestsForSeller(sellerId: string): Promise<VerificationRequest[]>;
  getVerificationRequestsForListing(listingId: number): Promise<VerificationRequest[]>;
  updateVerificationRequestStatus(id: number, status: string, sellerNote?: string): Promise<void>;
  getAllVerifications(): Promise<VerificationRequest[]>;
  updateVerificationStatus(id: number, status: string, adminNote?: string, expiryDate?: Date): Promise<void>;
  updateUserVerificationLevel(userId: string, level: string): Promise<void>;

  addFavorite(userId: string, listingId: number): Promise<Favorite>;
  removeFavorite(userId: string, listingId: number): Promise<void>;
  getUserFavorites(userId: string): Promise<ListingResponse[]>;
  isFavorited(userId: string, listingId: number): Promise<boolean>;

  reportListing(reporterId: string, data: InsertReport): Promise<Report>;
  getReports(): Promise<(Report & { listing: ListingResponse | undefined })[]>;
  updateReportStatus(id: number, status: string, adminResponse?: string): Promise<void>;
  getSimilarListings(id: number, category: string, city: string): Promise<ListingResponse[]>;
  getSearchSuggestions(q: string): Promise<{ titles: string[]; categories: string[] }>;

  createSavedSearch(userId: string, data: InsertSavedSearch): Promise<SavedSearch>;
  getSavedSearches(userId: string): Promise<SavedSearch[]>;
  deleteSavedSearch(id: number, userId: string): Promise<void>;
  getAllSavedSearches(): Promise<SavedSearch[]>;
  getUser(id: string): Promise<any | undefined>;

  createReview(data: InsertReview): Promise<Review>;
  getReviewsForSeller(sellerId: string): Promise<Review[]>;
  getReviewSummary(sellerId: string): Promise<{ avg: number; count: number }>;
  hasInteractedWithSeller(userId: string, sellerId: string): Promise<boolean>;
  hasReviewedSeller(userId: string, sellerId: string): Promise<boolean>;
  replyToReview(reviewId: number, sellerId: string, reply: string): Promise<Review>;
  getReviewById(id: number): Promise<Review | undefined>;

  createEvent(userId: string, data: InsertEvent): Promise<Event>;
  getEvents(params?: any): Promise<Event[]>;
  getEventById(id: number): Promise<Event | undefined>;
  rsvpEvent(eventId: number, userId: string): Promise<EventRsvp>;
  cancelRsvp(eventId: number, userId: string): Promise<void>;
  getEventRsvps(eventId: number): Promise<EventRsvp[]>;
  getUserEvents(userId: string): Promise<Event[]>;

  createOffer(buyerId: string, data: InsertOffer): Promise<Offer>;
  getOffers(userId: string): Promise<Offer[]>;
  getOfferById(id: number): Promise<Offer | undefined>;
  updateOfferStatus(id: number, status: string, counterAmount?: number): Promise<Offer>;

  createOrder(data: any): Promise<Order>;
  getOrders(userId: string): Promise<Order[]>;
  getOrderById(id: number): Promise<Order | undefined>;
  updateOrder(id: number, updates: any): Promise<Order>;

  generateReferralCode(userId: string): Promise<string>;
  getReferralByCode(code: string): Promise<any>;
  applyReferral(referralCode: string, referredUserId: string): Promise<void>;
  getReferralStats(userId: string): Promise<{ totalReferred: number; boostCredits: number }>;

  trackView(listingId: number, source?: string): Promise<void>;
  getAnalyticsOverview(userId: string): Promise<any>;
  getListingAnalytics(userId: string): Promise<any[]>;
  getViewsOverTime(userId: string, days?: number): Promise<any[]>;

  updateUserVerificationLevel(userId: string, level: string): Promise<void>;
  updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; displayName?: string; profileImageUrl?: string; email?: string; bio?: string; phone?: string; website?: string; city?: string; country?: string; favoriteCategories?: string[]; storefrontBio?: string; storefrontTagline?: string; storefrontBanner?: string }): Promise<any>;

  markDonation(id: number, userId: string, isDonation: boolean, recipient?: string): Promise<ListingResponse>;
  goLive(id: number, userId: string): Promise<ListingResponse>;
  goOffline(id: number, userId: string): Promise<ListingResponse>;

  joinNeighborhoodEvent(eventId: number, userId: string, data: any): Promise<EventParticipant>;
  leaveNeighborhoodEvent(eventId: number, userId: string): Promise<void>;
  getEventParticipants(eventId: number): Promise<EventParticipant[]>;

  confirmDelivery(orderId: number, userId: string): Promise<Order>;
  disputeOrder(orderId: number, userId: string, reason: string): Promise<Order>;

  getReputationScore(userId: string): Promise<any>;

  createNotification(data: { userId: string; type: string; title: string; body?: string; link?: string }): Promise<Notification>;
  getNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: number, userId?: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  createFeedback(data: { type: string; message: string; email?: string }): Promise<any>;
  getAllFeedback(): Promise<any[]>;
  updateFeedbackStatus(id: number, status: string, adminNote?: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getSearchSuggestions(q: string): Promise<{ titles: string[]; categories: string[] }> {
    const matchingListings = await db.select({ title: listings.title })
      .from(listings)
      .where(and(ilike(listings.title, `%${q}%`), eq(listings.isSold, false)))
      .limit(6);

    const titles = matchingListings.map(l => l.title);

    const matchingCategories = categories.filter(c => 
      c.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 6);

    return { titles, categories: matchingCategories };
  }

  async getSimilarListings(id: number, category: string, city: string): Promise<ListingResponse[]> {
    return await db.select().from(listings)
      .where(
        and(
          eq(listings.category, category),
          eq(listings.city, city),
          sql`${listings.id} != ${id}`,
          eq(listings.isSold, false)
        )
      )
      .limit(6);
  }

  private buildListingConditions(params: any) {
    const conditions = [];

    if (!params?.includeExpired) {
      conditions.push(or(
        sql`${listings.expiresAt} IS NULL`,
        gt(listings.expiresAt, new Date())
      ));
    }

    if (params?.category) conditions.push(eq(listings.category, params.category));
    if (params?.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(listings.title, term),
          ilike(listings.description, term),
          ilike(listings.city, term),
          sql`${listings.userId} IN (SELECT ${users.id} FROM ${users} WHERE ${users.displayName} ILIKE ${term} OR ${users.firstName} ILIKE ${term})`
        )
      );
    }
    if (params?.country) conditions.push(eq(listings.country, params.country));
    if (params?.city) conditions.push(eq(listings.city, params.city));
    if (params?.isShop !== undefined) conditions.push(eq(listings.isShop, params.isShop));
    if (params?.isBoosted !== undefined) conditions.push(eq(listings.isBoosted, params.isBoosted));
    if (params?.listingType) {
      if (params.listingType === "sale_event") {
        // Special meta-filter: match any date-driven sale-event type.
        conditions.push(inArray(listings.listingType, saleEventTypes as unknown as string[]));
      } else {
        conditions.push(eq(listings.listingType, params.listingType));
      }
    }
    if (params?.minPrice) conditions.push(gte(listings.price, parseInt(params.minPrice, 10)));
    if (params?.maxPrice) conditions.push(lte(listings.price, parseInt(params.maxPrice, 10)));
    if (params?.userId) conditions.push(eq(listings.userId, params.userId));
    if (params?.condition) conditions.push(eq(listings.condition, params.condition));
    if (params?.freeOnly === true || params?.freeOnly === "true") conditions.push(eq(listings.price, 0));
    if (!params?.userId && !params?.includeSold) conditions.push(eq(listings.isSold, false));

    if (params?.lat && params?.lng && params?.radius) {
      const lat = parseFloat(params.lat);
      const lng = parseFloat(params.lng);
      const radiusKm = parseFloat(params.radius);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm) && radiusKm > 0) {
        conditions.push(
          sql`${listings.lat} IS NOT NULL AND ${listings.lng} IS NOT NULL AND (
            6371 * acos(
              cos(radians(${lat})) * cos(radians(CAST(${listings.lat} AS DOUBLE PRECISION)))
              * cos(radians(CAST(${listings.lng} AS DOUBLE PRECISION)) - radians(${lng}))
              + sin(radians(${lat})) * sin(radians(CAST(${listings.lat} AS DOUBLE PRECISION)))
            )
          ) <= ${radiusKm}`
        );
      }
    }

    return conditions;
  }

  private applyListingSort(query: any, params: any) {
    if (params?.sort === 'price_asc') return query.orderBy(asc(listings.price));
    if (params?.sort === 'price_desc') return query.orderBy(desc(listings.price));
    if (params?.sort === 'boosted') return query.orderBy(
      sql`CASE ${listings.boostType} WHEN 'spotlight' THEN 3 WHEN 'featured' THEN 2 WHEN 'category' THEN 1 ELSE 0 END DESC`,
      desc(listings.createdAt)
    );
    return query.orderBy(
      sql`CASE ${listings.boostType} WHEN 'spotlight' THEN 3 WHEN 'featured' THEN 2 WHEN 'category' THEN 1 ELSE 0 END DESC`,
      desc(listings.createdAt)
    );
  }

  async getListings(params: any): Promise<ListingResponse[]> {
    const conditions = this.buildListingConditions(params);
    let query = db.select().from(listings);
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    query = this.applyListingSort(query, params);
    return await query;
  }

  async getListingsPaginated(params: any): Promise<{ items: ListingResponse[]; total: number; hasMore: boolean }> {
    const conditions = this.buildListingConditions(params);
    const limit = params?.limit || 40;
    const offset = params?.offset || 0;

    let countQuery = db.select({ total: count() }).from(listings);
    if (conditions.length > 0) countQuery = countQuery.where(and(...conditions)) as any;
    const [countResult] = await countQuery;
    const total = countResult?.total || 0;

    let query = db.select().from(listings);
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    query = this.applyListingSort(query, params);
    query = (query as any).limit(limit).offset(offset);

    const items = await query;
    return { items, total, hasMore: offset + items.length < total };
  }

  async getListing(id: number): Promise<ListingResponse | undefined> {
    const [listing] = await db.select().from(listings).where(eq(listings.id, id));
    return listing;
  }

  async createListing(userId: string, insertListing: CreateListingRequest): Promise<ListingResponse> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const [listing] = await db.insert(listings).values({ ...insertListing, userId, expiresAt }).returning();
    return listing;
  }

  async updateListing(id: number, userId: string, updates: UpdateListingRequest): Promise<ListingResponse> {
    const [listing] = await db.update(listings).set(updates)
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async deleteListing(id: number, userId: string): Promise<void> {
    await db.delete(listings).where(and(eq(listings.id, id), eq(listings.userId, userId)));
  }

  async boostListing(id: number, userId: string, boostType: "category" | "featured" | "spotlight", durationDays: number = 7): Promise<ListingResponse> {
    const boostExpiresAt = new Date();
    boostExpiresAt.setDate(boostExpiresAt.getDate() + durationDays);
    const [listing] = await db.update(listings).set({ isBoosted: true, boostType, boostExpiresAt })
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async deductBoostCredits(userId: string, amount: number): Promise<void> {
    await db.update(users).set({
      boostCredits: sql`GREATEST(${users.boostCredits} - ${amount}, 0)`,
    }).where(eq(users.id, userId));
  }

  async expireBoosts(): Promise<Array<{ id: number; userId: string; title: string }>> {
    const now = new Date();
    const expired = await db.update(listings)
      .set({ isBoosted: false, boostType: null, boostExpiresAt: null })
      .where(and(
        eq(listings.isBoosted, true),
        sql`${listings.boostExpiresAt} IS NOT NULL`,
        lte(listings.boostExpiresAt, now)
      ))
      .returning({ id: listings.id, userId: listings.userId, title: listings.title });
    return expired;
  }

  async markSold(id: number, userId: string, isSold: boolean): Promise<ListingResponse> {
    const [listing] = await db.update(listings).set({ isSold })
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async renewListing(id: number, userId: string): Promise<ListingResponse> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const [listing] = await db.update(listings).set({ expiresAt })
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async incrementViewCount(id: number): Promise<void> {
    await db.update(listings).set({ viewCount: sql`${listings.viewCount} + 1` }).where(eq(listings.id, id));
  }

  async sendMessage(senderId: string, data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values({ ...data, senderId }).returning();
    return msg;
  }

  async getConversations(userId: string): Promise<any[]> {
    const allMessages = await db.select().from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .orderBy(desc(messages.createdAt));

    if (allMessages.length === 0) return [];

    const seen = new Set<string>();
    const convos: any[] = [];
    const convoKeys: { otherId: string; listingId: number | null; lastMessage: any }[] = [];

    for (const msg of allMessages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const key = `${otherId}::${msg.listingId ?? 'null'}`;
      if (!seen.has(key)) {
        seen.add(key);
        convoKeys.push({ otherId, listingId: msg.listingId, lastMessage: msg });
      }
    }

    const unreadMessages = await db.select().from(messages)
      .where(and(eq(messages.receiverId, userId), eq(messages.isRead, false)));

    const unreadMap = new Map<string, number>();
    for (const msg of unreadMessages) {
      const key = `${msg.senderId}::${msg.listingId ?? 'null'}`;
      unreadMap.set(key, (unreadMap.get(key) || 0) + 1);
    }

    const listingIds = [...new Set(convoKeys.filter(c => c.listingId).map(c => c.listingId!))] ;
    const listingsMap = new Map<number, ListingResponse>();
    if (listingIds.length > 0) {
      const listingRows = await db.select().from(listings).where(inArray(listings.id, listingIds));
      for (const l of listingRows) listingsMap.set(l.id, l);
    }

    for (const convo of convoKeys) {
      const key = `${convo.otherId}::${convo.listingId ?? 'null'}`;
      convos.push({
        otherId: convo.otherId,
        listingId: convo.listingId,
        lastMessage: convo.lastMessage,
        unreadCount: unreadMap.get(key) || 0,
        listing: convo.listingId ? listingsMap.get(convo.listingId) || null : null,
      });
    }
    return convos;
  }

  async getThread(userId: string, otherId: string, listingId: number | null): Promise<Message[]> {
    const conditions = [or(
      and(eq(messages.senderId, userId), eq(messages.receiverId, otherId)),
      and(eq(messages.senderId, otherId), eq(messages.receiverId, userId))
    )];
    if (listingId) conditions.push(eq(messages.listingId, listingId) as any);
    return await db.select().from(messages).where(and(...conditions)).orderBy(asc(messages.createdAt));
  }

  async markThreadRead(userId: string, senderId: string, listingId: number | null): Promise<void> {
    const conditions = [eq(messages.receiverId, userId), eq(messages.senderId, senderId), eq(messages.isRead, false)];
    if (listingId) conditions.push(eq(messages.listingId, listingId) as any);
    await db.update(messages).set({ isRead: true }).where(and(...conditions));
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db.select({ total: count() }).from(messages)
      .where(and(eq(messages.receiverId, userId), eq(messages.isRead, false)));
    return result?.total || 0;
  }

  async deleteConversation(userId: string, otherId: string, listingId: number | null): Promise<void> {
    const conditions = [
      or(
        and(eq(messages.senderId, userId), eq(messages.receiverId, otherId)),
        and(eq(messages.senderId, otherId), eq(messages.receiverId, userId))
      ),
    ];
    if (listingId !== null) {
      conditions.push(eq(messages.listingId, listingId));
    } else {
      conditions.push(isNull(messages.listingId));
    }
    await db.delete(messages).where(and(...conditions));
  }

  async submitShopSuggestion(userId: string, data: InsertShopSuggestion): Promise<ShopSuggestion> {
    const [suggestion] = await db.insert(shopSuggestions).values({ ...data, userId }).returning();
    return suggestion;
  }

  async getShopSuggestions(listingId: number): Promise<ShopSuggestion[]> {
    return await db.select().from(shopSuggestions)
      .where(eq(shopSuggestions.listingId, listingId)).orderBy(desc(shopSuggestions.createdAt));
  }

  async applyShopSuggestion(id: number, ownerId: string): Promise<void> {
    const [suggestion] = await db.select().from(shopSuggestions).where(eq(shopSuggestions.id, id));
    if (!suggestion) throw new Error("Suggestion not found");
    const listing = await this.getListing(suggestion.listingId);
    if (!listing || listing.userId !== ownerId) throw new Error("Unauthorized");
    const updates: any = {};
    if (suggestion.phone) updates.phone = suggestion.phone;
    if (suggestion.website) updates.website = suggestion.website;
    if (suggestion.hours) updates.hours = suggestion.hours;
    if (Object.keys(updates).length > 0) await db.update(listings).set(updates).where(eq(listings.id, suggestion.listingId));
    await db.update(shopSuggestions).set({ status: 'applied' }).where(eq(shopSuggestions.id, id));
  }

  async submitVerificationRequest(userId: string, documentUrl: string, listingId?: number, sellerId?: string): Promise<VerificationRequest> {
    if (listingId) {
      const existing = await this.getListingVerificationStatus(userId, listingId);
      if (existing && existing.status === 'pending') return existing;
    } else {
      const existing = await this.getVerificationStatus(userId);
      if (existing && existing.status === 'pending') return existing;
    }
    const [req] = await db.insert(verificationRequests).values({
      userId, documentUrl, status: 'pending',
      listingId: listingId || null,
      sellerId: sellerId || null,
    }).returning();
    return req;
  }

  async getVerificationStatus(userId: string): Promise<VerificationRequest | undefined> {
    const [req] = await db.select().from(verificationRequests)
      .where(eq(verificationRequests.userId, userId)).orderBy(desc(verificationRequests.createdAt)).limit(1);
    return req;
  }

  async getListingVerificationStatus(userId: string, listingId: number): Promise<VerificationRequest | undefined> {
    const [req] = await db.select().from(verificationRequests)
      .where(and(
        eq(verificationRequests.userId, userId),
        eq(verificationRequests.listingId, listingId)
      ))
      .orderBy(desc(verificationRequests.createdAt)).limit(1);
    return req;
  }

  async getVerificationRequestsForSeller(sellerId: string): Promise<VerificationRequest[]> {
    return await db.select().from(verificationRequests)
      .where(eq(verificationRequests.sellerId, sellerId))
      .orderBy(desc(verificationRequests.createdAt));
  }

  async getVerificationRequestsForListing(listingId: number): Promise<VerificationRequest[]> {
    return await db.select().from(verificationRequests)
      .where(eq(verificationRequests.listingId, listingId))
      .orderBy(desc(verificationRequests.createdAt));
  }

  async updateVerificationRequestStatus(id: number, status: string, sellerNote?: string): Promise<void> {
    const updates: any = { status };
    if (sellerNote !== undefined) updates.sellerNote = sellerNote;
    await db.update(verificationRequests).set(updates).where(eq(verificationRequests.id, id));
  }

  async getAllVerifications(): Promise<VerificationRequest[]> {
    return await db.select().from(verificationRequests).orderBy(desc(verificationRequests.createdAt));
  }

  async updateVerificationStatus(id: number, status: string, adminNote?: string, expiryDate?: Date): Promise<void> {
    const updates: any = { status };
    if (adminNote !== undefined) updates.adminNote = adminNote;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate;
    await db.update(verificationRequests).set(updates).where(eq(verificationRequests.id, id));
  }

  async updateUserVerificationLevel(userId: string, level: string): Promise<void> {
    await db.update(users).set({ verificationLevel: level }).where(eq(users.id, userId));
  }

  async addFavorite(userId: string, listingId: number): Promise<Favorite> {
    const existing = await db.select().from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId))).limit(1);
    if (existing.length > 0) return existing[0];
    const [fav] = await db.insert(favorites).values({ userId, listingId }).returning();
    return fav;
  }

  async removeFavorite(userId: string, listingId: number): Promise<void> {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)));
  }

  async getUserFavorites(userId: string): Promise<ListingResponse[]> {
    const favRows = await db.select().from(favorites)
      .where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
    if (favRows.length === 0) return [];
    const listingIds = favRows.map(f => f.listingId);
    const listingRows = await db.select().from(listings).where(inArray(listings.id, listingIds));
    const listingsMap = new Map(listingRows.map(l => [l.id, l]));
    return listingIds.map(id => listingsMap.get(id)).filter(Boolean) as ListingResponse[];
  }

  async isFavorited(userId: string, listingId: number): Promise<boolean> {
    const [row] = await db.select().from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId))).limit(1);
    return !!row;
  }

  async reportListing(reporterId: string, data: InsertReport): Promise<Report> {
    const [report] = await db.insert(reports).values({ ...data, reporterId }).returning();
    return report;
  }

  async getReports(): Promise<(Report & { listing: ListingResponse | undefined })[]> {
    const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
    if (allReports.length === 0) return [];
    const listingIds = [...new Set(allReports.map(r => r.listingId))];
    const listingRows = await db.select().from(listings).where(inArray(listings.id, listingIds));
    const listingsMap = new Map(listingRows.map(l => [l.id, l]));
    return allReports.map(r => ({ ...r, listing: listingsMap.get(r.listingId) }));
  }

  async updateReportStatus(id: number, status: string, adminResponse?: string): Promise<void> {
    const updates: any = { status };
    if (adminResponse !== undefined) updates.adminResponse = adminResponse;
    await db.update(reports).set(updates).where(eq(reports.id, id));
  }

  async getUser(id: string): Promise<any | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createSavedSearch(userId: string, data: InsertSavedSearch): Promise<SavedSearch> {
    const [search] = await db.insert(savedSearches).values({ ...data, userId }).returning();
    return search;
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db.select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.createdAt));
  }

  async deleteSavedSearch(id: number, userId: string): Promise<void> {
    await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
  }

  async getAllSavedSearches(): Promise<SavedSearch[]> {
    return await db.select().from(savedSearches);
  }

  async createReview(data: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(data).returning();
    const summary = await this.getReviewSummary(data.sellerId);
    await db.update(users).set({
      sellerRating: summary.avg.toFixed(1),
      reviewCount: summary.count,
    }).where(eq(users.id, data.sellerId));
    return review;
  }

  async getReviewsForSeller(sellerId: string): Promise<Review[]> {
    return await db.select().from(reviews)
      .where(eq(reviews.sellerId, sellerId))
      .orderBy(desc(reviews.createdAt));
  }

  async getReviewSummary(sellerId: string): Promise<{ avg: number; count: number }> {
    const [result] = await db.select({
      avgRating: avg(reviews.rating),
      total: count(),
    }).from(reviews).where(eq(reviews.sellerId, sellerId));
    if (!result || result.total === 0) return { avg: 0, count: 0 };
    return { avg: Number(result.avgRating) || 0, count: result.total };
  }

  async getReviewById(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async replyToReview(reviewId: number, sellerId: string, reply: string): Promise<Review> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
    if (!review) throw new Error("Review not found");
    if (review.sellerId !== sellerId) throw new Error("Unauthorized — only the reviewed seller can reply");
    if (review.sellerReply) throw new Error("You have already replied to this review");
    const [updated] = await db.update(reviews)
      .set({ sellerReply: reply, sellerReplyAt: new Date() })
      .where(eq(reviews.id, reviewId))
      .returning();
    return updated;
  }

  async hasInteractedWithSeller(userId: string, sellerId: string): Promise<boolean> {
    const [order] = await db.select({ id: orders.id }).from(orders)
      .where(and(eq(orders.buyerId, userId), eq(orders.sellerId, sellerId))).limit(1);
    if (order) return true;

    const sellerListingIds = await db.select({ id: listings.id }).from(listings).where(eq(listings.userId, sellerId));
    if (sellerListingIds.length > 0) {
      const ids = sellerListingIds.map(l => l.id);
      const [offer] = await db.select({ id: offers.id }).from(offers)
        .where(and(eq(offers.buyerId, userId), eq(offers.status, "accepted"), inArray(offers.listingId, ids))).limit(1);
      if (offer) return true;
    }

    return false;
  }

  async hasReviewedSeller(userId: string, sellerId: string): Promise<boolean> {
    const [existing] = await db.select({ id: reviews.id }).from(reviews)
      .where(and(eq(reviews.reviewerId, userId), eq(reviews.sellerId, sellerId))).limit(1);
    return !!existing;
  }

  async createEvent(userId: string, data: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values({ ...data, userId }).returning();
    return event;
  }

  async getEvents(params?: any): Promise<Event[]> {
    const conditions = [];
    if (params?.upcoming) conditions.push(gt(events.endDate, new Date()));
    if (params?.city) conditions.push(eq(events.city, params.city));
    if (params?.country) conditions.push(eq(events.country, params.country));
    let query = db.select().from(events);
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    return await query.orderBy(asc(events.startDate));
  }

  async getEventById(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async rsvpEvent(eventId: number, userId: string): Promise<EventRsvp> {
    const existing = await db.select().from(eventRsvps)
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId))).limit(1);
    if (existing.length > 0) return existing[0];
    const [rsvp] = await db.insert(eventRsvps).values({ eventId, userId }).returning();
    return rsvp;
  }

  async cancelRsvp(eventId: number, userId: string): Promise<void> {
    await db.delete(eventRsvps).where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
  }

  async getEventRsvps(eventId: number): Promise<EventRsvp[]> {
    return await db.select().from(eventRsvps).where(eq(eventRsvps.eventId, eventId));
  }

  async getUserEvents(userId: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.userId, userId)).orderBy(desc(events.createdAt));
  }

  async createOffer(buyerId: string, data: InsertOffer): Promise<Offer> {
    const [offer] = await db.insert(offers).values({ ...data, buyerId }).returning();
    return offer;
  }

  async getOffers(userId: string): Promise<Offer[]> {
    return await db.select().from(offers)
      .where(or(eq(offers.buyerId, userId), eq(offers.sellerId, userId)))
      .orderBy(desc(offers.createdAt));
  }

  async getOfferById(id: number): Promise<Offer | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.id, id));
    return offer;
  }

  async updateOfferStatus(id: number, status: string, counterAmount?: number): Promise<Offer> {
    const updates: any = { status, updatedAt: new Date() };
    if (counterAmount !== undefined) updates.counterAmount = counterAmount;
    const [offer] = await db.update(offers).set(updates).where(eq(offers.id, id)).returning();
    if (!offer) throw new Error("Offer not found");
    return offer;
  }

  async createOrder(data: any): Promise<Order> {
    const [order] = await db.insert(orders).values(data).returning();
    return order;
  }

  async getOrders(userId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(or(eq(orders.buyerId, userId), eq(orders.sellerId, userId)))
      .orderBy(desc(orders.createdAt));
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async updateOrder(id: number, updates: any): Promise<Order> {
    updates.updatedAt = new Date();
    const [order] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    if (!order) throw new Error("Order not found");
    return order;
  }

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (user?.referralCode) return user.referralCode;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
    return code;
  }

  async getReferralByCode(code: string): Promise<any> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, code));
    return user;
  }

  async applyReferral(referralCode: string, referredUserId: string): Promise<void> {
    const referrer = await this.getReferralByCode(referralCode);
    if (!referrer) return;
    await db.insert(referrals).values({
      referrerId: referrer.id,
      referredUserId,
      referralCode,
      boostCredits: 1,
      status: "completed",
    });
    await db.update(users).set({
      boostCredits: sql`${users.boostCredits} + 1`,
    }).where(eq(users.id, referrer.id));
  }

  async getReferralStats(userId: string): Promise<{ totalReferred: number; boostCredits: number }> {
    const [refCount] = await db.select({ total: count() }).from(referrals)
      .where(eq(referrals.referrerId, userId));
    const user = await this.getUser(userId);
    return { totalReferred: refCount?.total || 0, boostCredits: user?.boostCredits ?? 0 };
  }

  async trackView(listingId: number, source?: string): Promise<void> {
    await db.insert(listingAnalytics).values({ listingId, source });
  }

  async getAnalyticsOverview(userId: string): Promise<any> {
    const [listingStats] = await db.select({
      totalListings: count(),
      totalViews: sql<number>`COALESCE(SUM(${listings.viewCount}), 0)`,
    }).from(listings).where(eq(listings.userId, userId));

    if (!listingStats || listingStats.totalListings === 0) {
      return { totalViews: 0, totalListings: 0, totalFavorites: 0, totalMessages: 0 };
    }

    const userListingIds = await db.select({ id: listings.id }).from(listings).where(eq(listings.userId, userId));
    const ids = userListingIds.map(l => l.id);

    const [favResult] = await db.select({ total: count() }).from(favorites)
      .where(inArray(favorites.listingId, ids));

    const [msgResult] = await db.select({ total: count() }).from(messages)
      .where(eq(messages.receiverId, userId));

    return {
      totalViews: Number(listingStats.totalViews),
      totalListings: listingStats.totalListings,
      totalFavorites: favResult?.total || 0,
      totalMessages: msgResult?.total || 0,
    };
  }

  async getListingAnalytics(userId: string): Promise<any[]> {
    const userListings = await db.select().from(listings).where(eq(listings.userId, userId));
    if (userListings.length === 0) return [];

    const ids = userListings.map(l => l.id);

    const viewCounts = await db.select({
      listingId: listingAnalytics.listingId,
      total: count(),
    }).from(listingAnalytics)
      .where(inArray(listingAnalytics.listingId, ids))
      .groupBy(listingAnalytics.listingId);

    const favCounts = await db.select({
      listingId: favorites.listingId,
      total: count(),
    }).from(favorites)
      .where(inArray(favorites.listingId, ids))
      .groupBy(favorites.listingId);

    const msgCounts = await db.select({
      listingId: messages.listingId,
      total: count(),
    }).from(messages)
      .where(and(inArray(messages.listingId, ids), eq(messages.receiverId, userId)))
      .groupBy(messages.listingId);

    const viewMap = new Map(viewCounts.map(v => [v.listingId, v.total]));
    const favMap = new Map(favCounts.map(f => [f.listingId, f.total]));
    const msgMap = new Map(msgCounts.map(m => [m.listingId, m.total]));

    return userListings.map(listing => ({
      listing,
      detailedViews: viewMap.get(listing.id) || 0,
      favorites: favMap.get(listing.id) || 0,
      messages: msgMap.get(listing.id) || 0,
    })).sort((a, b) => b.detailedViews - a.detailedViews);
  }

  async getViewsOverTime(userId: string, days = 30): Promise<any[]> {
    const userListings = await db.select({ id: listings.id }).from(listings).where(eq(listings.userId, userId));
    const listingIds = userListings.map(l => l.id);
    if (listingIds.length === 0) return [];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const allViews = await db.select().from(listingAnalytics)
      .where(and(
        sql`${listingAnalytics.listingId} = ANY(${listingIds})`,
        gt(listingAnalytics.createdAt, since)
      ))
      .orderBy(asc(listingAnalytics.createdAt));
    const byDay: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      byDay[d.toISOString().split('T')[0]] = 0;
    }
    for (const v of allViews) {
      if (v.createdAt) {
        const day = v.createdAt.toISOString().split('T')[0];
        byDay[day] = (byDay[day] || 0) + 1;
      }
    }
    return Object.entries(byDay).map(([date, views]) => ({ date, views }));
  }

  async updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; displayName?: string; profileImageUrl?: string; email?: string; bio?: string; phone?: string; website?: string; city?: string; country?: string; favoriteCategories?: string[]; storefrontBio?: string; storefrontTagline?: string; storefrontBanner?: string }): Promise<any> {
    const cleanUpdates: any = {};
    if (updates.firstName !== undefined) cleanUpdates.firstName = updates.firstName;
    if (updates.lastName !== undefined) cleanUpdates.lastName = updates.lastName;
    if (updates.displayName !== undefined) cleanUpdates.displayName = updates.displayName;
    if (updates.profileImageUrl !== undefined) cleanUpdates.profileImageUrl = updates.profileImageUrl;
    if (updates.bio !== undefined) cleanUpdates.bio = updates.bio?.trim() || null;
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone?.trim() || null;
    if (updates.website !== undefined) cleanUpdates.website = updates.website?.trim() || null;
    if (updates.city !== undefined) cleanUpdates.city = updates.city?.trim() || null;
    if (updates.country !== undefined) cleanUpdates.country = updates.country?.trim() || null;
    if (updates.favoriteCategories !== undefined) cleanUpdates.favoriteCategories = updates.favoriteCategories;
    if (updates.storefrontBio !== undefined) cleanUpdates.storefrontBio = updates.storefrontBio?.trim() || null;
    if (updates.storefrontTagline !== undefined) cleanUpdates.storefrontTagline = updates.storefrontTagline?.trim() || null;
    if (updates.storefrontBanner !== undefined) cleanUpdates.storefrontBanner = updates.storefrontBanner?.trim() || null;
    if (updates.email !== undefined) {
      cleanUpdates.email = updates.email;
      const [existing] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      if (existing && existing.email !== updates.email) {
        cleanUpdates.emailVerified = false;
        cleanUpdates.verificationToken = null;
      }
    }
    cleanUpdates.updatedAt = new Date();
    const [updated] = await db.update(users).set(cleanUpdates).where(eq(users.id, userId)).returning();
    return updated;
  }

  async markDonation(id: number, userId: string, isDonation: boolean, recipient?: string): Promise<ListingResponse> {
    const updates: any = { isDonation };
    if (isDonation) { updates.price = 0; updates.donationRecipient = recipient || null; }
    else { updates.donationRecipient = null; }
    const [listing] = await db.update(listings).set(updates)
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async goLive(id: number, userId: string): Promise<ListingResponse> {
    const [listing] = await db.update(listings).set({ isLive: true, liveStartedAt: new Date() })
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async goOffline(id: number, userId: string): Promise<ListingResponse> {
    const [listing] = await db.update(listings).set({ isLive: false, liveStartedAt: null })
      .where(and(eq(listings.id, id), eq(listings.userId, userId))).returning();
    if (!listing) throw new Error("Listing not found or unauthorized");
    return listing;
  }

  async joinNeighborhoodEvent(eventId: number, userId: string, data: any): Promise<EventParticipant> {
    const existing = await db.select().from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId))).limit(1);
    if (existing.length > 0) return existing[0];
    const [p] = await db.insert(eventParticipants).values({ eventId, userId, ...data }).returning();
    return p;
  }

  async leaveNeighborhoodEvent(eventId: number, userId: string): Promise<void> {
    await db.delete(eventParticipants).where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)));
  }

  async getEventParticipants(eventId: number): Promise<EventParticipant[]> {
    return await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, eventId));
  }

  async confirmDelivery(orderId: number, userId: string): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order || order.buyerId !== userId) throw new Error("Order not found or unauthorized");
    if (order.status !== "shipped" || order.escrowStatus !== "held") {
      throw new Error("Order is not in a valid state for delivery confirmation");
    }
    const [updated] = await db.update(orders).set({
      status: "delivered",
      escrowStatus: "released",
      escrowReleaseDate: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(orders.id, orderId), eq(orders.status, "shipped"), eq(orders.escrowStatus, "held"))).returning();
    if (!updated) throw new Error("Order already processed");
    return updated;
  }

  async disputeOrder(orderId: number, userId: string, reason: string): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order || (order.buyerId !== userId && order.sellerId !== userId)) throw new Error("Order not found or unauthorized");
    if (order.escrowStatus !== "held") throw new Error("Can only dispute orders with held funds");
    const [updated] = await db.update(orders).set({
      escrowStatus: "disputed",
      disputeReason: reason,
      updatedAt: new Date(),
    }).where(and(eq(orders.id, orderId), eq(orders.escrowStatus, "held"))).returning();
    if (!updated) throw new Error("Order already processed");
    return updated;
  }

  async getReputationScore(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) return { score: 0, breakdown: {} };
    const reviewSummary = await this.getReviewSummary(userId);
    const verificationPoints: Record<string, number> = {
      unverified: 0, email_verified: 15, id_verified: 30, trusted_seller: 50,
    };
    const vLevel = user.verificationLevel || "unverified";
    const reviewScore = Math.min(reviewSummary.avg * 8, 40);
    const transactionScore = Math.min((user.transactionCount || 0) * 2, 10);
    const verificationScore = verificationPoints[vLevel] || 0;
    const total = Math.round(Math.min(reviewScore + transactionScore + verificationScore, 100));
    return {
      score: total,
      breakdown: {
        reviews: Math.round(reviewScore),
        transactions: transactionScore,
        verification: verificationScore,
      },
      reviewAvg: reviewSummary.avg,
      reviewCount: reviewSummary.count,
      transactionCount: user.transactionCount || 0,
      verificationLevel: vLevel,
    };
  }

  async createNotification(data: { userId: string; type: string; title: string; body?: string; link?: string }): Promise<Notification> {
    const [notif] = await db.insert(notifications).values(data).returning();
    return notif;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async markNotificationRead(id: number, userId?: string): Promise<void> {
    const conditions = [eq(notifications.id, id)];
    if (userId) conditions.push(eq(notifications.userId, userId));
    await db.update(notifications).set({ isRead: true }).where(and(...conditions));
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ total: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result?.total || 0;
  }

  async createFeedback(data: { type: string; message: string; email?: string }): Promise<any> {
    const [result] = await db.insert(feedback).values(data).returning();
    return result;
  }

  async getAllFeedback(): Promise<any[]> {
    return db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }

  async updateFeedbackStatus(id: number, status: string, adminNote?: string): Promise<any> {
    const updates: any = { status };
    if (adminNote !== undefined) updates.adminNote = adminNote;
    const [result] = await db.update(feedback).set(updates).where(eq(feedback.id, id)).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
