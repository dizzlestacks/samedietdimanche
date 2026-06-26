import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useListingsPaginated } from "@/hooks/use-listings";
import { Navbar } from "@/components/Navbar";
import { ListingCard, ListingCardSkeleton, SpotlightCardSkeleton } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { categories, saleEventTypes, saleTypeLabels } from "@shared/schema";
import { Search, SlidersHorizontal, X, ShoppingBag, Tag, Tags, Store, Gift, Map, LayoutGrid, List, MapPin, Clock, TrendingUp, ChevronLeft, ChevronRight, Crown, Sparkles, Navigation, ExternalLink, StarIcon, Globe, CalendarDays, Zap } from "lucide-react";
const logoSrc = "/yardees-logo.png";
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ButtonLoader } from "@/components/PageLoader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { InFeedAd, ContentAd } from "@/components/AdUnit";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";
import { ListingMap } from "@/components/ListingMap";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event } from "@shared/schema";


const RECENT_SEARCHES_KEY = "yardees_recent_searches";
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  if (!term.trim()) return;
  const existing = getRecentSearches();
  const filtered = existing.filter((s) => s.toLowerCase() !== term.toLowerCase());
  const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function removeRecentSearch(term: string) {
  const existing = getRecentSearches();
  const updated = existing.filter((s) => s !== term);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function clearAllRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export default function Home() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());
  const searchRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<string>("all");
  const [listingType, setListingType] = useState<string>("all");
  const [country, setCountry] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [isShop, setIsShop] = useState<boolean | undefined>(undefined);
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc" | "boosted">("boosted");
  const [showFilters, setShowFilters] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [savedLocation, setSavedLocation] = useState<{ country: string; city: string } | null>(null);
  const [radius, setRadius] = useState<string>("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cityCoords, setCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem("yardees_location");
    if (!saved) {
      navigate("/welcome", { replace: true });
      return;
    }
    try {
      const loc = JSON.parse(saved);
      setSavedLocation(loc);
      const isWorldwide = loc.country === "Worldwide" || (!loc.country && !loc.city);
      if (!isWorldwide) {
        if (loc.country && !country) setCountry(loc.country);
        if (loc.city && !city) setCity(loc.city);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // IP-based coordinate fallback. Tries two providers so that a single
    // rate-limited/down service (ipapi.co frequently returns 503) no longer
    // wipes out userCoords — which is what nearby thrift shops depend on.
    const fallbackToIP = async () => {
      const providers = [
        "https://ipapi.co/json/",
        "https://ipwho.is/",
      ];
      for (const url of providers) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.latitude && data.longitude) {
            setUserCoords({ lat: data.latitude, lng: data.longitude });
            return;
          }
        } catch {
          // try next provider
        }
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => fallbackToIP(),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
      );
    } else {
      fallbackToIP();
    }
  }, []);

  useEffect(() => {
    // Resolve coords for nearby thrift shops from the saved location. Prefer the
    // city, but fall back to geocoding the country alone so country-only users
    // still get shops even when GPS/IP detection is unavailable. "Worldwide" has
    // no meaningful center, so it's skipped (relies on userCoords instead).
    const isWorldwide = country === "Worldwide";
    if ((!city && !country) || isWorldwide) {
      setCityCoords(null);
      return;
    }
    const geocodeLocation = async () => {
      try {
        const q = city ? (country ? `${city}, ${country}` : city) : country;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setCityCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
          }
        }
      } catch {}
    };
    geocodeLocation();
  }, [city, country]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      if (search.trim().length >= 2) {
        saveRecentSearch(search.trim());
        setRecentSearches(getRecentSearches());
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const { data: suggestions } = useQuery<{ titles: string[]; categories: string[] }>({
    queryKey: ["/api/search/suggestions", { q: debouncedSearch }],
    enabled: debouncedSearch.length >= 2,
  });

  const { data: trendingCategories } = useQuery<string[]>({
    queryKey: ["/api/search/trending"],
  });


  const { data: locations } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/listings/locations"],
  });
  const rawCountries = locations ? Object.keys(locations).sort() : [];
  const availableCountries = country && !rawCountries.includes(country) ? [country, ...rawCountries] : rawCountries;
  const rawCities = (country && locations?.[country]) ? locations[country].sort() : [];
  const availableCities = city && !rawCities.includes(city) ? [city, ...rawCities] : rawCities;

  const featuredScrollRef = useRef<HTMLDivElement>(null);

  const scrollFeatured = useCallback((direction: "left" | "right") => {
    const container = featuredScrollRef.current;
    if (!container) return;

    const firstChild = container.firstElementChild as HTMLElement | null;
    const cardWidth = firstChild?.offsetWidth || 200;
    const gap = 12;
    const scrollAmount = cardWidth + gap;
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (direction === "right" && container.scrollLeft >= maxScroll - 1) {
      container.scrollTo({ left: 0, behavior: "smooth" });
    } else if (direction === "left" && container.scrollLeft <= 1) {
      container.scrollTo({ left: maxScroll, behavior: "smooth" });
    } else {
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const LISTING_TYPES = [
    { value: "all", label: t("home.allListings"), icon: LayoutGrid, color: "from-emerald-600 to-green-500" },
    { value: "sale_event", label: t("home.sales"), icon: Tags, color: "from-purple-600 to-violet-500" },
    { value: "individual", label: t("home.individualItems"), icon: ShoppingBag, color: "from-rose-600 to-red-500" },
    { value: "shop", label: t("home.stores"), icon: Store, color: "from-blue-600 to-sky-500" },
    { value: "free", label: t("home.freeItems"), icon: Gift, color: "from-amber-500 to-yellow-500" },
  ];

  useOGMeta({
    title: t("home.heroTitle"),
    description: `${t("home.heroTagline")} ${t("home.heroSubtitle")}`,
    image: `${window.location.origin}/og-logo.png`,
    url: window.location.origin,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "YARDEES",
        alternateName: "Yardees Marketplace",
        url: window.location.origin,
        description: "Second Hand Never Looked This Good. Discover local yard sales, thrift shops, and unique second-hand finds in your neighborhood.",
        inLanguage: ["en", "es", "fr", "de", "pt", "zh"],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${window.location.origin}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "YARDEES",
        url: window.location.origin,
        logo: `${window.location.origin}/og-logo.png`,
        description: "YARDEES is the leading local marketplace for yard sales, thrift shopping, and second-hand goods. Second Hand Never Looked This Good.",
        sameAs: [],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "notifications@yardees.net",
          availableLanguage: ["English", "Spanish", "French", "German", "Portuguese", "Chinese"],
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is YARDEES?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "YARDEES is a marketplace for yard sales, thrift shops, and second-hand goods. Browse local listings, find hidden treasures, and sell items you no longer need.",
            },
          },
          {
            "@type": "Question",
            name: "How do I sell on YARDEES?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Create a free account, then click 'Sell' to list your items with photos, descriptions, and pricing. You can also boost your listings for more visibility.",
            },
          },
          {
            "@type": "Question",
            name: "Is YARDEES free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes! Browsing and listing items on YARDEES is completely free. Optional paid boosts are available to increase your listing's visibility.",
            },
          },
        ],
      },
    ],
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, category, listingType, country, city, isShop, sort, freeOnly, minPrice, maxPrice, radius]);

  const { data, isLoading, isError, refetch, isFetching } = useListingsPaginated({
    search: search || undefined,
    category: category === "all" ? undefined : category,
    listingType: listingType === "all" ? undefined : (listingType as any),
    country: country || undefined,
    city: city || undefined,
    isShop,
    sort,
    freeOnly: freeOnly ? "true" : undefined,
    minPrice: minPrice ? String(Number(minPrice) * 100) : undefined,
    maxPrice: maxPrice ? String(Number(maxPrice) * 100) : undefined,
    ...(radius && userCoords ? { lat: userCoords.lat, lng: userCoords.lng, radius: Number(radius) } : {}),
    page: currentPage,
  } as any);

  const shopLookupCoords = cityCoords || userCoords;
  const onlyLocationFilters = !search && category === "all" && listingType === "all" && isShop === undefined && sort === "boosted" && !freeOnly && !radius;
  const showNearbyShops = onlyLocationFilters || (isShop === true && !search && category === "all" && listingType === "all");

  const { data: nearbyShops } = useQuery<any[]>({
    queryKey: ["/api/shops/nearby", shopLookupCoords?.lat, shopLookupCoords?.lng],
    queryFn: async () => {
      if (!shopLookupCoords) return [];
      const res = await fetch(`/api/shops/nearby?lat=${shopLookupCoords.lat}&lon=${shopLookupCoords.lng}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!shopLookupCoords && showNearbyShops,
    staleTime: 5 * 60 * 1000,
  });
  const { data: collectionsData } = useQuery<any[]>({ queryKey: ["/api/collections"] });

  const { data: yardSaleData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/listings", "sale_events_section", country, city],
    queryFn: async () => {
      const params = new URLSearchParams({ listingType: "sale_event", limit: "10" });
      if (country) params.set("country", country);
      if (city) params.set("city", city);
      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: onlyLocationFilters,
    staleTime: 2 * 60 * 1000,
  });
  const yardSaleListings = yardSaleData?.items || [];

  const eventsUrl = (() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    const qs = params.toString();
    return qs ? `/api/events?${qs}` : "/api/events";
  })();
  const { data: allEvents } = useQuery<(Event & { rsvpCount: number })[]>({
    queryKey: ["/api/events", country, city],
    queryFn: async () => {
      const res = await fetch(eventsUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const todaysEvents = (allEvents || []).filter((e) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    return start < todayEnd && end >= todayStart;
  });

  const allListings = data?.items || [];
  const spotlightListings = currentPage === 1 ? allListings.filter((l: any) => l.isBoosted && !l.isSold && (l.boostType === "spotlight" || l.boostType === "featured")) : [];
  const listings = allListings;
  const totalCount = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveSearchMutation = useMutation({
    mutationFn: async () => {
      const label = search 
        ? `Search for "${search}"` 
        : category !== "all" 
          ? `Category: ${category}` 
          : "Saved Search";
      
      const res = await apiRequest("POST", "/api/saved-searches", {
        label,
        query: {
          search: search || undefined,
          category: category === "all" ? undefined : category,
          listingType: listingType === "all" ? undefined : listingType,
          country: country || undefined,
          city: city || undefined,
          isShop,
          freeOnly: freeOnly ? "true" : undefined,
        }
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      toast({
        title: t("home.searchSaved"),
        description: t("home.searchSavedDescription"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("home.saveSearchFailed"),
      });
    }
  });

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setListingType("all");
    setCountry(savedLocation?.country || "");
    setCity(savedLocation?.city || "");
    setIsShop(undefined);
    setSort("boosted");
    setFreeOnly(false);
    setRadius("");
  };

  const changeLocation = () => {
    localStorage.removeItem("yardees_location");
    navigate("/welcome");
  };

  const handleSuggestionClick = (type: 'title' | 'category', value: string) => {
    if (type === 'title') {
      setSearch(value);
      saveRecentSearch(value);
      setRecentSearches(getRecentSearches());
    } else {
      setCategory(value);
      setSearch("");
    }
    setShowSuggestions(false);
  };

  const handleRemoveRecent = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  };

  const handleClearAllRecent = () => {
    clearAllRecentSearches();
    setRecentSearches([]);
  };

  const handleRecentClick = (term: string) => {
    setSearch(term);
    setShowSuggestions(false);
  };

  const handleTrendingClick = (cat: string) => {
    setCategory(cat);
    setSearch("");
    setShowSuggestions(false);
  };

  const hasSearchContent = debouncedSearch.length >= 2;
  const hasSuggestions = suggestions && (suggestions.titles?.length > 0 || suggestions.categories?.length > 0);
  const hasRecent = recentSearches.length > 0;
  const hasTrending = trendingCategories && trendingCategories.length > 0;
  const shouldShowDropdown = showSuggestions && (hasSuggestions || (!hasSearchContent && (hasRecent || hasTrending)));

  const hasActiveFilters = search || category !== "all" || listingType !== "all" || country || city || isShop !== undefined || sort !== "boosted" || freeOnly || radius;

  const handlePullRefresh = async () => {
    await refetch();
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <PullToRefresh onRefresh={handlePullRefresh}>

      <section className="relative hero-glow overflow-hidden border-b border-border/20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/[0.05] dark:bg-primary/[0.08] rounded-full blur-[80px] animate-float-slow" />
          <div className="absolute top-10 -left-16 w-72 h-72 bg-accent/[0.06] dark:bg-accent/[0.10] rounded-full blur-[60px] animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-40 bg-primary/[0.04] dark:bg-primary/[0.06] rounded-full blur-[80px] animate-pulse-glow" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-accent/[0.04] dark:bg-accent/[0.06] rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />
        </div>

        <div className="relative container mx-auto px-3 sm:px-4 pt-8 pb-6 md:pt-16 md:pb-10 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-6 md:mb-10"
          >
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-3 leading-[1.1] tracking-tight gradient-text"
              data-testid="text-hero-title"
            >
              {t("home.heroTitle")}
            </h1>
            <p
              className="text-sm sm:text-base md:text-lg text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed"
              data-testid="text-hero-tagline"
            >
              {t("home.heroSubtitle")}
            </p>
            {savedLocation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center justify-center gap-3 mt-4"
              >
                <span className="inline-flex items-center gap-2 text-muted-foreground text-base font-medium">
                  {savedLocation.country === "Worldwide" || (!savedLocation.country && !savedLocation.city) ? (
                    <>
                      <Globe className="w-4 h-4" />
                      {t("welcome.browseWorldwide") || "Worldwide"}
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      {[savedLocation.city, savedLocation.country].filter(Boolean).join(", ")}
                    </>
                  )}
                </span>
                <button
                  onClick={changeLocation}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                  data-testid="button-change-location"
                >
                  {t("home.change")}
                </button>
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="bg-card/80 dark:bg-card/70 glass-card rounded-2xl border border-border/30 p-4 md:p-5 max-w-3xl mx-auto shadow-lg shadow-black/[0.03] dark:shadow-black/[0.15]"
          >

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-grow" ref={searchRef}>
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder={t("home.searchPlaceholder")}
                  autoComplete="off"
                  className="pl-11 h-12 md:h-14 text-base md:text-lg border-border/50 bg-background/60 focus:bg-background rounded-xl"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  data-testid="input-search"
                />

                <AnimatePresence>
                  {shouldShowDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-xl z-[100] overflow-hidden text-left"
                      data-testid="search-suggestions-dropdown"
                    >
                      {!hasSearchContent && hasRecent && (
                        <div className="p-2 border-b border-border/50">
                          <div className="flex items-center justify-between px-2 mb-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("home.recentSearches")}</p>
                            <button
                              onClick={handleClearAllRecent}
                              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                              data-testid="button-clear-all-recent"
                            >
                              {t("home.clearAll")}
                            </button>
                          </div>
                          {recentSearches.map((term, i) => (
                            <div
                              key={`recent-${i}`}
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-md transition-colors flex items-center gap-2 group cursor-pointer"
                              data-testid={`button-recent-search-${i}`}
                              role="option"
                              tabIndex={0}
                              onClick={() => handleRecentClick(term)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRecentClick(term); } }}
                            >
                              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="truncate flex-1">{term}</span>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveRecent(term, e)}
                                aria-label={`Remove ${term} from recent searches`}
                                className="invisible group-hover:visible flex-shrink-0 text-muted-foreground hover:text-destructive p-0.5 focus-visible:visible focus-visible:ring-1 focus-visible:ring-primary rounded"
                                data-testid={`button-remove-recent-${i}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {!hasSearchContent && hasTrending && (
                        <div className="p-2 border-b border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1">{t("home.trending")}</p>
                          {trendingCategories!.map((cat, i) => (
                            <button
                              key={`trending-${i}`}
                              onClick={() => handleTrendingClick(cat)}
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-md transition-colors flex items-center gap-2"
                              data-testid={`button-trending-category-${i}`}
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{t(`categories.${cat}`)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {hasSearchContent && suggestions && suggestions.titles && suggestions.titles.length > 0 && (
                        <div className="p-2 border-b border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1">{t("home.listings")}</p>
                          {suggestions.titles.map((title: string, i: number) => (
                            <button
                              key={i}
                              onClick={() => handleSuggestionClick('title', title)}
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-md transition-colors flex items-center gap-2"
                              data-testid={`button-suggestion-title-${i}`}
                            >
                              <Search className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="truncate">{title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {hasSearchContent && suggestions && suggestions.categories && suggestions.categories.length > 0 && (
                        <div className="p-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-1">{t("home.categories")}</p>
                          {suggestions.categories.map((cat: string, i: number) => (
                            <button
                              key={i}
                              onClick={() => handleSuggestionClick('category', cat)}
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded-md transition-colors flex items-center gap-2"
                              data-testid={`button-suggestion-category-${i}`}
                            >
                              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{t(`categories.${cat}`)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <Select value={sort} onValueChange={(val: any) => setSort(val)}>
                  <SelectTrigger className="flex-1 sm:w-[180px] h-12 md:h-14 text-base rounded-xl" data-testid="select-sort">
                    <SelectValue placeholder={t("home.sort")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boosted">{t("home.sortFeatured")}</SelectItem>
                    <SelectItem value="newest">{t("home.sortNewest")}</SelectItem>
                    <SelectItem value="price_asc">{t("home.sortPriceLow")}</SelectItem>
                    <SelectItem value="price_desc">{t("home.sortPriceHigh")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 md:h-14 md:w-14 flex-shrink-0 rounded-xl"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                  aria-label={t("home.filters")}
                >
                  <SlidersHorizontal className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-2"
                >
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-10 text-sm rounded-lg" data-testid="select-category">
                      <SelectValue placeholder={t("home.category")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("home.allCategories")}</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{t(`categories.${cat}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={country || "__all__"} onValueChange={(v) => { setCountry(v === "__all__" ? "" : v); setCity(""); }}>
                    <SelectTrigger className="h-10 text-sm rounded-lg" data-testid="select-country-filter">
                      <SelectValue placeholder={t("home.country")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("home.allCountries", "All Countries")}</SelectItem>
                      {availableCountries.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={city || "__all__"} onValueChange={(v) => setCity(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="h-10 text-sm rounded-lg" data-testid="select-city-filter">
                      <SelectValue placeholder={t("home.city")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("home.allCities", "All Cities")}</SelectItem>
                      {availableCities.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={radius || "__any__"} onValueChange={(v) => setRadius(v === "__any__" ? "" : v)}>
                    <SelectTrigger className="h-10 text-sm rounded-lg" data-testid="select-radius">
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5" />
                        <SelectValue placeholder={t("home.radius")} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">{t("home.anyDistance")}</SelectItem>
                      <SelectItem value="5">5 km</SelectItem>
                      <SelectItem value="10">10 km</SelectItem>
                      <SelectItem value="25">25 km</SelectItem>
                      <SelectItem value="50">50 km</SelectItem>
                      <SelectItem value="100">100 km</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={isShop === true ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsShop(isShop === true ? undefined : true)}
                    className="h-10 text-sm gap-1.5 rounded-lg"
                    data-testid="button-filter-shops"
                  >
                    <Store className="w-3.5 h-3.5" />
                    {t("home.shopsOnly")}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-5"
          >
            <div className="flex justify-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide px-1 -mx-1 pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {LISTING_TYPES.map(({ value, label, icon: Icon, color }) => {
                const isActive =
                  value === "shop" ? isShop === true && listingType === "all" && !freeOnly :
                  value === "free" ? freeOnly && listingType === "all" && isShop !== true :
                  value === "all" ? listingType === "all" && isShop !== true && !freeOnly :
                  listingType === value && isShop !== true && !freeOnly;

                const handleClick = () => {
                  if (value === "shop") {
                    setListingType("all");
                    setIsShop(isActive ? undefined : true);
                    setFreeOnly(false);
                  } else if (value === "free") {
                    setListingType("all");
                    setIsShop(undefined);
                    setFreeOnly(!isActive);
                  } else {
                    setListingType(value);
                    setIsShop(undefined);
                    setFreeOnly(false);
                  }
                };

                return (
                  <button
                    key={value}
                    onClick={handleClick}
                    data-testid={`chip-listing-type-${value}`}
                    className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                      isActive
                        ? `bg-gradient-to-r ${color || "from-foreground to-foreground"} text-white shadow-md border border-white/20`
                        : "bg-card/80 dark:bg-card/60 text-muted-foreground border border-border/40 hover:border-border hover:text-foreground hover:shadow-sm"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {!isLoading && spotlightListings.length > 0 && (
        <section className="relative py-10 md:py-14 border-b border-border/10 overflow-hidden" data-testid="section-featured">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-50/30 via-transparent to-transparent dark:from-amber-950/10 dark:via-transparent pointer-events-none" />
          <div className="container mx-auto px-4 relative">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between gap-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Crown className="w-4.5 h-4.5 text-amber-900" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text flex items-center gap-2">
                    {t("home.featured")}
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </h2>
                  <p className="text-[11px] md:text-xs text-muted-foreground/70 tracking-wide">{t("home.featuredSubtitle")}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Scroll featured left"
                  className="h-9 w-9 rounded-xl border-border/50 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-600 transition-all"
                  onClick={() => scrollFeatured("left")}
                  data-testid="button-featured-scroll-left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Scroll featured right"
                  className="h-9 w-9 rounded-xl border-border/50 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-600 transition-all"
                  onClick={() => scrollFeatured("right")}
                  data-testid="button-featured-scroll-right"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
            <div
              ref={featuredScrollRef}
              className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {spotlightListings.slice(0, 10).map((listing: any, index: number) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex-shrink-0 w-[300px] sm:w-[360px] md:w-[420px] snap-start"
                >
                  <ListingCard listing={listing} variant="spotlight" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {onlyLocationFilters && !isLoading && yardSaleListings.length > 0 && (
        <section className="py-8 md:py-12 border-b border-border/10" data-testid="section-yard-sales">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between gap-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                  <Tags className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">
                    {t("home.salesNearby")}
                  </h2>
                  <p className="text-[11px] md:text-xs text-muted-foreground/70 tracking-wide">{t("home.salesSubtitle")}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setListingType("sale_event");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="text-xs text-muted-foreground/50 hover:text-primary gap-1.5 rounded-xl"
                data-testid="button-view-all-yard-sales"
              >
                {t("home.viewAll")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {yardSaleListings.slice(0, 8).map((listing: any, index: number) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex-shrink-0 w-[200px] sm:w-[240px] snap-start"
                >
                  <ListingCard listing={listing} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {collectionsData && collectionsData.length > 0 && (
        <section className="py-8 md:py-12 border-b border-border/10" data-testid="section-collections">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between gap-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">
                    {t("home.seasonalCollections", "Seasonal Collections")}
                  </h2>
                  <p className="text-[11px] md:text-xs text-muted-foreground/70 tracking-wide">{t("home.collectionsSubtitle", "Curated picks for every season")}</p>
                </div>
              </div>
              <Link href="/collections">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/50 hover:text-primary gap-1.5 rounded-xl" data-testid="button-view-all-collections">
                  {t("home.viewAll")}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </motion.div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {collectionsData.slice(0, 8).map((collection: any, index: number) => (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="flex-shrink-0 w-[160px] snap-start"
                >
                  <Link href={`/collections/${collection.slug}`}>
                    <div className="listing-card-shell overflow-hidden h-full cursor-pointer group p-4 text-center" data-testid={`card-collection-${collection.slug}`}>
                      <span className="text-4xl block mb-2 transition-transform duration-300 group-hover:scale-110">{collection.emoji || "📦"}</span>
                      <h3 className="font-display font-semibold text-sm leading-snug line-clamp-1">{t(`collections.${collection.slug}`, collection.name) as string}</h3>
                      <p className="text-[10px] text-muted-foreground/60 line-clamp-1 mt-0.5">{t(`collections.${collection.slug}-desc`, collection.description) as string}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {todaysEvents.length > 0 && (
        <section className="py-8 md:py-12 border-b border-border/10" data-testid="section-todays-events">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between gap-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md shadow-green-500/20 animate-pulse">
                  <Zap className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">
                    {t("home.todaysEvents", "Happening Today")}
                  </h2>
                  <p className="text-[11px] md:text-xs text-muted-foreground/70 tracking-wide">
                    {t("home.todaysEventsSubtitle", "Events & yard sales happening right now")}
                  </p>
                </div>
              </div>
              <Link href="/events">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground/50 hover:text-primary gap-1.5 rounded-xl"
                  data-testid="button-view-all-events"
                >
                  {t("home.viewAll")}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </motion.div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {todaysEvents.map((event, index) => {
                const start = new Date(event.startDate);
                const end = new Date(event.endDate);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="flex-shrink-0 w-[260px] sm:w-[300px] snap-start"
                  >
                    <Link href={`/events/${event.id}`}>
                      <Card className="hover-elevate cursor-pointer h-full overflow-hidden border-green-500/20" data-testid={`card-today-event-${event.id}`}>
                        <div className="relative w-full h-32 overflow-hidden bg-muted">
                          <img
                            src={(event as any).photos?.[0] || logoSrc}
                            alt={event.title}
                            className={`w-full h-full ${(event as any).photos?.[0] ? "object-cover" : "object-contain p-4 bg-primary/5"}`}
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.onerror = null;
                              img.src = logoSrc;
                              img.className = "w-full h-full object-contain p-4 bg-primary/5";
                            }}
                          />
                          <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs gap-1 shadow-lg">
                            <Zap className="w-3 h-3" />
                            {t("events.happeningToday", "Happening Today")}
                          </Badge>
                        </div>
                        <CardHeader className="pb-1 pt-3">
                          <CardTitle className="text-sm font-semibold line-clamp-1">{event.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 pb-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0 text-green-500" />
                            <span>
                              {start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                              {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                              {" – "}
                              {end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                              {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                            <span className="truncate">{event.city}, {event.country}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {showNearbyShops && !isLoading && nearbyShops && nearbyShops.length > 0 && (
        <section className="py-8 md:py-12 border-b border-border/10" data-testid="section-nearby-shops">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between gap-4 mb-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Store className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-display font-bold tracking-tight gradient-text">
                    {t("home.nearbyThriftShops")}
                  </h2>
                  <p className="text-[11px] md:text-xs text-muted-foreground/70 tracking-wide">{t("home.nearbyThriftSubtitle")}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/nearby-shops")}
                className="text-xs text-muted-foreground/50 hover:text-primary gap-1.5 rounded-xl"
                data-testid="button-view-all-shops"
              >
                {t("home.viewAll")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
            <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {nearbyShops.slice(0, 8).map((shop: any, index: number) => (
                <motion.a
                  key={shop.id}
                  href={shop.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group flex-shrink-0 w-[200px] sm:w-[240px] snap-start cursor-pointer"
                  data-testid={`card-nearby-shop-${shop.id}`}
                >
                  <div className="listing-card-shell listing-card-shop h-full flex flex-col overflow-hidden">
                    <div className="aspect-[3/2] w-full relative overflow-hidden bg-muted/30">
                      {(shop.photoUrl || shop.photoRef) ? (
                        <img
                          src={shop.photoUrl || `/api/shops/photo/${shop.photoRef}`}
                          alt={shop.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      {shop.isOpen !== undefined && (
                        <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider uppercase backdrop-blur-md ${
                          shop.isOpen
                            ? "bg-emerald-500/90 text-white"
                            : "bg-red-500/90 text-white"
                        }`}>
                          {shop.isOpen ? "Open" : "Closed"}
                        </div>
                      )}
                      <div className="absolute top-2.5 right-2.5">
                        <div className="p-1.5 rounded-md bg-black/20 backdrop-blur-md text-white/70">
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      <h3 className="font-display font-semibold text-[13px] leading-snug line-clamp-1 text-foreground">
                        {shop.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-muted-foreground/70">
                        <MapPin className="w-3 h-3 flex-shrink-0 text-blue-500" />
                        <span className="text-[10px] truncate">{shop.address}</span>
                      </div>
                      {shop.rating && (
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <StarIcon
                                key={i}
                                className={`w-2.5 h-2.5 ${i < Math.round(shop.rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground/70">{shop.rating}</span>
                          {shop.userRatingsTotal && (
                            <span className="text-[9px] text-muted-foreground/60">({shop.userRatingsTotal})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 pt-6 pb-2">
        <ContentAd />
      </div>

      <main className="container mx-auto px-3 sm:px-4 py-8 md:py-14 flex-grow">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 rounded-full bg-gradient-to-b from-primary to-primary/30" />
            <div>
              <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight gradient-text">
                {hasActiveFilters ? t("home.searchResults") : t("home.freshFindings")}
              </h2>
              {allListings && (
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 tracking-wide">{t("home.listingsCount", { count: allListings.length })}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {hasActiveFilters && (
              <>
                {user && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => saveSearchMutation.mutate()} 
                    disabled={saveSearchMutation.isPending}
                    className="gap-1.5 rounded-xl text-xs h-9 border-border/30 hover:border-primary/30 hover:bg-primary/5"
                    data-testid="button-save-search"
                  >
                    {saveSearchMutation.isPending ? <ButtonLoader /> : <Bell className="w-3.5 h-3.5" />}
                    {t("home.saveSearch")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground/50 hover:text-destructive gap-1.5 text-xs h-9 rounded-xl">
                  <X className="w-3.5 h-3.5" />
                  {t("home.clear")}
                </Button>
              </>
            )}
            <div className="flex bg-muted/30 dark:bg-muted/10 rounded-xl p-0.5" role="group" aria-label="View mode">
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  viewMode === "grid" 
                    ? "bg-background dark:bg-card shadow-sm text-foreground" 
                    : "text-muted-foreground/40 hover:text-muted-foreground/70"
                }`}
                data-testid="button-grid-view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  viewMode === "list" 
                    ? "bg-background dark:bg-card shadow-sm text-foreground" 
                    : "text-muted-foreground/40 hover:text-muted-foreground/70"
                }`}
                data-testid="button-list-view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                aria-label="Map view"
                aria-pressed={viewMode === "map"}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  viewMode === "map" 
                    ? "bg-background dark:bg-card shadow-sm text-foreground" 
                    : "text-muted-foreground/40 hover:text-muted-foreground/70"
                }`}
                data-testid="button-map-view"
              >
                <Map className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide snap-x snap-mandatory -mx-1 px-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex-shrink-0 w-[200px] sm:w-[240px] snap-start">
                <ListingCardSkeleton />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <X className="w-7 h-7 text-destructive/60" />
            </div>
            <p className="text-muted-foreground">{t("home.failedToLoad")}</p>
          </div>
        ) : listings.length === 0 ? (
          onlyLocationFilters ? (
            // ── First-run / nothing-listed-yet empty state ──────────────────
            // Shown when there are genuinely no listings AND the user has not
            // applied any search/category/type filters. Keeps a brand-new site
            // (or a quiet area) feeling alive and points people toward action.
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto text-center py-16 px-4"
              data-testid="empty-first-run"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-primary/15 to-accent/15 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-9 h-9 text-primary" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">
                Be the first to sell here
              </h3>
              <p className="text-muted-foreground text-sm sm:text-base mb-8 max-w-md mx-auto leading-relaxed">
                {savedLocation && savedLocation.city
                  ? `No listings in ${savedLocation.city} just yet — YARDEES is brand new in your area. List an item and kick things off, or browse what's available everywhere.`
                  : "There are no listings yet. Post the very first item and get the marketplace going, or browse thrift shops nearby."}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
                {user ? (
                  <Link href="/create">
                    <Button size="lg" className="rounded-xl gap-2 shadow-sm" data-testid="button-list-first-item">
                      <ShoppingBag className="w-4 h-4" />
                      List your first item
                    </Button>
                  </Link>
                ) : (
                  <Link href="/register">
                    <Button size="lg" className="rounded-xl gap-2 shadow-sm" data-testid="button-signup-to-sell">
                      <ShoppingBag className="w-4 h-4" />
                      Sign up to start selling
                    </Button>
                  </Link>
                )}
                <Button
                  onClick={changeLocation}
                  size="lg"
                  variant="outline"
                  className="rounded-xl gap-2 border-border/40 hover:border-primary/30 hover:bg-primary/5"
                  data-testid="button-browse-elsewhere"
                >
                  <Globe className="w-4 h-4" />
                  Browse everywhere
                </Button>
              </div>

              {/* Keep the page lively with category entry points */}
              <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-4">
                Explore by category
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
                {categories.slice(0, 10).map((cat) => (
                  <Link key={cat} href={`/category/${encodeURIComponent(cat)}`}>
                    <span
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm bg-muted/40 hover:bg-primary/10 hover:text-primary border border-border/30 transition-colors cursor-pointer"
                      data-testid={`chip-empty-category-${cat}`}
                    >
                      <Tag className="w-3 h-3" />
                      {cat}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          ) : (
            // ── Filtered-empty state (search/filters returned nothing) ──────
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 bg-muted/30 dark:bg-muted/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Search className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-display font-bold mb-2">{t("home.noListings")}</h3>
              <p className="text-muted-foreground/70 text-sm mb-6 max-w-sm mx-auto">{t("home.tryAdjusting")}</p>
              <Button onClick={clearFilters} variant="outline" size="sm" className="rounded-xl border-border/30 hover:border-primary/30 hover:bg-primary/5">{t("home.clearAllFilters")}</Button>
            </motion.div>
          )
        ) : viewMode === "map" ? (
          <ListingMap listings={listings} />
        ) : (
          <>
            {totalCount > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] text-muted-foreground/70 tracking-wide" data-testid="text-listing-count">
                  {t("home.showingCount", { shown: listings.length, total: totalCount })}
                  {totalPages > 1 && ` · ${t("home.pageOf", { current: currentPage, total: totalPages })}`}
                </p>
                {isFetching && !isLoading && (
                  <div className="h-1 w-16 rounded-full overflow-hidden bg-muted/30">
                    <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                )}
              </div>
            )}
            {viewMode === "list" ? (
              <div className="flex flex-col gap-3">
                {listings.map((listing: any, index: number) => (
                  <Fragment key={listing.id}>
                    <ListingCard listing={listing} variant="list" />
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {listings.map((listing: any, index: number) => (
                  <Fragment key={listing.id}>
                    {index > 0 && index % 10 === 0 && (
                      <InFeedAd />
                    )}
                    {index < 8 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                      >
                        <ListingCard listing={listing} />
                      </motion.div>
                    ) : (
                      <ListingCard listing={listing} />
                    )}
                  </Fragment>
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-1.5 mt-10" aria-label="Pagination" data-testid="pagination">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-border/30"
                  onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === 1 || isFetching}
                  aria-label="First page"
                  data-testid="button-page-first"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <ChevronLeft className="w-4 h-4 -ml-2.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-border/30"
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === 1 || isFetching}
                  aria-label="Previous page"
                  data-testid="button-page-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {(() => {
                  const pages: (number | "...")[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground/40 text-sm select-none">...</span>
                    ) : (
                      <Button
                        key={p}
                        variant={currentPage === p ? "default" : "outline"}
                        size="icon"
                        className={`h-9 w-9 rounded-xl text-sm font-semibold ${
                          currentPage === p
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "border-border/30 hover:border-primary/30 hover:bg-primary/5"
                        }`}
                        onClick={() => { setCurrentPage(p as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        disabled={isFetching}
                        aria-label={`Page ${p}`}
                        aria-current={currentPage === p ? "page" : undefined}
                        data-testid={`button-page-${p}`}
                      >
                        {p}
                      </Button>
                    )
                  );
                })()}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-border/30"
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === totalPages || isFetching}
                  aria-label="Next page"
                  data-testid="button-page-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-border/30"
                  onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={currentPage === totalPages || isFetching}
                  aria-label="Last page"
                  data-testid="button-page-last"
                >
                  <ChevronRight className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4 -ml-2.5" />
                </Button>
              </nav>
            )}
          </>
        )}
      </main>

      </PullToRefresh>
    </div>
  );
}
