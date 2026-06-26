import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import crypto from "crypto";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../../email";

const oidcClientId = process.env.REPL_ID || "";
const hasOidcProvider = oidcClientId.length > 0;

const getOidcConfig = memoize(
  async () => {
    if (!hasOidcProvider || !oidcClientId) {
      throw new Error("OIDC authentication is not available");
    }
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      oidcClientId
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  let config: any = null;
  let registeredStrategies = new Set<string>();
  let oidcAvailable = false;

  if (hasOidcProvider) {
    try {
      config = await getOidcConfig();
      oidcAvailable = true;
    } catch (e) {
      console.log("[auth] OIDC setup failed, continuing without it:", (e as Error).message);
    }
  }

  if (oidcAvailable && config) {

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    };

    const ensureStrategy = (domain: string) => {
      const strategyName = `oidcauth:${domain}`;
      if (!registeredStrategies.has(strategyName)) {
        const strategy = new Strategy(
          {
            name: strategyName,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify
        );
        passport.use(strategy);
        registeredStrategies.add(strategyName);
      }
    };

    app.get("/api/login", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`oidcauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", (req: any, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`oidcauth:${req.hostname}`, (err: any, user: any) => {
        if (err) return next(err);
        if (!user) return res.redirect("/api/login");
        req.login(user, async (loginErr: any) => {
          if (loginErr) return next(loginErr);
          try { await authStorage.updateLastLogin(user.id); } catch {}
          res.redirect("/");
        });
      })(req, res, next);
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: oidcClientId,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  } else {
    app.get("/api/login", (_req, res) => {
      res.redirect("/login");
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect("/");
      });
    });
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // ─── Local (email/password) strategy ─────────────────────────────────────────
  passport.use(
    "local",
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await authStorage.getUserByEmail(email);
        if (!user || user.authType !== "local" || !user.passwordHash) {
          return done(null, false, { message: "Invalid email or password" });
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return done(null, false, { message: "Invalid email or password" });
        return done(null, { localUser: true, userId: user.id, claims: { sub: user.id, email: user.email } });
      } catch (err) {
        return done(err);
      }
    })
  );

  app.post("/api/register", async (req: any, res) => {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ message: "Email, password, and display name are required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }
    if (displayName.length > 50) {
      return res.status(400).json({ message: "Display name must be 50 characters or fewer" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const existing = await authStorage.getUserByEmail(email);
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await authStorage.createLocalUser({ email, passwordHash, displayName });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await authStorage.setVerificationToken(newUser.id, verificationToken);
    sendVerificationEmail(newUser.id, verificationToken);
    sendWelcomeEmail(newUser.id);

    const sessionUser = { localUser: true, userId: newUser.id, claims: { sub: newUser.id, email: newUser.email } };
    req.login(sessionUser, (err: any) => {
      if (err) return res.status(500).json({ message: "Login after registration failed" });
      res.json({ success: true, user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName } });
    });
  });

  app.post("/api/login/local", (req: any, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid email or password" });
      req.login(user, async (err: any) => {
        if (err) return next(err);
        try { await authStorage.updateLastLogin(user.id); } catch {}
        res.json({ success: true });
      });
    })(req, res, next);
  });

  app.get("/api/verify-email/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      const user = await authStorage.getUserByVerificationToken(token);
      if (!user) {
        return res.redirect("/verify-email?status=invalid");
      }
      await authStorage.setEmailVerified(user.id);
      return res.redirect("/verify-email?status=success");
    } catch (error) {
      console.error("Email verification error:", error);
      return res.redirect("/verify-email?status=error");
    }
  });

  app.post("/api/resend-verification", async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const userId = req.user?.userId || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await authStorage.getUser(userId);
    if (!user || user.authType !== "local") return res.status(400).json({ message: "Not applicable" });
    if (user.emailVerified) return res.status(400).json({ message: "Email already verified" });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    await authStorage.setVerificationToken(userId, verificationToken);
    sendVerificationEmail(userId, verificationToken);
    res.json({ success: true });
  });

  app.post("/api/forgot-password", async (req: any, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await authStorage.getUserByEmail(email);
    if (!user || user.authType !== "local") {
      return res.json({ success: true, message: "If an account exists, a reset email has been sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await authStorage.setResetToken(user.id, resetToken, expires);
    sendPasswordResetEmail(user.id, resetToken);

    res.json({ success: true, message: "If an account exists, a reset email has been sent." });
  });

  app.post("/api/reset-password", async (req: any, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required" });

    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const user = await authStorage.getUserByResetToken(token);
    if (!user) return res.status(400).json({ message: "Invalid or expired reset link" });
    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
      await authStorage.clearResetToken(user.id);
      return res.status(400).json({ message: "Reset link has expired. Please request a new one." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await authStorage.updatePassword(user.id, passwordHash);
    await authStorage.clearResetToken(user.id);

    res.json({ success: true, message: "Password has been reset. You can now log in." });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Local auth users don't have token expiry — they're always valid while session exists
  if (user?.localUser) {
    return next();
  }

  if (!user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
