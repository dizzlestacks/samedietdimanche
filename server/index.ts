import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

function validateEnv() {
  const required: { key: string; label: string }[] = [
    { key: "DATABASE_URL", label: "PostgreSQL connection string" },
    { key: "SESSION_SECRET", label: "Session encryption secret" },
  ];

  const recommended: { key: string; label: string }[] = [
    { key: "STRIPE_SECRET_KEY", label: "Stripe payments (checkout & boosts)" },
    { key: "RESEND_API_KEY", label: "Email notifications via Resend" },
    { key: "GOOGLE_PLACES_API_KEY", label: "Nearby shops discovery" },
  ];

  const missing: string[] = [];
  for (const { key, label } of required) {
    if (!process.env[key]) {
      missing.push(`  ✗ ${key} — ${label}`);
    }
  }

  if (missing.length > 0) {
    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║         YARDEES — MISSING REQUIRED ENV VARIABLES        ║");
    console.error("╚══════════════════════════════════════════════════════════╝\n");
    console.error(missing.join("\n"));
    console.error("\nSet these environment variables before starting the server.\n");
    process.exit(1);
  }

  const warns: string[] = [];
  for (const { key, label } of recommended) {
    if (!process.env[key]) {
      warns.push(`  ⚠ ${key} — ${label}`);
    }
  }

  if (warns.length > 0) {
    console.warn("\n[startup] Missing optional env variables (some features will be disabled):");
    console.warn(warns.join("\n"));
    console.warn("");
  }

  console.log("[startup] Environment variables validated ✓");
}

validateEnv();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > 200 ? body.slice(0, 200) + "..." : body}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const { registerSeoRoutes: registerSeo } = await import("./seo");
  registerSeo(app);

  // Social/SEO crawler middleware — runs in BOTH dev and prod so that
  // Facebook, iMessage, Twitter, WhatsApp, LinkedIn, Slack, etc. see the
  // correct OG image/title/description for each route (especially listings)
  // instead of the static defaults in client/index.html.
  {
    const { getMetaForRoute, injectMetaTags, buildMetaTags } = await import("./seo");
    const fs = await import("fs");
    const path = await import("path");

    const crawlerPattern = /bot|crawl|spider|slurp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Googlebot|Bingbot|Baiduspider|DuckDuckBot|Embedly|Quora|outbrain|pinterest|vkShare|Slack|Applebot|iMessage|preview|fetch/i;

    // In production the built HTML lives in dist/public/index.html;
    // in dev we read from the source client/index.html.
    const htmlCandidates = [
      path.resolve(import.meta.dirname, "public", "index.html"),
      path.resolve(import.meta.dirname, "..", "dist", "public", "index.html"),
      path.resolve(import.meta.dirname, "..", "client", "index.html"),
    ];

    app.use((req, res, next) => {
      const ua = req.headers["user-agent"] || "";
      if (!crawlerPattern.test(ua)) return next();
      if (req.path.startsWith("/api") || req.path.includes(".")) return next();

      (async () => {
        try {
          const origin = `${req.protocol}://${req.get("host")}`;
          const meta = await getMetaForRoute(req.path, origin);
          if (!meta) return next();

          let html: string | null = null;
          for (const candidate of htmlCandidates) {
            try {
              html = await fs.promises.readFile(candidate, "utf-8");
              break;
            } catch {}
          }
          if (!html) return next();

          html = injectMetaTags(html, buildMetaTags(meta));
          res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } catch {
          next();
        }
      })();
    });
  }

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log(`${signal} received — shutting down gracefully`);

    httpServer.close(() => {
      log("HTTP server closed");
      process.exit(0);
    });

    setTimeout(() => {
      log("Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });
})();
