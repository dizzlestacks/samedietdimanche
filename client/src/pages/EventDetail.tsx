import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingCard } from "@/components/ListingCard";
import {
  CalendarDays,
  MapPin,
  Users,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLoader } from "@/components/PageLoader";
import type { Event, Listing } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
const logoSrc = "/yardees-logo.png";

function formatGoogleCalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function EventPhotoGallery({ photos }: { photos: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden mb-6">
        <div className="relative aspect-[16/9] bg-muted flex items-center justify-center">
          <img
            src={logoSrc}
            alt="YARDEES"
            className="w-32 h-32 object-contain opacity-60"
            data-testid="img-event-gallery-fallback"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden mb-6">
      <div className="relative aspect-[16/9] bg-muted">
        <img
          src={photos[currentIndex]}
          alt={`Event photo ${currentIndex + 1}`}
          className="w-full h-full object-cover"
          data-testid={`img-event-gallery-${currentIndex}`}
          onError={(e) => {
            const img = e.currentTarget;
            img.onerror = null;
            img.src = logoSrc;
            img.className = "w-full h-full object-contain p-12 bg-primary/5";
          }}
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); setCurrentIndex((i) => (i - 1 + photos.length) % photos.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
              data-testid="button-event-photo-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setCurrentIndex((i) => (i + 1) % photos.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
              data-testid="button-event-photo-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); setCurrentIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/50"}`}
                  data-testid={`button-event-photo-dot-${i}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${i === currentIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
              data-testid={`button-event-thumbnail-${i}`}
            >
              <img
                    src={photo}
                    alt=""
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
    </div>
  );
}

