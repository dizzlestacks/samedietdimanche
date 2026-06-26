import { useEffect } from "react";

interface OGMeta {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

export function useOGMeta({ title, description, image, url, jsonLd }: OGMeta) {
  useEffect(() => {
    const siteTitle = `${title} | YARDEES — Second Hand Never Looked This Good`;
    document.title = siteTitle;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) ||
               document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:") || property.startsWith("twitter:")) {
          el.setAttribute("property", property);
        } else {
          el.setAttribute("name", property);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", siteTitle);
    setMeta("og:site_name", "YARDEES");
    setMeta("og:type", "website");
    setMeta("og:locale", "en_US");
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description);
      setMeta("twitter:description", description);
    }
    if (image) {
      setMeta("og:image", image);
      setMeta("og:image:alt", title);
      setMeta("twitter:image", image);
      setMeta("twitter:card", "summary_large_image");
    } else {
      setMeta("twitter:card", "summary");
    }
    if (url) {
      setMeta("og:url", url);
    }
    setMeta("twitter:title", siteTitle);
    setMeta("twitter:site", "@yardees");

    const canonicalUrl = url || window.location.href.split("?")[0];
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    const existingScripts = document.querySelectorAll('script[data-seo-jsonld]');
    existingScripts.forEach(s => s.remove());

    const createdScripts: HTMLScriptElement[] = [];

    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((item) => {
        const ldScript = document.createElement("script");
        ldScript.type = "application/ld+json";
        ldScript.setAttribute("data-seo-jsonld", "true");
        ldScript.textContent = JSON.stringify(item);
        document.head.appendChild(ldScript);
        createdScripts.push(ldScript);
      });
    }

    return () => {
      createdScripts.forEach(s => {
        if (s.parentNode) s.remove();
      });
    };
  }, [title, description, image, url, jsonLd]);
}
