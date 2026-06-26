import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createLocalUser(data: { email: string; passwordHash: string; displayName: string }): Promise<User>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  setEmailVerified(userId: string): Promise<void>;
  setVerificationToken(userId: string, token: string): Promise<void>;
  setResetToken(userId: string, token: string, expires: Date): Promise<void>;
  clearResetToken(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateEmailNotifications(userId: string, enabled: boolean): Promise<void>;
  updateNotificationPreferences(userId: string, preferences: Record<string, boolean>): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createLocalUser(data: { email: string; passwordHash: string; displayName: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        authType: "local",
        firstName: data.displayName,
      })
      .returning();
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async setEmailVerified(userId: string): Promise<void> {
    await db.update(users).set({ emailVerified: true, verificationToken: null }).where(eq(users.id, userId));
  }

  async setVerificationToken(userId: string, token: string): Promise<void> {
    await db.update(users).set({ verificationToken: token }).where(eq(users.id, userId));
  }

  async setResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await db.update(users).set({ passwordResetToken: token, passwordResetExpires: expires }).where(eq(users.id, userId));
  }

  async clearResetToken(userId: string): Promise<void> {
    await db.update(users).set({ passwordResetToken: null, passwordResetExpires: null }).where(eq(users.id, userId));
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async updateEmailNotifications(userId: string, enabled: boolean): Promise<void> {
    await db.update(users).set({ emailNotifications: enabled }).where(eq(users.id, userId));
  }

  async updateNotificationPreferences(userId: string, preferences: Record<string, boolean>): Promise<void> {
    const user = await this.getUser(userId);
    const current = (user as any)?.notificationPreferences || { messages: true, offers: true, reviews: true, orders: true, marketing: true };
    const merged = { ...current, ...preferences };
    await db.update(users).set({ notificationPreferences: merged }).where(eq(users.id, userId));
  }
  async updateLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }
}

export const authStorage = new AuthStorage();
