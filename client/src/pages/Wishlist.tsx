import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Plus, Trash2, Tag, DollarSign, Search, Sparkles } from "lucide-react";
import { categories, type Wishlist } from "@shared/schema";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";

export default function WishlistPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useOGMeta({ title: "My Wishlist", description: "Items you're looking for on YARDEES." });

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [keywords, setKeywords] = useState("");

  const { data: items, isLoading } = useQuery<Wishlist[]>({ queryKey: ["/api/wishlists"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/wishlists", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlists"] });
      setShowForm(false);
      setTitle("");
      setDescription("");
      setCategory("");
      setMaxPrice("");
      setKeywords("");
      toast({ title: t("wishlist.added", "Wishlist item added! We'll notify you when we find a match.") });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/wishlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlists"] });
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      maxPrice: maxPrice ? Math.round(parseFloat(maxPrice) * 100) : undefined,
      keywords: keywords.trim() ? keywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
      isActive: true,
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Heart className="w-6 h-6 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("wishlist.title", "My Wishlist")}</h1>
              </div>
              <p className="text-muted-foreground/60 text-sm">{t("wishlist.subtitle", "Tell us what you're looking for — we'll notify you when it appears")}</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="gap-1.5" data-testid="button-add-wishlist">
              <Plus className="w-4 h-4" /> {t("wishlist.addItem", "Add Item")}
            </Button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">{t("wishlist.whatLookingFor", "What are you looking for?")}</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("wishlist.titlePlaceholder", 'e.g. "Vintage leather jacket" or "Nintendo Switch"')}
                    data-testid="input-wishlist-title"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">{t("wishlist.details", "Details")} <span className="text-muted-foreground/50 font-normal">({t("common.optional")})</span></label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("wishlist.descPlaceholder", "Describe what you're looking for in more detail...")}
                    rows={2}
                    data-testid="input-wishlist-desc"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block flex items-center gap-1"><Tag className="w-3 h-3" /> {t("form.category")}</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="select-wishlist-category"><SelectValue placeholder={t("home.allCategories")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">{t("home.allCategories")}</SelectItem>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block flex items-center gap-1"><DollarSign className="w-3 h-3" /> {t("wishlist.maxBudget", "Max Budget")}</label>
                    <Input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="$0.00"
                      step="0.01"
                      min="0"
                      data-testid="input-wishlist-maxprice"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block flex items-center gap-1"><Search className="w-3 h-3" /> {t("wishlist.keywords", "Keywords")}</label>
                  <Input
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder={t("wishlist.keywordsPlaceholder", "leather, brown, size M (comma separated)")}
                    data-testid="input-wishlist-keywords"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
                  <Button onClick={handleCreate} disabled={!title.trim() || createMutation.isPending} data-testid="button-save-wishlist">
                    {createMutation.isPending ? t("common.saving", "Saving...") : t("wishlist.save", "Save")}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : !items?.length ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <h3 className="font-display font-bold text-lg mb-1">{t("wishlist.empty", "No wishlist items yet")}</h3>
            <p className="text-muted-foreground/50 text-sm mb-4">{t("wishlist.emptyDesc", "Add items you're looking for and we'll alert you when they're listed")}</p>
            <Button onClick={() => setShowForm(true)} variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" /> {t("wishlist.addFirst", "Add your first item")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="p-4 flex items-start gap-4" data-testid={`card-wishlist-${item.id}`}>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-display font-semibold text-sm">{item.title}</h3>
                    {item.description && <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-1">{item.description}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item.category}</span>
                      )}
                      {item.maxPrice && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          Max ${(item.maxPrice / 100).toFixed(2)}
                        </span>
                      )}
                      {item.keywords?.map(kw => (
                        <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground/60">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground/30 hover:text-destructive flex-shrink-0"
                    onClick={() => deleteMutation.mutate(item.id)}
                    data-testid={`button-delete-wishlist-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
