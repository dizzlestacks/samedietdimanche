import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { collections, saleTypeLabels } from "@shared/schema";
import { eq } from "drizzle-orm";

interface OGMeta {
  title: string;
  description: string;
  image?: string;
  url: string;
  type?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

export function buildMetaTags(meta: OGMeta): string {
  const tags: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  tags.push(`<title>${esc(meta.title)}</title>`);
  tags.push(`<meta name="description" content="${esc(meta.description)}" />`);
  tags.push(`<meta name="author" content="YARDEES" />`);
  tags.push(`<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`);
  tags.push(`<link rel="canonical" href="${esc(meta.url)}" />`);
  tags.push(`<meta property="og:title" content="${esc(meta.title)}" />`);
  tags.push(`<meta property="og:description" content="${esc(meta.description)}" />`);
  tags.push(`<meta property="og:url" content="${esc(meta.url)}" />`);
  tags.push(`<meta property="og:site_name" content="YARDEES" />`);
  tags.push(`<meta property="og:type" content="${meta.type || "website"}" />`);
  tags.push(`<meta property="og:locale" content="en_US" />`);
  tags.push(`<meta property="og:locale:alternate" content="es_ES" />`);
  tags.push(`<meta property="og:locale:alternate" content="fr_FR" />`);
  tags.push(`<meta property="og:locale:alternate" content="de_DE" />`);
  tags.push(`<meta property="og:locale:alternate" content="pt_BR" />`);
  tags.push(`<meta property="og:locale:alternate" content="zh_CN" />`);

  if (meta.image) {
    tags.push(`<meta property="og:image" content="${esc(meta.image)}" />`);
    tags.push(`<meta property="og:image:width" content="1200" />`);
    tags.push(`<meta property="og:image:height" content="630" />`);
    tags.push(`<meta property="og:image:alt" content="${esc(meta.title)}" />`);
    tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
    tags.push(`<meta name="twitter:image" content="${esc(meta.image)}" />`);
  } else {
    tags.push(`<meta name="twitter:card" content="summary" />`);
  }

  tags.push(`<meta name="twitter:site" content="@yardees" />`);
  tags.push(`<meta name="twitter:title" content="${esc(meta.title)}" />`);
  tags.push(`<meta name="twitter:description" content="${esc(meta.description)}" />`);

  if (meta.jsonLd) {
    const items = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    items.forEach(item => {
      const safeJson = JSON.stringify(item).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
      tags.push(`<script type="application/ld+json">${safeJson}</script>`);
    });
  }

  return tags.join("\n    ");
}

const TAGLINE = "Second Hand Never Looked This Good";
const BRAND_SUFFIX = `YARDEES — ${TAGLINE}`;
const GLOBAL_KEYWORDS = "yard sale, garage sale, thrift store, thrift shopping, second hand, used items, buy sell, marketplace, local deals, estate sale, flea market, consignment, resale, pre-owned, sustainable shopping, community marketplace, bargain, treasure hunting, yard sale near me, garage sale near me, thrift stores near me, second hand shop, buy used items, sell used items, online yard sale, virtual yard sale, moving sale, rummage sale, tag sale, jumble sale, boot sale, car boot sale, vide-grenier, brocante, Flohmarkt, mercado de pulgas, charity shop, op shop, vintage clothing, used furniture, pre-loved items, upcycle, recycle, sustainable fashion, neighborhood sale, community sale, multi-family yard sale, church sale, thrift haul, yard sale finds, yard sale tips, how to host a yard sale, best yard sale app, yard sale website, online thrift store, secondhand marketplace, buy and sell locally, local marketplace app, cheap second hand, affordable shopping, budget shopping, sell my stuff, declutter and sell";

function withBrand(title: string): string {
  return `${title} | ${BRAND_SUFFIX}`;
}

const DEFAULT_META: OGMeta = {
  title: `YARDEES — ${TAGLINE} | Yard Sales, Thrift Shopping & Second Hand Marketplace`,
  description: `${TAGLINE}. YARDEES is the world's marketplace for yard sales, garage sales, thrift shops, and second-hand treasures. Buy and sell pre-loved items locally or worldwide. Find yard sales near you, browse thrift stores, and discover hidden gems at unbeatable prices. Free to list, safe to buy.`,
  url: "",
  type: "website",
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Electronics: "Shop pre-owned electronics, smartphones, laptops, gaming consoles, and tech gear at yard sale prices. Find great deals on used electronics on YARDEES.",
  Furniture: "Find quality second-hand furniture for your home — sofas, dining tables, desks, chairs, bookshelves, and more at yard sale and thrift store prices on YARDEES.",
  Clothing: "Browse pre-loved clothing, shoes, accessories, designer brands, and vintage fashion at incredible thrift prices on YARDEES marketplace.",
  Books: "Discover used books, rare editions, textbooks, novels, and more at thrift prices. Buy and sell books on YARDEES.",
  Toys: "Find pre-owned toys, board games, puzzles, LEGO, action figures, and kids' items at affordable yard sale prices on YARDEES.",
  Sports: "Shop second-hand sports equipment, gym gear, bicycles, outdoor recreation gear, and fitness equipment at great prices on YARDEES.",
  "Home & Garden": "Browse second-hand home decor, kitchenware, garden tools, planters, and household items at yard sale prices on YARDEES.",
  Automotive: "Find used auto parts, car accessories, tires, tools, and automotive supplies at affordable prices on YARDEES marketplace.",
  Collectibles: "Discover vintage collectibles, trading cards, coins, stamps, memorabilia, and rare finds at yard sale prices on YARDEES.",
  Antiques: "Browse antique treasures, vintage furniture, heirloom pieces, and rare antiques from yard sales and estate sales on YARDEES.",
  Vintage: "Discover unique vintage items, retro clothing, mid-century furniture, and nostalgic finds at affordable prices on YARDEES.",
  Tools: "Shop second-hand power tools, hand tools, workshop equipment, and hardware at great yard sale prices on YARDEES marketplace.",
  Jewelry: "Find pre-owned jewelry, watches, rings, necklaces, bracelets, and accessories at thrift prices on YARDEES.",
  Appliances: "Browse used kitchen appliances, washers, dryers, vacuums, and household appliances at affordable prices on YARDEES marketplace.",
  "Baby & Kids": "Find baby gear, strollers, car seats, children's clothing, toys, and kids' furniture at yard sale prices on YARDEES.",
  Other: "Explore unique second-hand items, yard sale treasures, and miscellaneous finds on YARDEES marketplace.",
};

const CONDITION_MAP: Record<string, string> = {
  new: "NewCondition",
  like_new: "UsedCondition",
  good: "UsedCondition",
  fair: "UsedCondition",
  poor: "UsedCondition",
};

function buildBreadcrumbs(origin: string, items: { name: string; url: string }[]): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${origin}${item.url}`,
    })),
  };
}

export async function getMetaForRoute(url: string, origin: string): Promise<OGMeta | null> {
  const listingMatch = url.match(/^\/listing\/(\d+)/);
  if (listingMatch) {
    try {
      const id = parseInt(listingMatch[1], 10);
      const listing = await storage.getListing(id);
      if (listing && (listing as any).privacyLevel !== "hidden") {
        const rawPhoto = listing.photos?.[0];
        const image = rawPhoto
          ? (rawPhoto.startsWith("http") ? rawPhoto : `${origin}${rawPhoto}`)
          : `${origin}/og-logo.png`;
        const priceNum = listing.price || 0;
        const currency = listing.currency || "USD";
        const priceFormatted = priceNum
          ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(priceNum / 100)
          : "Free";

        const listingType = (listing as any).listingType || "individual";
        const typeLabel = listingType === "shop" ? "Thrift Shop" : (saleTypeLabels[listingType] || "Individual Seller");
        const locationStr = [listing.city, listing.country].filter(Boolean).join(", ");
        const descText = listing.description?.slice(0, 300) || "";

        const jsonLd: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: descText,
          url: `${origin}/listing/${id}`,
          brand: { "@type": "Brand", name: "YARDEES" },
          offers: {
            "@type": "Offer",
            price: (priceNum / 100).toFixed(2),
            priceCurrency: currency,
            availability: (listing as any).isSold
              ? "https://schema.org/SoldOut"
              : "https://schema.org/InStock",
            itemCondition: CONDITION_MAP[(listing as any).condition || ""]
              ? `https://schema.org/${CONDITION_MAP[(listing as any).condition]}`
              : undefined,
            seller: {
              "@type": "Organization",
              name: "YARDEES",
              url: origin,
            },
          },
        };
        if (image) {
          jsonLd.image = [image];
        }
        if (listing.category) {
          jsonLd.category = listing.category;
        }
        if (listing.city || listing.country) {
          jsonLd.offers.availableAtOrFrom = {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: listing.city || undefined,
              addressCountry: listing.country || undefined,
            },
          };
        }

        const breadcrumbs = buildBreadcrumbs(origin, [
          { name: "Home", url: "/" },
          ...(listing.category ? [{ name: listing.category, url: `/category/${encodeURIComponent(listing.category)}` }] : []),
          { name: listing.title, url: `/listing/${id}` },
        ]);

        const seoTitle = `${listing.title} — ${priceFormatted}${locationStr ? ` in ${locationStr}` : ""} | ${typeLabel}`;

        return {
          title: withBrand(seoTitle),
          description: `${priceFormatted} — ${listing.title}${locationStr ? ` in ${locationStr}` : ""}. ${descText.slice(0, 120)}. Buy second-hand on YARDEES.`,
          image,
          url: `${origin}/listing/${id}`,
          type: "product",
          jsonLd: [jsonLd, breadcrumbs],
        };
      }
    } catch {}
  }

  const categoryMatch = url.match(/^\/category\/([^/?]+)/);
  if (categoryMatch) {
    const cat = decodeURIComponent(categoryMatch[1]);
    const canonicalUrl = `${origin}/category/${encodeURIComponent(cat)}`;
    const desc = CATEGORY_DESCRIPTIONS[cat] || `Find ${cat.toLowerCase()} items at great prices. Buy and sell second-hand ${cat.toLowerCase()} on YARDEES marketplace.`;
    const breadcrumbs = buildBreadcrumbs(origin, [
      { name: "Home", url: "/" },
      { name: cat, url: `/category/${encodeURIComponent(cat)}` },
    ]);
    return {
      title: withBrand(`${cat} — Buy & Sell Second-Hand ${cat}`),
      description: desc,
      url: canonicalUrl,
      image: `${origin}/og-logo.png`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${cat} — Second-Hand ${cat} on YARDEES`,
          description: desc,
          url: canonicalUrl,
          isPartOf: { "@type": "WebSite", name: "YARDEES", url: origin },
        },
        breadcrumbs,
      ],
    };
  }

  const eventMatch = url.match(/^\/events\/(\d+)/);
  if (eventMatch) {
    try {
      const eventId = parseInt(eventMatch[1], 10);
      const events = await storage.getEvents();
      const event = events.find((e: any) => e.id === eventId);
      if (event) {
        const locationStr = [event.city, event.country].filter(Boolean).join(", ");
        const jsonLd: Record<string, any> = {
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.title,
          description: (event.description || "").slice(0, 500),
          startDate: event.startDate,
          url: `${origin}/events/${eventId}`,
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: "https://schema.org/EventScheduled",
          organizer: { "@type": "Organization", name: "YARDEES", url: origin },
        };
        if (event.endDate) jsonLd.endDate = event.endDate;
        if (event.city || event.country) {
          jsonLd.location = {
            "@type": "Place",
            name: event.address || event.city,
            address: {
              "@type": "PostalAddress",
              addressLocality: event.city || undefined,
              addressCountry: event.country || undefined,
              streetAddress: event.address || undefined,
            },
          };
        }
        const breadcrumbs = buildBreadcrumbs(origin, [
          { name: "Home", url: "/" },
          { name: "Events", url: "/events" },
          { name: event.title, url: `/events/${eventId}` },
        ]);
        return {
          title: withBrand(`${event.title}${locationStr ? ` in ${locationStr}` : ""} — Yard Sale Event`),
          description: `${event.title}${locationStr ? ` in ${locationStr}` : ""}. ${(event.description || "").slice(0, 120)} Join this yard sale event on YARDEES.`,
          url: `${origin}/events/${eventId}`,
          type: "event",
          image: `${origin}/og-logo.png`,
          jsonLd: [jsonLd, breadcrumbs],
        };
      }
    } catch {}
  }

  const sellerMatch = url.match(/^\/seller\/([^/?]+)/);
  if (sellerMatch) {
    try {
      const sellerId = decodeURIComponent(sellerMatch[1]);
      const seller = await storage.getUser(sellerId);
      if (seller) {
        const name = seller.displayName || seller.firstName || "Seller";
        const image = seller.profileImageUrl
          ? (seller.profileImageUrl.startsWith("http") ? seller.profileImageUrl : `${origin}${seller.profileImageUrl}`)
          : `${origin}/og-logo.png`;
        const breadcrumbs = buildBreadcrumbs(origin, [
          { name: "Home", url: "/" },
          { name: name, url: `/seller/${sellerId}` },
        ]);
        return {
          title: withBrand(`${name} — Seller Profile & Listings`),
          description: `Browse second-hand listings from ${name} on YARDEES. ${seller.reviewCount ? `Rated by ${seller.reviewCount} buyers.` : "View their items, reviews, and shop."} Buy pre-loved items safely.`,
          image,
          url: `${origin}/seller/${sellerId}`,
          jsonLd: [
            {
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              mainEntity: {
                "@type": "Person",
                name,
                url: `${origin}/seller/${sellerId}`,
                ...(image ? { image } : {}),
              },
            },
            breadcrumbs,
          ],
        };
      }
    } catch {}
    return {
      title: withBrand("Seller Profile — Browse Their Listings"),
      description: "View seller listings, reviews, and ratings on YARDEES — the second-hand marketplace.",
      url: `${origin}${url}`,
    };
  }

  const collectionSlugMatch = url.match(/^\/collections\/([^/?]+)/);
  if (collectionSlugMatch) {
    const slug = decodeURIComponent(collectionSlugMatch[1]);
    const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const breadcrumbs = buildBreadcrumbs(origin, [
      { name: "Home", url: "/" },
      { name: "Collections", url: "/collections" },
      { name: displayName, url: `/collections/${slug}` },
    ]);
    return {
      title: withBrand(`${displayName} — Curated Collection`),
      description: `Explore our curated "${displayName}" collection of second-hand treasures on YARDEES. Hand-picked yard sale finds, thrift gems, and pre-loved items.`,
      url: `${origin}/collections/${slug}`,
      image: `${origin}/og-logo.png`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: displayName,
          description: `Curated ${displayName} collection on YARDEES`,
          url: `${origin}/collections/${slug}`,
          isPartOf: { "@type": "WebSite", name: "YARDEES", url: origin },
        },
        breadcrumbs,
      ],
    };
  }

  if (url === "/" || url === "") {
    return {
      ...DEFAULT_META,
      url: origin,
      image: `${origin}/og-logo.png`,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "YARDEES",
          alternateName: ["Yardees Marketplace", "Yardees.net", "YARDEES — Second Hand Never Looked This Good"],
          url: origin,
          description: DEFAULT_META.description,
          inLanguage: ["en", "es", "fr", "de", "pt", "zh"],
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${origin}/?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "YARDEES",
          url: origin,
          logo: `${origin}/og-logo.png`,
          description: "YARDEES is the world's marketplace for yard sales, garage sales, thrift shops, and second-hand goods. Buy and sell pre-loved items locally or worldwide. Second Hand Never Looked This Good.",
          slogan: "Second Hand Never Looked This Good",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: "support@yardees.net",
            availableLanguage: ["English", "Spanish", "French", "German", "Portuguese", "Chinese"],
          },
          sameAs: [],
        },
        {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "YARDEES",
          url: origin,
          applicationCategory: "ShoppingApplication",
          operatingSystem: "All",
          description: "Buy and sell second-hand items at yard sales, garage sales, and thrift shops worldwide. Free to list, safe to buy.",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: "Free to browse and list items",
          },
          featureList: [
            "Buy and sell second-hand items",
            "Find yard sales near you",
            "Browse thrift stores and shops",
            "Secure messaging between buyers and sellers",
            "Escrow payment protection",
            "Barcode scanner for quick listings",
            "Interactive maps with nearby sales",
            "Price drop alerts on favorites",
            "Auction and bidding system",
            "Community tips and reviews",
            "Multi-language support (6 languages)",
          ],
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "YARDEES is a worldwide marketplace for yard sales, garage sales, thrift shops, and second-hand goods. Browse local listings, find hidden treasures, and sell items you no longer need. Available in 6 languages." },
            },
            {
              "@type": "Question",
              name: "How do I sell items on YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "Create a free account, then click 'Sell' to list your items with photos, descriptions, and pricing. You can add up to 20 photos per listing. YARDEES supports individual sales, yard sales, and thrift shop listings." },
            },
            {
              "@type": "Question",
              name: "Is YARDEES free to use?",
              acceptedAnswer: { "@type": "Answer", text: "Yes! Browsing and listing items on YARDEES is completely free. There's a small 5% platform fee only when a sale is completed through our secure payment system. Optional paid boosts are available to increase your listing's visibility." },
            },
            {
              "@type": "Question",
              name: "How do I find yard sales near me?",
              acceptedAnswer: { "@type": "Answer", text: "Set your location on YARDEES and browse nearby yard sales, thrift shops, and individual sellers. Use distance filters (1-100 km), category filters, and price range to find exactly what you're looking for. You can also view sales on an interactive map." },
            },
            {
              "@type": "Question",
              name: "Is it safe to buy on YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "Yes! YARDEES offers buyer protection through our escrow payment system. Payments are held securely until delivery is confirmed. Both buyers and sellers can file disputes if issues arise. We also support buyer verification for added trust." },
            },
            {
              "@type": "Question",
              name: "How do I host a yard sale on YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "Create a yard sale listing with your sale dates, location, and items. YARDEES automatically creates an event for your sale with RSVP capability. You can also join neighborhood yard sale events to attract more buyers." },
            },
            {
              "@type": "Question",
              name: "Can I sell internationally on YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "Yes! YARDEES is a worldwide marketplace. You can list items from any country, set shipping options, and reach buyers globally. The platform supports 6 languages and multiple currencies." },
            },
            {
              "@type": "Question",
              name: "What can I sell on YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "You can sell virtually anything second-hand on YARDEES — furniture, electronics, clothing, books, toys, sports equipment, antiques, collectibles, jewelry, tools, appliances, and more across 15 categories." },
            },
            {
              "@type": "Question",
              name: "How does the bidding system work on YARDEES?",
              acceptedAnswer: { "@type": "Answer", text: "Sellers can enable auctions on their listings. Buyers place bids with a minimum increment. You'll be notified if you're outbid. The highest bidder wins when the auction ends." },
            },
            {
              "@type": "Question",
              name: "What is the difference between a yard sale, garage sale, and estate sale?",
              acceptedAnswer: { "@type": "Answer", text: "A yard sale (or tag sale) sells household items in your yard. A garage sale is similar but held in a garage. An estate sale typically involves selling most belongings from a home, often after a move or passing. YARDEES supports all these types of sales." },
            },
          ],
        },
      ] as any,
    };
  }

  if (url === "/explore" || url === "/explore/") {
    return {
      title: withBrand("Explore — Browse Categories, Shops & Listings"),
      description: "Explore YARDEES — browse 15 categories of second-hand items, discover nearby thrift shops, and find the latest yard sale listings. Your treasure hunting starts here.",
      url: `${origin}/explore`,
      image: `${origin}/og-logo.png`,
      jsonLd: buildBreadcrumbs(origin, [
        { name: "Home", url: "/" },
        { name: "Explore", url: "/explore" },
      ]),
    };
  }

  if (url === "/collections" || url === "/collections/") {
    return {
      title: withBrand("Curated Collections — Hand-Picked Thrift Finds"),
      description: "Browse curated collections of second-hand treasures on YARDEES. From vintage finds to seasonal picks, discover hand-selected yard sale gems.",
      url: `${origin}/collections`,
      image: `${origin}/og-logo.png`,
      jsonLd: buildBreadcrumbs(origin, [
        { name: "Home", url: "/" },
        { name: "Collections", url: "/collections" },
      ]),
    };
  }

  if (url.startsWith("/events") && !eventMatch) {
    return {
      title: withBrand("Yard Sale Events — Find Sales Near You"),
      description: "Discover upcoming yard sales, garage sales, estate sales, and community events near you. RSVP, get directions, and add to your calendar on YARDEES.",
      url: `${origin}/events`,
      image: `${origin}/og-logo.png`,
      jsonLd: buildBreadcrumbs(origin, [
        { name: "Home", url: "/" },
        { name: "Events", url: "/events" },
      ]),
    };
  }

  if (url === "/nearby-shops" || url === "/nearby-shops/") {
    return {
      title: withBrand("Nearby Thrift Shops — Find Stores Near You"),
      description: "Find thrift stores, consignment shops, second-hand stores, and charity shops near your location. Browse ratings, hours, and directions on YARDEES.",
      url: `${origin}/nearby-shops`,
      image: `${origin}/og-logo.png`,
      jsonLd: buildBreadcrumbs(origin, [
        { name: "Home", url: "/" },
        { name: "Nearby Shops", url: "/nearby-shops" },
      ]),
    };
  }

  if (url === "/tips" || url === "/tips/") {
    return {
      title: withBrand("Yard Sale Tips — Community Advice & Guides"),
      description: "Get yard sale tips, thrift shopping advice, pricing guides, and selling strategies from the YARDEES community. Learn how to find the best deals and host successful sales.",
      url: `${origin}/tips`,
      image: `${origin}/og-logo.png`,
      jsonLd: buildBreadcrumbs(origin, [
        { name: "Home", url: "/" },
        { name: "Community Tips", url: "/tips" },
      ]),
    };
  }

  if (url === "/neighborhood-events" || url === "/neighborhood-events/") {
    return {
      title: withBrand("Neighborhood Yard Sales — Community Sale Events"),
      description: "Join neighborhood-wide yard sale events. Organize multi-family sales, community garage sales, and block sales. Connect with neighbors and attract more buyers on YARDEES.",
      url: `${origin}/neighborhood-events`,
      image: `${origin}/og-logo.png`,
    };
  }

  if (url === "/auctions" || url === "/auctions/") {
    return {
      title: withBrand("Auctions — Bid on Second-Hand Items"),
      description: "Place bids on unique second-hand items in live auctions on YARDEES. Find deals on electronics, furniture, collectibles, and more through our bidding system.",
      url: `${origin}/auctions`,
      image: `${origin}/og-logo.png`,
    };
  }

  if (url === "/help" || url === "/help/") {
    return {
      title: withBrand("Help Center — Support & Guides"),
      description: "Get help with buying, selling, payments, shipping, and more on YARDEES. Browse FAQs, guides, and contact our support team.",
      url: `${origin}/help`,
      image: `${origin}/og-logo.png`,
    };
  }

  if (url === "/rewards" || url === "/rewards/") {
    return {
      title: withBrand("Rewards Program — Earn Points & Perks"),
      description: "Join the YARDEES loyalty program. Earn points for listing, selling, and reviewing. Unlock Bronze, Silver, Gold, and Platinum tiers with exclusive perks.",
      url: `${origin}/rewards`,
      image: `${origin}/og-logo.png`,
    };
  }

  if (url === "/about" || url === "/about/") {
    return {
      title: withBrand("About Us — Our Story & Mission"),
      description: "Learn about YARDEES, the world's marketplace for yard sales, garage sales, and thrift shopping. Our mission is to make second-hand shopping sustainable, accessible, and beautiful for everyone.",
      url: `${origin}/about`,
      image: `${origin}/og-logo.png`,
      jsonLd: [
        buildBreadcrumbs(origin, [
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About YARDEES",
          description: "YARDEES is the world's marketplace for yard sales, garage sales, thrift shops, and second-hand goods.",
          url: `${origin}/about`,
          isPartOf: { "@type": "WebSite", name: "YARDEES", url: origin },
        },
      ],
    };
  }

  if (url === "/contact" || url === "/contact/") {
    return {
      title: withBrand("Contact Us — Get in Touch"),
      description: "Contact the YARDEES team for support, feedback, partnership inquiries, or general questions. Email us at support@yardees.net or use our contact form.",
      url: `${origin}/contact`,
      image: `${origin}/og-logo.png`,
      jsonLd: [
        buildBreadcrumbs(origin, [
          { name: "Home", url: "/" },
          { name: "Contact", url: "/contact" },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact YARDEES",
          description: "Get in touch with the YARDEES team.",
          url: `${origin}/contact`,
          isPartOf: { "@type": "WebSite", name: "YARDEES", url: origin },
        },
      ],
    };
  }

  return null;
}

export function injectMetaTags(html: string, metaTags: string): string {
  return html.replace("</head>", `    ${metaTags}\n  </head>`);
}

const CATEGORIES = [
  "Furniture", "Clothing", "Electronics", "Books", "Toys",
  "Home & Garden", "Sports", "Antiques", "Vintage", "Tools",
  "Collectibles", "Jewelry", "Appliances", "Baby & Kids", "Other",
];

export function registerSeoRoutes(app: Express) {
  app.get("/ads.txt", (_req, res) => {
    res.type("text/plain");
    res.send("google.com, pub-1344150540989825, DIRECT, f08c47fec0942fa0\n");
  });

  app.get("/robots.txt", (_req, res) => {
    const host = `${_req.protocol}://${_req.get("host")}`;
    res.type("text/plain");
    res.send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin.html
Disallow: /dashboard
Disallow: /messages
Disallow: /orders
Disallow: /offers
Disallow: /wallet
Disallow: /analytics
Disallow: /bulk-import
Disallow: /verify
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /welcome

User-agent: GPTBot
Allow: /
Allow: /listing/
Allow: /category/
Allow: /events/
Allow: /collections/
Allow: /explore
Allow: /tips
Allow: /nearby-shops
Allow: /help
Disallow: /api/
Disallow: /admin.html
Disallow: /dashboard
Disallow: /messages
Disallow: /orders
Disallow: /offers
Disallow: /wallet
Disallow: /analytics
Disallow: /bulk-import
Disallow: /verify
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /welcome

User-agent: ChatGPT-User
Allow: /
Allow: /listing/
Allow: /category/
Allow: /events/
Allow: /collections/
Allow: /explore
Allow: /tips
Allow: /nearby-shops
Allow: /help
Disallow: /api/
Disallow: /admin.html
Disallow: /dashboard
Disallow: /messages
Disallow: /orders
Disallow: /offers
Disallow: /wallet
Disallow: /analytics
Disallow: /bulk-import
Disallow: /verify
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /welcome

User-agent: Applebot
Allow: /

User-agent: Bingbot
Allow: /

Sitemap: ${host}/sitemap.xml
`
    );
  });

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const host = `${req.protocol}://${req.get("host")}`;
      const now = new Date().toISOString().split("T")[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      xml += `  <url><loc>${host}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${now}</lastmod></url>\n`;
      xml += `  <url><loc>${host}/explore</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${now}</lastmod></url>\n`;
      xml += `  <url><loc>${host}/events</loc><changefreq>daily</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>\n`;
      xml += `  <url><loc>${host}/collections</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
      xml += `  <url><loc>${host}/nearby-shops</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
      xml += `  <url><loc>${host}/tips</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\n`;
      xml += `  <url><loc>${host}/neighborhood-events</loc><changefreq>daily</changefreq><priority>0.6</priority></url>\n`;
      xml += `  <url><loc>${host}/help</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
      xml += `  <url><loc>${host}/rewards</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
      xml += `  <url><loc>${host}/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
      xml += `  <url><loc>${host}/contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
      xml += `  <url><loc>${host}/auctions</loc><changefreq>daily</changefreq><priority>0.6</priority></url>\n`;
      xml += `  <url><loc>${host}/login</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>\n`;
      xml += `  <url><loc>${host}/register</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>\n`;
      xml += `  <url><loc>${host}/privacy</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>\n`;
      xml += `  <url><loc>${host}/terms</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>\n`;

      for (const cat of CATEGORIES) {
        xml += `  <url><loc>${host}/category/${encodeURIComponent(cat)}</loc><changefreq>daily</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>\n`;
      }

      const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

      try {
        const allCollections = await db.select().from(collections).where(eq(collections.isActive, true));
        for (const col of allCollections) {
          if (col.slug) {
            xml += `  <url><loc>${host}/collections/${encodeURIComponent(col.slug)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
          }
        }
      } catch {}

      const listings = await storage.getListings({});
      for (const listing of listings.slice(0, 10000)) {
        if ((listing as any).privacyLevel === "hidden") continue;
        const lastmod = listing.createdAt
          ? new Date(listing.createdAt).toISOString().split("T")[0]
          : now;
        xml += `  <url><loc>${host}/listing/${listing.id}</loc><changefreq>weekly</changefreq><priority>0.6</priority><lastmod>${lastmod}</lastmod>`;
        if (listing.photos && listing.photos[0]) {
          const rawUrl = listing.photos[0].startsWith("http") ? listing.photos[0] : `${host}${listing.photos[0]}`;
          const imgUrl = xmlEsc(rawUrl);
          const imgTitle = xmlEsc(listing.title || "");
          xml += `<image:image><image:loc>${imgUrl}</image:loc><image:title>${imgTitle}</image:title></image:image>`;
        }
        xml += `</url>\n`;
      }

      try {
        const events = await storage.getEvents();
        for (const event of events) {
          xml += `  <url><loc>${host}/events/${event.id}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>\n`;
        }
      } catch {}

      xml += `</urlset>`;

      res.type("application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      res.status(500).type("text/plain").send("Error generating sitemap");
    }
  });
}
