import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { CheckCircle, Zap } from "lucide-react";
import { InlineLoader } from "@/components/PageLoader";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export default function BoostSuccess() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"confirming" | "success" | "error">("confirming");
  const [listingId, setListingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lid = Number(params.get("listingId"));
    const sessionId = params.get("session_id");

    setListingId(lid || null);

    if (!lid || !sessionId) {
      setStatus("error");
      setErrorMessage(!lid ? "Missing listing ID" : "Missing session ID");
      return;
    }

    fetch(`/api/listings/${lid}/boost/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      credentials: "include",
    })
      .then(async (r) => {
        if (r.ok) {
          setStatus("success");
          qc.invalidateQueries({ queryKey: ["/api/listings", lid] });
          qc.invalidateQueries({ queryKey: ["/api/listings"] });
        } else {
          const data = await r.json().catch(() => ({}));
          setStatus("error");
          setErrorMessage(data.message || "Boost confirmation failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Network error during confirmation");
      });
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
        {status === "confirming" && (
          <>
            <div className="mb-6"><InlineLoader /></div>
            <h2 className="text-2xl font-display font-bold gradient-text mb-2">{t("boost.confirmingBoost")}</h2>
            <p className="text-muted-foreground">{t("boost.pleaseWait")}</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold gradient-text mb-2">{t("boost.boostSuccessTitle")}</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              {t("boost.boostSuccessMessage")}
            </p>
            <div className="flex gap-3">
              {listingId && (
                <Link href={`/listing/${listingId}`}>
                  <Button size="lg" className="gap-2" data-testid="button-view-boosted-listing">
                    <Zap className="w-4 h-4" /> {t("boost.viewListing")}
                  </Button>
                </Link>
              )}
              <Link href="/">
                <Button variant="outline" size="lg" data-testid="button-browse-more">{t("boost.browseMore")}</Button>
              </Link>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <Zap className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-3xl font-display font-bold gradient-text mb-2">{t("boost.somethingWentWrong")}</h2>
            <p className="text-muted-foreground mb-4">{t("boost.couldntConfirm")}</p>
            {errorMessage && (
              <p className="text-sm text-muted-foreground/70 mb-8">{errorMessage}</p>
            )}
            <div className="flex gap-3">
              {listingId && (
                <Link href={`/listing/${listingId}`}>
                  <Button variant="outline" size="lg" data-testid="button-back-to-listing">
                    Back to listing
                  </Button>
                </Link>
              )}
              <Link href="/">
                <Button variant="outline" size="lg" data-testid="button-go-home">{t("common.goHome")}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
