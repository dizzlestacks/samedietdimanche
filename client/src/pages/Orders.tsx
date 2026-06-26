import { useState, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { currencySymbols, shippingCarriers } from "@shared/schema";
import type { Order } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Package, Truck, CheckCircle2, DollarSign, Calendar, ShoppingBag, CreditCard, Shield, AlertTriangle, Loader2, Lock, Clock, Info, ExternalLink, MapPin, ChevronDown, Send, MessageCircle } from "lucide-react";
import { InlineLoader, PageTransition } from "@/components/PageLoader";
import { format, differenceInDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { motion, AnimatePresence } from "framer-motion";

type OrderWithDetails = Order & {
  listingTitle?: string;
  buyerName?: string;
  sellerName?: string;
};

const ORDER_STEPS = ["pending", "paid", "shipped", "delivered"] as const;

function formatAmount(amount: number, currency: string) {
  const symbol = currencySymbols[currency] || "$";
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function StatusTimeline({ status }: { status: string }) {
  const { t } = useTranslation();
  const currentIndex = ORDER_STEPS.indexOf(status as typeof ORDER_STEPS[number]);
  const isCancelled = status === "cancelled";

  const stepConfig = [
    { key: "pending", label: t("orders.pending"), icon: CreditCard, color: "text-amber-500" },
    { key: "paid", label: "In Escrow", icon: Lock, color: "text-blue-500" },
    { key: "shipped", label: t("orders.shipped"), icon: Truck, color: "text-purple-500" },
    { key: "delivered", label: t("orders.delivered"), icon: CheckCircle2, color: "text-green-500" },
  ];

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2" data-testid="timeline-cancelled">
        <Badge variant="destructive" className="text-xs">{t("orders.cancelled")}</Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full" data-testid="timeline-status">
      {stepConfig.map((step, i) => {
        const isComplete = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.15 : 1,
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                } ${isCurrent ? "ring-2 ring-green-500/30 ring-offset-2 ring-offset-background" : ""}`}
                data-testid={`timeline-dot-${step.key}`}
              >
                <Icon className="w-4 h-4" />
              </motion.div>
              <span className={`text-[10px] sm:text-xs ${isComplete ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < stepConfig.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mt-[-18px] transition-colors ${
                  i < currentIndex ? "bg-green-500" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const num = encodeURIComponent(trackingNumber.trim());
  const carrierUrls: Record<string, string> = {
    "UPS": `https://www.ups.com/track?tracknum=${num}`,
    "USPS": `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`,
    "FedEx": `https://www.fedex.com/fedextrack/?trknbr=${num}`,
    "DHL": `https://www.dhl.com/en/express/tracking.html?AWB=${num}`,
    "Canada Post": `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${num}`,
    "Royal Mail": `https://www.royalmail.com/track-your-item#/tracking-results/${num}`,
  };
  return carrierUrls[carrier] || null;
}

function getTrackingSteps(status: string) {
  const steps = [
    { label: "Order placed", icon: ShoppingBag, done: true },
    { label: "Shipped", icon: Truck, done: status === "shipped" || status === "delivered" },
    { label: "Delivered", icon: CheckCircle2, done: status === "delivered" },
  ];
  return steps;
}

function PackageTracker({ order }: { order: OrderWithDetails }) {
  const [open, setOpen] = useState(false);
  const trackingUrl = order.trackingCarrier && order.trackingNumber
    ? getTrackingUrl(order.trackingCarrier, order.trackingNumber)
    : null;
  const steps = getTrackingSteps(order.status);

  if (!order.trackingNumber && !order.trackingCarrier) return null;

  return (
    <div className="mt-3 border rounded-lg overflow-hidden" data-testid={`tracker-${order.id}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
        data-testid={`button-track-package-${order.id}`}
      >
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Track Package
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          key="tracker-content"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
        <div className="px-4 py-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {order.trackingCarrier && (
              <Badge variant="secondary" className="text-xs font-semibold">{order.trackingCarrier}</Badge>
            )}
            {order.trackingNumber && (
              <span className="text-foreground font-mono text-xs bg-muted px-2 py-1 rounded">{order.trackingNumber}</span>
            )}
          </div>

          <div className="relative pl-5 space-y-0">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === steps.length - 1;
              const isActive = step.done && (i === steps.length - 1 || !steps[i + 1].done);
              return (
                <div key={step.label} className="flex items-start gap-3 relative pb-4">
                  {!isLast && (
                    <div className={`absolute left-[9px] top-[22px] w-0.5 h-[calc(100%-14px)] ${step.done ? "bg-green-500" : "bg-border"}`} />
                  )}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    step.done
                      ? isActive ? "bg-green-500 text-white ring-2 ring-green-500/30 ring-offset-1 ring-offset-background" : "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <span className={`text-sm pt-0.5 ${step.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              data-testid={`link-track-external-${order.id}`}
            >
              <ExternalLink className="w-4 h-4" />
              Track on {order.trackingCarrier}
            </a>
          )}
          {!trackingUrl && order.trackingCarrier === "Other" && order.trackingNumber && (
            <p className="text-xs text-muted-foreground">
              Use your tracking number to check status on your carrier's website.
            </p>
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

interface DisputeChatMessage {
  id: number;
  orderId: number;
  senderId: string;
  senderRole: string;
  senderName: string;
  content: string;
  createdAt: string;
}

function DisputeChat({ orderId, userId }: { orderId: number; userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<DisputeChatMessage[]>({
    queryKey: ["/api/orders", orderId, "dispute-chat"],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/dispute-chat`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/dispute-chat`, { content });
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["/api/orders", orderId, "dispute-chat"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (open && messages?.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [messages?.length, open]);

  const roleColors: Record<string, string> = {
    buyer: "bg-blue-500",
    seller: "bg-green-600",
    admin: "bg-orange-500",
  };

  const roleLabels: Record<string, string> = {
    buyer: "Buyer",
    seller: "Seller",
    admin: "Support",
  };

  return (
    <div className="mt-3 border border-red-500/20 rounded-lg overflow-hidden" data-testid={`dispute-chat-${orderId}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-red-500/5 hover:bg-red-500/10 transition-colors text-sm font-medium"
        data-testid={`button-dispute-chat-toggle-${orderId}`}
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-red-500" />
          Dispute Discussion
          {messages && messages.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">{messages.length}</Badge>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="dispute-chat-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-red-500/10">
              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                <p className="text-xs text-muted-foreground">
                  Chat with the other party and YARDEES Support to resolve this dispute.
                </p>
              </div>

              <div className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-3">
                {isLoading && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && (!messages || messages.length === 0) && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    No messages yet. Start the discussion to resolve this dispute.
                  </p>
                )}
                {messages?.map((msg) => {
                  const isOwn = msg.senderId === userId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      data-testid={`dispute-msg-${msg.id}`}
                    >
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : msg.senderRole === "admin"
                          ? "bg-orange-500/10 border border-orange-500/20 rounded-bl-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}>
                        {!isOwn && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${roleColors[msg.senderRole] || "bg-gray-400"}`} />
                            <span className="text-[10px] font-semibold">
                              {msg.senderName}
                              <span className="text-muted-foreground font-normal ml-1">({roleLabels[msg.senderRole] || msg.senderRole})</span>
                            </span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {msg.createdAt ? format(new Date(msg.createdAt), "MMM d, h:mm a") : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="px-4 py-3 border-t border-border flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  maxLength={2000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && draft.trim() && !sendMutation.isPending) {
                      e.preventDefault();
                      sendMutation.mutate(draft.trim());
                    }
                  }}
                  data-testid={`input-dispute-chat-${orderId}`}
                />
                <Button
                  size="icon"
                  disabled={!draft.trim() || sendMutation.isPending}
                  onClick={() => sendMutation.mutate(draft.trim())}
                  data-testid={`button-send-dispute-${orderId}`}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EscrowBadge({ escrowStatus }: { escrowStatus: string }) {
  const configs: Record<string, { label: string; variant: string; icon: typeof Shield }> = {
    held: { label: "Funds in Escrow", variant: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: Lock },
    released: { label: "Funds Released", variant: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20", icon: CheckCircle2 },
    disputed: { label: "Under Review", variant: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: AlertTriangle },
    refunded: { label: "Refunded", variant: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20", icon: DollarSign },
  };

  const config = configs[escrowStatus];
  if (!config || escrowStatus === "none") return null;

  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.variant}`} data-testid={`badge-escrow-${escrowStatus}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function EscrowGuaranteeBanner() {
  return (
    <Card className="p-4 mb-8 bg-blue-500/5 border-blue-500/20" data-testid="escrow-guarantee-banner">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold text-sm">YARDEES Buyer & Seller Protection</h3>
          <div className="grid sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span>Payments held in secure escrow until delivery is confirmed</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span>Sellers protected with automatic fund release after 14 days</span>
            </div>
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span>Both parties can open a dispute if something goes wrong</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EscrowInfoPanel({ order, isBuyer, isSeller }: { order: OrderWithDetails; isBuyer: boolean; isSeller: boolean }) {
  if (order.escrowStatus === "none" || order.status === "pending") return null;

  const daysUntilAutoRelease = order.status === "shipped" && order.updatedAt
    ? Math.max(0, 14 - differenceInDays(new Date(), new Date(order.updatedAt)))
    : null;

  if (order.escrowStatus === "held") {
    return (
      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs space-y-1.5" data-testid={`escrow-info-${order.id}`}>
        <div className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
          <Lock className="w-3.5 h-3.5" />
          Escrow Protection Active
        </div>
        {isBuyer && order.status === "paid" && (
          <p className="text-muted-foreground">
            Your payment of <span className="font-semibold text-foreground">{formatAmount(order.amount, order.currency)}</span> is held securely.
            The seller has been notified to ship your item. You will not be charged until you confirm delivery.
          </p>
        )}
        {isBuyer && order.status === "shipped" && (
          <p className="text-muted-foreground">
            Your item has been shipped! Once you receive it, click "Confirm Delivery" to release payment to the seller.
            {daysUntilAutoRelease !== null && daysUntilAutoRelease > 0 && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                <Clock className="w-3 h-3 inline mr-1" />
                Funds auto-release in {daysUntilAutoRelease} day{daysUntilAutoRelease !== 1 ? "s" : ""} if not confirmed or disputed.
              </span>
            )}
          </p>
        )}
        {isSeller && order.status === "paid" && (
          <p className="text-muted-foreground">
            Payment of <span className="font-semibold text-foreground">{formatAmount(order.amount, order.currency)}</span> received and held in escrow.
            Ship the item and add tracking to proceed. Your payout of <span className="font-semibold text-foreground">{formatAmount(order.sellerPayout || (order.amount - Math.round(order.amount * 0.05)), order.currency)}</span> will be released once the buyer confirms delivery.
          </p>
        )}
        {isSeller && order.status === "shipped" && (
          <p className="text-muted-foreground">
            Item shipped! Waiting for buyer to confirm delivery.
            {daysUntilAutoRelease !== null && (
              <span className="block mt-1 text-green-600 dark:text-green-400">
                <Shield className="w-3 h-3 inline mr-1" />
                {daysUntilAutoRelease > 0
                  ? `Your payout auto-releases in ${daysUntilAutoRelease} day${daysUntilAutoRelease !== 1 ? "s" : ""} even if the buyer doesn't confirm.`
                  : "Your payout is being auto-released — funds will arrive shortly."
                }
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  if (order.escrowStatus === "released") {
    return (
      <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 text-xs" data-testid={`escrow-info-${order.id}`}>
        <div className="flex items-center gap-1.5 font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Transaction Complete
        </div>
        <p className="text-muted-foreground mt-1">
          {isSeller
            ? `Your payout of ${formatAmount(order.sellerPayout || (order.amount - Math.round(order.amount * 0.05)), order.currency)} has been released.`
            : "Payment has been released to the seller. Thank you for your purchase!"
          }
          {order.escrowReleaseDate && (
            <span className="ml-1">Released on {format(new Date(order.escrowReleaseDate), "MMM d, yyyy")}.</span>
          )}
        </p>
      </div>
    );
  }

  if (order.escrowStatus === "disputed") {
    return (
      <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs" data-testid={`escrow-info-${order.id}`}>
        <div className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Dispute Under Review
        </div>
        <p className="text-muted-foreground mt-1">
          Funds are frozen while our team reviews the dispute. We'll reach out to both parties to resolve this.
        </p>
        {order.disputeReason && (
          <p className="text-muted-foreground mt-1 italic border-t border-red-500/10 pt-1.5">
            Reason: "{order.disputeReason}"
          </p>
        )}
      </div>
    );
  }

  if (order.escrowStatus === "refunded") {
    return (
      <div className="rounded-md border border-gray-500/20 bg-gray-500/5 p-3 text-xs" data-testid={`escrow-info-${order.id}`}>
        <div className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400">
          <DollarSign className="w-3.5 h-3.5" />
          Refund Processed
        </div>
        <p className="text-muted-foreground mt-1">
          {isBuyer
            ? `A refund of ${formatAmount(order.amount, order.currency)} has been issued to your payment method.`
            : "The buyer has been refunded for this order."
          }
        </p>
      </div>
    );
  }

  return null;
}

export default function Orders() {
  const { t } = useTranslation();
  useOGMeta({ title: "My Orders", description: "Track your orders and shipping on YARDEES.", url: `${window.location.origin}/orders` });
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
    enabled: !!user,
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; [key: string]: any }) => {
      await apiRequest("PATCH", `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: t("orders.orderUpdated") });
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
          <p className="text-muted-foreground">{t("orders.pleaseLogIn")}</p>
          <Link href="/login">
            <Button className="mt-4" data-testid="button-login">{t("common.logIn")}</Button>
          </Link>
        </main>
      </div>
    );
  }

  const buying = orders?.filter(o => o.buyerId === user.id) || [];
  const selling = orders?.filter(o => o.sellerId === user.id) || [];
  const hasActiveOrders = orders && orders.some(o => o.escrowStatus === "held" || o.status === "pending");

  return (
    <div className="min-h-screen bg-background" data-testid="page-orders">
      <Navbar />
      <PageTransition>
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3 mb-2">
          <ShoppingBag className="w-8 h-8 text-primary" />
          {t("orders.title")}
        </h1>
        <p className="text-muted-foreground mb-8">{t("orders.subtitle")}</p>

        {hasActiveOrders && <EscrowGuaranteeBanner />}

        {isLoading ? (
          <InlineLoader />
        ) : !orders || orders.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-md border border-dashed border-border">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t("orders.noOrders")}</h3>
            <p className="text-muted-foreground">{t("orders.noOrdersDesc")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {buying.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  Purchases ({buying.length})
                </h2>
                <div className="space-y-4">
                  {buying.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      userId={user.id}
                      onUpdate={(data) => updateOrderMutation.mutate({ id: order.id, ...data })}
                      isPending={updateOrderMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
            {selling.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Sales ({selling.length})
                </h2>
                <div className="space-y-4">
                  {selling.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      userId={user.id}
                      onUpdate={(data) => updateOrderMutation.mutate({ id: order.id, ...data })}
                      isPending={updateOrderMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      </PageTransition>
    </div>
  );
}

function OrderCard({
  order,
  userId,
  onUpdate,
  isPending,
}: {
  order: OrderWithDetails;
  userId: string;
  onUpdate: (data: Record<string, any>) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isSeller = order.sellerId === userId;
  const isBuyer = order.buyerId === userId;
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || "");
  const [trackingCarrier, setTrackingCarrier] = useState(order.trackingCarrier || "");

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${order.id}/checkout`);
      return res.json();
    },
    onSuccess: (data: { checkoutUrl: string }) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (err: Error) => {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${order.id}/confirm-delivery`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Delivery confirmed! Funds released to seller." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${order.id}/dispute`, { reason: disputeReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Dispute filed", description: "We'll review and get back to both parties." });
      setDisputeDialogOpen(false);
      setDisputeReason("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const platformFee = order.platformFee || Math.round(order.amount * 0.05);
  const sellerPayout = order.sellerPayout || (order.amount - platformFee);

  const cardBorderClass =
    order.status === "pending" && isBuyer
      ? "border-amber-500/50 bg-amber-50/5"
      : order.escrowStatus === "disputed"
      ? "border-red-500/30 bg-red-50/5"
      : order.escrowStatus === "held"
      ? "border-blue-500/20"
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`p-5 ${cardBorderClass}`} data-testid={`card-order-${order.id}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/listing/${order.listingId}`}>
                  <span className="font-bold text-lg hover:underline cursor-pointer" data-testid={`text-order-title-${order.id}`}>
                    {order.listingTitle || `Listing #${order.listingId}`}
                  </span>
                </Link>
                <Badge variant="outline" className="text-xs capitalize">
                  {isSeller ? t("orders.selling") : t("orders.buying")}
                </Badge>
                <EscrowBadge escrowStatus={order.escrowStatus} />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1" data-testid={`text-order-amount-${order.id}`}>
                  <DollarSign className="w-4 h-4" />
                  <span className="text-foreground font-bold text-base">{formatAmount(order.amount, order.currency)}</span>
                </span>
                {isSeller && order.status !== "pending" && (
                  <span className="text-xs text-muted-foreground">
                    Your payout: <span className="font-semibold text-foreground">{formatAmount(sellerPayout, order.currency)}</span>
                    <span className="ml-1">(5% fee)</span>
                  </span>
                )}
                {isBuyer && order.status === "pending" && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Protected by escrow
                  </span>
                )}
                <span className="flex items-center gap-1" data-testid={`text-order-date-${order.id}`}>
                  <Calendar className="w-4 h-4" />
                  {order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy") : "N/A"}
                </span>
              </div>

              <PackageTracker order={order} />

              {order.status !== "pending" && (
                <div className="text-xs text-muted-foreground">
                  {isSeller ? `Buyer: ${order.buyerName || "Unknown"}` : `Seller: ${order.sellerName || "Unknown"}`}
                </div>
              )}

              {isSeller && order.shippingAddress && order.status !== "pending" && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40" data-testid={`shipping-address-${order.id}`}>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Ship To
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{order.shippingAddress}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1.5 h-7 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 gap-1 px-2"
                    onClick={() => {
                      navigator.clipboard.writeText(order.shippingAddress || "");
                      toast({ title: "Copied", description: "Shipping address copied to clipboard" });
                    }}
                    data-testid={`button-copy-address-${order.id}`}
                  >
                    Copy Address
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-start shrink-0">
              {isBuyer && order.status === "pending" && (
                <Button
                  size="default"
                  className="bg-green-600 hover:bg-green-700 text-white shadow-md gap-2 font-semibold"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                  data-testid={`button-pay-now-${order.id}`}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Pay Securely
                </Button>
              )}

              {isSeller && order.status === "paid" && (
                <Dialog open={trackingDialogOpen} onOpenChange={setTrackingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" data-testid={`button-add-tracking-${order.id}`}>
                      <Truck className="w-4 h-4 mr-2" />
                      {order.trackingNumber ? t("orders.updateTracking") : t("orders.addTracking")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("orders.shippingInfo")}</DialogTitle>
                      <DialogDescription>Add shipping details so the buyer can track their order. Funds will auto-release 14 days after shipping.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">{t("orders.carrier")}</label>
                        <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                          <SelectTrigger data-testid={`select-carrier-${order.id}`}>
                            <SelectValue placeholder={t("orders.selectCarrier")} />
                          </SelectTrigger>
                          <SelectContent>
                            {shippingCarriers.map((carrier) => (
                              <SelectItem key={carrier} value={carrier}>
                                {carrier}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">{t("orders.trackingNumber")}</label>
                        <Input
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder={t("orders.enterTrackingNumber")}
                          data-testid={`input-tracking-${order.id}`}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!trackingNumber || !trackingCarrier || isPending}
                        onClick={() => {
                          onUpdate({
                            trackingNumber,
                            trackingCarrier,
                            status: "shipped",
                          });
                          setTrackingDialogOpen(false);
                        }}
                        data-testid={`button-submit-tracking-${order.id}`}
                      >
                        {t("orders.saveAndMarkShipped")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {isBuyer && order.status === "shipped" && order.escrowStatus === "held" && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 gap-2"
                  onClick={() => confirmDeliveryMutation.mutate()}
                  disabled={confirmDeliveryMutation.isPending}
                  data-testid={`button-confirm-delivery-${order.id}`}
                >
                  {confirmDeliveryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm Delivery
                </Button>
              )}

              {(isBuyer || isSeller) && (order.status === "paid" || order.status === "shipped") && order.escrowStatus === "held" && (
                <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-muted-foreground text-xs" data-testid={`button-dispute-${order.id}`}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      Report Issue
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report an Issue</DialogTitle>
                      <DialogDescription>
                        Filing a dispute will freeze the escrow funds while our team reviews the case.
                        Both buyer and seller will be contacted to resolve the issue fairly.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Please try to resolve the issue directly with the {isBuyer ? "seller" : "buyer"} via messages first. Disputes should be a last resort.</span>
                      </div>
                      <Textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Describe the issue in detail (at least 10 characters)..."
                        rows={4}
                        data-testid={`input-dispute-reason-${order.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {disputeReason.trim().length}/10 characters minimum
                      </p>
                      <Button
                        className="w-full"
                        variant="destructive"
                        disabled={disputeReason.trim().length < 10 || disputeMutation.isPending}
                        onClick={() => disputeMutation.mutate()}
                        data-testid={`button-submit-dispute-${order.id}`}
                      >
                        {disputeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Submit Dispute
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <EscrowInfoPanel order={order} isBuyer={isBuyer} isSeller={isSeller} />

          {order.escrowStatus === "disputed" && userId && (
            <DisputeChat orderId={order.id} userId={userId} />
          )}

          <StatusTimeline status={order.status} />
        </div>
      </Card>
    </motion.div>
  );
}
