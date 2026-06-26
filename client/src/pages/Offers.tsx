import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { currencySymbols } from "@shared/schema";
import type { Offer } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Inbox, Send, DollarSign, MessageSquare, Calendar, ArrowLeftRight, CreditCard } from "lucide-react";
import { InlineLoader, PageTransition } from "@/components/PageLoader";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

type OfferWithDetails = Offer & {
  listingTitle?: string;
  buyerName?: string;
  sellerName?: string;
};

const statusBadgeVariants: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  accepted: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  countered: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  expired: "bg-muted text-muted-foreground border-border",
};

function formatAmount(amount: number, currency: string) {
  const symbol = currencySymbols[currency] || "$";
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`capitalize text-xs ${statusBadgeVariants[status] || ""}`}
      data-testid={`badge-status-${status}`}
    >
      {status}
    </Badge>
  );
}

export default function Offers() {
  const { t } = useTranslation();
  useOGMeta({ title: "My Offers", description: "Track your offers and negotiations on YARDEES.", url: `${window.location.origin}/offers` });
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const { data: offers, isLoading } = useQuery<OfferWithDetails[]>({
    queryKey: ["/api/offers"],
    enabled: !!user,
  });

  const updateOfferMutation = useMutation({
    mutationFn: async ({ id, status, counterAmount }: { id: number; status: string; counterAmount?: number }) => {
      await apiRequest("PATCH", `/api/offers/${id}`, { status, counterAmount });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/offers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      const msg = variables.status === "accepted"
        ? t("offers.accepted")
        : variables.status === "rejected"
        ? t("offers.rejected")
        : t("offers.offerUpdated");
      toast({ title: msg });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  if (isAuthLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">{t("offers.pleaseLogIn")}</p>
          <Link href="/login">
            <Button className="mt-4" data-testid="button-login">{t("common.logIn")}</Button>
          </Link>
        </main>
      </div>
    );
  }

  const received = offers?.filter((o) => o.sellerId === user.id) || [];
  const sent = offers?.filter((o) => o.buyerId === user.id) || [];
  const pendingReceived = received.filter(o => o.status === "pending").length;
  const pendingSent = sent.filter(o => o.status === "pending" || o.status === "countered").length;

  return (
    <div className="min-h-screen bg-background" data-testid="page-offers">
      <Navbar />
      <PageTransition>
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3 mb-2">
          <ArrowLeftRight className="w-8 h-8 text-primary" />
          {t("offers.title")}
        </h1>
        <p className="text-muted-foreground mb-8">{t("offers.subtitle")}</p>

        <Tabs defaultValue="received" data-testid="tabs-offers">
          <TabsList className="mb-6">
            <TabsTrigger value="received" data-testid="tab-received" className="relative gap-2">
              <Inbox className="w-4 h-4" />
              {t("offers.received")} ({received.length})
              {pendingReceived > 0 && (
                <Badge className="ml-1 w-5 h-5 p-0 flex items-center justify-center text-[10px] bg-orange-500 text-white border-0">
                  {pendingReceived}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent" className="relative gap-2">
              <Send className="w-4 h-4" />
              {t("offers.sent")} ({sent.length})
              {pendingSent > 0 && (
                <Badge className="ml-1 w-5 h-5 p-0 flex items-center justify-center text-[10px] bg-blue-500 text-white border-0">
                  {pendingSent}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            {isLoading ? (
              <InlineLoader />
            ) : received.length === 0 ? (
              <EmptyState icon={Inbox} title={t("offers.noReceivedOffers")} description={t("offers.offersFromBuyers")} />
            ) : (
              <div className="space-y-4">
                {received.map((offer) => (
                  <ReceivedOfferCard
                    key={offer.id}
                    offer={offer}
                    onAction={(status, counterAmount) =>
                      updateOfferMutation.mutate({ id: offer.id, status, counterAmount })
                    }
                    isPending={updateOfferMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {isLoading ? (
              <InlineLoader />
            ) : sent.length === 0 ? (
              <EmptyState icon={Send} title={t("offers.noSentOffers")} description={t("offers.offersMadeAppear")} />
            ) : (
              <div className="space-y-4">
                {sent.map((offer) => (
                  <SentOfferCard
                    key={offer.id}
                    offer={offer}
                    onAction={(status) =>
                      updateOfferMutation.mutate({ id: offer.id, status })
                    }
                    isPending={updateOfferMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      </PageTransition>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="text-center py-20 bg-muted/20 rounded-md border border-dashed border-border">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function ReceivedOfferCard({
  offer,
  onAction,
  isPending,
}: {
  offer: OfferWithDetails;
  onAction: (status: string, counterAmount?: number) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterValue, setCounterValue] = useState("");

  return (
    <Card className="p-4" data-testid={`card-offer-received-${offer.id}`}>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-grow space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/listing/${offer.listingId}`}>
              <span className="font-bold text-lg hover:underline cursor-pointer" data-testid={`text-listing-title-${offer.id}`}>
                {offer.listingTitle || `Listing #${offer.listingId}`}
              </span>
            </Link>
            <StatusBadge status={offer.status} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1" data-testid={`text-buyer-${offer.id}`}>
              {t("offers.fromLabel")}: <span className="text-foreground font-medium">{offer.buyerName || offer.buyerId}</span>
            </span>
            <span className="flex items-center gap-1" data-testid={`text-amount-${offer.id}`}>
              <DollarSign className="w-4 h-4" />
              <span className="text-foreground font-bold">{formatAmount(offer.amount, offer.currency)}</span>
            </span>
            {offer.counterAmount && (
              <span className="flex items-center gap-1" data-testid={`text-counter-amount-${offer.id}`}>
                {t("offers.counter")}: <span className="text-foreground font-bold">{formatAmount(offer.counterAmount, offer.currency)}</span>
              </span>
            )}
            <span className="flex items-center gap-1" data-testid={`text-date-${offer.id}`}>
              <Calendar className="w-4 h-4" />
              {offer.createdAt ? format(new Date(offer.createdAt), "MMM d, yyyy") : "N/A"}
            </span>
          </div>

          {offer.message && (
            <p className="text-sm text-muted-foreground flex items-start gap-1" data-testid={`text-message-${offer.id}`}>
              <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {offer.message}
            </p>
          )}
        </div>

        {offer.status === "pending" && (
          <div className="flex flex-wrap sm:flex-col gap-2 sm:min-w-[120px]">
            <Button
              size="sm"
              className="bg-green-600"
              onClick={() => onAction("accepted")}
              disabled={isPending}
              data-testid={`button-accept-${offer.id}`}
            >
              {t("offers.accept")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onAction("rejected")}
              disabled={isPending}
              data-testid={`button-reject-${offer.id}`}
            >
              {t("offers.reject")}
            </Button>
            <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid={`button-counter-${offer.id}`}>
                  {t("offers.counter")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("offers.counterOffer")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">{t("offers.counterAmountLabel")} ({currencySymbols[offer.currency] || "$"})</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t("offers.enterCounterAmount")}
                      value={counterValue}
                      onChange={(e) => setCounterValue(e.target.value)}
                      data-testid={`input-counter-amount-${offer.id}`}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!counterValue || isPending}
                    onClick={() => {
                      const cents = Math.round(parseFloat(counterValue) * 100);
                      if (cents > 0) {
                        onAction("countered", cents);
                        setCounterOpen(false);
                        setCounterValue("");
                      }
                    }}
                    data-testid={`button-submit-counter-${offer.id}`}
                  >
                    {t("offers.sendCounterOffer")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </Card>
  );
}

function SentOfferCard({ offer, onAction, isPending }: { offer: OfferWithDetails; onAction: (status: string) => void; isPending: boolean }) {
  const { t } = useTranslation();

  return (
    <Card className={`p-4 ${offer.status === "countered" ? "border-blue-500/40 bg-blue-500/5" : ""}`} data-testid={`card-offer-sent-${offer.id}`}>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-grow space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/listing/${offer.listingId}`}>
              <span className="font-bold text-lg hover:underline cursor-pointer" data-testid={`text-listing-title-${offer.id}`}>
                {offer.listingTitle || `Listing #${offer.listingId}`}
              </span>
            </Link>
            <StatusBadge status={offer.status} />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1" data-testid={`text-seller-${offer.id}`}>
              {t("offers.toLabel")}: <span className="text-foreground font-medium">{offer.sellerName || offer.sellerId}</span>
            </span>
            <span className="flex items-center gap-1" data-testid={`text-amount-${offer.id}`}>
              <DollarSign className="w-4 h-4" />
              <span className={`font-bold ${offer.status === "countered" ? "text-muted-foreground line-through" : "text-foreground"}`}>{formatAmount(offer.amount, offer.currency)}</span>
            </span>
            {offer.counterAmount && (
              <span className="flex items-center gap-1" data-testid={`text-counter-amount-${offer.id}`}>
                <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                <span className="text-foreground font-bold text-blue-600 dark:text-blue-400">{formatAmount(offer.counterAmount, offer.currency)}</span>
              </span>
            )}
            <span className="flex items-center gap-1" data-testid={`text-date-${offer.id}`}>
              <Calendar className="w-4 h-4" />
              {offer.createdAt ? format(new Date(offer.createdAt), "MMM d, yyyy") : "N/A"}
            </span>
          </div>

          {offer.message && (
            <p className="text-sm text-muted-foreground flex items-start gap-1" data-testid={`text-message-${offer.id}`}>
              <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {offer.message}
            </p>
          )}

          {offer.status === "countered" && offer.counterAmount && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-2" data-testid={`counter-offer-banner-${offer.id}`}>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                {t("offers.sellerCountered", "The seller has countered with")} {formatAmount(offer.counterAmount, offer.currency)}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  onClick={() => onAction("accepted")}
                  disabled={isPending}
                  data-testid={`button-accept-counter-${offer.id}`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {t("offers.acceptAndPay", "Accept & Pay")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onAction("rejected")}
                  disabled={isPending}
                  data-testid={`button-decline-counter-${offer.id}`}
                >
                  {t("offers.decline", "Decline")}
                </Button>
              </div>
            </div>
          )}

          {offer.status === "accepted" && (
            <Link href="/orders">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2 mt-1" data-testid={`button-go-pay-${offer.id}`}>
                <CreditCard className="w-4 h-4" />
                {t("offers.completePurchase", "Complete Purchase")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
