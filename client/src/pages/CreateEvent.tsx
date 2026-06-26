import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPlus, ImagePlus, X, Loader2, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineLoader, ButtonLoader } from "@/components/PageLoader";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

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

export default function CreateEvent() {
  const { t } = useTranslation();
  useOGMeta({ title: "Create Event", description: "Create a new yard sale event on YARDEES.", url: `${window.location.origin}/create-event` });
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const storedLoc = useMemo(() => getStoredLocation(), []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(storedLoc?.city || "");
  const [country, setCountry] = useState(storedLoc?.country || "USA");
  const [startDate, setStartDate] = useState("");

  const { data: locationsMap } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/listings/locations"],
  });

  const evtCountryOptions = useMemo(() => {
    const set = new Set<string>();
    if (locationsMap) Object.keys(locationsMap).forEach(c => set.add(c));
    if (storedLoc?.country) set.add(storedLoc.country);
    if (country) set.add(country);
    return Array.from(set).sort();
  }, [locationsMap, storedLoc, country]);

  const evtCityOptions = useMemo(() => {
    const set = new Set<string>();
    if (country && locationsMap?.[country]) {
      locationsMap[country].forEach(c => set.add(c));
    }
    if (storedLoc?.city && (!country || country === storedLoc.country)) {
      set.add(storedLoc.city);
    }
    if (city) set.add(city);
    return Array.from(set).sort();
  }, [country, city, locationsMap, storedLoc]);

  const [evtCitySearch, setEvtCitySearch] = useState("");
  const [evtCityOpen, setEvtCityOpen] = useState(false);

  const filteredEvtCities = useMemo(() => {
    if (!evtCitySearch) return evtCityOptions;
    const q = evtCitySearch.toLowerCase();
    return evtCityOptions.filter(c => c.toLowerCase().includes(q));
  }, [evtCityOptions, evtCitySearch]);
  const [endDate, setEndDate] = useState("");
  const [listingId, setListingId] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 10) {
      toast({ variant: "destructive", title: t("common.error"), description: "Maximum 10 photos allowed" });
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("photo", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        setPhotos((prev) => [...prev, data.url]);
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: "Failed to upload photo" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/login");
    }
  }, [user, authLoading, setLocation]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        description: description || null,
        address,
        city,
        country,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      };
      if (listingId) {
        body.listingId = parseInt(listingId, 10);
      }
      if (photos.length > 0) {
        body.photos = photos;
      }
      const res = await apiRequest("POST", "/api/events", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: t("events.eventCreated"), description: t("events.eventPublished") });
      setLocation("/events");
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t("common.error"), description: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !address || !city || !startDate || !endDate) {
      toast({ variant: "destructive", title: t("events.missingFields"), description: t("events.fillRequired") });
      return;
    }
    createMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <InlineLoader />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto px-4 py-8 flex-grow max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-primary" />
              {t("events.createYardSaleEvent")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t("events.titleRequired")}</Label>
                <Input
                  id="title"
                  placeholder={t("events.titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  data-testid="input-event-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t("events.description")}</Label>
                <Textarea
                  id="description"
                  placeholder={t("events.descriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-event-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t("events.addressRequired")}</Label>
                <Input
                  id="address"
                  autoComplete="street-address"
                  placeholder={t("events.addressPlaceholder")}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  data-testid="input-event-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t("events.cityRequired")}</Label>
                  <div className="relative">
                    <Input
                      id="city"
                      data-testid="input-event-city"
                      placeholder={t("events.cityPlaceholder")}
                      value={evtCityOpen ? evtCitySearch : city}
                      onChange={(e) => {
                        setEvtCitySearch(e.target.value);
                        if (!evtCityOpen) setEvtCityOpen(true);
                      }}
                      onFocus={() => {
                        setEvtCitySearch(city);
                        setEvtCityOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          if (evtCitySearch.trim() && !city) {
                            setCity(capitalizeWords(evtCitySearch.trim()));
                          }
                          setEvtCityOpen(false);
                        }, 200);
                      }}
                      autoComplete="off"
                      required
                    />
                    {evtCityOpen && filteredEvtCities.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {filteredEvtCities.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                              city === c ? "bg-accent/50 font-medium" : ""
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setCity(c);
                              setEvtCitySearch(c);
                              setEvtCityOpen(false);
                            }}
                          >
                            {city === c && <Check className="w-3.5 h-3.5 text-primary" />}
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">{t("events.countryRequired")}</Label>
                  <Select
                    value={country}
                    onValueChange={(val) => {
                      setCountry(val);
                      const newCities = locationsMap?.[val] || [];
                      if (city && !newCities.includes(city) && !(storedLoc?.country === val && storedLoc?.city === city)) {
                        setCity("");
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-event-country">
                      <SelectValue placeholder={t("events.countryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {evtCountryOptions.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">{t("events.startDateTime")}</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    data-testid="input-event-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">{t("events.endDateTime")}</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    data-testid="input-event-end"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("events.photos") || "Photos"}</Label>
                <div className="flex flex-wrap gap-3">
                  {photos.map((photo, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-event-photo-${i}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {photos.length < 10 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                      data-testid="button-add-event-photo"
                    >
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                      <span className="text-[10px]">{uploading ? "..." : "Add"}</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  data-testid="input-event-photos"
                />
                <p className="text-xs text-muted-foreground">{t("events.photosHint") || "Add up to 10 photos of your event setup"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="listingId">{t("events.linkToListing")}</Label>
                <Input
                  id="listingId"
                  type="number"
                  placeholder={t("events.listingIdPlaceholder")}
                  value={listingId}
                  onChange={(e) => setListingId(e.target.value)}
                  data-testid="input-event-listing-id"
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={createMutation.isPending}
                data-testid="button-create-event"
              >
                {createMutation.isPending && <ButtonLoader />}
                {t("events.createEvent")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
