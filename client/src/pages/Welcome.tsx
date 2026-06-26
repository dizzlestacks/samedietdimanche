import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, ChevronRight, Globe, Loader2, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { POPULAR_CITIES } from "@/data/popularCities";
const logoSrc = "/yardees-logo.png";

// Full list of countries so the dropdown is comprehensive. "USA" and "UK" use the
// short forms that normalizeCountry() maps auto-detected locations onto.
const ALL_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark",
  "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
  "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
  "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
  "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
  "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines",
  "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
  "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal",
  "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan",
  "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda",
  "UK", "Ukraine", "United Arab Emirates", "Uruguay", "USA", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

export default function Welcome() {
  const { t } = useTranslation();
  const { toast } = useToast();
  useOGMeta({ title: "Welcome", description: "Welcome to YARDEES — the marketplace for yard sales and thrift shopping.", url: `${window.location.origin}/welcome` });
  const [, navigate] = useLocation();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const { data: locations } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/listings/locations"],
  });
  // City dropdown = popular cities for the chosen country (instant, worldwide)
  // followed by any extra cities that already have YARDEES listings. Popular
  // cities keep their prominence order; listing-only extras are appended
  // alphabetically. Dedupe is case-insensitive so we never show a city twice.
  const cityOptions = (() => {
    if (!country) return [] as string[];
    const popular = POPULAR_CITIES[country] || [];
    const listingCities = locations?.[country] || [];
    const seen = new Set(popular.map((c) => c.toLowerCase()));
    const extras = [...listingCities]
      .filter((c) => c && !seen.has(c.toLowerCase()))
      .sort();
    return [...popular, ...extras];
  })();
  const [detecting, setDetecting] = useState(false);

  // Live city autocomplete (OpenStreetMap) so ANY city worldwide can be picked
  // accurately — not just cities that already have YARDEES listings.
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const cityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic counter so a slow/old response can't overwrite newer suggestions.
  const cityReqId = useRef(0);

  const fetchCitySuggestions = (q: string) => {
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (!q || q.trim().length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }
    const reqId = ++cityReqId.current;
    cityDebounce.current = setTimeout(async () => {
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "json");
        url.searchParams.set("city", q.trim());
        if (country.trim()) url.searchParams.set("country", country.trim());
        url.searchParams.set("limit", "6");
        url.searchParams.set("addressdetails", "1");
        const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const data = await res.json();
        const names: string[] = Array.from(
          new Set(
            (data as any[])
              .map(
                (d) =>
                  d.address?.city ||
                  d.address?.town ||
                  d.address?.village ||
                  d.name ||
                  d.display_name?.split(",")[0]
              )
              .filter(Boolean)
          )
        ).slice(0, 6);
        // Ignore this response if a newer query has since been issued.
        if (reqId !== cityReqId.current) return;
        setCitySuggestions(names);
        setShowCitySuggestions(names.length > 0);
      } catch {
        // network/rate-limit failures are non-fatal — manual typing still works
      }
    }, 350);
  };

  useEffect(() => {
    const saved = localStorage.getItem("yardees_location");
    if (saved) {
      navigate("/", { replace: true });
      return;
    }
    const autoDetect = async () => {
      setDetecting(true);
      const ipResult = await detectViaIP();
      if (ipResult && ipResult.detectedCountry) {
        applyDetected(ipResult.detectedCity, ipResult.detectedCountry);
      }
      setDetecting(false);
    };
    autoDetect();
  }, [navigate]);

  // Reverse-geocode precise GPS coords into a city/country via OpenStreetMap.
  const reverseGeocode = async (lat: number, lng: number) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error("reverse geocode failed");
    const data = await res.json();
    const addr = data.address || {};
    const detectedCity =
      addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
    const detectedCountry = addr.country || "";
    return { detectedCity, detectedCountry };
  };

  // IP-based fallback when GPS is denied/unavailable. Tries two providers so a
  // single rate-limited/down service no longer silently breaks detection.
  const detectViaIP = async () => {
    const providers = [
      {
        url: "https://ipapi.co/json/",
        parse: (d: any) => ({ city: d.city, country: d.country_name }),
      },
      {
        url: "https://ipwho.is/",
        parse: (d: any) => ({ city: d.city, country: d.country }),
      },
    ];
    for (const p of providers) {
      try {
        const res = await fetch(p.url);
        if (!res.ok) continue;
        const data = await res.json();
        const { city: c, country: co } = p.parse(data);
        if (co) {
          return { detectedCity: c || "", detectedCountry: co };
        }
      } catch {
        // try next provider
      }
    }
    return null;
  };

  // Map full country names returned by geocoders to the short forms used in the
  // country dropdown, so the city list lights up after auto-detection.
  const normalizeCountry = (name: string) => {
    const map: Record<string, string> = {
      "united states": "USA",
      "united states of america": "USA",
      "united kingdom": "UK",
      "great britain": "UK",
      "england": "UK",
    };
    return map[name.trim().toLowerCase()] || name;
  };

  const applyDetected = (detectedCity: string, detectedCountry: string) => {
    if (detectedCountry) setCountry(normalizeCountry(detectedCountry));
    if (detectedCity) setCity(detectedCity);
  };

  const handleDetectLocation = async () => {
    setDetecting(true);

    // 1) Try precise browser geolocation (asks the user for permission).
    if (navigator.geolocation) {
      try {
        const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
          );
        });
        const { detectedCity, detectedCountry } = await reverseGeocode(coords.latitude, coords.longitude);
        if (detectedCountry) {
          applyDetected(detectedCity, detectedCountry);
          setDetecting(false);
          return;
        }
      } catch {
        // permission denied, timed out, or reverse geocode failed → fall back to IP
      }
    }

    // 2) Fall back to IP-based lookup.
    const ipResult = await detectViaIP();
    if (ipResult && ipResult.detectedCountry) {
      applyDetected(ipResult.detectedCity, ipResult.detectedCountry);
    } else {
      toast({
        title: t("welcome.locationFailedTitle", "Couldn't detect your location"),
        description: t(
          "welcome.locationFailedDesc",
          "Please pick your country and city manually below."
        ),
        variant: "destructive",
      });
    }
    setDetecting(false);
  };

  const handleContinue = () => {
    const loc = { country: country.trim(), city: city.trim() };
    localStorage.setItem("yardees_location", JSON.stringify(loc));
    navigate("/");
  };

  const handleWorldwide = () => {
    localStorage.setItem("yardees_location", JSON.stringify({ country: "Worldwide", city: "" }));
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-primary/[0.05] dark:bg-primary/[0.08] rounded-full blur-[80px] animate-float-slow" />
        <div className="absolute top-10 -left-16 w-72 h-72 bg-accent/[0.06] dark:bg-accent/[0.10] rounded-full blur-[60px] animate-float" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-40 bg-primary/[0.04] dark:bg-primary/[0.06] rounded-full blur-[80px] animate-pulse-glow" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-accent/[0.04] dark:bg-accent/[0.06] rounded-full blur-3xl animate-float" style={{ animationDelay: "4s" }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="inline-block mb-5"
          >
            <motion.img
              src={logoSrc}
              alt="YARDEES"
              className="h-20 w-auto drop-shadow-2xl"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              data-testid="img-logo"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-2xl sm:text-3xl md:text-5xl font-display font-bold mb-3 leading-tight gradient-text"
          >
            {t("welcome.title").replace("YARDEES", "")}
            <span>YARDEES</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="text-muted-foreground/80 text-sm md:text-base tracking-wide max-w-sm mx-auto"
          >
            {t("welcome.subtitle")}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="bg-card/80 dark:bg-card/70 glass-card rounded-2xl border border-border/30 p-5 md:p-6 shadow-lg shadow-black/[0.03] dark:shadow-black/[0.15]"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-primary" /> {t("welcome.country")}
              </label>
              <Select value={country} onValueChange={(v) => { setCountry(v); setCity(""); }}>
                <SelectTrigger className="h-11 text-base bg-background/60 border-border/50 rounded-xl" data-testid="select-splash-country">
                  <SelectValue placeholder={t("welcome.countryPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {ALL_COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder={t("welcome.typeCountryName")}
                className="h-9 text-sm mt-1.5 bg-background/60 border-border/50 rounded-xl"
                value={country}
                onChange={(e) => { const val = e.target.value; setCountry(val.charAt(0).toUpperCase() + val.slice(1)); setCity(""); }}
                data-testid="input-splash-country"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> {t("welcome.city")}
              </label>
              <Select value={city || "__none__"} onValueChange={(v) => setCity(v === "__none__" ? "" : v)} disabled={!country.trim()}>
                <SelectTrigger className={`h-11 text-base bg-background/60 border-border/50 rounded-xl ${!country.trim() ? "opacity-40 cursor-not-allowed" : ""}`} data-testid="select-splash-city">
                  <SelectValue placeholder={!country.trim() ? t("welcome.selectCountryFirst", "Select a country first") : t("welcome.cityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("welcome.cityPlaceholder")}</SelectItem>
                  {cityOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Input
                  placeholder={t("welcome.typeCityName", "Or type a city name")}
                  autoComplete="off"
                  className={`h-9 text-sm mt-1.5 bg-background/60 border-border/50 rounded-xl ${!country.trim() ? "opacity-40 cursor-not-allowed" : ""}`}
                  value={city}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = val.charAt(0).toUpperCase() + val.slice(1);
                    setCity(next);
                    fetchCitySuggestions(next);
                  }}
                  onFocus={() => { if (citySuggestions.length > 0) setShowCitySuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                  disabled={!country.trim()}
                  data-testid="input-splash-city"
                />
                {showCitySuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border/50 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {citySuggestions.map((c) => (
                      <button
                        type="button"
                        key={c}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCity(c);
                          setShowCitySuggestions(false);
                        }}
                        data-testid={`option-city-suggestion-${c}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 rounded-xl"
              onClick={handleDetectLocation}
              disabled={detecting}
              data-testid="button-detect-location"
            >
              {detecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              {detecting ? t("common.loading") : t("nearbyShops.useMyLocation")}
            </Button>
          </div>

          <div className="space-y-2.5 pt-5 mt-2 border-t border-border/20">
            <Button
              size="lg"
              className="w-full h-12 text-base gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold shadow-lg shadow-primary/20 rounded-xl"
              onClick={handleContinue}
              disabled={!country.trim()}
              data-testid="button-splash-continue"
            >
              {t("welcome.letsGo")}
              <ChevronRight className="w-5 h-5" />
            </Button>

            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">{t("auth.or") || "or"}</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>

            <Button
              size="lg"
              variant="outline"
              className="w-full h-11 text-base gap-2 font-semibold rounded-xl"
              onClick={handleWorldwide}
              data-testid="button-splash-worldwide"
            >
              <Globe className="w-5 h-5" />
              {t("welcome.browseWorldwide") || "Browse Worldwide"}
            </Button>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-xs text-muted-foreground/40 mt-6"
        >
          {t("welcome.changeAnytime")}
        </motion.p>
      </div>
    </div>
  );
}
