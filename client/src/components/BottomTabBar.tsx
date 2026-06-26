import { Link, useLocation } from "wouter";
import { Home, Search, PlusCircle, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";
import { useTranslation } from "react-i18next";

interface TabItem {
  path: string;
  icon: typeof Home;
  labelKey: string;
  badge?: number;
  requiresAuth?: boolean;
  authFallback?: string;
}

export function BottomTabBar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { t } = useTranslation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: notifCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadMessages = (unreadData as any)?.messageCount ?? unreadData?.count ?? 0;
  const unreadNotifs = notifCountData?.count ?? 0;
  const combinedBadge = unreadMessages + unreadNotifs;

  const tabs: TabItem[] = [
    { path: "/", icon: Home, labelKey: "nav.home" },
    { path: "/explore", icon: Search, labelKey: "nav.explore" },
    { path: "/create", icon: PlusCircle, labelKey: "nav.sell", requiresAuth: true, authFallback: "/login" },
    { path: "/messages", icon: MessageSquare, labelKey: "nav.messages", badge: combinedBadge, requiresAuth: true, authFallback: "/login" },
    { path: "/dashboard", icon: User, labelKey: "nav.profile", requiresAuth: true, authFallback: "/login" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  const hiddenRoutes = ["/welcome", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/admin"];
  if (hiddenRoutes.some(r => location.startsWith(r))) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden" data-testid="bottom-tab-bar">
      <div className="bg-background/95 backdrop-blur-xl border-t border-border/30 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_-2px_12px_rgba(0,0,0,0.2)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-14 px-1">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const href = tab.requiresAuth && !user ? (tab.authFallback || "/login") : tab.path;
            const Icon = tab.icon;

            return (
              <Link
                key={tab.path}
                href={href}
                className="relative flex flex-col items-center justify-center flex-1 h-full"
                onClick={() => triggerHaptic("light")}
                data-testid={`tab-${tab.labelKey.split('.').pop()}`}
              >
                <div className="relative flex flex-col items-center gap-0.5">
                  {active && (
                    <motion.div
                      layoutId="bottomTabIndicator"
                      className="absolute -top-1.5 w-5 h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    {tab.path === "/create" ? (
                      <div className={`p-1.5 rounded-full ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                      </div>
                    ) : (
                      <Icon
                        className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                        strokeWidth={active ? 2.5 : 1.5}
                      />
                    )}
                    {tab.badge && tab.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 text-[10px] font-bold leading-4 text-center text-primary-foreground bg-primary rounded-full">
                        {tab.badge > 99 ? "99+" : tab.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className={`text-[10px] leading-tight font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {t(tab.labelKey, tab.labelKey.split('.').pop() ?? tab.labelKey)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
