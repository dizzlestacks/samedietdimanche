import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { ListingCard } from "@/components/ListingCard";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import type { Collection, Listing } from "@shared/schema";

function CollectionCard({ collection }: { collection: Collection }) {
  const { t, i18n } = useTranslation();
  const name = t(`collections.${collection.slug}`, collection.name);
  const description = t(`collections.${collection.slug}-desc`, collection.description || "");
  const locale = i18n.language || "en";
  return (
    <Link href={`/collections/${collection.slug}`}>
      <motion.div
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        className="group cursor-pointer"
        data-testid={`card-collection-${collection.slug}`}
      >
        <div className="listing-card-shell overflow-hidden h-full flex flex-col">
          {collection.coverImage ? (
            <div className="aspect-[2/1] w-full relative overflow-hidden">
              <img src={collection.coverImage} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="font-display font-bold text-white text-lg leading-snug">{collection.emoji} {name}</h3>
              </div>
            </div>
          ) : (
            <div className="aspect-[2/1] w-full relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <span className="text-5xl">{collection.emoji || "📦"}</span>
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="font-display font-bold text-foreground text-lg leading-snug">{name}</h3>
              </div>
            </div>
          )}
          <div className="p-3.5 flex-grow">
            <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">{description}</p>
            {collection.startDate && collection.endDate && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/40">
                <Clock className="w-2.5 h-2.5" />
                <span>
                  {new Date(collection.startDate).toLocaleDateString(locale, { month: "short", day: "numeric" })} — {new Date(collection.endDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                </span>
              </div>
            )}
          </div>
          <div className="px-3.5 pb-3 flex items-center text-xs text-primary font-semibold">
            {t("collections.browseCollection", "Browse collection")} <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function CollectionsIndex() {
  const { t } = useTranslation();
  useOGMeta({ title: "Seasonal Collections", description: "Browse curated seasonal collections on YARDEES." });
  const { data: allCollections, isLoading } = useQuery<Collection[]>({ queryKey: ["/api/collections"] });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("collections.title", "Seasonal Collections")}</h1>
          </div>
          <p className="text-muted-foreground/60 text-sm">{t("collections.subtitle", "Curated picks for every season and occasion")}</p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : !allCollections?.length ? (
          <div className="text-center py-20 text-muted-foreground/40">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-display font-semibold">No collections available right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {allCollections.map((collection, i) => (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <CollectionCard collection={collection} />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CollectionDetail() {
  const [, params] = useRoute("/collections/:slug");
  const slug = params?.slug || "";
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";

  const { data, isLoading } = useQuery<{ collection: Collection; listings: Listing[] }>({
    queryKey: ["/api/collections", slug],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const collectionName = data?.collection ? t(`collections.${data.collection.slug}`, data.collection.name) : "";
  const collectionDesc = data?.collection ? t(`collections.${data.collection.slug}-desc`, data.collection.description || "") : "";

  useOGMeta({
    title: collectionName || "Collection",
    description: collectionDesc || "Browse this curated collection on YARDEES.",
  });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/collections">
          <Button variant="ghost" size="sm" className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground" data-testid="button-back-collections">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("common.back", "Back")}
          </Button>
        </Link>

        {isLoading ? (
          <>
            <Skeleton className="h-10 w-64 mb-3" />
            <Skeleton className="h-5 w-96 mb-8" />
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
            </div>
          </>
        ) : !data ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">{t("collections.notFound", "Collection not found")}</p>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text mb-2">
                {data.collection.emoji} {collectionName}
              </h1>
              <p className="text-muted-foreground/60 text-sm max-w-2xl">{collectionDesc}</p>
              {data.collection.startDate && data.collection.endDate && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground/40">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(data.collection.startDate).toLocaleDateString(locale, { month: "long", day: "numeric" })} — {new Date(data.collection.endDate).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
            </motion.div>

            {data.listings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground/40">
                <p className="font-display font-semibold">{t("collections.noItems", "No items in this collection yet")}</p>
                <p className="text-xs mt-1">{t("collections.checkBack", "Check back soon for new additions!")}</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground/35 tracking-wide mb-4">{data.listings.length} items</p>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {data.listings.map((listing: any, i: number) => (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.04 }}
                    >
                      <ListingCard listing={listing} />
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function CollectionsPage() {
  const [isDetail] = useRoute("/collections/:slug");
  return isDetail ? <CollectionDetail /> : <CollectionsIndex />;
}
