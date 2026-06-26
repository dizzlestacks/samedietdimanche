import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Navigation, Star, ExternalLink, AlertCircle, Store, List, Map as MapIcon, Loader2, Phone, Globe, Clock, X, SlidersHorizontal, Search } from "lucide-react";
import { InlineLoader } from "@/components/PageLoader";
import { useToast } from "@/hooks/use-toast";
const logoSrc = "/yardees-logo.png";

const CATEGORIES = [
  { label: "All", value: "" },
  { label: "Thrift Store", value: "thrift store" },
  { label: "Discount Shop", value: "discount shop" },
  { label: "Used Goods", value: "used goods store" },
  { label: "Donations", value: "donation center" },
];

interface NearbyShop {
  id: string;
  name: string;
  address: string;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  isOpen?: boolean;
  photoRef?: string;
  photoUrl?: string | null;
  mapsUrl: string;
  location?: { lat: number; lng: number };
}

interface ShopDetail {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating?: number;
  userRatingsTotal?: number;
  hours: string[] | null;
  isOpen?: boolean;
  photos: string[];
  mapsUrl: string;
  location?: { lat: number; lng: number };
  types: string[];
  priceLevel?: number;
  businessStatus?: string;
  reviews: { author: string; rating: number; text: string; time: string; profilePhoto?: string }[];
}

