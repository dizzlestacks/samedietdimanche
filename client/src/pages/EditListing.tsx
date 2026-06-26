import { Navbar } from "@/components/Navbar";
import { ListingForm } from "@/components/ListingForm";
import { useUpdateListing, useListing } from "@/hooks/use-listings";
import { useAuth } from "@/hooks/use-auth";
import { useRoute, useLocation } from "wouter";
import { useEffect } from "react";
import { InlineLoader } from "@/components/PageLoader";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function EditListing() {
  const { t } = useTranslation();
  useOGMeta({ title: "Edit Listing", description: "Update your listing on YARDEES marketplace." });
  const [match, params] = useRoute("/edit/:id");
  const id = parseInt(params?.id || "0");
  
  const { data: listing, isLoading: isListingLoading } = useListing(id);
  const { mutate: updateListing, isPending } = useUpdateListing();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (listing && user && listing.userId !== user.id) {
      setLocation("/");
    }
  }, [listing, user, setLocation]);

  if (isAuthLoading || isListingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <InlineLoader />
      </div>
    );
  }

  if (!listing) return null;

  const handleSubmit = (data: any) => {
    updateListing({ id, ...data }, {
      onSuccess: () => {
        setLocation("/dashboard");
      }
    });
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold gradient-text">{t("form.editListing")}</h1>
          <p className="text-muted-foreground mt-2">{t("form.updateDetailsFor", { title: listing.title })}</p>
        </div>

        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border p-6 md:p-10">
          <ListingForm 
            defaultValues={listing as any}
            onSubmit={handleSubmit} 
            isPending={isPending} 
          />
        </div>
      </main>
    </div>
  );
}
