import { useRoute, useLocation } from "wouter";
import { useListing } from "@/hooks/use-listings";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
const logoSrc = "/yardees-logo.png";
import {
  ArrowLeft,
  Zap,
  TrendingUp,
  Star,
  AlertCircle,
  CheckCircle,
  Crown,
  Eye,
  Users,
  Clock,
  Coins,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ButtonLoader } from "@/components/PageLoader";
import { currencySymbols } from "@shared/schema";

type BoostTier = "category" | "featured" | "spotlight";
type Duration = 7 | 14 | 30;

const PRICES: Record<BoostTier, Record<Duration, number>> = {
  category: { 7: 199, 14: 299, 30: 499 },
  featured: { 7: 499, 14: 799, 30: 1299 },
  spotlight: { 7: 999, 14: 1699, 30: 2499 },
};

const REACH: Record<BoostTier, { views: string; impressions: string }> = {
  category: { views: "2-5x", impressions: "~500" },
  featured: { views: "5-10x", impressions: "~2,000" },
  spotlight: { views: "10-25x", impressions: "~5,000" },
};

const FEATURES: Record<BoostTier, string[]> = {
  category: [
    "Boosted within your item's category",
    "\"Boosted\" badge on listing",
    "Higher placement in category searches",
  ],
  featured: [
    "Everything in Category Bump",
    "Featured on the home page",
    "\"Featured\" badge displayed prominently",
    "Shown before all non-featured listings",
  ],
  spotlight: [
    "Everything in Featured",
    "Premium gold Spotlight badge",
    "Top placement across all pages",
    "Priority in search results",
    "Highlighted in email digests",
  ],
};

const TIER_CONFIG: Record<
  BoostTier,
  {
    label: string;
    icon: typeof TrendingUp;
    color: string;
    iconBg: string;
    borderSelected: string;
  }
