import { useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { useAllListings } from "@/hooks/use-listings";
import { Navbar } from "@/components/Navbar";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { categories } from "@shared/schema";
import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Tag } from "lucide-react";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function CategoryBrowse() {
  const { t } = useTranslation();
  const [, params] = useRoute("/category/:category");
  const rawCategory = decodeURIComponent(params?.category || "");
  const category = categories.find(c => c.toLowerCase().replace(/\s+/g, "-") === rawCategory) || rawCategory;

  const [sort, setSort] = useState<"boosted" | "newest" | "price_asc" | "price_desc">("boosted");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const { data: listings, isLoading } = useAllListings({
    category,
    sort,
    search: search || undefined,
    country: country || undefined,
    city: city || undefined,
  });

  useOGMeta({
    title: `${category} for Sale — Buy & Sell Second-Hand ${category}`,
    description: `Browse ${listings?.length ?? ""} second-hand ${category} listings on YARDEES. Find pre-owned ${category?.toLowerCase()} at yard sale and thrift store prices. Buy and sell locally or worldwide.`,
    url: `${window.location.origin}/category/${encodeURIComponent(category || "")}`,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: `${category} — Second-Hand ${category} on YARDEES`, description: `Browse ${category} items on YARDEES`, url: `${window.location.origin}/category/${encodeURIComponent(category || "")}`, isPartOf: { "@type": "WebSite", name: "YARDEES", url: window.location.origin } },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: window.location.origin }, { "@type": "ListItem", position: 2, name: category, item: `${window.location.origin}/category/${encodeURIComponent(category || "")}` }] },
    ],
  });

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl flex-grow">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-primary">{t("common.home")}</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">{category}</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Tag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold gradient-text">{category}</h1>
            {listings && <p className="text-sm text-muted-foreground">{t("home.listingsCount", { count: listings.length })}</p>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-7 bg-card rounded-xl border border-border p-4">
          <Input
            placeholder={t("home.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 text-sm flex-grow min-w-[160px]"
            data-testid="input-search-category"
          />
          <Input
            placeholder={t("home.country")}
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="h-9 text-sm w-28"
            data-testid="input-country"
          />
          <Input
            placeholder={t("home.city")}
            value={city}
            onChange={e => setCity(e.target.value)}
            className="h-9 text-sm w-28"
            data-testid="input-city"
          />
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="h-9 text-sm w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boosted">{t("home.sortFeatured")}</SelectItem>
              <SelectItem value="newest">{t("home.sortNewest")}</SelectItem>
              <SelectItem value="price_asc">{t("home.sortPriceLow")}</SelectItem>
              <SelectItem value="price_desc">{t("home.sortPriceHigh")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-7">
          {categories.map(cat => (
            <Link key={cat} href={`/category/${cat.toLowerCase().replace(/\s+/g, "-")}`}>
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                cat === category
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}>
                {cat}
              </span>
            </Link>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : listings?.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
            <Tag className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">{t("home.noListings")}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t("home.noListingsMessage")}</p>
            <Link href="/create">
              <span className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                {t("home.postFirstListing")}
              </span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
            {listings?.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
