import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Calendar, Users, Plus, PartyPopper, Clock, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
import { useAuth } from "@/hooks/use-auth";
import type { NeighborhoodEvent } from "@shared/schema";

export default function NeighborhoodEventsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useOGMeta({ title: "Neighborhood Events", description: "Find and join yard sale events in your neighborhood." });

  const [showForm, setShowForm] = useState(false);
  const storedLoc = useMemo(() => getStoredLocation(), []);
  const [formData, setFormData] = useState({
    title: "", description: "", neighborhood: "",
    city: storedLoc?.city || "", country: storedLoc?.country || "",
    startDate: "", endDate: "", maxParticipants: "",
  });

  const { data: locationsMap } = useQuery<Record<string, string[]>>({
    queryKey: ["/api/listings/locations"],
  });

  const eventCountryOptions = useMemo(() => {
    const set = new Set<string>();
    if (locationsMap) Object.keys(locationsMap).forEach(c => set.add(c));
    if (storedLoc?.country) set.add(storedLoc.country);
    if (formData.country) set.add(formData.country);
    return Array.from(set).sort();
  }, [locationsMap, storedLoc, formData.country]);

  const eventCityOptions = useMemo(() => {
    const set = new Set<string>();
    if (formData.country && locationsMap?.[formData.country]) {
      locationsMap[formData.country].forEach(c => set.add(c));
    }
    if (storedLoc?.city && (!formData.country || formData.country === storedLoc.country)) {
      set.add(storedLoc.city);
    }
    if (formData.city) set.add(formData.city);
    return Array.from(set).sort();
  }, [formData.country, formData.city, locationsMap, storedLoc]);

  const [eventCitySearch, setEventCitySearch] = useState("");
  const [eventCityOpen, setEventCityOpen] = useState(false);

  const filteredEventCities = useMemo(() => {
    if (!eventCitySearch) return eventCityOptions;
    const q = eventCitySearch.toLowerCase();
    return eventCityOptions.filter(c => c.toLowerCase().includes(q));
  }, [eventCityOptions, eventCitySearch]);

  const location = useMemo(() => getStoredLocation(), []);
  const locCountry = location?.country || "";
  const locCity = location?.city || "";

  const neighborhoodUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (locCountry) params.set("country", locCountry);
    if (locCity) params.set("city", locCity);
    const qs = params.toString();
    return qs ? `/api/neighborhood-events?${qs}` : "/api/neighborhood-events";
  }, [locCountry, locCity]);

  const { data: events, isLoading } = useQuery<NeighborhoodEvent[]>({
    queryKey: ["/api/neighborhood-events", locCountry, locCity],
    queryFn: async () => {
      const res = await fetch(neighborhoodUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/neighborhood-events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/neighborhood-events"] });
      setShowForm(false);
      setFormData({ title: "", description: "", neighborhood: "", city: storedLoc?.city || "", country: storedLoc?.country || "", startDate: "", endDate: "", maxParticipants: "" });
      toast({ title: t("events.created", "Event created! Invite your neighbors.") });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const res = await apiRequest("POST", `/api/neighborhood-events/${eventId}/join`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/neighborhood-events"] });
      toast({ title: t("events.joined", "You've joined the event!") });
    },
    onError: () => {
      toast({ title: "Already joined", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!formData.title.trim() || !formData.neighborhood.trim()) return;
    createMutation.mutate({
      title: formData.title,
      description: formData.description || undefined,
      neighborhood: formData.neighborhood,
      city: formData.city,
      country: formData.country,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      maxParticipants: formData.maxParticipants ? Number(formData.maxParticipants) : undefined,
      isPublic: true,
    });
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <PartyPopper className="w-6 h-6 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("events.neighborhoodTitle", "Neighborhood Events")}</h1>
              </div>
              <p className="text-muted-foreground/60 text-sm">{t("events.neighborhoodSubtitle", "Organize and join yard sale events in your area")}</p>
            </div>
            {user && (
              <Button onClick={() => setShowForm(!showForm)} className="gap-1.5" data-testid="button-create-event">
                <Plus className="w-4 h-4" /> {t("events.organize", "Organize Event")}
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6">
                <Card className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">{t("events.eventName", "Event Name")}</label>
                    <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Community Yard Sale Weekend" data-testid="input-event-title" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">{t("events.description", "Description")}</label>
                    <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Tell people about the event..." rows={3} data-testid="input-event-desc" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">{t("events.neighborhood", "Neighborhood")}</label>
                      <Input value={formData.neighborhood} onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })} placeholder="Downtown" data-testid="input-event-neighborhood" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">{t("form.city")}</label>
                      <div className="relative">
                        <Input
                          data-testid="input-event-city"
                          placeholder="City"
                          value={eventCityOpen ? eventCitySearch : formData.city}
                          onChange={(e) => {
                            setEventCitySearch(e.target.value);
                            if (!eventCityOpen) setEventCityOpen(true);
                          }}
                          onFocus={() => {
                            setEventCitySearch(formData.city);
                            setEventCityOpen(true);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              if (eventCitySearch.trim() && !formData.city) {
                                setFormData({ ...formData, city: capitalizeWords(eventCitySearch.trim()) });
                              }
                              setEventCityOpen(false);
                            }, 200);
                          }}
                          autoComplete="off"
                        />
                        {eventCityOpen && filteredEventCities.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-32 overflow-y-auto">
                            {filteredEventCities.map((c) => (
                              <button
                                key={c}
                                type="button"
                                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                                  formData.city === c ? "bg-accent/50 font-medium" : ""
                                }`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormData({ ...formData, city: c });
                                  setEventCitySearch(c);
                                  setEventCityOpen(false);
                                }}
                              >
                                {formData.city === c && <Check className="w-3.5 h-3.5 text-primary" />}
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">{t("form.country")}</label>
                      <Select
                        value={formData.country}
                        onValueChange={(val) => {
                          const newCities = locationsMap?.[val] || [];
                          const cityStillValid = newCities.includes(formData.city) || (storedLoc?.country === val && storedLoc?.city === formData.city);
                          setFormData({ ...formData, country: val, city: cityStillValid ? formData.city : "" });
                        }}
                      >
                        <SelectTrigger data-testid="select-event-country">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventCountryOptions.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">{t("events.startDate", "Start Date")}</label>
                      <Input type="datetime-local" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} data-testid="input-event-start" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">{t("events.endDate", "End Date")}</label>
                      <Input type="datetime-local" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} data-testid="input-event-end" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">{t("events.maxParticipants", "Max Participants")}</label>
                      <Input type="number" value={formData.maxParticipants} onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })} placeholder="No limit" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
                    <Button onClick={handleCreate} disabled={!formData.title.trim() || !formData.neighborhood.trim() || createMutation.isPending} data-testid="button-save-event">
                      {createMutation.isPending ? t("common.saving", "Saving...") : t("events.create", "Create Event")}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : !events?.length ? (
            <Card className="p-12 text-center">
              <PartyPopper className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <h3 className="font-display font-bold text-lg mb-1">{t("events.noEvents", "No upcoming events")}</h3>
              <p className="text-sm text-muted-foreground/50 mb-4">{t("events.beFirst", "Be the first to organize a neighborhood event!")}</p>
              {user && (
                <Button onClick={() => setShowForm(true)} variant="outline" className="gap-1.5">
                  <Plus className="w-4 h-4" /> {t("events.organize", "Organize Event")}
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {events.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="p-5 h-full flex flex-col" data-testid={`card-event-${event.id}`}>
                    {event.coverImage && (
                      <img src={event.coverImage} alt={event.title} className="w-full h-32 object-cover rounded-lg mb-3" />
                    )}
                    <h3 className="font-display font-bold text-lg mb-1">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-muted-foreground/60 line-clamp-2 mb-3">{event.description}</p>
                    )}
                    <div className="space-y-1.5 text-xs text-muted-foreground/50 mb-3 flex-grow">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" /> {event.neighborhood}, {event.city}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" /> {formatDate(event.startDate)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> Until {formatDate(event.endDate)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" /> {event.participantCount} participants
                        {event.maxParticipants && ` / ${event.maxParticipants} max`}
                      </div>
                    </div>
                    {user && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => joinMutation.mutate(event.id)}
                        disabled={joinMutation.isPending}
                        data-testid={`button-join-event-${event.id}`}
                      >
                        <Users className="w-3.5 h-3.5" /> {t("events.joinEvent", "Join Event")}
                      </Button>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
