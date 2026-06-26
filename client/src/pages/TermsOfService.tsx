import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function TermsOfService() {
  const { t } = useTranslation();
  useOGMeta({
    title: "Terms of Service",
    description: "Read the Yardees Terms of Service governing your use of our marketplace platform.",
    url: `${window.location.origin}/terms`,
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-terms">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2" data-testid="link-terms-back">
              <ArrowLeft className="w-4 h-4" />
              {t("common.back")}
            </Button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2" data-testid="text-terms-title">{t("legal.termsOfService")}</h1>
        <p className="text-sm text-muted-foreground mb-8" data-testid="text-terms-updated">{t("legal.lastUpdated", { date: "January 1, 2025" })}</p>

        <div className="prose dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. {t("legal.tos.acceptanceTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.acceptanceText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. {t("legal.tos.eligibilityTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.eligibilityText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. {t("legal.tos.accountsTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.accountsText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. {t("legal.tos.listingsTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.listingsText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. {t("legal.tos.transactionsTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.transactionsText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. {t("legal.tos.prohibitedTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.prohibitedText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. {t("legal.tos.intellectualPropertyTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.intellectualPropertyText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. {t("legal.tos.limitationTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.limitationText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. {t("legal.tos.terminationTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.terminationText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. {t("legal.tos.changesTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.changesText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. {t("legal.tos.contactTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.tos.contactText")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}