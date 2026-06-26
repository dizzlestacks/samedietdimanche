import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageLoader";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import type { Notification } from "@shared/schema";

export default function Notifications() {
  const { t } = useTranslation();
  useOGMeta({ title: "Notifications", description: "Your notifications on YARDEES.", url: `${window.location.origin}/notifications` });
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t("nav.justNow", "Just now");
    if (diffMins < 60) return t("nav.minutesAgo", "{{count}}m ago", { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t("nav.hoursAgo", "{{count}}h ago", { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t("nav.daysAgo", "{{count}}d ago", { count: diffDays });
    return d.toLocaleDateString();
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="container mx-auto px-4 py-16 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-xl font-bold gradient-text mb-2">{t("nav.notifications")}</h2>
          <p className="text-muted-foreground text-sm mb-4">{t("auth.loginRequired", "Please log in to view notifications.")}</p>
          <Button onClick={() => navigate("/login")} data-testid="button-login-notifications">
            {t("auth.logIn")}
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <PageTransition>
        <main className="container mx-auto px-4 py-8 flex-grow max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold gradient-text flex items-center gap-2" data-testid="text-notifications-title">
                <Bell className="w-6 h-6 text-primary" />
                {t("nav.notifications")}
              </h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {unreadCount} unread
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <Check className="w-3 h-3" />
                {t("nav.markAllRead")}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-1/3" />
                </Card>
              ))}
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="text-center py-16 bg-muted/20 rounded-lg border border-dashed border-border">
              <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">{t("nav.noNotifications")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("nav.noNotificationsDesc", "You're all caught up! Notifications will appear here.")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notif => (
                <Card
                  key={notif.id}
                  className={`p-4 cursor-pointer transition-colors hover:bg-muted/30 ${!notif.isRead ? "bg-primary/5 border-primary/20" : ""}`}
                  onClick={() => handleNotifClick(notif)}
                  data-testid={`card-notif-${notif.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.isRead ? "font-semibold" : ""}`} data-testid={`text-notif-title-${notif.id}`}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-notif-body-${notif.id}`}>
                          {notif.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTime(notif.createdAt || new Date())}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      {notif.link && <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />}
                      {!notif.isRead && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
