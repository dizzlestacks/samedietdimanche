import { WifiOff, Wifi, Database } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { getCachedListingCount, getLastCachedTime } from "@/lib/offlineStorage";

export default function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);
  const [lastCached, setLastCached] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      getCachedListingCount().then(setCachedCount);
      getLastCachedTime().then((ts) => {
        if (ts) {
          const diff = Date.now() - ts;
          const mins = Math.floor(diff / 60000);
          const hours = Math.floor(diff / 3600000);
          if (hours > 0) setLastCached(`${hours}h ago`);
          else if (mins > 0) setLastCached(`${mins}m ago`);
          else setLastCached("just now");
        }
      });
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
        isOnline
          ? "bg-green-600 text-white"
          : "bg-amber-500 text-amber-950"
      }`}
      data-testid="banner-offline-status"
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          {t("offline.backOnline")}
        </>
      ) : (
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>{t("offline.browsing")}</span>
          {cachedCount > 0 && (
            <span className="flex items-center gap-1 bg-amber-600/30 rounded-full px-2.5 py-0.5 text-xs">
              <Database className="w-3 h-3" />
              {cachedCount} {t("offline.cachedListings")}{lastCached ? ` · ${lastCached}` : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