function ShopDetailModal({ shopId, open, onClose }: { shopId: string | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: detail, isLoading, isError } = useQuery<ShopDetail>({
    queryKey: ["/api/shops/details", shopId],
    enabled: !!shopId && open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground">{t("nearbyShops.searchFailed")}</p>
            <Button variant="outline" size="sm" onClick={onClose}>{t("common.close", "Close")}</Button>
          </div>
        )}
        {detail && (
          <>
            {detail.photos.length > 0 ? (
              <div className="h-48 overflow-hidden rounded-t-lg">
                <img
                  src={`/api/shops/photo/${detail.photos[0]}`}
                  alt={detail.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = logoSrc; e.currentTarget.className = "w-full h-full object-contain p-8 bg-primary/5"; }}
                />
              </div>
            ) : (
              <div className="h-48 bg-primary/5 flex items-center justify-center rounded-t-lg">
                <img src={logoSrc} alt="Yardees" className="w-full h-full object-contain p-8" />
              </div>
            )}

            <div className="p-5 space-y-4">
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-xl font-display leading-tight">{detail.name}</DialogTitle>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {detail.isOpen !== undefined && (
                      <Badge variant="outline" className={`text-xs ${detail.isOpen ? "text-green-600 dark:text-green-400 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30" : "text-red-500 dark:text-red-400 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"}`}>
                        {detail.isOpen ? t("nearbyShops.open") : t("nearbyShops.closed")}
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {detail.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className={`w-4 h-4 ${i <= Math.round(detail.rating!) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{detail.rating.toFixed(1)}</span>
                  {detail.userRatingsTotal && (
                    <span className="text-xs text-muted-foreground">({detail.userRatingsTotal} {t("nearbyShops.reviews", "reviews")})</span>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span>{detail.address}</span>
                </div>
                {detail.phone && (
                  <a href={`tel:${detail.phone}`} className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{detail.phone}</span>
                  </a>
                )}
                {detail.website && (
                  <a href={detail.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-primary hover:underline">
                    <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{detail.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  </a>
                )}
              </div>

              {detail.hours && detail.hours.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{t("listing.hours", "Hours")}</span>
                  </div>
                  <div className="space-y-0.5">
                    {detail.hours.map((line, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {detail.photos.length > 1 && (
                <div>
                  <p className="text-sm font-semibold mb-2">{t("nearbyShops.photos", "Photos")}</p>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
                    {detail.photos.slice(1, 4).map((ref, i) => (
                      <div key={i} className="aspect-square overflow-hidden">
                        <img
                          src={`/api/shops/photo/${ref}`}
                          alt=""
                          className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.reviews.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">{t("nearbyShops.recentReviews", "Recent Reviews")}</p>
                  <div className="space-y-3">
                    {detail.reviews.map((review, i) => (
                      <div key={i} className="bg-muted/20 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          {review.profilePhoto && (
                            <img src={review.profilePhoto} alt="" className="w-5 h-5 rounded-full" />
                          )}
                          <span className="text-xs font-medium">{review.author}</span>
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{review.text}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{review.time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <a href={detail.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full gap-2" data-testid="button-detail-maps">
                    <ExternalLink className="w-4 h-4" /> {t("nearbyShops.viewOnMaps")}
                  </Button>
                </a>
                {detail.phone && (
                  <a href={`tel:${detail.phone}`}>
                    <Button variant="outline" size="icon" data-testid="button-detail-call">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
      <span className="text-xs font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

function LeafletMapView({ shops }: { shops: NearbyShop[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const validShops = shops.filter(s => s.location);
    if (!validShops.length) return;

    const centerLat = validShops.reduce((s, sh) => s + sh.location!.lat, 0) / validShops.length;
    const centerLng = validShops.reduce((s, sh) => s + sh.location!.lng, 0) / validShops.length;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:15px;">🏪</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    validShops.forEach(shop => {
      const marker = L.marker([shop.location!.lat, shop.location!.lng], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:170px;font-family:sans-serif;padding:2px 0">
          <strong style="font-size:13px;display:block;margin-bottom:3px">${shop.name}</strong>
          <span style="font-size:11px;color:#555;display:block;margin-bottom:4px">${shop.address}</span>
          ${shop.rating ? `<span style="font-size:11px">⭐ ${shop.rating.toFixed(1)}</span> ` : ""}
          ${shop.isOpen !== undefined ? `<span style="font-size:11px;color:${shop.isOpen ? "#16a34a" : "#dc2626"};display:block;margin:2px 0">${shop.isOpen ? "✓ Open Now" : "✗ Closed"}</span>` : ""}
          <a href="${shop.mapsUrl}" target="_blank" rel="noopener" style="font-size:11px;color:#2563eb;display:block;margin-top:6px">View on Google Maps →</a>
        </div>`
      );
    });

    return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; };
  }, [shops]);

  return <div ref={mapRef} className="w-full rounded-2xl" style={{ height: "520px", zIndex: 0 }} />;
}

export default function NearbyShops() {
  const { t } = useTranslation();
  useOGMeta({ title: "Nearby Thrift Shops", description: "Discover thrift stores and discount shops near you on YARDEES.", url: `${window.location.origin}/nearby-shops` });
  const { toast } = useToast();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [locating, setLocating] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [radius, setRadius] = useState("10000");
  const [minRating, setMinRating] = useState("0");
  const [openNow, setOpenNow] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (viewMode === "map" && !leafletReady) {
      if (!(window as any).L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => setLeafletReady(true);
        document.head.appendChild(script);
      } else {
        setLeafletReady(true);
      }
    }
  }, [viewMode]);

  const locate = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location not supported", description: "Use city search instead.", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast({ title: "Couldn't detect location", description: "Enter your city manually.", variant: "destructive" });
        setLocating(false);
      }
    );
  };

  const handleCitySearch = async () => {
    const city = cityInput.trim();
    if (!city) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`, {
        headers: { "Accept-Language": "en" }
      });
      const data = await res.json();
      if (data.length > 0) {
        setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      } else {
        toast({ title: "City not found", description: "Try a different spelling or city name.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Search failed", description: "Could not geocode that location.", variant: "destructive" });
    }
  };

  const { data: rawShops, isLoading, isError, error } = useQuery<NearbyShop[]>({
    queryKey: ["/api/shops/nearby", coords?.lat, coords?.lon, activeCategory, radius],
    queryFn: async () => {
      const url = new URL("/api/shops/nearby", window.location.origin);
      url.searchParams.set("lat", String(coords!.lat));
      url.searchParams.set("lon", String(coords!.lon));
      url.searchParams.set("radius", radius);
      if (activeCategory) url.searchParams.set("query", activeCategory);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    enabled: !!coords,
  });

  const shops = rawShops?.filter((shop) => {
    if (openNow && shop.isOpen === false) return false;
    if (parseFloat(minRating) > 0 && (!shop.rating || shop.rating < parseFloat(minRating))) return false;
    if (nameFilter.trim() && !shop.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
    return true;
  });

  const isMissingKey = isError && (error as Error)?.message?.includes("not configured");

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-6xl flex-grow">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Store className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-display font-bold gradient-text">{t("nearbyShops.title")}</h1>
          </div>
          <p className="text-muted-foreground">{t("nearbyShops.subtitle")}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={locate} variant="outline" disabled={locating} className="gap-2 flex-shrink-0" data-testid="button-detect-location">
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4 text-primary" />}
              {locating ? t("common.loading") : t("nearbyShops.useMyLocation")}
            </Button>
            <div className="flex gap-2 flex-grow">
              <Input
                placeholder={t("nearbyShops.enterCity")}
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCitySearch()}
                className="flex-grow"
                data-testid="input-city-search"
              />
              <Button onClick={handleCitySearch} disabled={!cityInput.trim()} data-testid="button-city-search">
                {t("nearbyShops.search")}
              </Button>
            </div>
          </div>
          {coords && (
            <p className="text-xs text-primary mt-3 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {t("nearbyShops.locationSet")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {CATEGORIES.map(({ label, value }) => (
            <button key={value} onClick={() => setActiveCategory(value)} data-testid={`chip-category-${label}`}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${activeCategory === value ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}>
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`ml-auto px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5 ${showFilters ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50"}`}
            data-testid="button-toggle-filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="bg-card rounded-2xl border border-border p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Search by Name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Shop name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="pl-9"
                    data-testid="input-name-filter"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Distance</label>
                <Select value={radius} onValueChange={setRadius}>
                  <SelectTrigger data-testid="select-radius">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">1 km (0.6 mi)</SelectItem>
                    <SelectItem value="2000">2 km (1.2 mi)</SelectItem>
                    <SelectItem value="5000">5 km (3 mi)</SelectItem>
                    <SelectItem value="10000">10 km (6 mi)</SelectItem>
                    <SelectItem value="20000">20 km (12 mi)</SelectItem>
                    <SelectItem value="50000">50 km (31 mi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Min Rating</label>
                <Select value={minRating} onValueChange={setMinRating}>
                  <SelectTrigger data-testid="select-min-rating">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Any Rating</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="3.5">3.5+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="4.5">4.5+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Status</label>
                <button
                  onClick={() => setOpenNow(!openNow)}
                  className={`w-full h-9 px-4 rounded-md text-sm font-medium border transition-all flex items-center justify-center gap-2 ${openNow ? "bg-green-600 text-white border-green-600" : "bg-background text-muted-foreground border-input hover:border-primary/50"}`}
                  data-testid="button-open-now"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {openNow ? "Open Now Only" : "Any Status"}
                </button>
              </div>
            </div>

            {(nameFilter || minRating !== "0" || openNow || radius !== "10000") && (
              <button
                onClick={() => { setNameFilter(""); setMinRating("0"); setOpenNow(false); setRadius("10000"); }}
                className="text-xs text-primary hover:underline font-medium"
                data-testid="button-clear-filters"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {isMissingKey && (
          <div className="flex items-start gap-3 p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl mb-6">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">Google Places API key required</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Add a <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">GOOGLE_API_KEY_JAVA</code> environment secret to enable nearby shop search.
              </p>
            </div>
          </div>
        )}

        {shops && shops.length > 0 && (
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted-foreground">
              {rawShops && shops && rawShops.length !== shops.length
                ? `${shops.length} of ${rawShops.length} shops`
                : t("nearbyShops.shopsFound", { count: shops?.length || 0 })}
            </p>
            <div className="flex rounded-xl border border-border overflow-hidden">
              {(["list", "map"] as const).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                  data-testid={`button-view-${mode}`}>
                  {mode === "list" ? <><List className="w-4 h-4" /> {t("nearbyShops.list")}</> : <><MapIcon className="w-4 h-4" /> {t("nearbyShops.map")}</>}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        )}

        {!isLoading && !isError && shops?.length === 0 && coords && (
          <div className="text-center py-16 bg-muted/20 rounded-3xl border border-dashed border-border">
            <Store className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">{t("nearbyShops.noShopsFound")}</h3>
            <p className="text-muted-foreground text-sm">{t("nearbyShops.tryDifferentCategory")}</p>
          </div>
        )}

        {!coords && !isLoading && (
          <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed border-border">
            <Navigation className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">{t("nearbyShops.whereAreYou")}</h3>
            <p className="text-muted-foreground mb-6">{t("nearbyShops.useDeviceLocation")}</p>
            <Button onClick={locate} className="gap-2"><Navigation className="w-4 h-4" /> {t("nearbyShops.detectMyLocation")}</Button>
          </div>
        )}

        {!isLoading && viewMode === "map" && shops && shops.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
            {leafletReady ? <LeafletMapView shops={shops} /> : (
              <div className="h-[520px] flex items-center justify-center bg-muted/30">
                <InlineLoader />
              </div>
            )}
          </div>
        )}

        {!isLoading && viewMode === "list" && shops && shops.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map((shop) => (
              <div
                key={shop.id}
                role="button"
                tabIndex={0}
                className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                onClick={() => { if (shop.id.startsWith("osm:")) { window.open(shop.mapsUrl, "_blank", "noopener"); } else { setSelectedShopId(shop.id); } }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (shop.id.startsWith("osm:")) { window.open(shop.mapsUrl, "_blank", "noopener"); } else { setSelectedShopId(shop.id); } } }}
                data-testid={`card-shop-${shop.id}`}
              >
                {(shop.photoUrl || shop.photoRef) ? (
                  <div className="h-36 overflow-hidden">
                    <img
                      src={shop.photoUrl || `/api/shops/photo/${shop.photoRef}`}
                      alt={shop.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = logoSrc;
                        img.className = "w-full h-full object-contain p-6 bg-primary/5";
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-36 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <img src={logoSrc} alt="Yardees" className="h-10 w-auto opacity-25" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-base leading-tight">{shop.name}</h3>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {shop.rating && <StarRating rating={shop.rating} />}
                      {shop.isOpen !== undefined && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${shop.isOpen ? "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800" : "text-red-500 dark:text-red-400 border-red-200 dark:border-red-800"}`}>
                          {shop.isOpen ? t("nearbyShops.open") : t("nearbyShops.closed")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-1 text-muted-foreground text-xs mb-3">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{shop.address}</span>
                  </div>
                  {shop.userRatingsTotal && (
                    <p className="text-xs text-muted-foreground mb-3">{t("nearbyShops.reviewsCount", { count: shop.userRatingsTotal })}</p>
                  )}
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" data-testid={`button-details-${shop.id}`}>
                    <Store className="w-3 h-3" /> {t("nearbyShops.viewDetails", "View Details")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ShopDetailModal
        shopId={selectedShopId}
        open={!!selectedShopId}
        onClose={() => setSelectedShopId(null)}
      />
    </div>
  );
}
