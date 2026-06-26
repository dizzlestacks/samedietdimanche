import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { categories } from "@shared/schema";
import { useOGMeta } from "@/hooks/use-og-meta";
import {
  Compass, Store, MapPin, Star, ChevronRight, Navigation,
  Armchair, Shirt, Cpu, BookOpen, Puzzle, Home as HomeIcon,
  Dumbbell, Clock, Gem, Wrench, Zap, Baby, MoreHorizontal, Tag,
  ShoppingBag, Sparkles
} from "lucide-react";
import type { Collection } from "@shared/schema";
const logoSrc = "/yardees-logo.png";

const CATEGORY_ICONS: Record<string, any> = {
  "Furniture": Armchair,
  "Clothing": Shirt,
  "Electronics": Cpu,
  "Books": BookOpen,
  "Toys": Puzzle,
  "Home & Garden": HomeIcon,
  "Sports": Dumbbell,
  "Antiques": Clock,
  "Vintage": Star,
  "Tools": Wrench,
  "Collectibles": Gem,
  "Jewelry": Gem,
  "Appliances": Zap,
  "Baby & Kids": Baby,
  "Other": MoreHorizontal,
};

const CATEGORY_COLORS: Record<string, { bg: string; icon: string; border: string }> = {
  "Furniture": { bg: "from-amber-500/10 to-orange-500/10", icon: "text-amber-600 dark:text-amber-400", border: "border-amber-200/50 dark:border-amber-800/30" },
  "Clothing": { bg: "from-pink-500/10 to-rose-500/10", icon: "text-pink-600 dark:text-pink-400", border: "border-pink-200/50 dark:border-pink-800/30" },
  "Electronics": { bg: "from-blue-500/10 to-cyan-500/10", icon: "text-blue-600 dark:text-blue-400", border: "border-blue-200/50 dark:border-blue-800/30" },
  "Books": { bg: "from-emerald-500/10 to-green-500/10", icon: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200/50 dark:border-emerald-800/30" },
  "Toys": { bg: "from-purple-500/10 to-violet-500/10", icon: "text-purple-600 dark:text-purple-400", border: "border-purple-200/50 dark:border-purple-800/30" },
  "Home & Garden": { bg: "from-green-500/10 to-lime-500/10", icon: "text-green-600 dark:text-green-400", border: "border-green-200/50 dark:border-green-800/30" },
  "Sports": { bg: "from-red-500/10 to-orange-500/10", icon: "text-red-600 dark:text-red-400", border: "border-red-200/50 dark:border-red-800/30" },
  "Antiques": { bg: "from-yellow-500/10 to-amber-500/10", icon: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200/50 dark:border-yellow-800/30" },
  "Vintage": { bg: "from-rose-500/10 to-pink-500/10", icon: "text-rose-600 dark:text-rose-400", border: "border-rose-200/50 dark:border-rose-800/30" },
  "Tools": { bg: "from-slate-500/10 to-gray-500/10", icon: "text-slate-600 dark:text-slate-400", border: "border-slate-200/50 dark:border-slate-800/30" },
  "Collectibles": { bg: "from-indigo-500/10 to-blue-500/10", icon: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200/50 dark:border-indigo-800/30" },
  "Jewelry": { bg: "from-fuchsia-500/10 to-purple-500/10", icon: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-200/50 dark:border-fuchsia-800/30" },
  "Appliances": { bg: "from-cyan-500/10 to-teal-500/10", icon: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-200/50 dark:border-cyan-800/30" },
  "Baby & Kids": { bg: "from-sky-500/10 to-blue-500/10", icon: "text-sky-600 dark:text-sky-400", border: "border-sky-200/50 dark:border-sky-800/30" },
  "Other": { bg: "from-gray-500/10 to-slate-500/10", icon: "text-gray-600 dark:text-gray-400", border: "border-gray-200/50 dark:border-gray-800/30" },
};

function getStoredLocation(): { country: string; city: string } | null {
  try {
    const saved = localStorage.getItem("yardees_location");
    if (!saved) return null;
    const loc = JSON.parse(saved);
    if (loc.country === "Worldwide" || (!loc.country && !loc.city)) return null;
    return loc;
  } catch {
    return null;
  }
}

export default function Explore() {
  const { t } = useTranslation();
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  useOGMeta({
    title: t("explore.title"),
    description: t("explore.subtitle"),
  });

  const location = getStoredLocation();
  const country = location?.country || "";
  const city = location?.city || "";

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        async () => {
          try {
            const res = await fetch("https://ipapi.co/json/");
            if (res.ok) {
              const data = await res.json();
              if (data.latitude && data.longitude) {
                setUserCoords({ lat: data.latitude, lng: data.longitude });
              }
            }
          } catch {}
        },
        { timeout: 5000 }
      );
    }
  }, []);

  const locationParams = (() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    return params.toString();
  })();

  const { data: categoryCounts } = useQuery<{ name: string; totalCount: number; sampleImage: string | null }[]>({
    queryKey: ["/api/categories/featured", country, city],
    queryFn: async () => {
      const base = "/api/categories/featured?limit=all";
      const url = locationParams ? `${base}&${locationParams}` : base;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: nearbyShops, isLoading: shopsLoading } = useQuery<any[]>({
    queryKey: ["/api/shops/nearby", userCoords?.lat, userCoords?.lng],
    queryFn: async () => {
      if (!userCoords) return [];
      const res = await fetch(`/api/shops/nearby?lat=${userCoords.lat}&lon=${userCoords.lng}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userCoords,
    staleTime: 5 * 60 * 1000,
  });

  const { data: seasonalCollections } = useQuery<Collection[]>({ queryKey: ["/api/collections"] });

  const { data: recentListings, isLoading: recentLoading } = useQuery<{ items: any[] }>({
    queryKey: ["/api/listings", "explore-recent", country, city],
    queryFn: async () => {
      const params = new URLSearchParams({ sort: "newest", limit: "8" });
      if (country) params.set("country", country);
      if (city) params.set("city", city);
      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
  });

  const categoryCountMap = new Map(
    (categoryCounts || []).map(c => [c.name, { count: c.totalCount, image: c.sampleImage }])
  );

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <main className="flex-grow pb-24 md:pb-8">
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 md:mb-10"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                <Compass className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight gradient-text" data-testid="text-explore-title">
                  {t("explore.title")}
                </h1>
                <p className="text-sm text-muted-foreground/60">{t("explore.subtitle")}</p>
              </div>
            </div>
          </motion.div>

          <section className="mb-10 md:mb-14" data-testid="section-browse-categories">
            <div className="flex items-center gap-2 mb-5">
              <ShoppingBag className="w-4.5 h-4.5 text-primary" />
              <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">{t("explore.browseCategories")}</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 md:gap-3">
              {categories.map((cat, index) => {
                const Icon = CATEGORY_ICONS[cat] || Tag;
                const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS["Other"];
                const info = categoryCountMap.get(cat);
                const count = info?.count || 0;

                return (
                  <Link key={cat} href={`/category/${encodeURIComponent(cat)}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className={`cursor-pointer rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-3 md:p-4 flex flex-col items-center gap-2 text-center transition-shadow hover:shadow-md group`}
                      data-testid={`card-explore-category-${cat}`}
                    >
                      <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl bg-background/80 dark:bg-background/40 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                        <Icon className={`w-4.5 h-4.5 md:w-5 md:h-5 ${colors.icon}`} />
                      </div>
                      <div>
                        <p className="text-[11px] md:text-xs font-semibold text-foreground leading-tight line-clamp-1">{cat}</p>
                        {count > 0 && (
                          <p className="text-[9px] md:text-[10px] text-muted-foreground/50 mt-0.5">{count} {count === 1 ? "item" : "items"}</p>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </section>

          {seasonalCollections && seasonalCollections.length > 0 && (
            <section className="mb-10 md:mb-14" data-testid="section-explore-collections">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-primary" />
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">{t("explore.collections", "Seasonal Collections")}</h2>
                </div>
                <Link href="/collections">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/50 hover:text-primary gap-1" data-testid="button-view-all-collections">
                    {t("explore.viewAll")} <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {seasonalCollections.slice(0, 6).map((collection, index) => (
                  <motion.div
                    key={collection.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="flex-shrink-0 w-[200px] sm:w-[240px] snap-start"
                  >
                    <Link href={`/collections/${collection.slug}`}>
                      <div className="listing-card-shell overflow-hidden h-full cursor-pointer group" data-testid={`card-explore-collection-${collection.slug}`}>
                        <div className="aspect-[3/2] w-full relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <span className="text-4xl transition-transform duration-300 group-hover:scale-110">{collection.emoji || "📦"}</span>
                        </div>
                        <div className="p-3">
                          <h3 className="font-display font-semibold text-[13px] leading-snug line-clamp-1">{t(`collections.${collection.slug}`, collection.name)}</h3>
                          <p className="text-[10px] text-muted-foreground/50 line-clamp-1 mt-0.5">{t(`collections.${collection.slug}-desc`, collection.description)}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {nearbyShops && nearbyShops.length > 0 && (
            <section className="mb-10 md:mb-14" data-testid="section-explore-nearby-shops">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-2">
                  <Store className="w-4.5 h-4.5 text-blue-500" />
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">{t("explore.nearbyShops")}</h2>
                </div>
                <Link href="/nearby-shops">
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/50 hover:text-primary gap-1 rounded-xl" data-testid="button-explore-view-all-shops">
                    {t("home.viewAll")}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {nearbyShops.slice(0, 8).map((shop: any, index: number) => (
                  <motion.div
                    key={shop.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                    className="flex-shrink-0 w-[200px] sm:w-[240px] snap-start"
                  >
                    <div className="listing-card-shell listing-card-shop h-full flex flex-col overflow-hidden">
                      <div className="aspect-[4/3] w-full relative overflow-hidden bg-muted">
                        {shop.photo ? (
                          <img
                            src={`/api/shops/photo/${shop.photo}`}
                            alt={shop.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.onerror = null;
                              img.src = logoSrc;
                              img.className = "w-full h-full object-contain p-6 bg-muted/30";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/5 to-sky-500/5">
                            <img src={logoSrc} alt="Yardees" className="h-12 w-auto opacity-20" />
                          </div>
                        )}
                        {shop.isOpen !== undefined && (
                          <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold tracking-wider uppercase backdrop-blur-md ${
                            shop.isOpen ? "bg-emerald-500/90 text-white" : "bg-red-500/90 text-white"
                          }`}>
                            {shop.isOpen ? "Open" : "Closed"}
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 md:p-3 flex flex-col gap-1 flex-grow">
                        <h3 className="font-display font-semibold text-[12px] md:text-[13px] leading-snug line-clamp-1 text-foreground">
                          {shop.name}
                        </h3>
                        <div className="flex items-center gap-1 text-muted-foreground/50">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-blue-500" />
                          <span className="text-[9px] md:text-[10px] truncate">{shop.address}</span>
                        </div>
                        {shop.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-medium text-foreground/70">{shop.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {shopsLoading && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <Store className="w-4.5 h-4.5 text-blue-500" />
                <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">{t("explore.nearbyShops")}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
              </div>
            </section>
          )}

          {recentListings && recentListings.items.length > 0 && (
            <section data-testid="section-explore-recent">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-4.5 h-4.5 text-muted-foreground" />
                <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">{t("explore.recentlyAdded")}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {recentListings.items.slice(0, 8).map((listing: any, index: number) => (
                  <motion.div
                    key={listing.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                  >
                    <ListingCard listing={listing} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