export default function EventDetail() {
  const { t } = useTranslation();
  const [match, params] = useRoute("/events/:id");
  const id = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery<Event & { rsvpCount: number; requiresVerification?: boolean; linkedListingId?: number | null }>({
    queryKey: ["/api/events", id],
    enabled: !!id,
  });

  const { data: rsvpStatus } = useQuery<{ hasRsvp: boolean }>({
    queryKey: ["/api/events", id, "rsvp-status"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/events/${id}/rsvp`, { credentials: "include" });
        if (res.status === 401) return { hasRsvp: false };
        if (!res.ok) return { hasRsvp: false };
        return res.json();
      } catch {
        return { hasRsvp: false };
      }
    },
    enabled: !!id && !!user,
  });

  const { data: verificationStatus } = useQuery<any>({
    queryKey: ["/api/verification/listing", event?.linkedListingId],
    queryFn: async () => {
      const res = await fetch(`/api/verification/listing/${event!.linkedListingId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && !!event?.requiresVerification && !!event?.linkedListingId,
  });

  const eventJsonLd = event ? {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: (event.description || "").slice(0, 500),
    startDate: event.startDate,
    endDate: event.endDate || undefined,
    url: `${window.location.origin}/events/${id}`,
    location: (event.city || event.country) ? {
      "@type": "Place",
      name: event.address || event.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city || undefined,
        addressCountry: event.country || undefined,
        streetAddress: event.address || undefined,
      },
    } : undefined,
  } : undefined;

  useOGMeta({
    title: event?.title || "Event Details",
    description: event?.description?.slice(0, 160) || "View event details, RSVP, and add to your calendar on YARDEES.",
    url: `${window.location.origin}/events/${id}`,
    jsonLd: eventJsonLd,
  });

  const { data: linkedListing } = useQuery<Listing>({
    queryKey: ["/api/listings", event?.listingId],
    enabled: !!event?.listingId,
  });

  const isVerified = verificationStatus?.status === "approved";
  const isPendingVerification = verificationStatus?.status === "pending";
  const needsVerification = event?.requiresVerification && !isVerified && user;

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      if (rsvpStatus?.hasRsvp) {
        await apiRequest("DELETE", `/api/events/${id}/rsvp`);
      } else {
        await apiRequest("POST", `/api/events/${id}/rsvp`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events", id] });
      qc.invalidateQueries({ queryKey: ["/api/events", id, "rsvp-status"] });
      toast({
        title: rsvpStatus?.hasRsvp ? t("events.rsvpCancelled") : t("events.rsvpConfirmed"),
        description: rsvpStatus?.hasRsvp
          ? t("events.removedFromGuestList")
          : t("events.onGuestList"),
      });
    },
    onError: (err: Error) => {
      if (err.message?.includes("ID verification required")) {
        toast({
          variant: "destructive",
          title: t("events.verificationRequired", "ID Verification Required"),
          description: t("events.verifyIdBeforeRsvp", "Please verify your ID on the linked listing before RSVPing to this event."),
        });
        qc.invalidateQueries({ queryKey: ["/api/verification/listing", event?.linkedListingId] });
      } else {
        toast({ variant: "destructive", title: t("common.error"), description: err.message });
      }
    },
  });

  if (!match) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-8 w-2/3 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-xl font-bold gradient-text mb-2">{t("events.eventNotFound")}</h2>
          <Link href="/events">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> {t("events.backToEvents")}
            </Button>
          </Link>
        </main>
      </div>
    );
  }

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGoogleCalDate(start)}/${formatGoogleCalDate(end)}&details=${encodeURIComponent(event.description || "")}&location=${encodeURIComponent(event.address)}`;

  const outlookUrl = `https://outlook.live.com/calendar/0/action/compose?subject=${encodeURIComponent(event.title)}&startdt=${start.toISOString()}&enddt=${end.toISOString()}&body=${encodeURIComponent(event.description || "")}&location=${encodeURIComponent(event.address)}`;

  const hasRsvp = rsvpStatus?.hasRsvp ?? false;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="container mx-auto px-4 py-8 flex-grow max-w-3xl">
        <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("events.backToEvents")}
        </Link>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-event-detail-title">
              {event.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(event as any).photos?.length > 0 && (
              <EventPhotoGallery photos={(event as any).photos} />
            )}

            {event.description && (
              <p className="text-muted-foreground" data-testid="text-event-description">
                {event.description}
              </p>
            )}

            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" />
                <div data-testid="text-event-date-range">
                  <div>
                    {start.toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                  <div className="text-muted-foreground">
                    {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    {" - "}
                    {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                <div data-testid="text-event-address">
                  <div>{event.address}</div>
                  <div className="text-muted-foreground">
                    {event.city}, {event.country}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Users className="w-5 h-5 text-primary flex-shrink-0" />
                <span data-testid="text-event-rsvp-count">
                  {event.rsvpCount === 1
                    ? t("events.personAttending", { count: event.rsvpCount })
                    : t("events.peopleAttending", { count: event.rsvpCount })}
                </span>
              </div>
            </div>

            {event.requiresVerification && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm" data-testid="notice-verification-required">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="text-amber-800 dark:text-amber-300">
                  {t("events.idVerificationRequired", "ID verification is required to RSVP to this event")}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {user ? (
                needsVerification ? (
                  <div className="flex flex-col gap-2">
                    {isPendingVerification ? (
                      <Badge variant="secondary" className="gap-1 text-sm px-3 py-1.5" data-testid="badge-verification-pending">
                        <ShieldCheck className="w-4 h-4" />
                        {t("events.verificationPending", "ID verification pending — you'll be able to RSVP once approved")}
                      </Badge>
                    ) : (
                      <Link href={`/listings/${event.linkedListingId}`}>
                        <Button variant="default" className="gap-2" data-testid="button-verify-to-rsvp">
                          <ShieldCheck className="w-4 h-4" />
                          {t("events.verifyToRsvp", "Verify your ID to RSVP")}
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <Button
                    variant={hasRsvp ? "outline" : "default"}
                    className="gap-2"
                    onClick={() => rsvpMutation.mutate()}
                    disabled={rsvpMutation.isPending}
                    data-testid="button-rsvp"
                  >
                    {rsvpMutation.isPending ? (
                      <ButtonLoader />
                    ) : hasRsvp ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {hasRsvp ? t("events.cancelRsvp") : t("events.rsvp")}
                  </Button>
                )
              ) : (
                <Link href="/login">
                  <Button variant="outline" className="gap-2" data-testid="button-login-to-rsvp">
                    <CheckCircle className="w-4 h-4" /> {t("events.logInToRsvp")}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("events.addToCalendar")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/events/${id}/ics`} download>
                <Button variant="outline" className="gap-2" data-testid="button-download-ics">
                  <Download className="w-4 h-4" /> {t("events.downloadIcs")}
                </Button>
              </a>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2" data-testid="link-google-calendar">
                  <ExternalLink className="w-4 h-4" /> {t("events.googleCalendar")}
                </Button>
              </a>
              <a href={`/api/events/${id}/ics`} download>
                <Button variant="outline" className="gap-2" data-testid="link-apple-calendar">
                  <Download className="w-4 h-4" /> {t("events.appleCalendar")}
                </Button>
              </a>
              <a href={outlookUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2" data-testid="link-outlook-calendar">
                  <ExternalLink className="w-4 h-4" /> {t("events.outlook")}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {linkedListing && (
          <div>
            <h3 className="text-lg font-semibold mb-3">{t("events.linkedListing")}</h3>
            <ListingCard listing={linkedListing} />
          </div>
        )}
      </main>
    </div>
  );
}