> = {
  category: {
    label: "Category Bump",
    icon: TrendingUp,
    color: "text-blue-500",
    iconBg: "bg-blue-500",
    borderSelected: "border-blue-500",
  },
  featured: {
    label: "Featured",
    icon: Star,
    color: "text-amber-500",
    iconBg: "bg-amber-500",
    borderSelected: "border-amber-500",
  },
  spotlight: {
    label: "Spotlight",
    icon: Crown,
    color: "text-yellow-400",
    iconBg: "bg-gradient-to-br from-yellow-400 to-amber-600",
    borderSelected: "border-yellow-400",
  },
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function savingsPercent(tier: BoostTier, duration: Duration): number | null {
  if (duration === 7) return null;
  const base = PRICES[tier][7];
  const multiplier = duration === 14 ? 2 : duration === 30 ? (30 / 7) : 1;
  const expected = Math.round(base * multiplier);
  const actual = PRICES[tier][duration];
  const pct = Math.round(((expected - actual) / expected) * 100);
  return pct > 0 ? pct : null;
}

export default function BoostListing() {
  const { t } = useTranslation();
  useOGMeta({ title: "Boost Listing", description: "Promote your listing with boosting options on YARDEES." });
  const [match, params] = useRoute("/boost/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id || "0");
  const { data: listing, isLoading } = useListing(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<BoostTier | null>(null);
  const [duration, setDuration] = useState<Duration>(7);
  const [useCredits, setUseCredits] = useState(false);

  const userCredits = (user as any)?.boostCredits ?? 0;

  const selectedPrice = selectedTier ? PRICES[selectedTier][duration] : 0;
  const creditValueCents = useCredits ? Math.min(userCredits * 100, selectedPrice) : 0;
  const creditsUsed = useCredits ? Math.min(userCredits, Math.ceil(selectedPrice / 100)) : 0;
  const chargeAmount = selectedPrice - creditValueCents;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTier) throw new Error("Select a tier");

      if (chargeAmount <= 0 && useCredits) {
        const res = await fetch(`/api/listings/${id}/boost/credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boostType: selectedTier, duration }),
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Credit boost failed");
        }
        return res.json();
      }

      const res = await fetch(`/api/listings/${id}/boost/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boostType: selectedTier,
          duration,
          useCredits: creditsUsed,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Checkout failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        qc.invalidateQueries({ queryKey: ["/api/listings", id] });
        qc.invalidateQueries({ queryKey: ["/api/listings"] });
        qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({ title: t("boost.listingBoosted"), description: t("boost.boostActive") });
        navigate(`/listing/${id}`);
      }
    },
    onError: (err: any) => {
      if (err.message?.includes("not configured") || err.message?.includes("missingStripe")) {
        toast({
          title: "Payment setup required",
          description: "The payment system hasn't been configured yet. Please contact the site owner.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      }
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground" data-testid="text-login-prompt">{t("boost.pleaseLogIn")}</p>
          <Link href="/login"><Button data-testid="button-login">{t("nav.logIn")}</Button></Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-80 rounded-md" />
            <Skeleton className="h-96 rounded-md" />
            <Skeleton className="h-80 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing || listing.userId !== user.id) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <p className="text-muted-foreground" data-testid="text-not-found">{t("listing.notFound")}</p>
        </div>
      </div>
    );
  }

  const durations: Duration[] = [7, 14, 30];
  const tiers: BoostTier[] = ["category", "featured", "spotlight"];

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />

      <main className="container mx-auto px-4 py-10 max-w-6xl flex-grow">
        <Link href={`/listing/${id}`}>
          <Button variant="ghost" className="mb-6 pl-0 text-muted-foreground hover:text-foreground" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("listing.backToListings")}
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Zap className="w-7 h-7 text-amber-500" />
            <h1 className="text-3xl font-display font-bold gradient-text" data-testid="text-page-title">{t("boost.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("boost.promoting")} <span className="font-medium text-foreground">"{listing.title}"</span>
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 mb-8">
          {durations.map((d) => (
            <Button
              key={d}
              variant={duration === d ? "default" : "outline"}
              onClick={() => setDuration(d)}
              className="relative"
              data-testid={`button-duration-${d}`}
            >
              {t("boost.days", { count: d })}
              {d > 7 && (() => {
                const anyTierSaving = tiers.some((t) => savingsPercent(t, d));
                return anyTierSaving ? (
                  <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 bg-green-600 text-white">
                    {t("boost.save")}
                  </Badge>
                ) : null;
              })()}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 items-end">
          {tiers.map((tier) => {
            const config = TIER_CONFIG[tier];
            const Icon = config.icon;
            const isSelected = selectedTier === tier;
            const price = PRICES[tier][duration];
            const saving = savingsPercent(tier, duration);
            const reach = REACH[tier];
            const isFeaturedTier = tier === "featured";
            const isSpotlight = tier === "spotlight";

            return (
              <motion.div
                key={tier}
                layout
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={isFeaturedTier ? "md:-mt-4" : ""}
              >
                <button
                  onClick={() => setSelectedTier(tier)}
                  data-testid={`button-boost-${tier}`}
                  className={`relative w-full text-left rounded-md border-2 transition-colors ${
                    isSelected
                      ? `${config.borderSelected} shadow-lg`
                      : "border-border"
                  } ${
                    isSpotlight
                      ? "bg-gradient-to-b from-yellow-50/50 to-card dark:from-yellow-900/10 dark:to-card"
                      : "bg-card"
                  } ${isFeaturedTier ? "pb-2" : ""}`}
                >
                  {isFeaturedTier && (
                    <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1 rounded-t-[calc(var(--radius)-2px)]">
                      {t("boost.mostPopular")}
                    </div>
                  )}

                  {isSpotlight && (
                    <div className="bg-gradient-to-r from-yellow-400 to-amber-600 text-white text-xs font-semibold text-center py-1 rounded-t-[calc(var(--radius)-2px)]">
                      {t("boost.bestValue")}
                    </div>
                  )}

                  <div className="p-5">
                    <div className={`w-11 h-11 rounded-md ${config.iconBg} flex items-center justify-center mb-4`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-1" data-testid={`text-tier-label-${tier}`}>
                      {config.label}
                    </h3>

                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-3xl font-bold text-foreground" data-testid={`text-price-${tier}`}>
                        {formatCents(price)}
                      </span>
                      <span className="text-sm text-muted-foreground">/ {duration} days</span>
                      {saving && (
                        <Badge className="bg-green-600 text-white text-[10px]" data-testid={`badge-saving-${tier}`}>
                          Save {saving}%
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> {reach.views} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {reach.impressions} impr.
                      </span>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {FEATURES[tier].map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.color}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                      >
                        <CheckCircle className="w-4 h-4 text-primary-foreground" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-4">
            {userCredits > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground" data-testid="text-credit-balance">
                        {t("boost.creditsAvailable", { count: userCredits })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        1 credit = $0.01 value
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={useCredits ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseCredits(!useCredits)}
                    data-testid="button-toggle-credits"
                  >
                    {useCredits ? t("boost.usingCredits") : t("boost.useCredits")}
                  </Button>
                </div>
                {useCredits && selectedTier && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground space-y-1"
                  >
                    <div className="flex justify-between">
                      <span>{t("boost.boostPrice")}</span>
                      <span>{formatCents(selectedPrice)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>{t("boost.creditsApplied")}</span>
                      <span>-{formatCents(creditValueCents)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-foreground">
                      <span>{t("boost.amountToPay")}</span>
                      <span>{chargeAmount > 0 ? formatCents(chargeAmount) : t("common.free")}</span>
                    </div>
                  </motion.div>
                )}
              </Card>
            )}

            <Card className="p-5">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  {selectedTier ? (
                    <div>
                      <p className="font-semibold text-foreground" data-testid="text-selected-tier">
                        {TIER_CONFIG[selectedTier].label}
                      </p>
                      <p className="text-muted-foreground text-sm flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatCents(useCredits ? chargeAmount : selectedPrice)} for {duration} days
                        {useCredits && creditValueCents > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            ({formatCents(creditValueCents)} in credits)
                          </span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground" data-testid="text-select-prompt">{t("boost.selectTier")}</p>
                  )}
                </div>

                <Button
                  size="lg"
                  className="gap-2 min-w-[180px]"
                  disabled={!selectedTier || checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate()}
                  data-testid="button-proceed-checkout"
                >
                  {checkoutMutation.isPending ? (
                    <><ButtonLoader /> {t("boost.processing")}</>
                  ) : chargeAmount <= 0 && useCredits && selectedTier ? (
                    <><Coins className="w-4 h-4" /> {t("boost.boostWithCredits")}</>
                  ) : (
                    <><Zap className="w-4 h-4" /> {t("boost.payAndBoost")}</>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">{t("boost.preview")}</p>
            <Card className="overflow-visible">
              <div className="relative">
                {listing.photos?.[0] && (
                  <img
                    src={listing.photos[0]}
                    alt={listing.title}
                    className="w-full h-36 object-cover rounded-t-md"
                    data-testid="img-listing-preview"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = logoSrc;
                      img.className = "w-full h-36 object-contain rounded-t-md p-4 bg-primary/5";
                    }}
                  />
                )}
                {selectedTier && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-2 left-2"
                  >
                    {selectedTier === "category" && (
                      <Badge className="bg-blue-500 text-white" data-testid="badge-preview-category">{t("listing.boosted")}</Badge>
                    )}
                    {selectedTier === "featured" && (
                      <Badge className="bg-amber-500 text-white" data-testid="badge-preview-featured">{t("listing.featured")}</Badge>
                    )}
                    {selectedTier === "spotlight" && (
                      <Badge className="bg-gradient-to-r from-yellow-400 to-amber-600 text-white" data-testid="badge-preview-spotlight">{t("listing.spotlight")}</Badge>
                    )}
                  </motion.div>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-sm text-foreground truncate" data-testid="text-preview-title">
                  {listing.title}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-preview-price">
                  {currencySymbols[listing.currency] || "$"}
                  {(listing.price / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-preview-location">
                  {listing.city}, {listing.country}
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t("boost.stripeNote")}</span>
        </div>
      </main>
    </div>
  );
}
