import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertListingSchema, categories, conditions, conditionLabels, currencies, shippingCarriers, saleEventTypes, saleTypeLabels, isSaleEventType, type InsertListing } from "@shared/schema";
const logoSrc = "/yardees-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ImagePlus, X, Loader2, Store, Shield, Phone, Globe, Clock,
  Tag, ShoppingBag, Package, DollarSign, CalendarClock, Star,
  Coins, ArrowLeft, ChevronRight, ChevronLeft, MapPin, Mail,
  Users, Megaphone, Calendar, Eye, TrendingUp, Truck, Plus, Trash2, Tags
} from "lucide-react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

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

interface ListingFormProps {
  defaultValues?: Partial<InsertListing & { phone?: string; website?: string; hours?: string; id?: number }>;
  onSubmit: (data: InsertListing) => void;
  isPending: boolean;
  prefill?: { title?: string; description?: string };
}

const shippingMethods = ["Standard Shipping", "Express Shipping", "Priority Mail", "Economy Shipping", "Local Delivery", "International Shipping", "Other"] as const;

function ShippingManager({ listingId, t }: { listingId: number; t: any }) {
  const { toast } = useToast();
  const { data: shippingOptions, refetch } = useQuery<any[]>({
    queryKey: ["/api/listings", listingId, "shipping"],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${listingId}/shipping`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [adding, setAdding] = useState(false);
  const [newMethod, setNewMethod] = useState("Standard Shipping");
  const [newPrice, setNewPrice] = useState("");
  const [newDays, setNewDays] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newMethod) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: newMethod,
          price: isFree ? 0 : Math.round(parseFloat(newPrice || "0") * 100),
          estimatedDays: newDays || null,
          isFree,
        }),
      });
      if (!res.ok) throw new Error("Failed to add shipping option");
      refetch();
      setAdding(false);
      setNewMethod("Standard Shipping");
      setNewPrice("");
      setNewDays("");
      setIsFree(false);
      toast({ title: t("form.shippingAdded", "Shipping option added") });
    } catch {
      toast({ title: t("form.shippingAddFailed", "Failed to add shipping option"), variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <p className="font-semibold text-sm flex items-center gap-2">
        <Truck className="w-4 h-4 text-blue-500" /> {t("form.shippingOptions", "Shipping Options")} <span className="text-muted-foreground font-normal text-xs">({t("common.optional")})</span>
      </p>

      {shippingOptions && shippingOptions.length > 0 && (
        <div className="space-y-2">
          {shippingOptions.map((opt: any) => (
            <div key={opt.id} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2" data-testid={`shipping-item-${opt.id}`}>
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{opt.method}</span>
                {opt.estimatedDays && <span className="text-xs text-muted-foreground">({opt.estimatedDays})</span>}
              </div>
              <span className="font-semibold text-xs">
                {opt.isFree ? <span className="text-green-600">Free</span> : `$${(opt.price / 100).toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 bg-muted/30 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("form.shippingMethod", "Method")}</label>
              <Select value={newMethod} onValueChange={setNewMethod}>
                <SelectTrigger data-testid="select-shipping-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shippingMethods.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("form.estimatedDays", "Est. Delivery")}</label>
              <Input
                placeholder="e.g. 3-5 days"
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                data-testid="input-shipping-days"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={isFree} onCheckedChange={setIsFree} data-testid="switch-free-shipping" />
              <span>{t("form.freeShipping", "Free Shipping")}</span>
            </label>
            {!isFree && (
              <div className="space-y-1 flex-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price (e.g. 5.99)"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  data-testid="input-shipping-price"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd} disabled={saving} data-testid="button-add-shipping">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.add", "Add")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>{t("common.cancel", "Cancel")}</Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1" data-testid="button-add-shipping-option">
          <Plus className="w-3.5 h-3.5" /> {t("form.addShippingOption", "Add Shipping Option")}
        </Button>
      )}
    </div>
  );
}

const MAX_PHOTOS = 20;
const MIN_PHOTOS = 2;

const privacyOptions = [
  { value: "open", labelKey: "listing.public", descKey: "listing.publicDesc" },
  { value: "hidden", labelKey: "listing.onRequest", descKey: "listing.onRequestDesc" },
  { value: "verified", labelKey: "listing.verifiedOnly", descKey: "listing.verifiedOnlyDesc" },
];

type PhotoEntry = { url: string; uploading?: boolean };

