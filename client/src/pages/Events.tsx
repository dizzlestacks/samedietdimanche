import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/PageLoader";
import { Link } from "wouter";
import { CalendarDays, MapPin, Users, Plus, Search, Zap, Clock, Download, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import type { Event } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
const logoSrc = "/yardees-logo.png";

function formatGoogleCalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function getEventStatus(startDate: Date, endDate: Date): "today" | "upcoming" | "past" {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  if (endDate < now) return "past";
  if (startDate < todayEnd && endDate >= todayStart) return "today";
  return "upcoming";
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

export default function Events() {
  const { t } = useTranslation();
  useOGMeta({ title: "Community Events", description: "Discover upcoming yard sales and community events near you on YARDEES.", url: `${window.location.origin}/events` });
  const { user } = useAuth();
  const [searchFilter, setSearchFilter] = useState("");

  const location = useMemo(() => getStoredLocation(), []);
  const country = location?.country || "";
  const city = location?.city || "";

  const eventsQueryKey = useMemo(() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    const qs = params.toString();
    return qs ? `/api/events?${qs}` : "/api/events";
  }, [country, city]);

  const { data: events, isLoading } = useQuery<(Event & { rsvpCount: number })[]>({
    queryKey: ["/api/events", country, city],
    queryFn: async () => {
      const res = await fetch(eventsQueryKey, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const filtered = events
    ?.filter((e) => {
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.address.toLowerCase().includes(q)
      );
    })
    ?.sort((a, b) => {
      const statusA = getEventStatus(new Date(a.startDate), new Date(a.endDate));
      const statusB = getEventStatus(new Date(b.startDate), new Date(b.endDate));
      const order = { today: 0, upcoming: 1, past: 2 };
      if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB];
      if (statusA === "past") return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <PageTransition>
      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text" data-testid="text-events-title">
              {t("events.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("events.subtitle")}
            </p>
          </div>
          {user ? (
            <Link href="/events/create">
              <Button className="gap-2" data-testid="link-create-event">
                <Plus className="w-4 h-4" />
                {t("events.createEvent")}
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="gap-2" data-testid="link-login-to-create">
                <Plus className="w-4 h-4" />
                {t("events.logInToCreate")}
              </Button>
            </Link>
          )}
        </div>

        <div className="mb-6 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t("events.searchEvents", "Search events...")}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-9"
            data-testid="input-event-search"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <Skeleton className="h-40 w-full" />
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-16 bg-muted/20 rounded-md border border-dashed border-border">
            <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">{t("events.noEvents")}</h3>
            <p className="text-muted-foreground text-sm">
              {searchFilter ? t("events.tryDifferentSearch", "Try a different search term") : t("events.beFirstToCreate")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered?.map((event) => {
              const start = new Date(event.startDate);
              const end = new Date(event.endDate);
              const status = getEventStatus(start, end);
              return (
                <Card
                  key={event.id}
                  className={`hover-elevate h-full overflow-hidden transition-opacity ${status === "past" ? "opacity-50 hover:opacity-70" : ""}`}
                  data-testid={`card-event-${event.id}`}
                >
                  <Link href={`/events/${event.id}`} className="block cursor-pointer">
                    <div className="relative w-full h-40 overflow-hidden bg-muted">
                      <img
                        src={(event as any).photos?.[0] || logoSrc}
                        alt={event.title}
                        className={`w-full h-full ${(event as any).photos?.[0] ? "object-cover" : "object-contain p-6 bg-primary/5"} ${status === "past" ? "grayscale" : ""}`}
                        data-testid={`img-event-cover-${event.id}`}
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = logoSrc;
                          img.className = `w-full h-full object-contain p-6 bg-primary/5 ${status === "past" ? "grayscale" : ""}`;
                        }}
                      />
                      {status === "today" && (
                        <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs gap-1 shadow-lg animate-pulse" data-testid={`badge-today-${event.id}`}>
                          <Zap className="w-3 h-3" />
                          {t("events.happeningToday", "Happening Today")}
                        </Badge>
                      )}
                      {status === "past" && (
                        <Badge variant="secondary" className="absolute top-2 left-2 bg-muted/90 text-muted-foreground text-xs gap-1" data-testid={`badge-past-${event.id}`}>
                          <Clock className="w-3 h-3" />
                          {t("events.pastEvent", "Past Event")}
                        </Badge>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-lg line-clamp-2 ${status === "past" ? "text-muted-foreground" : ""}`} data-testid={`text-event-title-${event.id}`}>
                        {event.title}
                      </CardTitle>
                    </CardHeader>
                  </Link>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CalendarDays className={`w-4 h-4 flex-shrink-0 mt-0.5 ${status === "today" ? "text-green-500" : status === "past" ? "text-muted-foreground/50" : "text-primary"}`} />
                      <div data-testid={`text-event-date-${event.id}`}>
                        <div>
                          {start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}{" "}
                          {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </div>
                        <div className="text-xs text-muted-foreground/70">
                          {t("events.to", "to")} {end.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}{" "}
                          {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className={`w-4 h-4 flex-shrink-0 ${status === "past" ? "text-muted-foreground/50" : "text-primary"}`} />
                      <span className="truncate" data-testid={`text-event-location-${event.id}`}>
                        {event.city}, {event.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className={`w-4 h-4 flex-shrink-0 ${status === "past" ? "text-muted-foreground/50" : "text-primary"}`} />
                      <span data-testid={`text-event-rsvp-${event.id}`}>
                        {event.rsvpCount} {event.rsvpCount === 1 ? t("events.rsvp") : t("events.rsvps")}
                      </span>
                    </div>
                    {status !== "past" && (
                      <div className="flex gap-1.5 pt-1">
                        <a href={`/api/events/${event.id}/ics`} download>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" data-testid={`button-ics-${event.id}`}>
                            <Download className="w-3 h-3" />
                            {t("events.ics", "iCal")}
                          </Button>
                        </a>
                        <a
                          href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGoogleCalDate(start)}/${formatGoogleCalDate(end)}&details=${encodeURIComponent((event as any).description || "")}&location=${encodeURIComponent((event as any).address || `${event.city}, ${event.country}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" data-testid={`link-google-cal-${event.id}`}>
                            <ExternalLink className="w-3 h-3" />
                            {t("events.googleCal", "Google")}
                          </Button>
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      </PageTransition>
    </div>
  );
}
