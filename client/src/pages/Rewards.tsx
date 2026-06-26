import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Trophy, Star, Gift, Zap, ArrowUp, Clock, ShoppingBag, MessageSquare, Award } from "lucide-react";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LoyaltyPoints, LoyaltyTransaction } from "@shared/schema";

const tierColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  bronze: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700", icon: "text-orange-500" },
  silver: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-700 dark:text-gray-300", border: "border-gray-300 dark:border-gray-600", icon: "text-gray-400" },
  gold: { bg: "bg-yellow-50 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-400 dark:border-yellow-700", icon: "text-yellow-500" },
  platinum: { bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-400 dark:border-purple-700", icon: "text-purple-500" },
};

const tierThresholds = [
  { name: "Bronze", min: 0, icon: "🥉" },
  { name: "Silver", min: 500, icon: "🥈" },
  { name: "Gold", min: 2000, icon: "🥇" },
  { name: "Platinum", min: 5000, icon: "💎" },
];

const typeIcons: Record<string, any> = {
  daily_login: Zap,
  listing_created: ShoppingBag,
  listing_sold: Gift,
  purchase_made: ShoppingBag,
  review_written: MessageSquare,
  referral: Star,
  first_listing: Award,
};

export default function RewardsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useOGMeta({ title: "Rewards", description: "Earn points and unlock rewards on YARDEES." });

  const { data, isLoading } = useQuery<LoyaltyPoints & { transactions: LoyaltyTransaction[] }>({
    queryKey: ["/api/loyalty"],
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/loyalty/claim-daily");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loyalty"] });
      toast({ title: `+${data.points} points!`, description: "Daily login bonus claimed" });
    },
    onError: () => {
      toast({ title: "Already claimed today", variant: "destructive" });
    },
  });

  const currentTier = data?.tier || "bronze";
  const colors = tierColors[currentTier];
  const currentTierIdx = tierThresholds.findIndex(t => t.name.toLowerCase() === currentTier);
  const nextTier = tierThresholds[currentTierIdx + 1];
  const progress = nextTier
    ? ((data?.lifetimePoints || 0) - tierThresholds[currentTierIdx].min) / (nextTier.min - tierThresholds[currentTierIdx].min) * 100
    : 100;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("rewards.title", "Rewards")}</h1>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : (
            <>
              <Card className={`p-6 mb-6 ${colors.bg} ${colors.border} border-2`} data-testid="card-rewards-summary">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">{t("rewards.yourTier", "Your Tier")}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{tierThresholds[currentTierIdx]?.icon}</span>
                      <h2 className={`text-2xl font-display font-bold capitalize ${colors.text}`}>{currentTier}</h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">{t("rewards.points", "Points")}</p>
                    <p className={`text-3xl font-display font-bold ${colors.text}`} data-testid="text-total-points">
                      {(data?.points || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                {nextTier && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground/50 mb-1">
                      <span>{tierThresholds[currentTierIdx]?.name}</span>
                      <span>{nextTier.name} ({nextTier.min.toLocaleString()} pts)</span>
                    </div>
                    <div className="h-2 rounded-full bg-background/40 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${currentTier === "bronze" ? "bg-orange-400" : currentTier === "silver" ? "bg-gray-400" : "bg-yellow-400"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground/40 mt-1 flex items-center gap-1">
                      <ArrowUp className="w-3 h-3" /> {nextTier.min - (data?.lifetimePoints || 0)} more points to {nextTier.name}
                    </p>
                  </div>
                )}
              </Card>

              <Card className="p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-sm">{t("rewards.dailyBonus", "Daily Login Bonus")}</h3>
                    <p className="text-xs text-muted-foreground/50">+5 points every day you visit</p>
                  </div>
                  <Button
                    onClick={() => claimMutation.mutate()}
                    disabled={claimMutation.isPending}
                    variant="outline"
                    className="gap-1.5"
                    data-testid="button-claim-daily"
                  >
                    <Zap className="w-4 h-4" /> {t("rewards.claim", "Claim")}
                  </Button>
                </div>
              </Card>

              <Card className="p-4 mb-6">
                <h3 className="font-display font-semibold text-sm mb-3">{t("rewards.howToEarn", "How to Earn Points")}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <Zap className="w-3.5 h-3.5 text-yellow-500" /> Daily login: +5 pts
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-500" /> Create listing: +10 pts
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <Gift className="w-3.5 h-3.5 text-green-500" /> Sell an item: +50 pts
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-500" /> Make purchase: +25 pts
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <MessageSquare className="w-3.5 h-3.5 text-orange-500" /> Write review: +15 pts
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <Star className="w-3.5 h-3.5 text-pink-500" /> Referral: +100 pts
                  </div>
                </div>
              </Card>

              {data?.transactions && data.transactions.length > 0 && (
                <div>
                  <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {t("rewards.history", "Recent Activity")}
                  </h3>
                  <div className="space-y-2">
                    {data.transactions.map((tx, i) => {
                      const Icon = typeIcons[tx.type] || Star;
                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg"
                          data-testid={`tx-${tx.id}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium truncate">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground/40">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                            </p>
                          </div>
                          <span className={`text-sm font-bold ${tx.points > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                            {tx.points > 0 ? "+" : ""}{tx.points}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
