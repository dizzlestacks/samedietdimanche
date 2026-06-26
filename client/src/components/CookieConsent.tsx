import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { Link } from "wouter";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("yardees-cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("yardees-cookie-consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("yardees-cookie-consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] p-4 md:p-6 animate-in slide-in-from-bottom-5 duration-500"
      data-testid="cookie-consent-banner"
    >
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-6 h-6 text-primary shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium mb-1">We value your privacy</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            YARDEES uses cookies and similar technologies to improve your experience, analyze site traffic, and serve personalized ads. By clicking "Accept All", you consent to our use of cookies. Read our{" "}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>{" "}
            for more information.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={decline}
            className="flex-1 sm:flex-none text-xs"
            data-testid="button-cookie-decline"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="flex-1 sm:flex-none text-xs"
            data-testid="button-cookie-accept"
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
