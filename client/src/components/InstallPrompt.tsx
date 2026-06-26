import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("yardees_install_dismissed");
      if (dismissed) {
        const dismissedAt = parseInt(dismissed, 10);
        if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
      }
    } catch { /* localStorage unavailable */ }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    if (isStandalone) return;

    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS);

    if (isiOS) {
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
      if (isSafari) {
        setTimeout(() => setShowBanner(true), 3000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    try { localStorage.setItem("yardees_install_dismissed", Date.now().toString()); } catch { /* ignore */ }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[env(safe-area-inset-bottom,16px)]" data-testid="install-prompt">
      <div className="mx-auto max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        {showIOSGuide ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{t("pwa.addToHomeScreen")}</h3>
              <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600" data-testid="button-dismiss-ios-guide">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-2 pl-4 list-decimal">
              <li>{t("pwa.iosStep1")}</li>
              <li>{t("pwa.iosStep2")}</li>
              <li>{t("pwa.iosStep3")}</li>
            </ol>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{t("pwa.getTheApp")}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t("pwa.installDescription")}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-xs px-2" data-testid="button-dismiss-install">
                {t("pwa.notNow")}
              </Button>
              <Button size="sm" onClick={handleInstall} className="text-xs px-3 bg-green-600 hover:bg-green-700" data-testid="button-install-app">
                <Download className="w-3.5 h-3.5 mr-1" />
                {t("pwa.install")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