function LocationFields({ form, t }: { form: any; t: any }) {
  const storedLoc = useMemo(() => getStoredLocation(), []);
  const { data: locationsMap } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/listings/locations"],
  });

  const watchedCountry = useWatch({ control: form.control, name: "country" });

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    if (locationsMap) Object.keys(locationsMap).forEach(c => set.add(c));
    if (storedLoc?.country) set.add(storedLoc.country);
    const current = form.getValues("country");
    if (current) set.add(current);
    return Array.from(set).sort();
  }, [locationsMap, storedLoc]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    if (watchedCountry && locationsMap?.[watchedCountry]) {
      locationsMap[watchedCountry].forEach(c => set.add(c));
    }
    if (storedLoc?.city && (!watchedCountry || watchedCountry === storedLoc.country)) {
      set.add(storedLoc.city);
    }
    const current = form.getValues("city");
    if (current) set.add(current);
    return Array.from(set).sort();
  }, [watchedCountry, locationsMap, storedLoc]);

  const [citySearch, setCitySearch] = useState("");
  const [cityOpen, setCityOpen] = useState(false);

  const filteredCities = useMemo(() => {
    if (!citySearch) return cityOptions;
    const q = citySearch.toLowerCase();
    return cityOptions.filter(c => c.toLowerCase().includes(q));
  }, [cityOptions, citySearch]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="country"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("form.country")}</FormLabel>
            <Select
              value={field.value || ""}
              onValueChange={(val) => {
                field.onChange(val);
                const currentCity = form.getValues("city");
                const newCities = locationsMap?.[val] || [];
                if (currentCity && !newCities.includes(currentCity) && !(storedLoc?.country === val && storedLoc?.city === currentCity)) {
                  form.setValue("city", "");
                }
              }}
            >
              <FormControl>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder={t("form.countryPlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {countryOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="city"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("form.city")}</FormLabel>
            <div className="relative">
              <Input
                data-testid="input-city"
                placeholder={t("form.cityPlaceholder")}
                value={cityOpen ? citySearch : (field.value || "")}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  if (!cityOpen) setCityOpen(true);
                }}
                onFocus={() => {
                  setCitySearch(field.value || "");
                  setCityOpen(true);
                }}
                onBlur={() => {
                  setTimeout(() => {
                    if (citySearch.trim() && !field.value) {
                      field.onChange(capitalizeWords(citySearch.trim()));
                    }
                    setCityOpen(false);
                  }, 200);
                }}
                autoComplete="off"
              />
              {cityOpen && filteredCities.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {filteredCities.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                        field.value === c ? "bg-accent/50 font-medium" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        field.onChange(c);
                        setCitySearch(c);
                        setCityOpen(false);
                      }}
                      data-testid={`option-city-${c}`}
                    >
                      {field.value === c && <Check className="w-3.5 h-3.5 text-primary" />}
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

type ListingTypeChoice = "individual" | "yard_sale" | "shop";

const typeCards: { key: ListingTypeChoice; labelKey: string; icon: typeof Tag; color: string; bgColor: string; borderColor: string; descKey: string; featureKeys: string[] }[] = [
  {
    key: "individual",
    labelKey: "form.singleItem",
    icon: Tag,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-500",
    descKey: "form.singleItemDesc",
    featureKeys: ["form.singleItemFeature1", "form.singleItemFeature2", "form.singleItemFeature3", "form.singleItemFeature4"],
  },
  {
    key: "yard_sale",
    labelKey: "form.saleEvent",
    icon: Tags,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-500",
    descKey: "form.saleEventDesc",
    featureKeys: ["form.yardSaleFeature1", "form.yardSaleFeature2", "form.yardSaleFeature3", "form.yardSaleFeature4"],
  },
  {
    key: "shop",
    labelKey: "form.storeShop",
    icon: Store,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-500",
    descKey: "form.storeShopDesc",
    featureKeys: ["form.storeShopFeature1", "form.storeShopFeature2", "form.storeShopFeature3", "form.storeShopFeature4"],
  },
];

function PriceSuggestion({ category, condition, onApply }: { category: string; condition?: string; onApply: (price: number) => void }) {
  const { t } = useTranslation();
  const { data } = useQuery<{ available: boolean; avg?: number; min?: number; max?: number; sampleSize?: number }>({
    queryKey: ["/api/price-suggestion", category, condition],
    queryFn: async () => {
      const params = new URLSearchParams({ category });
      if (condition) params.set("condition", condition);
      const res = await fetch(`/api/price-suggestion?${params}`);
      return res.json();
    },
    enabled: !!category && category !== "Other",
    staleTime: 60000,
  });

  if (!data?.available || !data.avg) return null;

  const avgDisplay = (data.avg / 100).toFixed(2);
  const minDisplay = (data.min! / 100).toFixed(2);
  const maxDisplay = (data.max! / 100).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="mt-1.5"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-xs">
        <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-muted-foreground">
          {t("form.priceSuggestion", { avg: avgDisplay, min: minDisplay, max: maxDisplay, count: data.sampleSize })}
        </span>
        <button
          type="button"
          onClick={() => onApply(data.avg! / 100)}
          className="ml-auto text-primary font-semibold hover:underline flex-shrink-0"
          data-testid="button-apply-suggested-price"
        >
          {t("form.applySuggestion", "Use ${{avg}}")}
        </button>
      </div>
    </motion.div>
  );
}

