import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ThumbsUp, Plus, MessageSquare, Tag, TrendingUp, Award } from "lucide-react";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { CommunityTip } from "@shared/schema";

const tipCategories = [
  { value: "general", label: "General", icon: Lightbulb },
  { value: "selling", label: "Selling Tips", icon: TrendingUp },
  { value: "buying", label: "Buying Tips", icon: Tag },
  { value: "pricing", label: "Pricing", icon: Award },
  { value: "shipping", label: "Shipping", icon: MessageSquare },
];

export default function CommunityTipsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useOGMeta({ title: "Community Tips", description: "Share and discover tips from the YARDEES community." });

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [filterCategory, setFilterCategory] = useState("all");

  const { data: tips, isLoading } = useQuery<CommunityTip[]>({
    queryKey: ["/api/tips", filterCategory],
    queryFn: async () => {
      const res = await fetch(`/api/tips?category=${filterCategory}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tips", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips"] });
      setShowForm(false);
      setTitle("");
      setContent("");
      setCategory("general");
      toast({ title: t("tips.shared", "Tip shared with the community!") });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (tipId: number) => {
      const res = await apiRequest("POST", `/api/tips/${tipId}/vote`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tips"] });
    },
  });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Lightbulb className="w-6 h-6 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("tips.title", "Community Tips")}</h1>
              </div>
              <p className="text-muted-foreground/60 text-sm">{t("tips.subtitle", "Share and discover tips from fellow thrift shoppers")}</p>
            </div>
            {user && (
              <Button onClick={() => setShowForm(!showForm)} className="gap-1.5" data-testid="button-share-tip">
                <Plus className="w-4 h-4" /> {t("tips.share", "Share Tip")}
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6">
                <Card className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">{t("tips.tipTitle", "Title")}</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("tips.titlePlaceholder", "What's your tip about?")}
                      data-testid="input-tip-title"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">{t("tips.content", "Your Tip")}</label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={t("tips.contentPlaceholder", "Share your knowledge with the community...")}
                      rows={4}
                      data-testid="input-tip-content"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block">{t("tips.category", "Category")}</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="select-tip-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {tipCategories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
                    <Button
                      onClick={() => createMutation.mutate({ title, content, category })}
                      disabled={!title.trim() || !content.trim() || createMutation.isPending}
                      data-testid="button-submit-tip"
                    >
                      {createMutation.isPending ? t("common.saving", "Saving...") : t("tips.post", "Post Tip")}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            <Button
              variant={filterCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory("all")}
              className="text-xs"
            >
              All
            </Button>
            {tipCategories.map(c => (
              <Button
                key={c.value}
                variant={filterCategory === c.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory(c.value)}
                className="text-xs gap-1"
              >
                <c.icon className="w-3 h-3" /> {c.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : !tips?.length ? (
            <Card className="p-12 text-center">
              <Lightbulb className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <h3 className="font-display font-bold text-lg mb-1">{t("tips.noTips", "No tips yet")}</h3>
              <p className="text-sm text-muted-foreground/50">{t("tips.beFirst", "Be the first to share a tip!")}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {tips.map((tip, idx) => {
                const catInfo = tipCategories.find(c => c.value === tip.category);
                const CatIcon = catInfo?.icon || Lightbulb;
                return (
                  <motion.div
                    key={tip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card className="p-4" data-testid={`card-tip-${tip.id}`}>
                      <div className="flex gap-3">
                        <button
                          onClick={() => voteMutation.mutate(tip.id)}
                          className="flex flex-col items-center gap-0.5 pt-1"
                          data-testid={`button-vote-${tip.id}`}
                        >
                          <ThumbsUp className="w-5 h-5 text-muted-foreground/40 hover:text-primary transition-colors" />
                          <span className="text-xs font-bold text-muted-foreground/50">{tip.upvotes}</span>
                        </button>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-display font-semibold text-sm">{tip.title}</h3>
                            {tip.isFeatured && (
                              <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px] gap-0.5">
                                <Award className="w-2.5 h-2.5" /> Featured
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground/60 whitespace-pre-line">{tip.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <CatIcon className="w-2.5 h-2.5" /> {catInfo?.label || tip.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/30">
                              {tip.createdAt ? new Date(tip.createdAt).toLocaleDateString() : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
