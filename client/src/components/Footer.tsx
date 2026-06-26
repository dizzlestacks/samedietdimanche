import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
const logoSrc = "/yardees-logo.png";
import { FeedbackDialog } from "./FeedbackDialog";

export function Footer() {
  const { t } = useTranslation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-border/30 mt-auto" data-testid="footer">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-3">
              <img src={logoSrc} alt="Yardees" className="h-10 w-auto opacity-90" data-testid="img-footer-logo" />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {t("footer.tagline")}
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-md"
                onClick={() => setFeedbackOpen(true)}
                data-testid="button-feedback"
              >
                <MessageCircle className="w-4 h-4" />
                {t("footer.feedbackButton")}
              </Button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border/20 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-about">
                About
              </Link>
              <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-contact">
                Contact Us
              </Link>
              <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-terms">
                {t("footer.termsOfService")}
              </Link>
              <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                {t("footer.privacyPolicy")}
              </Link>
              <Link href="/help" className="text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-help">
                {t("footer.helpCenter", "Help Center")}
              </Link>
              <a href="mailto:support@yardees.net" className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1" data-testid="link-footer-support-email">
                <Mail className="w-3 h-3" />
                support@yardees.net
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Yardees. {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