export function ListingForm({ defaultValues, onSubmit, isPending, prefill }: ListingFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isEditing = !!(defaultValues as any)?.id;

  const getInitialType = (): ListingTypeChoice | null => {
    if (!isEditing) return null;
    if (defaultValues?.isShop) return "shop";
    if (isSaleEventType((defaultValues as any)?.listingType)) return "yard_sale";
    return "individual";
  };

  const [selectedType, setSelectedType] = useState<ListingTypeChoice | null>(getInitialType());
  // Which kind of sale-event this listing is (yard / estate / garage / ...).
  // Defaults to "yard_sale" so the existing flow is unchanged for new sales.
  const [saleType, setSaleType] = useState<string>(
    isSaleEventType((defaultValues as any)?.listingType) ? (defaultValues as any).listingType : "yard_sale"
  );
  const [photos, setPhotos] = useState<PhotoEntry[]>(
    (defaultValues?.photos || []).map((url) => ({ url }))
  );
  const [videos, setVideos] = useState<string[]>((defaultValues as any)?.videos || []);
  const [videoUploading, setVideoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<InsertListing>({
    resolver: zodResolver(insertListingSchema),
    defaultValues: {
      title: defaultValues?.title || prefill?.title || "",
      description: defaultValues?.description || prefill?.description || "",
      price: defaultValues?.price ? defaultValues.price / 100 : 0,
      listingType: (defaultValues as any)?.listingType || "individual",
      category: defaultValues?.category || "Other",
      subCategories: (defaultValues as any)?.subCategories || [],
      address: defaultValues?.address || "",
      country: defaultValues?.country || (() => { try { return JSON.parse(localStorage.getItem("yardees_location") || "{}").country || ""; } catch { return ""; } })(),
      city: defaultValues?.city || (() => { try { return JSON.parse(localStorage.getItem("yardees_location") || "{}").city || ""; } catch { return ""; } })(),
      sellerContact: defaultValues?.sellerContact || "",
      photos: defaultValues?.photos || [],
      isShop: defaultValues?.isShop || false,
      privacyLevel: defaultValues?.privacyLevel || "hidden",
      isBoosted: defaultValues?.isBoosted || false,
      currency: defaultValues?.currency || "USD",
      phone: (defaultValues as any)?.phone || "",
      website: (defaultValues as any)?.website || "",
      hours: (defaultValues as any)?.hours || "",
      condition: (defaultValues as any)?.condition || undefined,
      isNegotiable: (defaultValues as any)?.isNegotiable || false,
      inPersonPrice: (defaultValues as any)?.inPersonPrice
        ? (defaultValues as any).inPersonPrice / 100
        : undefined,
      isBundle: (defaultValues as any)?.isBundle || false,
      bundleItems: (defaultValues as any)?.bundleItems || "",
      pickupAvailability: (defaultValues as any)?.pickupAvailability || "",
      saleStartDate: ((defaultValues as any)?.saleStartDate ? new Date((defaultValues as any).saleStartDate).toISOString().slice(0, 10) : undefined) as any,
      saleEndDate: ((defaultValues as any)?.saleEndDate ? new Date((defaultValues as any).saleEndDate).toISOString().slice(0, 10) : undefined) as any,
    },
  });

  const isNegotiable = useWatch({ control: form.control, name: "isNegotiable" });
  const isBundle = useWatch({ control: form.control, name: "isBundle" });
  const selectedSubCats: string[] = useWatch({ control: form.control, name: "subCategories" }) || [];
  const watchedCategory = useWatch({ control: form.control, name: "category" });
  const watchedCondition = useWatch({ control: form.control, name: "condition" as any });

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("photo", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).url;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const ready = photos.filter((p) => !p.uploading);
    if (ready.length + files.length > MAX_PHOTOS) {
      setPhotoError(t("form.maxPhotos", { max: MAX_PHOTOS }));
      return;
    }
    setPhotoError(null);
    const startIdx = photos.length;
    const placeholders: PhotoEntry[] = Array.from(files).map(() => ({ url: "", uploading: true }));
    setPhotos((prev) => [...prev, ...placeholders]);

    for (let i = 0; i < files.length; i++) {
      try {
        const url = await uploadFile(files[i]);
        setPhotos((prev) => { const u = [...prev]; u[startIdx + i] = { url, uploading: false }; return u; });
      } catch {
        toast({ title: t("dashboard.uploadFailed"), description: files[i].name, variant: "destructive" });
        setPhotos((prev) => { const u = [...prev]; u.splice(startIdx + i, 1); return u; });
      }
    }

    setPhotos((prev) => {
      const final = prev.filter((p) => !p.uploading);
      form.setValue("photos", final.map((p) => p.url));
      return final;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videos.length >= 3) {
      toast({ title: t("form.maxVideos", "Maximum 3 videos allowed"), variant: "destructive" });
      return;
    }
    setVideoUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const res = await fetch("/api/upload/video", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setVideos((prev) => [...prev, data.url]);
    } catch {
      toast({ title: t("dashboard.uploadFailed"), description: file.name, variant: "destructive" });
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const removeVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      form.setValue("photos", updated.map((p) => p.url));
      return updated;
    });
  };

  const movePhoto = (index: number, direction: "left" | "right") => {
    setPhotos((prev) => {
      const newPhotos = [...prev];
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newPhotos.length) return prev;
      [newPhotos[index], newPhotos[targetIndex]] = [newPhotos[targetIndex], newPhotos[index]];
      form.setValue("photos", newPhotos.filter(p => !p.uploading).map(p => p.url));
      return newPhotos;
    });
  };

  const toggleSubCategory = (cat: string) => {
    const current: string[] = form.getValues("subCategories") || [];
    const updated = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    form.setValue("subCategories", updated as any);
  };

  const handleSubmit = (data: InsertListing) => {
    const readyUrls = photos.filter((p) => !p.uploading && p.url).map((p) => p.url);
    if (readyUrls.length < MIN_PHOTOS) {
      setPhotoError(t("form.minPhotos", { min: MIN_PHOTOS }));
      return;
    }
    const processed: any = {
      ...data,
      price: Math.round(data.price * 100),
      photos: readyUrls,
      videos: videos.length > 0 ? videos : undefined,
    };
    if (data.inPersonPrice != null && String(data.inPersonPrice) !== "") {
      processed.inPersonPrice = Math.round((data.inPersonPrice as number) * 100);
    } else {
      processed.inPersonPrice = null;
    }
    if ((data as any).saleStartDate) {
      processed.saleStartDate = new Date((data as any).saleStartDate).toISOString();
    }
    if ((data as any).saleEndDate) {
      processed.saleEndDate = new Date((data as any).saleEndDate).toISOString();
    }
    onSubmit(processed);
  };

  const handleTypeSelect = (type: ListingTypeChoice) => {
    setSelectedType(type);
    if (type === "shop") {
      form.setValue("isShop", true);
      form.setValue("listingType", "individual");
    } else if (type === "yard_sale") {
      form.setValue("isShop", false);
      form.setValue("listingType", saleType as any);
    } else {
      form.setValue("isShop", false);
      form.setValue("listingType", "individual");
    }
  };

  // Switch which kind of sale-event this listing is (yard, estate, garage, ...).
  const handleSaleTypeChange = (value: string) => {
    setSaleType(value);
    form.setValue("listingType", value as any);
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    const target = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.style.opacity = "0.4";
    });
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    setDragIndex(null);
    setDragOverIndex(null);
    if (fromIndex === dropIndex || isNaN(fromIndex)) return;
    setPhotos((prev) => {
      const newPhotos = [...prev];
      const [moved] = newPhotos.splice(fromIndex, 1);
      newPhotos.splice(dropIndex, 0, moved);
      form.setValue("photos", newPhotos.filter(p => !p.uploading).map(p => p.url));
      return newPhotos;
    });
  }, [form]);

  const readyPhotoCount = photos.filter((p) => !p.uploading).length;

  if (!selectedType) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center mb-8">
          <h2 className="text-xl font-display font-bold text-foreground">{t("form.whatAreYouListing")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("form.chooseType")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {typeCards.map((tc) => {
            const Icon = tc.icon;
            return (
              <motion.button
                key={tc.key}
                type="button"
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                onClick={() => handleTypeSelect(tc.key)}
                data-testid={`button-type-${tc.key}`}
                className="text-left w-full"
              >
                <Card className={`p-6 h-full border-2 border-border hover:border-2 hover:${tc.borderColor} transition-all duration-200 cursor-pointer group`}>
                  <div className={`w-12 h-12 rounded-xl ${tc.bgColor} flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${tc.color}`} />
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground mb-1">{t(tc.labelKey)}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{t(tc.descKey)}</p>
                  <ul className="space-y-1.5">
                    {tc.featureKeys.map((fk) => (
                      <li key={fk} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ChevronRight className={`w-3 h-3 ${tc.color} flex-shrink-0`} />
                        {t(fk)}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-5 pt-4 border-t border-border/50 flex items-center justify-between`}>
                    <span className={`text-sm font-semibold ${tc.color}`}>{t("form.select")}</span>
                    <ChevronRight className={`w-4 h-4 ${tc.color} group-hover:translate-x-1 transition-transform`} />
                  </div>
                </Card>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    );
  }

  const activeType = typeCards.find((t) => t.key === selectedType)!;
  const ActiveIcon = activeType.icon;
  const isShopType = selectedType === "shop";
  const isYardSale = selectedType === "yard_sale";
  const isSingleItem = selectedType === "individual";

  const PhotoGrid = ({ contextLabel, contextHint }: { contextLabel?: string; contextHint?: string }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <FormLabel>
          {contextLabel || t("listing.photos")}
          <span className="text-muted-foreground font-normal ml-1">{t("form.photos")}</span>
        </FormLabel>
        <span className={`text-xs font-medium ${readyPhotoCount < MIN_PHOTOS ? "text-destructive" : "text-primary"}`}>
          {readyPhotoCount}/{MAX_PHOTOS}
        </span>
      </div>
      {contextHint && (
        <p className="text-xs text-muted-foreground mb-3">{contextHint}</p>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.url || `uploading-${index}`}
            draggable={!photo.uploading}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            className={`relative aspect-square rounded-lg overflow-hidden border bg-muted group transition-all duration-150 ${
              !photo.uploading ? "cursor-grab active:cursor-grabbing" : ""
            } ${
              dragOverIndex === index && dragIndex !== index
                ? "ring-2 ring-primary ring-offset-2 scale-105"
                : ""
            } ${
              dragIndex === index ? "opacity-40" : ""
            }`}
            data-testid={`photo-item-${index}`}
          >
            {photo.uploading ? (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : (
              <img
                src={photo.url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover pointer-events-none"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = logoSrc;
                  img.className = "w-full h-full object-contain pointer-events-none p-3 bg-primary/5";
                }}
              />
            )}
            {!photo.uploading && (
              <>
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full shadow-sm"
                  data-testid={`button-remove-photo-${index}`}
                >
                  <X className="w-3 h-3" />
                </button>
                {photos.length > 1 && (
                  <div className="absolute bottom-1 left-1 right-1 flex justify-between items-center invisible group-hover:visible sm:invisible sm:group-hover:visible md:visible">
                    <button
                      type="button"
                      onClick={() => movePhoto(index, "left")}
                      disabled={index === 0}
                      className="p-1.5 bg-black/60 text-white rounded-full disabled:opacity-20 shadow-sm"
                      data-testid={`button-move-left-${index}`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(index, "right")}
                      disabled={index === photos.length - 1}
                      className="p-1.5 bg-black/60 text-white rounded-full disabled:opacity-20 shadow-sm"
                      data-testid={`button-move-right-${index}`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
            {index === 0 && !photo.uploading && (
              <span className="absolute top-1 left-1 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-semibold shadow-sm">
                {t("form.coverPhoto")}
              </span>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center cursor-pointer transition-colors" data-testid="button-add-photo">
            <ImagePlus className="w-6 h-6 text-muted-foreground mb-1" />
            <span className="text-[10px] text-muted-foreground font-medium">{t("listing.addPhoto")}</span>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} multiple />
          </label>
        )}
      </div>
      {readyPhotoCount >= 2 && (
        <p className="text-xs text-muted-foreground mt-2">{t("form.dragToReorder")}. {t("listing.coverImage")}</p>
      )}
      {readyPhotoCount < MIN_PHOTOS && readyPhotoCount > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          {t("listing.addMorePhotos", { count: MIN_PHOTOS - readyPhotoCount })}
        </p>
      )}
      {readyPhotoCount === 0 && (
        <p className="text-xs text-muted-foreground mt-2">{t("listing.photosRequired")}</p>
      )}
      {photoError && <p className="text-sm text-destructive mt-2">{photoError}</p>}

      <div className="mt-4 pt-4 border-t border-border/30">
        <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          {t("form.videoClips", "Video Clips")}
          <span className="text-muted-foreground/50 font-normal">({t("common.optional")})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {videos.map((url, i) => (
            <div key={i} className="relative w-28 h-20 rounded-lg overflow-hidden bg-muted/30 border border-border/30">
              <video src={url} className="w-full h-full object-cover" muted />
              <button
                type="button"
                onClick={() => removeVideo(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-destructive"
                data-testid={`button-remove-video-${i}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {videos.length < 3 && (
            <label className="w-28 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center cursor-pointer transition-colors" data-testid="button-add-video">
              {videoUploading ? (
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              ) : (
                <>
                  <Eye className="w-5 h-5 text-muted-foreground mb-0.5" />
                  <span className="text-[9px] text-muted-foreground font-medium">{t("form.addVideo", "Add Video")}</span>
                </>
              )}
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            </label>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/40 mt-1.5">{t("form.videoHint", "Up to 3 short video clips (max 50MB each)")}</p>
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="form"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {!isEditing && (
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedType(null)}
              className="gap-1.5"
              data-testid="button-back-type"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("form.back")}
            </Button>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${activeType.bgColor} flex items-center justify-center`}>
                <ActiveIcon className={`w-4 h-4 ${activeType.color}`} />
              </div>
              <div>
                <p className="font-semibold text-sm">{t(activeType.labelKey)}</p>
                <p className="text-xs text-muted-foreground">{t(activeType.descKey)}</p>
              </div>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* ═══════════════════════════════════════════════════════════════
                SHOP FORM — "Set Up Your Storefront"
                Flow: Identity → Contact & Hours → Location → Gallery → What You Sell
            ═══════════════════════════════════════════════════════════════ */}
            {isShopType && (
              <>
                {/* Step 1: Your Shop Identity */}
                <Card className="p-6 border-2 border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-background space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                      <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-purple-700 dark:text-purple-300">{t("form.yourShopIdentity")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.yourShopIdentityDesc")}</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{t("form.shopNameLabel")}</FormLabel>
                        <FormControl>
                          <Input data-testid="input-title" autoComplete="organization" placeholder={t("form.shopNamePlaceholder")} className="text-lg font-medium h-12" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">{t("form.shopNameHeadlineDesc")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{t("form.aboutShop")}</FormLabel>
                        <FormControl>
                          <Textarea data-testid="input-description" placeholder={t("form.shopDescPlaceholder")} className="min-h-[130px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Card>

                {/* Step 2: Contact & Business Hours */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.contactBusinessHours")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.contactBusinessHoursDesc")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name={"phone" as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> {t("form.phoneNumber")}</FormLabel>
                        <FormControl><Input data-testid="input-shop-phone" autoComplete="tel" placeholder={t("form.phonePlaceholder")} {...field} /></FormControl>
                        <FormDescription className="text-xs">{t("form.customersCanCall")}</FormDescription>
                      </FormItem>
                    )} />

                    <FormField
                      control={form.control}
                      name="sellerContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5 text-sm"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> {t("form.emailAddress")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-contact" autoComplete="email" placeholder={t("form.shopEmailPlaceholder")} {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">{t("form.forInquiries")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField control={form.control} name={"website" as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-sm"><Globe className="w-3.5 h-3.5 text-muted-foreground" /> {t("form.websiteOptional")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span></FormLabel>
                      <FormControl><Input data-testid="input-shop-website" autoComplete="url" placeholder={t("form.websitePlaceholder")} {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name={"hours" as any} render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-sm"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> {t("form.businessHoursLabel")}</FormLabel>
                      <FormControl><Textarea data-testid="input-shop-hours" placeholder={t("form.businessHoursFullPlaceholder")} className="min-h-[90px] text-sm" {...field} /></FormControl>
                      <FormDescription className="text-xs">{t("form.businessHoursCustomersDesc")}</FormDescription>
                    </FormItem>
                  )} />
                </Card>

                {/* Step 3: Store Location */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.storeLocation")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.storeLocationDesc")}</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.streetAddress")}</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            data-testid="input-address"
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("form.shopAddressPlaceholder")}
                            onPlaceSelect={(details) => {
                              if (details.city) form.setValue("city", details.city);
                              if (details.country) form.setValue("country", details.country);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <LocationFields form={form} t={t} />
                  <FormField
                    control={form.control}
                    name="privacyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-muted-foreground" /> {t("form.addressVisibility")}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-privacy">
                              <SelectValue placeholder={t("form.whoCanSeeAddress")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {privacyOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex flex-col">
                                  <span>{t(opt.labelKey)}</span>
                                  <span className="text-xs text-muted-foreground">{t(opt.descKey)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Card>

                {/* Step 4: Shop Gallery */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.shopGallery")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.shopGalleryDesc")}</p>
                    </div>
                  </div>
                  <PhotoGrid
                    contextLabel={t("form.storefrontPhotos")}
                    contextHint={t("form.storefrontPhotosTip")}
                  />
                </Card>

                {/* Step 5: What You Sell */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.whatYouSell")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.whatYouSellDesc")}</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.primaryCategory")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder={t("form.whatDoesShopSell")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{t(`categories.${cat}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">{t("form.chooseCategoryDesc")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-muted-foreground" /> {t("form.currency")}
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue placeholder={t("form.selectCurrency")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {currencies.map((curr) => (
                                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.averagePricePoint")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-price" type="number" step="0.01" min="0" placeholder={t("form.pricePlaceholder")} {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">{t("form.enterZeroForVaries")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="isNegotiable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                        <div>
                          <FormLabel className="text-sm">{t("form.pricesNegotiable")}</FormLabel>
                          <FormDescription className="text-xs">{t("form.customersCanHaggle")}</FormDescription>
                        </div>
                        <FormControl>
                          <Switch data-testid="switch-negotiable" checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </Card>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                YARD SALE FORM — "Announce Your Sale"
                Flow: Sale Announcement → When & Where → What's Available → Photos → Pricing
            ═══════════════════════════════════════════════════════════════ */}
            {isYardSale && (
              <>
                {/* Step 0: Pick the kind of sale */}
                <Card className="p-6 border-2 border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/20 dark:to-background">
                  <FormItem>
                    <FormLabel className="text-sm font-semibold flex items-center gap-2">
                      <Tags className="w-4 h-4 text-orange-500" /> {t("form.saleTypeLabel")}
                    </FormLabel>
                    <Select value={saleType} onValueChange={handleSaleTypeChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-sale-type" className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {saleEventTypes.map((st) => (
                          <SelectItem key={st} value={st} data-testid={`option-sale-type-${st}`}>
                            {saleTypeLabels[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">{t("form.saleTypeDesc")}</FormDescription>
                  </FormItem>
                </Card>

                {/* Step 1: Announce Your Sale */}
                <Card className="p-6 border-2 border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/20 dark:to-background space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                      <Megaphone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg text-orange-700 dark:text-orange-300">{t("form.announceYourSale")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.announceYourSaleDesc")}</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{t("form.saleHeadline")}</FormLabel>
                        <FormControl>
                          <Input data-testid="input-title" placeholder={t("form.yardSaleHeadlinePlaceholder")} className="text-lg font-medium h-12" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">{t("form.makeItCatchy")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{t("form.saleDescription")}</FormLabel>
                        <FormControl>
                          <Textarea data-testid="input-description" placeholder={t("form.yardSaleDescPlaceholder")} className="min-h-[140px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Card>

                {/* Step 2: When & Where */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.whenWhere")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.whenWhereDesc")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={"saleStartDate" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm font-semibold">
                            <CalendarClock className="w-4 h-4 text-blue-500" /> {saleTypeLabels[saleType] || "Sale"} Start Date
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-sale-start-date"
                              className="text-sm"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">When does the sale begin?</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={"saleEndDate" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-sm font-semibold">
                            <CalendarClock className="w-4 h-4 text-orange-500" /> {saleTypeLabels[saleType] || "Sale"} End Date
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-sale-end-date"
                              className="text-sm"
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Listing auto-deactivates after this date.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={"pickupAvailability" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-sm font-semibold">
                          <CalendarClock className="w-4 h-4 text-blue-500" /> Additional Details (optional)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            data-testid="input-pickup-availability"
                            placeholder="e.g., Rain or shine! Early birds welcome from 7 AM. Multi-family sale."
                            className="min-h-[70px] text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Any extra info about the sale schedule or details.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" /> {t("form.saleAddress")}
                        </FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            data-testid="input-address"
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder={t("form.saleAddressPlaceholder")}
                            onPlaceSelect={(details) => {
                              if (details.city) form.setValue("city", details.city);
                              if (details.country) form.setValue("country", details.country);
                            }}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">{t("form.saleAddressDesc")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <LocationFields form={form} t={t} />

                  <FormField
                    control={form.control}
                    name="privacyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-muted-foreground" /> {t("form.addressVisibility")}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-privacy">
                              <SelectValue placeholder={t("form.whoCanSeeAddress")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {privacyOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex flex-col">
                                  <span>{t(opt.labelKey)}</span>
                                  <span className="text-xs text-muted-foreground">{t(opt.descKey)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sellerContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-muted-foreground" /> {t("form.contactInfo")} <span className="text-muted-foreground font-normal text-xs">({t("common.optional")})</span>
                        </FormLabel>
                        <FormControl>
                          <Input data-testid="input-contact" autoComplete="email" placeholder={t("form.contactPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Card>

                {/* Step 3: What's Available */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.whatsAvailable")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.whatsAvailableDesc")}</p>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="subCategories"
                    render={() => (
                      <FormItem>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {categories.map((cat) => (
                            <label
                              key={cat}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                                selectedSubCats.includes(cat)
                                  ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 font-medium"
                                  : "border-border hover:border-orange-300 dark:hover:border-orange-800"
                              }`}
                            >
                              <Checkbox
                                checked={selectedSubCats.includes(cat)}
                                onCheckedChange={() => toggleSubCategory(cat)}
                                data-testid={`checkbox-category-${cat}`}
                              />
                              {t(`categories.${cat}`)}
                            </label>
                          ))}
                        </div>
                        <FormDescription className="mt-2">
                          {selectedSubCats.length === 0
                            ? t("form.selectItemTypes")
                            : t("form.categoriesSelected", { count: selectedSubCats.length })}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Card>

                {/* Step 4: Sale Photos */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.salePhotos")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.salePhotosDesc")}</p>
                    </div>
                  </div>
                  <PhotoGrid
                    contextLabel={t("form.yardSalePhotos")}
                    contextHint={t("form.yardSalePhotosTip")}
                  />
                </Card>

                {/* Step 5: Pricing */}
                <Card className="p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-lg">{t("form.pricing")}</h3>
                      <p className="text-xs text-muted-foreground">{t("form.pricingDesc")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-muted-foreground" /> {t("form.currency")}
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue placeholder={t("form.selectCurrency")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {currencies.map((curr) => (
                                <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.startingPrice")}</FormLabel>
                          <FormControl>
                            <Input data-testid="input-price" type="number" step="0.01" min="0" placeholder={t("form.pricePlaceholder")} {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">{t("form.lowestPriceDesc")}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Card>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                INDIVIDUAL ITEM FORM — Standard item listing
            ═══════════════════════════════════════════════════════════════ */}
            {isSingleItem && (
              <>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.title")}</FormLabel>
                      <FormControl>
                        <Input data-testid="input-title" placeholder={t("form.itemTitlePlaceholder")} className="text-lg font-medium" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.description")}</FormLabel>
                      <FormControl>
                        <Textarea data-testid="input-description" placeholder={t("form.itemDescPlaceholder")} className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <PhotoGrid />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.category")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder={t("form.selectCategory")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{t(`categories.${cat}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-primary" /> {t("form.currency")}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-currency">
                              <SelectValue placeholder={t("form.selectCurrency")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((curr) => (
                              <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.price")}</FormLabel>
                        <FormControl>
                          <Input data-testid="input-price" type="number" step="0.01" min="0" placeholder={t("form.pricePlaceholder")} {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">{t("form.enterZeroFree")}</FormDescription>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={"condition" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-primary" /> {t("form.itemCondition")}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-condition">
                            <SelectValue placeholder={t("form.selectConditionOptional")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditions.map((c) => (
                            <SelectItem key={c} value={c}>{t(`conditions.${c}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/30">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" /> {t("form.pricingOptions")}
                  </p>
                  <FormField
                    control={form.control}
                    name="isNegotiable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div>
                          <FormLabel className="text-sm">{t("form.priceNegotiableOBO")}</FormLabel>
                          <FormDescription className="text-xs">{t("form.buyersCanMakeOffers")}</FormDescription>
                        </div>
                        <FormControl>
                          <Switch data-testid="switch-negotiable" checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"inPersonPrice" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm flex items-center gap-1">
                          {t("form.inPersonPrice")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-in-person-price"
                            type="number" step="0.01" min="0"
                            placeholder={t("form.inPersonPricePlaceholder")}
                            {...field}
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">{t("form.inPersonPriceDesc")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/30">
                  <FormField
                    control={form.control}
                    name={"isBundle" as any}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm flex items-center gap-2">
                            <Package className="w-4 h-4 text-purple-600" /> {t("form.bundleLot")}
                          </FormLabel>
                          <FormDescription className="text-xs">{t("form.bundleLotDesc")}</FormDescription>
                        </div>
                        <FormControl>
                          <Switch data-testid="switch-bundle" checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {isBundle && (
                    <FormField
                      control={form.control}
                      name={"bundleItems" as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">{t("form.whatsInBundle")}</FormLabel>
                          <FormControl>
                            <Textarea
                              data-testid="input-bundle-items"
                              placeholder={t("form.bundleItemsPlaceholder")}
                              className="min-h-[80px] text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <LocationFields form={form} t={t} />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.addressLocation")}</FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          data-testid="input-address"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder={t("form.addressPlaceholder")}
                          onPlaceSelect={(details) => {
                            if (details.city) form.setValue("city", details.city);
                            if (details.country) form.setValue("country", details.country);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="privacyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-primary" /> {t("listing.addressPrivacy")}
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-privacy">
                            <SelectValue placeholder={t("form.selectPrivacyLevel")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {privacyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex flex-col">
                                <span>{t(opt.labelKey)}</span>
                                <span className="text-xs text-muted-foreground">{t(opt.descKey)}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sellerContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.contactInfo")}</FormLabel>
                      <FormControl>
                        <Input data-testid="input-contact" autoComplete="email" placeholder={t("form.contactPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={"pickupAvailability" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-primary" /> {t("form.pickupAvailabilityLabel")} <span className="text-muted-foreground font-normal text-xs">({t("common.optional")})</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="input-pickup-availability"
                          placeholder={t("form.pickupSchedulePlaceholder")}
                          className="min-h-[80px] text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">{t("form.pickupAvailabilityDesc")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(defaultValues as any)?.id && (
                  <ShippingManager listingId={(defaultValues as any).id} t={t} />
                )}
              </>
            )}

            <div className="flex justify-end pt-6 border-t">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto min-w-[200px]"
                disabled={isPending || photos.some((p) => p.uploading)}
                data-testid="button-submit"
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("form.saving")}</>
                ) : (
                  isYardSale ? t("form.postYardSale") : isShopType ? t("form.createStorefront") : t("form.submitListing")
                )}
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </AnimatePresence>
  );
}
