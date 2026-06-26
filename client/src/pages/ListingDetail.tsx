import { useRoute } from "wouter";
import { useListing } from "@/hooks/use-listings";
import { isSaleEventType, saleTypeLabels } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SellerBadge } from "@/components/SellerBadge";
import { ContentAd } from "@/components/AdUnit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  Phone,
  Calendar,
  Share2,
  ArrowLeft,
  Eye,
  EyeOff,
  Store,
  Zap,
  Star,
  Shield,
  ShieldCheck,
  Globe,
  MessageSquare,
  HandshakeIcon,
  Clock,
  ExternalLink,
  CheckCircle,
  Pencil,
  Send,
  Users,
  CalendarCheck,
  Flag,
  Package,
  Truck,
  User,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  MessageCircle,
} from "lucide-react";
import { PageTransition } from "@/components/PageLoader";
import { format } from "date-fns";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { ListingCard } from "@/components/ListingCard";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Listing, conditionLabels, reportReasons, currencySymbols } from "@shared/schema";
import { useOGMeta } from "@/hooks/use-og-meta";
import { PhotoGallery } from "@/components/PhotoGallery";
const logoSrc = "/yardees-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";

export default function ListingDetail() {
  const { t } = useTranslation();
  const [match, params] = useRoute("/listing/:id");
  const id = parseInt(params?.id || "0");
  const { data: listing, isLoading, isError } = useListing(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAddress, setShowAddress] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [messageText, setMessageText] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestion, setSuggestion] = useState({ phone: "", website: "", hours: "", note: "" });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const inlineSwipeRef = useRef<number | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyPreview, setVerifyPreview] = useState<string | null>(null);
  const [verifyUploading, setVerifyUploading] = useState(false);

  const isOwner = user && listing && user.id === listing.userId;
  const isYardSale = isSaleEventType(listing?.listingType);
  const saleLabel = saleTypeLabels[(listing as any)?.listingType] || "Sale";

  const { data: linkedEvent } = useQuery<any>({
    queryKey: ["/api/listings", id, "event"],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${id}/event`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!listing && isYardSale,
  });

  const hasRsvped = linkedEvent?.rsvps?.some((r: any) => r.userId === user?.id) || false;

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${linkedEvent.id}/rsvp`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to RSVP");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "RSVP Confirmed", description: "You're on the list for this yard sale!" });
      qc.invalidateQueries({ queryKey: ["/api/listings", id, "event"] });
    },
    onError: (err: Error) => {
      toast({ title: "RSVP Failed", description: err.message, variant: "destructive" });
    },
  });

  const cancelRsvpMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/events/${linkedEvent.id}/rsvp`);
    },
    onSuccess: () => {
      toast({ title: "RSVP Cancelled", description: "You've been removed from the list." });
      qc.invalidateQueries({ queryKey: ["/api/listings", id, "event"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel RSVP", variant: "destructive" });
    },
  });

  const { data: listingVerification, refetch: refetchVerification } = useQuery<any>({
    queryKey: ["/api/verification/listing", id],
    queryFn: async () => {
      const res = await fetch(`/api/verification/listing/${id}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && !!listing && listing.privacyLevel === "verified" && !isOwner,
  });

  const { data: buyerVerificationStatus } = useQuery<any>({
    queryKey: ["/api/verification/status"],
    enabled: !!user && !!listing && listing.privacyLevel === "verified" && !isOwner,
  });

  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/verification/request-review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("verify.reviewRequestSent"), description: t("verify.reviewRequestSentDesc") });
      refetchVerification();
    },
    onError: (err: any) => {
      if (err.message?.includes("submit your ID first")) {
        toast({ title: t("verify.idRequired"), description: t("verify.submitIdFirst"), variant: "destructive" });
      } else {
        toast({ title: t("verify.requestFailed"), description: err.message, variant: "destructive" });
      }
    },
  });

  const { data: shippingOptions } = useQuery<any[]>({
    queryKey: ["/api/listings", id, "shipping"],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${id}/shipping`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!listing,
  });

  const { data: referralCode } = useQuery<{ code: string }>({
    queryKey: ["/api/referral/code"],
    enabled: !!user,
  });

  const getShareUrl = () => {
    const base = `${window.location.origin}/listing/${id}`;
    return referralCode?.code ? `${base}?ref=${referralCode.code}` : base;
  };

  const { data: suggestions } = useQuery<any[]>({
    queryKey: ["/api/listings", id, "suggestions"],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${id}/suggestions`);
      return res.json();
    },
    enabled: !!listing && !!isOwner,
  });

  const { data: sellerInfo } = useQuery<any>({
    queryKey: ["/api/users", listing?.userId, "verification"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${listing!.userId}/verification`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!listing,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/messages", {
        receiverId: listing!.userId,
        listingId: id,
        content: messageText,
      });
    },
    onSuccess: () => {
      toast({ title: t("listing.messageSent"), description: t("listing.sellerNotified") });
      setMessageText("");
      setMessageOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
      qc.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
    onError: () => {
      toast({ title: t("listing.failedToSend"), variant: "destructive" });
    },
  });

  const submitSuggestionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/listings/${id}/suggestions`, {
        listingId: id,
        ...suggestion,
      });
    },
    onSuccess: () => {
      toast({ title: t("listing.suggestionSubmitted"), description: t("listing.shopOwnerReview") });
      setSuggestion({ phone: "", website: "", hours: "", note: "" });
      setSuggestOpen(false);
    },
    onError: () => {
      toast({ title: t("listing.failedToSubmitSuggestion"), variant: "destructive" });
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async (sid: number) => {
      return apiRequest("POST", `/api/listings/${id}/suggestions/${sid}/apply`, {});
    },
    onSuccess: () => {
      toast({ title: t("listing.suggestionApplied") });
      qc.invalidateQueries({ queryKey: ["/api/listings", id, "suggestions"] });
      qc.invalidateQueries({ queryKey: [`/api/listings/${id}`] });
    },
    onError: () => {
      toast({ title: t("listing.failedToApplySuggestion"), variant: "destructive" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/listings/${id}/report`, {
        listingId: id,
        reason: reportReason,
        details: reportDetails || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: t("listing.reportSubmitted"), description: t("listing.reportThankYou") });
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
    },
    onError: () => {
      toast({ title: t("listing.failedToSubmitReport"), variant: "destructive" });
    },
  });

  const conditionMap: Record<string, string> = { new: "NewCondition", like_new: "UsedCondition", good: "UsedCondition", fair: "UsedCondition", poor: "UsedCondition" };
  const listingJsonLd = listing ? [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: listing.title,
      description: (listing.description || "").slice(0, 500),
      url: `${window.location.origin}/listing/${listing.id}`,
      image: listing.photos?.filter(Boolean).map((p: string) => p.startsWith("http") ? p : `${window.location.origin}${p}`),
      category: listing.category,
      brand: { "@type": "Brand", name: "YARDEES" },
      offers: {
        "@type": "Offer",
        price: (listing.price / 100).toFixed(2),
        priceCurrency: listing.currency || "USD",
        availability: (listing as any).isSold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        itemCondition: conditionMap[(listing as any).condition || ""] ? `https://schema.org/${conditionMap[(listing as any).condition]}` : undefined,
        seller: { "@type": "Organization", name: "YARDEES", url: window.location.origin },
        ...((listing.city || listing.country) ? {
          availableAtOrFrom: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: listing.city || undefined, addressCountry: listing.country || undefined } }
        } : {}),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: window.location.origin },
        ...(listing.category ? [{ "@type": "ListItem", position: 2, name: listing.category, item: `${window.location.origin}/category/${encodeURIComponent(listing.category)}` }] : []),
        { "@type": "ListItem", position: listing.category ? 3 : 2, name: listing.title, item: `${window.location.origin}/listing/${listing.id}` },
      ],
    },
  ] : undefined;

  const listingPrice = listing ? new Intl.NumberFormat("en-US", { style: "currency", currency: listing.currency || "USD" }).format(listing.price / 100) : "";
  const listingLocation = listing ? [listing.city, listing.country].filter(Boolean).join(", ") : "";
  useOGMeta({
    title: listing ? `${listing.title} — ${listingPrice}${listingLocation ? ` in ${listingLocation}` : ""}` : "Listing",
    description: listing ? `${listingPrice} — ${listing.title}${listingLocation ? ` in ${listingLocation}` : ""}. ${(listing.description || "").slice(0, 120)}. Buy second-hand on YARDEES.` : "",
    image: listing?.photos?.[0] ? (listing.photos[0].startsWith("http") ? listing.photos[0] : `${window.location.origin}${listing.photos[0]}`) : undefined,
    url: `${window.location.origin}/listing/${id}`,
    jsonLd: listingJsonLd,
  });

  if (isLoading) return <ListingSkeleton />;
  if (isError || !listing) return <NotFoundState />;

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency || "USD",
  }).format(listing.price / 100);

  const inPersonPrice = (listing as any).inPersonPrice;
  const formattedInPersonPrice = inPersonPrice
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: listing.currency || "USD" }).format(inPersonPrice / 100)
    : null;

  const privacyMessage = () => {
    if (listing.privacyLevel === "open") return null;
    if (!user) return t("listing.logInToViewAddress");
    if (listing.privacyLevel === "hidden" || listing.privacyLevel === "request") return t("listing.messageForAddress");
    if (listing.privacyLevel === "verified") return t("listing.verifiedBuyersOnly");
    return null;
  };

  return (
    <>
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />

      <PageTransition>
      <main className="container mx-auto px-4 py-8 flex-grow">
        <Link href="/">
          <Button variant="ghost" className="mb-6 pl-0 hover:pl-2 transition-all text-muted-foreground" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("listing.backToListings")}
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <motion.div
              layoutId={`image-${listing.id}`}
              className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-muted border border-border shadow-sm"
            >
              {listing.photos && listing.photos.length > 0 ? (
                <div
                  className="relative w-full h-full cursor-pointer group"
                  style={{ touchAction: "pan-y" }}
                  onClick={() => setLightboxOpen(true)}
                  onTouchStart={(e) => {
                    if (e.touches.length === 1) {
                      inlineSwipeRef.current = e.touches[0].clientX;
                    }
                  }}
                  onTouchEnd={(e) => {
                    const startX = inlineSwipeRef.current;
                    if (startX == null) return;
                    const diff = e.changedTouches[0].clientX - startX;
                    inlineSwipeRef.current = null;
                    if (Math.abs(diff) > 50 && listing.photos!.length > 1) {
                      e.preventDefault();
                      setActivePhoto((prev) => diff > 0
                        ? (prev > 0 ? prev - 1 : listing.photos!.length - 1)
                        : (prev < listing.photos!.length - 1 ? prev + 1 : 0)
                      );
                    }
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activePhoto}
                      src={listing.photos[activePhoto]}
                      alt={listing.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.onerror = null;
                        img.src = logoSrc;
                        img.className = "w-full h-full object-contain p-12 bg-primary/5";
                      }}
                    />
                  </AnimatePresence>
                  {listing.photos.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActivePhoto(activePhoto > 0 ? activePhoto - 1 : listing.photos!.length - 1); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid="button-photo-prev"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActivePhoto(activePhoto < listing.photos!.length - 1 ? activePhoto + 1 : 0); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid="button-photo-next"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {listing.photos.map((_: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setActivePhoto(idx); }}
                            className={`w-2 h-2 rounded-full transition-all ${
                              activePhoto === idx ? "bg-white scale-125" : "bg-white/50 hover:bg-white/70"
                            }`}
                            data-testid={`button-dot-${idx}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  <div className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity" data-testid="button-expand-photo">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/5">
                  <img src={logoSrc} alt="Yardees" className="h-24 w-auto opacity-40" />
                </div>
              )}
            </motion.div>

            {listing.photos && listing.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-x-visible sm:pb-0">
                {listing.photos.map((photo: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhoto(idx)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 w-16 sm:w-auto ${
                      activePhoto === idx ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    data-testid={`button-photo-${idx}`}
                  >
                    <img
                      src={photo}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = logoSrc;
                        img.className = "w-full h-full object-contain p-2 bg-primary/5";
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            {(listing as any).videos?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{t("listing.videoClips", "Video Clips")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(listing as any).videos.map((videoUrl: string, idx: number) => (
                    <video
                      key={idx}
                      src={videoUrl}
                      controls
                      preload="metadata"
                      className="w-full rounded-xl border border-border/30 bg-black"
                      data-testid={`video-player-${idx}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Badge variant="secondary" className="px-3 py-1 text-sm bg-primary/10 text-primary border-primary/20">
                  {listing.category}
                </Badge>
                {listing.isShop && (
                  <Badge className="bg-green-600 text-white px-3 py-1">
                    <Store className="w-3 h-3 mr-1" /> {t("listing.thriftShop")}
                  </Badge>
                )}
                {listing.isBoosted && (() => {
                  const bt = (listing as any).boostType;
                  if (bt === "spotlight") {
                    return (
                      <Badge className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 shadow-md shadow-amber-400/30 px-3 py-1 font-bold" data-testid="badge-boost-tier">
                        <Zap className="w-3 h-3 mr-1" /> {t("listing.spotlight")}
                      </Badge>
                    );
                  }
                  if (bt === "featured") {
                    return (
                      <Badge className="bg-amber-500 text-white px-3 py-1 font-bold" data-testid="badge-boost-tier">
                        <Star className="w-3 h-3 mr-1" /> {t("listing.featured")}
                      </Badge>
                    );
                  }
                  return (
                    <Badge className="bg-blue-500 text-white px-3 py-1" data-testid="badge-boost-tier">
                      <Zap className="w-3 h-3 mr-1" /> {t("listing.boosted")}
                    </Badge>
                  );
                })()}
                {listing.listingType === "individual" && (listing as any).condition && (
                  <Badge variant="outline" className="px-3 py-1">
                    <Star className="w-3 h-3 mr-1" /> {conditionLabels[(listing as any).condition] || (listing as any).condition}
                  </Badge>
                )}
                {(listing as any).isBundle && (
                  <Badge className="bg-purple-600 text-white px-3 py-1">
                    <Package className="w-3 h-3 mr-1" /> {t("listing.bundle")}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {t("listing.posted", { date: format(new Date(listing.createdAt || new Date()), "MMM d, yyyy") })}
                </span>
              </div>

              <h1 className="text-2xl md:text-4xl font-display font-bold gradient-text mb-4 break-words" data-testid="text-listing-title">
                {listing.title}
              </h1>

              <div className="flex flex-wrap items-baseline gap-3 mb-4">
                <div className="flex flex-col">
                  {isYardSale && (
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
                      {t("listing.startingFrom")}
                    </span>
                  )}
                  <span className="text-3xl font-bold text-accent" data-testid="text-listing-price">
                    {listing.price === 0 ? t("common.free") : formattedPrice}
                  </span>
                </div>
                {(listing as any).isNegotiable && (
                  <Badge variant="outline" className="gap-1 text-sm font-medium">
                    <DollarSign className="w-3.5 h-3.5" /> {t("listing.priceNegotiable")}
                  </Badge>
                )}
                {formattedInPersonPrice && formattedInPersonPrice !== formattedPrice && (
                  <span className="text-sm text-muted-foreground">
                    {t("common.or")} <span className="font-semibold text-foreground">{formattedInPersonPrice}</span> {t("listing.inPerson")}
                  </span>
                )}
              </div>

              {(listing.city || listing.country) && (
                <div className="flex items-center gap-2 text-muted-foreground mb-6">
                  <Globe className="w-4 h-4" />
                  <span>{[listing.city, listing.country].filter(Boolean).join(", ")}</span>
                </div>
              )}

              {isYardSale && ((listing as any).saleStartDate || (listing as any).saleEndDate) && (
                <div className="mb-4 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40">
                  <p className="font-semibold text-sm flex items-center gap-2 text-orange-800 dark:text-orange-300 mb-2">
                    <Calendar className="w-4 h-4" /> {saleLabel} Dates
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {(listing as any).saleStartDate && (
                      <div>
                        <span className="text-muted-foreground">Starts: </span>
                        <span className="font-medium text-foreground">{new Date((listing as any).saleStartDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      </div>
                    )}
                    {(listing as any).saleEndDate && (
                      <div>
                        <span className="text-muted-foreground">Ends: </span>
                        <span className="font-medium text-foreground">{new Date((listing as any).saleEndDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      </div>
                    )}
                  </div>

                  {linkedEvent && (
                    <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-800/40">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-300">
                          <Users className="w-4 h-4" />
                          <span className="font-medium">{linkedEvent.rsvpCount || 0} {(linkedEvent.rsvpCount || 0) === 1 ? "person" : "people"} attending</span>
                        </div>
                        {!isOwner && (
                          <div>
                            {!user ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                                onClick={() => { window.location.href = "/api/login"; }}
                                data-testid="button-rsvp-login"
                              >
                                <CalendarCheck className="w-3.5 h-3.5" /> Sign in to RSVP
                              </Button>
                            ) : hasRsvped ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700 gap-1">
                                  <CheckCircle className="w-3 h-3" /> You're attending
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                                  onClick={() => cancelRsvpMutation.mutate()}
                                  disabled={cancelRsvpMutation.isPending}
                                  data-testid="button-cancel-rsvp"
                                >
                                  {cancelRsvpMutation.isPending ? "Cancelling..." : "Cancel"}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                                onClick={() => rsvpMutation.mutate()}
                                disabled={rsvpMutation.isPending}
                                data-testid="button-rsvp-yard-sale"
                              >
                                <CalendarCheck className="w-3.5 h-3.5" />
                                {rsvpMutation.isPending ? "Confirming..." : `RSVP to this ${saleLabel}`}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isYardSale && linkedEvent && !((listing as any).saleStartDate || (listing as any).saleEndDate) && (
                <div className="mb-4 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-300">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{linkedEvent.rsvpCount || 0} {(linkedEvent.rsvpCount || 0) === 1 ? "person" : "people"} interested</span>
                    </div>
                    {!isOwner && (
                      <div>
                        {!user ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                            onClick={() => { window.location.href = "/api/login"; }}
                            data-testid="button-rsvp-login-alt"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" /> Sign in to RSVP
                          </Button>
                        ) : hasRsvped ? (
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700 gap-1">
                              <CheckCircle className="w-3 h-3" /> You're attending
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                              onClick={() => cancelRsvpMutation.mutate()}
                              disabled={cancelRsvpMutation.isPending}
                              data-testid="button-cancel-rsvp-alt"
                            >
                              {cancelRsvpMutation.isPending ? "Cancelling..." : "Cancel"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={() => rsvpMutation.mutate()}
                            disabled={rsvpMutation.isPending}
                            data-testid="button-rsvp-yard-sale-alt"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            {rsvpMutation.isPending ? "Confirming..." : "RSVP to this Yard Sale"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="prose prose-stone dark:prose-invert max-w-none text-muted-foreground">
                <p className="whitespace-pre-line">{listing.description}</p>
              </div>

              {(listing as any).isBundle && (listing as any).bundleItems && (
                <div className="mt-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40">
                  <p className="font-semibold text-sm flex items-center gap-2 text-purple-800 dark:text-purple-300 mb-2">
                    <Package className="w-4 h-4" /> {t("listing.bundleContents")}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-line">{(listing as any).bundleItems}</p>
                </div>
              )}

              {(listing as any).pickupAvailability && (
                <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="font-semibold text-sm flex items-center gap-2 text-primary mb-2">
                    <Clock className="w-4 h-4" /> {t("listing.pickupAvailability")}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-line">{(listing as any).pickupAvailability}</p>
                </div>
              )}

              {shippingOptions && shippingOptions.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30" data-testid="section-shipping-options">
                  <p className="font-semibold text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-3">
                    <Truck className="w-4 h-4" /> {t("listing.shippingOptions", "Shipping Options")}
                  </p>
                  <div className="space-y-2">
                    {shippingOptions.map((opt: any, idx: number) => (
                      <div key={opt.id || idx} className="flex items-center justify-between text-sm" data-testid={`shipping-option-${idx}`}>
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{opt.method}</span>
                          {opt.estimatedDays && (
                            <span className="text-xs text-muted-foreground">({opt.estimatedDays})</span>
                          )}
                        </div>
                        <span className="font-semibold">
                          {opt.isFree ? (
                            <span className="text-green-600 dark:text-green-400">{t("listing.freeShipping", "Free")}</span>
                          ) : (
                            `$${(opt.price / 100).toFixed(2)}`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Link href={`/seller/${listing.userId}`}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer" data-testid="link-seller-profile">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {sellerInfo?.profileImageUrl ? (
                        <img
                          src={sellerInfo.profileImageUrl}
                          alt={t("listing.seller")}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = logoSrc;
                            img.className = "w-full h-full object-contain p-1 bg-primary/5";
                          }}
                        />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">
                          {sellerInfo?.displayName || sellerInfo?.firstName || t("listing.seller")}
                        </span>
                        {sellerInfo && sellerInfo.level !== "unverified" && (
                          <SellerBadge level={sellerInfo.level} size={16} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t("listing.viewSellerListings")}</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {listing.isShop && (
              <Card className="p-6 bg-card/50 border-border shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Store className="w-5 h-5 text-primary" />
                    {t("listing.shopInfo")}
                  </h3>
                  {user && !isOwner && (
                    <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-suggest-edit">
                          <Pencil className="w-3.5 h-3.5" /> {t("listing.suggestEdit")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("listing.suggestShopUpdate")}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <p className="text-sm text-muted-foreground">{t("listing.suggestHelpText")}</p>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium flex items-center gap-1 mb-1.5"><Phone className="w-3 h-3" /> {t("listing.phone")}</label>
                              <Input placeholder="+1 (555) 000-0000" autoComplete="tel" value={suggestion.phone} onChange={(e) => setSuggestion((s) => ({ ...s, phone: e.target.value }))} data-testid="input-suggest-phone" />
                            </div>
                            <div>
                              <label className="text-sm font-medium flex items-center gap-1 mb-1.5"><Globe className="w-3 h-3" /> {t("listing.website")}</label>
                              <Input placeholder="https://..." autoComplete="url" value={suggestion.website} onChange={(e) => setSuggestion((s) => ({ ...s, website: e.target.value }))} data-testid="input-suggest-website" />
                            </div>
                            <div>
                              <label className="text-sm font-medium flex items-center gap-1 mb-1.5"><Clock className="w-3 h-3" /> {t("listing.hours")}</label>
                              <Textarea placeholder={"Mon–Fri: 9am–6pm\nSat: 10am–4pm"} value={suggestion.hours} onChange={(e) => setSuggestion((s) => ({ ...s, hours: e.target.value }))} className="min-h-[80px]" data-testid="input-suggest-hours" />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-1.5 block">{t("listing.noteToOwner")}</label>
                              <Textarea placeholder="..." value={suggestion.note} onChange={(e) => setSuggestion((s) => ({ ...s, note: e.target.value }))} className="min-h-[60px]" data-testid="input-suggest-note" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setSuggestOpen(false)}>{t("common.cancel")}</Button>
                            <Button onClick={() => submitSuggestionMutation.mutate()} disabled={submitSuggestionMutation.isPending} data-testid="button-submit-suggestion">
                              {t("listing.submitSuggestion")}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                <div className="space-y-3">
                  {(listing as any).phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                      <a href={`tel:${(listing as any).phone}`} className="hover:text-primary transition-colors" data-testid="text-shop-phone">
                        {(listing as any).phone}
                      </a>
                    </div>
                  )}
                  {(listing as any).website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                      <a href={(listing as any).website} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1" data-testid="text-shop-website">
                        {(listing as any).website} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {(listing as any).hours && (
                    <div className="flex items-start gap-3 text-sm">
                      <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <pre className="whitespace-pre-wrap font-sans text-foreground" data-testid="text-shop-hours">{(listing as any).hours}</pre>
                    </div>
                  )}
                  {!(listing as any).phone && !(listing as any).website && !(listing as any).hours && (
                    <p className="text-sm text-muted-foreground italic">{t("listing.noShopDetails")}</p>
                  )}
                </div>

                {isOwner && suggestions && suggestions.filter((s) => s.status === "pending").length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-sm font-semibold mb-3">{t("listing.pendingSuggestions")}</p>
                    <div className="space-y-3">
                      {suggestions.filter((s) => s.status === "pending").map((s) => (
                        <div key={s.id} className="rounded-lg bg-muted/50 border border-border p-3 text-sm space-y-1">
                          {s.phone && <p><span className="text-muted-foreground">{t("listing.phone")}:</span> {s.phone}</p>}
                          {s.website && <p><span className="text-muted-foreground">{t("listing.website")}:</span> {s.website}</p>}
                          {s.hours && <p><span className="text-muted-foreground">{t("listing.hours")}:</span> {s.hours}</p>}
                          {s.note && <p className="text-muted-foreground italic">"{s.note}"</p>}
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 gap-1.5"
                            onClick={() => applySuggestionMutation.mutate(s.id)}
                            disabled={applySuggestionMutation.isPending}
                            data-testid={`button-apply-suggestion-${s.id}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-green-600" /> {t("listing.apply")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            <Card className="p-6 bg-card/50 backdrop-blur-sm border-border shadow-md">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                {t("listing.locationContact")}
              </h3>

              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-grow">
                      <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> {t("listing.address")}
                        <span className="text-xs ml-1 opacity-60">
                          ({listing.privacyLevel === "open" ? t("listing.public") : listing.privacyLevel === "verified" ? t("listing.verifiedOnly") : t("listing.onRequest")})
                        </span>
                      </p>
                      {listing.privacyLevel === "open" ? (
                        <p className="font-medium text-foreground text-lg">{listing.address}</p>
                      ) : (listing.privacyLevel === "hidden" || listing.privacyLevel === "request") && user ? (
                        <AnimatePresence mode="wait">
                          {showAddress ? (
                            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="font-medium text-foreground text-lg">
                              {listing.address}
                            </motion.p>
                          ) : (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground italic text-sm">
                              {t("listing.addressHiddenTap")}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      ) : listing.privacyLevel === "verified" && user && !isOwner ? (
                        <div className="space-y-2">
                          {listingVerification?.status === "approved" ? (
                            <p className="font-medium text-foreground text-lg">{listing.address}</p>
                          ) : buyerVerificationStatus?.isGloballyVerified ? (
                            <div className="flex flex-col gap-2">
                              {listingVerification?.status === "pending" ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  {t("verify.reviewAlreadyRequested")}
                                </p>
                              ) : (
                                <>
                                  <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Your ID is verified. Request access to view this address.
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-fit gap-1.5 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                                    onClick={() => requestReviewMutation.mutate()}
                                    disabled={requestReviewMutation.isPending}
                                    data-testid="button-request-id-review"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    {requestReviewMutation.isPending ? t("verify.requesting") : t("verify.requestIdReview")}
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : buyerVerificationStatus?.request?.status === "pending" ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-muted-foreground italic text-sm flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                {t("verify.idPendingReview")}
                              </p>
                              {listingVerification?.status === "pending" ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  {t("verify.reviewAlreadyRequested")}
                                </p>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-fit gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  onClick={() => requestReviewMutation.mutate()}
                                  disabled={requestReviewMutation.isPending}
                                  data-testid="button-request-id-review"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  {requestReviewMutation.isPending ? t("verify.requesting") : t("verify.requestIdReview")}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <p className="text-muted-foreground italic text-sm">{t("listing.verifiedBuyersOnly")}</p>
                              <Link href="/verify">
                                <Button variant="outline" size="sm" className="w-fit gap-1.5" data-testid="button-verify-id">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  {t("verify.verifyYourId")}
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">{privacyMessage()}</p>
                      )}
                    </div>

                    {(listing.privacyLevel === "hidden" || listing.privacyLevel === "request") && user ? (
                      <Button variant="outline" size="sm" onClick={() => setShowAddress(!showAddress)} className="flex-shrink-0" data-testid="button-toggle-address">
                        {showAddress ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">{showAddress ? t("listing.hide") : t("listing.reveal")}</span>
                      </Button>
                    ) : listing.privacyLevel !== "open" && !user ? (
                      <a href="/api/login">
                        <Button size="sm" variant="secondary" data-testid="button-login-to-view">{t("listing.logInToView")}</Button>
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t("listing.sellerContact")}</p>
                    <p className="font-medium" data-testid="text-seller-contact">{listing.sellerContact}</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex gap-4">
              {!isOwner && user ? (
                <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 h-12 text-lg shadow-lg shadow-primary/20 gap-2" size="lg" data-testid="button-contact-seller">
                      <MessageSquare className="w-5 h-5" />
                      {t("listing.messagesSeller")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("listing.messageTheSeller")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">
                        {t("listing.sendMessageAbout")} <span className="font-medium text-foreground">"{listing.title}"</span>
                      </p>
                      <Textarea
                        placeholder={t("listing.interestedMessage")}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className="min-h-[100px]"
                        data-testid="input-message-seller"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setMessageOpen(false)}>{t("common.cancel")}</Button>
                        <Button onClick={() => sendMessageMutation.mutate()} disabled={!messageText.trim() || sendMessageMutation.isPending} data-testid="button-send-message-seller">
                          <Send className="w-4 h-4 mr-2" />
                          {t("listing.sendMessage")}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : !user ? (
                <a href="/api/login" className="flex-1">
                  <Button className="w-full h-12 text-lg shadow-lg shadow-primary/20 gap-2" size="lg" data-testid="button-contact-seller">
                    <MessageSquare className="w-5 h-5" />
                    {t("listing.logInToMessage")}
                  </Button>
                </a>
              ) : (
                <div className="flex-1" />
              )}
              {user && !isOwner && (
                <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive" data-testid="button-report-listing">
                      <Flag className="w-4 h-4" />
                      <span className="hidden sm:inline">{t("common.report")}</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-destructive" /> {t("listing.reportListing")}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm text-muted-foreground">{t("listing.reportReviewMessage")}</p>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("listing.reason")}</label>
                        <Select value={reportReason} onValueChange={setReportReason}>
                          <SelectTrigger data-testid="select-report-reason">
                            <SelectValue placeholder={t("listing.selectReason")} />
                          </SelectTrigger>
                          <SelectContent>
                            {reportReasons.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">{t("listing.additionalDetails")} <span className="text-muted-foreground font-normal">({t("common.optional")})</span></label>
                        <Textarea
                          placeholder={t("listing.describeIssue")}
                          value={reportDetails}
                          onChange={e => setReportDetails(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="input-report-details"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setReportOpen(false)}>{t("common.cancel")}</Button>
                        <Button
                          variant="destructive"
                          onClick={() => reportMutation.mutate()}
                          disabled={!reportReason || reportMutation.isPending}
                          data-testid="button-submit-report"
                        >
                          <Flag className="w-4 h-4 mr-2" /> {t("listing.submitReport")}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 w-12 p-0"
                  data-testid="button-share"
                  onClick={async () => {
                    const url = getShareUrl();
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: listing.title, text: listing.description, url });
                      } catch {}
                    } else {
                      await navigator.clipboard.writeText(url);
                      toast({ title: t("listing.linkCopied") });
                    }
                  }}
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${listing.title} — ${getShareUrl()}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-12 h-12 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-whatsapp"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(listing.title)}&url=${encodeURIComponent(getShareUrl())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-12 h-12 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-twitter"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-foreground"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-12 h-12 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-facebook"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-600"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {listing.listingType === "individual" && !isOwner && user && (
          <MakeOfferSection listing={listing} />
        )}

        <SellerReviews sellerId={listing.userId} />
        <ContentAd />
        <SimilarListings id={id} />
      </main>
      </PageTransition>
    </div>

      {lightboxOpen && listing?.photos && listing.photos.length > 0 && (
        <PhotoGallery
          photos={listing.photos}
          activeIndex={activePhoto}
          onClose={() => setLightboxOpen(false)}
          onChangeIndex={setActivePhoto}
        />
      )}
    </>
  );
}

function SimilarListings({ id }: { id: number }) {
  const { t } = useTranslation();
  const { data: similarListings, isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings", id, "similar"],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${id}/similar`);
      if (!res.ok) throw new Error(t("listing.failedToFetch"));
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="mt-16 pt-8 border-t border-border">
        <h2 className="text-2xl font-display font-bold gradient-text mb-6">{t("listing.youMightAlsoLike")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!similarListings || similarListings.length === 0) return null;

  return (
    <div className="mt-16 pt-8 border-t border-border">
      <h2 className="text-2xl font-display font-bold gradient-text mb-6">{t("listing.youMightAlsoLike")}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-6">
        {similarListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}

function MakeOfferSection({ listing }: { listing: any }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [showOffer, setShowOffer] = useState(false);

  const symbol = currencySymbols[listing.currency] || "$";

  const offerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/offers", {
        listingId: listing.id,
        sellerId: listing.userId,
        amount: Math.round(parseFloat(offerAmount) * 100),
        currency: listing.currency,
        message: offerMessage || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
      toast({ title: t("listing.offerSent"), description: t("listing.sellerNotified") });
      setShowOffer(false);
      setOfferAmount("");
      setOfferMessage("");
    },
    onError: () => {
      toast({ variant: "destructive", title: t("common.error"), description: t("listing.failedToSendOffer") });
    },
  });

  return (
    <div className="mt-8 pt-6 border-t" data-testid="make-offer-section">
      <Dialog open={showOffer} onOpenChange={setShowOffer}>
        <DialogTrigger asChild>
          <Button size="lg" variant="outline" className="gap-2" data-testid="button-make-offer">
            <HandshakeIcon className="w-5 h-5" /> {t("listing.makeOffer")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("listing.makeOffer")} "{listing.title}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">{t("listing.yourOffer")} ({symbol})</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={t("listing.enterAmount")}
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                data-testid="input-offer-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("listing.messageOptional")}</label>
              <Textarea
                placeholder={t("listing.addMessage")}
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                data-testid="input-offer-message"
              />
            </div>
            <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-3 flex gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>Your payment will be held in secure escrow until you confirm delivery. If something goes wrong, you can file a dispute and funds stay protected.</span>
            </div>
            <Button
              onClick={() => offerMutation.mutate()}
              disabled={!offerAmount || offerMutation.isPending}
              className="w-full"
              data-testid="button-submit-offer"
            >
              {offerMutation.isPending ? t("listing.sending") : `${t("listing.sendOffer")} ${symbol}${offerAmount}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SellerReviews({ sellerId }: { sellerId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const isSeller = user?.id === sellerId;

  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/reviews", sellerId],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${sellerId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: summary } = useQuery<{ avg: number; count: number }>({
    queryKey: ["/api/reviews", sellerId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${sellerId}/summary`);
      if (!res.ok) return { avg: 0, count: 0 };
      return res.json();
    },
  });

  const { data: canReviewData } = useQuery<{ canReview: boolean; reason?: string }>({
    queryKey: ["/api/reviews", sellerId, "can-review"],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${sellerId}/can-review`, { credentials: "include" });
      if (!res.ok) return { canReview: false, reason: "error" };
      return res.json();
    },
    enabled: !!user && user.id !== sellerId,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reviews", {
        sellerId,
        rating,
        comment: comment || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", sellerId, "can-review"] });
      toast({ title: t("listing.reviewSubmitted") });
      setRating(0);
      setComment("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: t("common.error"), description: err.message || t("listing.failedToSend") });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (reviewId: number) => {
      const res = await apiRequest("PATCH", `/api/reviews/${reviewId}/reply`, {
        reply: replyText,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", sellerId] });
      toast({ title: t("listing.replyPosted") });
      setReplyingTo(null);
      setReplyText("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: t("common.error"), description: err.message || t("listing.failedToSend") });
    },
  });

  const canReview = canReviewData?.canReview ?? false;
  const reviewReason = canReviewData?.reason;

  return (
    <div className="mt-12 pt-8 border-t" data-testid="seller-reviews-section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold gradient-text">{t("listing.sellerReviews")}</h2>
        {summary && summary.count > 0 && (
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <span className="font-bold">{summary.avg.toFixed(1)}</span>
            <span className="text-muted-foreground">({summary.count} {t("listing.reviews").toLowerCase()})</span>
          </div>
        )}
      </div>

      {user && user.id !== sellerId && canReview && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold mb-3">{t("listing.leaveReview")}</h3>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(s)}
                data-testid={`button-star-${s}`}
              >
                <Star
                  className={`w-6 h-6 ${(hoverRating || rating) >= s ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder={t("listing.shareExperience")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-3"
            data-testid="input-review-comment"
          />
          <Button
            onClick={() => reviewMutation.mutate()}
            disabled={!rating || reviewMutation.isPending}
            size="sm"
            data-testid="button-submit-review"
          >
            {reviewMutation.isPending ? t("listing.submitting") : t("listing.submitReview")}
          </Button>
        </Card>
      )}

      {user && user.id !== sellerId && !canReview && reviewReason && (
        <Card className="p-4 mb-6 bg-muted/50">
          <p className="text-sm text-muted-foreground flex items-center gap-2" data-testid="text-review-eligibility">
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            {reviewReason === "already_reviewed"
              ? t("listing.alreadyReviewed")
              : t("listing.reviewEligibility")}
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {reviews?.map((review) => (
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

            {review.sellerReply && (
              <div className="mt-3 ml-4 pl-3 border-l-2 border-primary/30" data-testid={`review-reply-${review.id}`}>
                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                  <Store className="w-3 h-3" /> {t("listing.sellerReply")}
                  {review.sellerReplyAt && (
                    <span className="font-normal text-muted-foreground ml-1">
                      {new Date(review.sellerReplyAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{review.sellerReply}</p>
              </div>
            )}

            {isSeller && !review.sellerReply && replyingTo !== review.id && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 gap-1.5 text-xs"
                onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                data-testid={`button-reply-review-${review.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> {t("listing.reply")}
              </Button>
            )}

            {isSeller && replyingTo === review.id && (
              <div className="mt-3 ml-4 space-y-2" data-testid={`reply-form-${review.id}`}>
                <Textarea
                  placeholder={t("listing.replyPlaceholder")}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[60px]"
                  data-testid={`input-reply-${review.id}`}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => replyMutation.mutate(review.id)}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    data-testid={`button-submit-reply-${review.id}`}
                  >
                    {replyMutation.isPending ? t("listing.posting") : t("listing.postReply")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setReplyingTo(null); setReplyText(""); }}
                    data-testid={`button-cancel-reply-${review.id}`}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {(!reviews || reviews.length === 0) && (
          <p className="text-muted-foreground text-center py-8">{t("listing.noReviews")}</p>
        )}
      </div>
    </div>
  );
}


function ListingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="w-32 h-10 bg-muted rounded mb-8 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <Skeleton className="aspect-[4/3] rounded-2xl w-full" />
          <div className="space-y-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-10 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <MapPin className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-3xl font-display font-bold gradient-text mb-2">{t("listing.notFound")}</h2>
        <p className="text-muted-foreground mb-8">{t("listing.notFoundMessage")}</p>
        <Link href="/">
          <Button size="lg">{t("listing.browseOtherItems")}</Button>
        </Link>
      </div>
    </div>
  );
}
