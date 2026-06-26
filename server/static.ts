import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getMetaForRoute, injectMetaTags, buildMetaTags } from "./seo";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("/{*path}", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      const origin = `${req.protocol}://${req.get("host")}`;
      const meta = await getMetaForRoute(req.path, origin);
      if (meta) {
        let html = await fs.promises.readFile(indexPath, "utf-8");
        html = injectMetaTags(html, buildMetaTags(meta));
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } else {
        res.sendFile(indexPath);
      }
    } catch {
      res.sendFile(indexPath);
    }
  });
}
