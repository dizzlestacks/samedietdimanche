import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Gavel, Clock, Users, DollarSign, ArrowUp, Plus, Timer } from "lucide-react";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

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
import { Link } from "wouter";
import type { Auction } from "@shared/schema";

function timeLeft(endsAt: string | Date) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${mins}m`;
}

export default function AuctionsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useOGMeta({ title: "Auctions", description: "Browse and bid on live auctions." });

  const [selectedAuction, setSelectedAuction] = useState<number | null>(null);
  const [bidAmount, setBidAmount] = useState("");

  const location = useMemo(() => getStoredLocation(), []);
  const country = location?.country || "";
  const city = location?.city || "";

  const auctionsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    const qs = params.toString();
    return qs ? `/api/auctions?${qs}` : "/api/auctions";
  }, [country, city]);

  const { data: auctionsList, isLoading } = useQuery<Auction[]>({
    queryKey: ["/api/auctions", country, city],
    queryFn: async () => {
      const res = await fetch(auctionsUrl, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: auctionDetail } = useQuery<any>({
    queryKey: ["/api/auctions", selectedAuction],
    queryFn: async () => {
      const res = await fetch(`/api/auctions/${selectedAuction}`);
      return res.json();
    },
    enabled: !!selectedAuction,
  });

  const bidMutation = useMutation({
    mutationFn: async ({ auctionId, amount }: { auctionId: number; amount: number }) => {
      const res = await apiRequest("POST", `/api/auctions/${auctionId}/bid`, { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auctions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auctions", selectedAuction] });
      setBidAmount("");
      toast({ title: t("auction.bidPlaced", "Bid placed successfully!") });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to place bid", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Gavel className="w-6 h-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("auction.title", "Live Auctions")}</h1>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : !auctionsList?.length ? (
                <Card className="p-12 text-center">
                  <Gavel className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                  <h3 className="font-display font-bold text-lg mb-1">{t("auction.noAuctions", "No active auctions")}</h3>
                  <p className="text-sm text-muted-foreground/50">{t("auction.checkBack", "Check back later for new auctions")}</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {auctionsList.map((auction, idx) => (
                    <motion.div
                      key={auction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card
                        className={`p-4 cursor-pointer transition-all hover:border-primary/30 ${selectedAuction === auction.id ? "border-primary ring-1 ring-primary/20" : ""}`}
                        onClick={() => setSelectedAuction(auction.id)}
                        data-testid={`card-auction-${auction.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-display font-bold text-sm">Auction #{auction.id}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <Badge variant="outline" className="gap-1 text-xs">
                                <DollarSign className="w-3 h-3" />
                                {auction.currentBid ? `$${(auction.currentBid / 100).toFixed(2)}` : `$${(auction.startingPrice / 100).toFixed(2)}`}
                              </Badge>
                              <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                                <Users className="w-3 h-3" /> {auction.bidCount} bids
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="gap-1" variant={timeLeft(auction.endsAt) === "Ended" ? "destructive" : "secondary"}>
                              <Timer className="w-3 h-3" /> {timeLeft(auction.endsAt)}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <AnimatePresence mode="wait">
                {auctionDetail ? (
                  <motion.div key={auctionDetail.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                    <Card className="p-5 sticky top-20">
                      <h3 className="font-display font-bold mb-3">{t("auction.details", "Auction Details")}</h3>
                      {auctionDetail.listing && (
                        <div className="mb-4">
                          {auctionDetail.listing.photos?.[0] && (
                            <img src={auctionDetail.listing.photos[0]} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />
                          )}
                          <Link href={`/listing/${auctionDetail.listing.id}`}>
                            <p className="font-semibold text-sm hover:text-primary cursor-pointer">{auctionDetail.listing.title}</p>
                          </Link>
                        </div>
                      )}
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Starting Price</span>
                          <span className="font-semibold">${(auctionDetail.startingPrice / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current Bid</span>
                          <span className="font-bold text-primary">${((auctionDetail.currentBid || auctionDetail.startingPrice) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bids</span>
                          <span>{auctionDetail.bidCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Time Left</span>
                          <span className="font-semibold">{timeLeft(auctionDetail.endsAt)}</span>
                        </div>
                      </div>

                      {user && timeLeft(auctionDetail.endsAt) !== "Ended" && (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            placeholder={`Min $${(((auctionDetail.currentBid || auctionDetail.startingPrice) + 100) / 100).toFixed(2)}`}
                            step="0.01"
                            data-testid="input-bid-amount"
                          />
                          <Button
                            onClick={() => bidMutation.mutate({ auctionId: auctionDetail.id, amount: Math.round(parseFloat(bidAmount) * 100) })}
                            disabled={!bidAmount || bidMutation.isPending}
                            className="gap-1"
                            data-testid="button-place-bid"
                          >
                            <ArrowUp className="w-4 h-4" /> Bid
                          </Button>
                        </div>
                      )}

                      {auctionDetail.bids?.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs font-semibold mb-2 text-muted-foreground">{t("auction.bidHistory", "Bid History")}</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {auctionDetail.bids.map((bid: any) => (
                              <div key={bid.id} className="flex justify-between text-xs p-1.5 bg-muted/20 rounded">
                                <span className="text-muted-foreground/50">
                                  {new Date(bid.createdAt).toLocaleTimeString()}
                                </span>
                                <span className="font-semibold">${(bid.amount / 100).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ) : (
                  <Card className="p-8 text-center">
                    <Gavel className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground/50">{t("auction.selectOne", "Select an auction to view details")}</p>
                  </Card>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
