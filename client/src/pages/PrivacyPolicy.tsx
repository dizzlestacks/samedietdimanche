import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  useOGMeta({
    title: "Privacy Policy",
    description: "Learn how Yardees collects, uses, and protects your personal information.",
    url: `${window.location.origin}/privacy`,
  });

  return (
    <div className="min-h-screen bg-background" data-testid="page-privacy">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2" data-testid="link-privacy-back">
              <ArrowLeft className="w-4 h-4" />
              {t("common.back")}
            </Button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-2" data-testid="text-privacy-title">{t("legal.privacyPolicy")}</h1>
        <p className="text-sm text-muted-foreground mb-8" data-testid="text-privacy-updated">{t("legal.lastUpdated", { date: "January 1, 2025" })}</p>

        <div className="prose dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. {t("legal.privacy.infoCollectTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.infoCollectText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. {t("legal.privacy.howWeUseTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.howWeUseText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. {t("legal.privacy.sharingTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.sharingText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. {t("legal.privacy.cookiesTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.cookiesText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. {t("legal.privacy.dataSecurityTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.dataSecurityText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. {t("legal.privacy.yourRightsTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.yourRightsText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. {t("legal.privacy.retentionTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.retentionText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. {t("legal.privacy.childrenTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.childrenText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. {t("legal.privacy.changesTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.changesText")}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. {t("legal.privacy.contactTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("legal.privacy.contactText")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}