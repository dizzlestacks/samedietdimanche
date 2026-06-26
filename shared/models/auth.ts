import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, boolean, text } from "drizzle-orm/pg-core";

// Session storage table.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  displayName: varchar("display_name"),
  passwordHash: varchar("password_hash"),
  authType: varchar("auth_type").default("local"),
  referralCode: varchar("referral_code").unique(),
  verificationLevel: varchar("verification_level").default("unverified"),
  phoneVerified: boolean("phone_verified").default(false),
  transactionCount: integer("transaction_count").default(0),
  sellerRating: varchar("seller_rating"),
  reviewCount: integer("review_count").default(0),
  boostCredits: integer("boost_credits").default(0),
  bio: text("bio"),
  phone: varchar("phone"),
  website: varchar("website"),
  city: varchar("city"),
  country: varchar("country"),
  favoriteCategories: text("favorite_categories").array(),
  storefrontBio: text("storefront_bio"),
  storefrontBanner: text("storefront_banner"),
  storefrontTagline: text("storefront_tagline"),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: varchar("verification_token"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  emailNotifications: boolean("email_notifications").default(true),
  notificationPreferences: jsonb("notification_preferences").$type<{
    messages: boolean;
    offers: boolean;
    reviews: boolean;
    orders: boolean;
    marketing: boolean;
  }>().default({ messages: true, offers: true, reviews: true, orders: true, marketing: true }),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
