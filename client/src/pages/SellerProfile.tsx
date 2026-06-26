import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { useAllListings } from "@/hooks/use-listings";
import { Navbar } from "@/components/Navbar";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { User, ShoppingBag, Package, Star, Calendar, MessageSquare, MapPin, Globe } from "lucide-react";
import { PageTransition } from "@/components/PageLoader";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { SellerBadge, StarRating } from "@/components/SellerBadge";
const logoSrc = "/yardees-logo.png";

export default function SellerProfile() {
  const { t } = useTranslation();
  const [, params] = useRoute("/seller/:userId");
  const userId = params?.userId || "";

  const { data: listings, isLoading } = useAllListings(userId ? { userId } : undefined);

  const { data: verification } = useQuery<any>({
    queryKey: ["/api/users", userId, "verification"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/verification`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: storefront } = useQuery<any>({
    queryKey: ["/api/users", userId, "storefront"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/storefront`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: reviewSummary } = useQuery<{ avg: number; count: number }>({
    queryKey: ["/api/reviews", userId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${userId}/summary`);
      if (!res.ok) return { avg: 0, count: 0 };
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/reviews", userId],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${userId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const activeListings = listings?.filter(l => !(l as any).isSold) || [];
  const soldListings = listings?.filter(l => (l as any).isSold) || [];
  const sellerName = storefront?.displayName || storefront?.firstName || verification?.displayName || verification?.firstName || t("listing.seller");
  const memberSince = storefront?.createdAt ? new Date(storefront.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;

  useOGMeta({
    title: `${sellerName} — Seller Profile`,
    description: `Browse ${activeListings.length} active listing${activeListings.length !== 1 ? "s" : ""} from ${sellerName} on YARDEES.`,
    image: storefront?.storefrontBanner || storefront?.profileImageUrl || undefined,
    url: `${window.location.origin}/seller/${userId}`,
  });

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <PageTransition>
      <main className="container mx-auto px-4 py-0 max-w-6xl flex-grow">
        {storefront?.storefrontBanner && (
          <div className="relative -mx-4 sm:mx-0 sm:rounded-2xl overflow-hidden mb-6 h-40 sm:h-52">
            <img
              src={storefront.storefrontBanner}
              alt={`${sellerName} storefront`}
              className="w-full h-full object-cover"
              data-testid="img-storefront-banner"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>
        )}

        <div className={`bg-card rounded-2xl border border-border p-6 mb-8 ${storefront?.storefrontBanner ? "-mt-12 relative z-10 mx-2 sm:mx-4" : "mt-10"}`}>
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-background shadow-lg">
              {(storefront?.profileImageUrl || verification?.profileImageUrl) ? (
                <img
                  src={storefront?.profileImageUrl || verification?.profileImageUrl}
                  alt={sellerName}
                  className="w-full h-full object-cover"
                  data-testid="img-seller-photo"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = logoSrc;
                    img.className = "w-full h-full object-contain p-2 bg-primary/5";
                  }}
                />
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-display font-bold gradient-text truncate" data-testid="text-seller-name">
                  {sellerName}
                </h1>
                {verification && <SellerBadge level={verification.level} size={20} showLabel />}
              </div>
              {storefront?.storefrontTagline && (
                <p className="text-sm text-muted-foreground/70 italic mb-2" data-testid="text-storefront-tagline">
                  "{storefront.storefrontTagline}"
                </p>
              )}
              {storefront?.bio && (
                <p className="text-sm text-foreground/80 mb-2 max-w-lg" data-testid="text-seller-bio">
                  {storefront.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                {(storefront?.city || storefront?.country) && (
                  <span className="inline-flex items-center gap-1" data-testid="text-seller-location">
                    <MapPin className="w-3.5 h-3.5" />
                    {[storefront?.city, storefront?.country].filter(Boolean).join(", ")}
                  </span>
                )}
                {storefront?.website && (
                  <a
                    href={storefront.website.startsWith("http") ? storefront.website : `https://${storefront.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    data-testid="link-seller-website"
                  >
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className="gap-1">
                  <ShoppingBag className="w-3 h-3" /> {activeListings.length} {t("dashboard.active").toLowerCase()}
                </Badge>
                {soldListings.length > 0 && (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Package className="w-3 h-3" /> {soldListings.length} {t("analytics.sold").toLowerCase()}
                  </Badge>
                )}
                {reviewSummary && reviewSummary.count > 0 && (
                  <StarRating rating={reviewSummary.avg} count={reviewSummary.count} />
                )}
                {memberSince && (
                  <Badge variant="outline" className="gap-1 text-muted-foreground/50 text-[10px]">
                    <Calendar className="w-2.5 h-2.5" /> {t("seller.memberSince", { date: memberSince })}
                  </Badge>
                )}
              </div>

              {storefront?.favoriteCategories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2" data-testid="seller-favorite-categories">
                  {storefront.favoriteCategories.map((cat: string) => (
                    <Badge key={cat} variant="secondary" className="text-xs font-normal">
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Link href="/messages">
              <Button variant="outline" className="gap-2 hidden sm:flex" data-testid="button-message-seller">
                <MessageSquare className="w-4 h-4" /> {t("listing.messagesSeller")}
              </Button>
            </Link>
          </div>

          {storefront?.storefrontBio && (
            <div className="mt-5 pt-5 border-t border-border/30">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line" data-testid="text-storefront-bio">
                {storefront.storefrontBio}
              </p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : activeListings.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
            <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">{t("seller.noActiveListings")}</h3>
            <p className="text-muted-foreground text-sm">{t("seller.noItemsAvailable")}</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-display font-bold gradient-text mb-5">{t("seller.activeListings")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
              {activeListings.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </>
        )}

        {reviews && reviews.length > 0 && (
          <div className="mt-12 pt-8 border-t" data-testid="seller-reviews">
            <h2 className="text-xl font-display font-bold gradient-text mb-5 flex items-center gap-2">
              {t("listing.reviews")}
              {reviewSummary && reviewSummary.count > 0 && (
                <span className="text-base font-normal text-muted-foreground">
                  {t("seller.avgTotal", { avg: reviewSummary.avg.toFixed(1), count: reviewSummary.count })}
                </span>
              )}
            </h2>
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="p-4" data-testid={`review-${review.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-4 h-4 ${review.rating >= s ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  {review.comment && <p className="text-sm">{review.comment}</p>}
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
      </PageTransition>
    </div>
  );
}
