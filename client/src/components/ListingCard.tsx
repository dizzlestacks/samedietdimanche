import { Link } from "wouter";
import { type Listing, isSaleEventType, saleTypeLabels } from "@shared/schema";
import { motion } from "framer-motion";
import { MapPin, Heart, CheckCircle2, Zap, Star, Store, Tags, ShoppingBag, Eye, Tag, Crown, Camera, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
const logoSrc = "/yardees-logo.png";
import { useTranslation } from "react-i18next";
import { triggerHaptic } from "@/lib/haptics";

interface ListingCardProps {
  listing: Listing;
  variant?: "default" | "spotlight" | "list";
}

function HeartButton({ listingId }: { listingId: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const { data } = useQuery<{ isFavorited: boolean }>({
    queryKey: [`/api/favorites/${listingId}/status`],
    queryFn: async () => {
      const res = await fetch(`/api/favorites/${listingId}/status`, { credentials: "include" });
      if (!res.ok) return { isFavorited: false };
      return res.json();
    },
    enabled: !!user,
  });

  const isFav = optimistic !== null ? optimistic : (data?.isFavorited ?? false);

  const toggle = useMutation({
    mutationFn: async () => {
      const method = isFav ? "DELETE" : "POST";
      const res = await fetch(`/api/favorites/${listingId}`, { method, credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return !isFav;
    },
    onMutate: () => setOptimistic(!isFav),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/favorites/${listingId}/status`] });
      qc.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: () => setOptimistic(null),
  });

  if (!user) return null;

  return (
    <motion.button
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerHaptic("medium");
        toggle.mutate();
      }}
      data-testid={`button-favorite-${listingId}`}
      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFav}
      className={`p-2 rounded-full backdrop-blur-xl transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 ${
        isFav
          ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
          : "bg-black/20 text-white/80 hover:bg-black/40 hover:text-white"
      }`}
    >
      <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
    </motion.button>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card-shell" data-testid="skeleton-listing-card">
      <div className="aspect-[4/3] w-full">
        <Skeleton className="w-full h-full rounded-none" />
      </div>
      <div className="p-4 space-y-2.5">
        <Skeleton className="h-4 w-4/5 rounded-md" />
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-1/2 rounded-md" />
        <div className="flex items-center justify-between pt-2 border-t border-border/20">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function SpotlightCardSkeleton() {
  return (
    <div className="spotlight-card-shell" data-testid="skeleton-spotlight-card">
      <div className="aspect-[16/9] w-full">
        <Skeleton className="w-full h-full rounded-none" />
      </div>
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-md" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const TYPE_THEMES = {
  yard_sale: {
    gradient: "from-purple-600 via-violet-500 to-purple-500",
    bannerBg: "bg-gradient-to-r from-purple-600 via-violet-500 to-purple-500",
    icon: Tags,
    accent: "text-purple-600 dark:text-purple-400",
    accentBg: "bg-purple-500/8 dark:bg-purple-500/15",
    priceBg: "bg-purple-600",
    dot: "bg-purple-500",
    borderHue: "purple",
    badgeClass: "bg-purple-600/90 text-white",
  },
  shop: {
    gradient: "from-blue-600 via-sky-500 to-blue-500",
    bannerBg: "bg-gradient-to-r from-blue-600 via-sky-500 to-blue-500",
    icon: Store,
    accent: "text-blue-600 dark:text-blue-400",
    accentBg: "bg-blue-500/8 dark:bg-blue-500/15",
    priceBg: "bg-blue-600",
    dot: "bg-blue-500",
    borderHue: "blue",
    badgeClass: "bg-blue-600/90 text-white",
  },
  individual: {
    gradient: "from-rose-600 via-red-500 to-rose-500",
    bannerBg: "bg-gradient-to-r from-rose-600 via-red-500 to-rose-500",
    icon: ShoppingBag,
    accent: "text-rose-600 dark:text-rose-400",
    accentBg: "bg-rose-500/8 dark:bg-rose-500/15",
    priceBg: "bg-rose-600",
    dot: "bg-rose-500",
    borderHue: "red",
    badgeClass: "bg-rose-600/90 text-white",
  },
};

export function ListingCard({ listing, variant = "default" }: ListingCardProps) {
  const { t } = useTranslation();

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency || "USD",
  }).format(listing.price / 100);

  const isSaleEvent = isSaleEventType((listing as any).listingType);
  const isShop = (listing as any).isShop === true;
  const isSold = (listing as any).isSold;
  const isBoosted = listing.isBoosted && !isSold;
  const boostType = (listing as any).boostType;
  const isSpotlight = variant === "spotlight";
  const photoCount = listing.photos?.length || 0;

  // All sale-event types share the "yard_sale" visual theme; only the badge label differs.
  const typeKey = isSaleEvent ? "yard_sale" : isShop ? "shop" : "individual";
  const theme = TYPE_THEMES[typeKey];
  const TypeIcon = theme.icon;
  const typeLabel = isSaleEvent
    ? (saleTypeLabels[(listing as any).listingType] || t("listing.yardSale"))
    : isShop ? t("listing.thriftShop") : t("listing.individual", "INDIVIDUAL");
  const priceDisplay = listing.price === 0 ? t("common.free") : isSaleEvent ? `${t("listing.from")} ${formattedPrice}` : formattedPrice;

  if (variant === "list") {
    return (
      <Link href={`/listing/${listing.id}`}>
        <div
          className="cursor-pointer group"
        >
          <div
            className={`listing-card-shell listing-card-${typeKey} flex flex-row overflow-hidden ${isSold ? "opacity-50 saturate-[0.3]" : ""} ${isBoosted ? (boostType === "spotlight" ? "listing-card-boosted-spotlight" : boostType === "featured" ? "listing-card-boosted-featured" : "listing-card-boosted-category") : ""}`}
            data-testid={`card-listing-list-${listing.id}`}
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 relative overflow-hidden">
              {listing.photos && listing.photos.length > 0 ? (
                <img
                  src={listing.photos[0]}
                  alt={listing.title}
                  loading="lazy"
                  className={`w-full h-full object-cover transition-transform duration-500 ease-out ${isSold ? "" : "group-hover:scale-105"}`}
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = logoSrc;
                    img.className = "w-full h-full object-contain p-4 bg-muted/30";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
                  <img src={logoSrc} alt="Yardees" className="h-10 w-auto opacity-20" />
                </div>
              )}
              {isSold && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="bg-white/95 dark:bg-black/90 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span className="font-bold text-[10px]">{t("listing.sold")}</span>
                  </div>
                </div>
              )}
              {!isSold && photoCount > 1 && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/30 backdrop-blur-md text-white/80 text-[9px] font-medium">
                  <Camera className="w-2 h-2" />
                  {photoCount}
                </div>
              )}
            </div>
            <div className="flex-grow flex flex-col p-3 sm:p-3.5 min-w-0 gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-grow">
                  <h3 className={`font-display font-semibold text-[13px] sm:text-sm leading-snug line-clamp-1 ${isSold ? "text-muted-foreground line-through" : "card-gradient-text"}`}>
                    {listing.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                    {listing.description}
                  </p>
                </div>
                <HeartButton listingId={listing.id} />
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-auto">
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r ${theme.gradient} text-white text-[9px] font-bold tracking-wider`}>
                  <TypeIcon className="w-2.5 h-2.5" />
                  <span>{typeLabel}</span>
                </div>
                {isBoosted && (
                  <div className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${boostType === "spotlight" ? "text-yellow-500" : boostType === "featured" ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {boostType === "spotlight" ? <Crown className="w-2.5 h-2.5 fill-current" /> : boostType === "featured" ? <Star className="w-2.5 h-2.5 fill-current" /> : <TrendingUp className="w-2.5 h-2.5" />}
                    <span className="tracking-wider uppercase">{boostType === "spotlight" ? t("listing.spotlight") : boostType === "featured" ? t("listing.featured") : t("listing.boosted")}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-auto">
                <div className="flex items-center gap-1 text-muted-foreground min-w-0">
                  <MapPin className={`w-2.5 h-2.5 flex-shrink-0 ${theme.accent}`} />
                  <span className="truncate text-[10px]">{[listing.city, listing.country].filter(Boolean).join(", ")}</span>
                </div>
                <div className={`px-2 py-0.5 rounded-md bg-gradient-to-r ${theme.gradient} text-white flex-shrink-0`}>
                  <span className="font-bold text-xs tracking-tight">{priceDisplay}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (isSpotlight) {
    return (
      <Link href={`/listing/${listing.id}`}>
        <div
          className="cursor-pointer h-full group"
        >
          <div
            className="spotlight-card-shell h-full flex flex-col"
            data-testid={`card-listing-${listing.id}`}
          >
            <div className="aspect-[16/9] w-full relative overflow-hidden">
              {listing.photos && listing.photos.length > 0 ? (
                <img
                  src={listing.photos[0]}
                  alt={listing.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-[1.08]"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = logoSrc;
                    img.className = "w-full h-full object-contain p-8 bg-muted/30";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-950/20 to-amber-900/10">
                  <img src={logoSrc} alt="Yardees" className="h-20 w-auto opacity-20" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" />

              <div className="absolute top-3.5 left-3.5 right-3.5 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {boostType === "spotlight" ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-900 text-[10px] font-black tracking-widest uppercase shadow-xl shadow-amber-500/30 spotlight-shimmer">
                      <Crown className="w-3 h-3" />
                      <span>{t("listing.spotlight")}</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/90 to-amber-600/90 text-white text-[10px] font-black tracking-widest uppercase shadow-lg shadow-amber-500/20">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{t("listing.featured")}</span>
                    </div>
                  )}
                </div>
                <HeartButton listingId={listing.id} />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <h3 className="font-display font-bold text-lg sm:text-xl text-white leading-snug line-clamp-2 drop-shadow-lg mb-1">
                  {listing.title}
                </h3>
                <div className="flex items-center gap-1.5 text-white/60 text-xs">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{[listing.city, listing.country].filter(Boolean).join(", ")}</span>
                  {photoCount > 1 && (
                    <>
                      <span className="mx-1 text-white/30">|</span>
                      <Camera className="w-3 h-3 flex-shrink-0" />
                      <span>{photoCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-2.5 border-t border-amber-200/20 dark:border-amber-500/10 bg-gradient-to-r from-amber-50/60 via-white to-amber-50/60 dark:from-amber-950/20 dark:via-card dark:to-amber-950/20">
              {listing.description && (
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {listing.description}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r ${theme.gradient} text-white text-[9px] font-bold tracking-wider shadow-sm flex-shrink-0`}>
                    <TypeIcon className="w-2.5 h-2.5" />
                    <span>{typeLabel}</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${theme.gradient} text-white shadow-md flex-shrink-0`}>
                  <span className="font-bold text-sm tracking-tight">{priceDisplay}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/listing/${listing.id}`}>
      <div
        className="cursor-pointer h-full group"
      >
        <div
          className={`listing-card-shell listing-card-${typeKey} h-full flex flex-col ${isSold ? "opacity-50 saturate-[0.3]" : ""} ${isBoosted ? (boostType === "spotlight" ? "listing-card-boosted-spotlight" : boostType === "featured" ? "listing-card-boosted-featured" : "listing-card-boosted-category") : ""}`}
          data-testid={`card-listing-${listing.id}`}
        >
          <div className={`${isBoosted && boostType === "spotlight" ? "bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400" : isBoosted && boostType === "featured" ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" : isBoosted && boostType === "category" ? "bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600" : theme.bannerBg} px-3 py-1.5 flex items-center justify-between gap-2`}>
            <div className="flex items-center gap-1.5">
              <TypeIcon className={`w-3 h-3 ${isBoosted && boostType === "spotlight" ? "text-amber-900/90" : "text-white/90"}`} />
              <span className={`text-[10px] font-bold tracking-wider uppercase ${isBoosted && boostType === "spotlight" ? "text-amber-900" : "text-white"}`}>{typeLabel}</span>
            </div>
            {isBoosted && (
              <div className={`flex items-center gap-1 boost-badge-${boostType || "category"} rounded-full px-2 py-0.5 ${boostType === "spotlight" ? "bg-amber-900/25 text-amber-900" : boostType === "featured" ? "bg-amber-900/30 text-white" : "bg-white/20 text-white"}`}>
                {boostType === "spotlight" ? <Crown className="w-2.5 h-2.5 fill-current" /> : boostType === "featured" ? <Star className="w-2.5 h-2.5 fill-current" /> : <TrendingUp className="w-2.5 h-2.5" />}
                <span className="text-[9px] font-bold tracking-wider uppercase">{boostType === "spotlight" ? t("listing.spotlight") : boostType === "featured" ? t("listing.featured") : t("listing.boosted")}</span>
              </div>
            )}
          </div>

          <div className="aspect-[4/3] w-full relative overflow-hidden">
            {listing.photos && listing.photos.length > 0 ? (
              <img
                src={listing.photos[0]}
                alt={listing.title}
                loading="lazy"
                className={`w-full h-full object-cover transition-transform duration-[800ms] ease-out ${isSold ? "" : "group-hover:scale-[1.08]"}`}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = logoSrc;
                  img.className = "w-full h-full object-contain p-6 bg-muted/30";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
                <img src={logoSrc} alt="Yardees" className="h-14 w-auto opacity-20" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {isSold && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-white/95 dark:bg-black/90 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl border border-white/20 dark:border-white/5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-sm tracking-wide">{t("listing.sold")}</span>
                </div>
              </div>
            )}

            <div className="absolute top-3 right-3">
              <HeartButton listingId={listing.id} />
            </div>

            {!isSold && photoCount > 1 && (
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-black/30 backdrop-blur-md text-white/80 text-[10px] font-medium">
                <Camera className="w-2.5 h-2.5" />
                {photoCount}
              </div>
            )}

            <div className={`absolute bottom-0 left-0 right-0 px-3 py-2 ${theme.bannerBg} bg-opacity-95`}>
              <div className={`px-2.5 py-0.5 rounded-md inline-flex items-center`}>
                <span className="font-bold text-sm text-white tracking-tight drop-shadow-sm">{priceDisplay}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 md:p-4 flex flex-col flex-grow">
            <h3 className={`font-display font-semibold text-[13px] md:text-[15px] leading-snug line-clamp-2 mb-1.5 ${isSold ? "text-muted-foreground line-through" : "card-gradient-text"}`}>
              {listing.title}
            </h3>

            <p className="text-[11px] md:text-xs text-muted-foreground line-clamp-2 mb-auto leading-relaxed">
              {listing.description}
            </p>

            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-border/15 dark:border-border/10 text-muted-foreground">
              <MapPin className={`w-3 h-3 flex-shrink-0 ${theme.accent}`} />
              <span className="truncate text-[10px] md:text-[11px]">{[listing.city, listing.country].filter(Boolean).join(", ")}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
