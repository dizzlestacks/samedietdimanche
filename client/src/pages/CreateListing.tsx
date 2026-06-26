import { Navbar } from "@/components/Navbar";
import { ListingForm } from "@/components/ListingForm";
import { useCreateListing } from "@/hooks/use-listings";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function CreateListing() {
  const { t } = useTranslation();
  useOGMeta({ title: "Create Listing", description: "Post a new listing on YARDEES marketplace.", url: `${window.location.origin}/create-listing` });
  const { mutate: createListing, isPending } = useCreateListing();
  const { user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const prefill = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      title: params.get("prefill_title") || undefined,
      description: params.get("prefill_description") || undefined,
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, isLoading]);

  if (isLoading || !user) return null;

  const handleSubmit = (data: any) => {
    createListing(data, {
      onSuccess: () => {
        setLocation("/dashboard");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-3xl font-display font-bold gradient-text">{t("form.postNewListing")}</h1>
            <p className="text-muted-foreground mt-2">{t("form.postNewListingSubtitle")}</p>
          </div>

          <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border p-6 md:p-10">
            <ListingForm 
              onSubmit={handleSubmit} 
              isPending={isPending}
              prefill={prefill}
            />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
