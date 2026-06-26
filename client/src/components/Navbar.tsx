import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { 
  PlusCircle, 
  LogOut, 
  Menu, 
  X,
  Sun,
  Moon,
  MessageSquare,
  Store,
  ShieldCheck,
  Calendar,
  BarChart3,
  HandshakeIcon,
  Package,
  Heart,
  Trophy,
  Camera,

  Lightbulb,
  MapPin,
  Upload,
  Bell,
  Check,
  ExternalLink,
  HelpCircle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
const logoSrc = "/yardees-logo.png";
import { useOnboardingTour } from "@/components/OnboardingTour";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AccessibilityPanel } from "@/components/AccessibilityWidget";
import { Accessibility } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useTranslation();
  const { startTour } = useOnboardingTour();

  const isActive = (path: string) => location === path;
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [a11yOpen, setA11yOpen] = useState(false);
  const closeSidebar = useCallback(() => { setIsSidebarOpen(false); setA11yOpen(false); }, []);
  const sidebarWidth = 320;

  useEffect(() => {
    const root = document.getElementById("root");
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.overflowX = "hidden";
      document.documentElement.style.overflowX = "hidden";
      if (root) {
        root.style.transition = "transform 0.35s cubic-bezier(0.4,0,0.2,1)";
        root.style.transform = `translateX(-${sidebarWidth}px)`;
      }
    } else {
      document.body.style.overflow = "";
      document.body.style.overflowX = "";
      document.documentElement.style.overflowX = "";
      if (root) {
        root.style.transition = "transform 0.35s cubic-bezier(0.4,0,0.2,1)";
        root.style.transform = "";
      }
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.overflowX = "";
      document.documentElement.style.overflowX = "";
      if (root) {
        root.style.transform = "";
        root.style.transition = "";
      }
    };
  }, [isSidebarOpen]);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = (unreadData as any)?.messageCount ?? unreadData?.count ?? 0;

  const { data: notifCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const notifUnreadCount = notifCountData?.count || 0;

  const { data: notificationsData } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user && notifOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  function handleNotifClick(notif: Notification) {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    setNotifOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  }

  function formatNotifTime(date: string | Date | null) {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t("common.justNow");
    if (diffMin < 60) return t("common.minutesAgo", { count: diffMin });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return t("common.hoursAgo", { count: diffHr });
    const diffDay = Math.floor(diffHr / 24);
    return t("common.daysAgo", { count: diffDay });
  }

  return (
    <>
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-3 sm:px-4 h-16 md:h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          <img
            src={logoSrc}
            alt="Yardees"
            className="h-14 md:h-20 w-auto group-hover:scale-[1.03] transition-transform duration-300"
            data-testid="img-navbar-logo"
          />
        </Link>

        <div className="hidden md:flex items-center gap-5">
          <Link href="/" className={`text-sm font-medium tracking-wide transition-colors hover:text-primary ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>
            {t("nav.browse")}
          </Link>
          <Link href="/explore" className={`text-sm font-medium tracking-wide transition-colors hover:text-primary flex items-center gap-1.5 ${isActive("/explore") ? "text-primary" : "text-muted-foreground"}`}>
            <Store className="w-4 h-4" />
            {t("nav.explore")}
          </Link>
          <Link href="/events" className={`text-sm font-medium tracking-wide transition-colors hover:text-primary flex items-center gap-1.5 ${isActive("/events") ? "text-primary" : "text-muted-foreground"}`}>
            <Calendar className="w-4 h-4" />
            {t("nav.events")}
          </Link>

          <LanguageSelector />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            ) : (
              <Sun className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
            )}
          </Button>

          {user ? (
            <>
              <Link href="/dashboard" className={`text-sm font-medium transition-colors hover:text-primary ${isActive("/dashboard") ? "text-primary" : "text-muted-foreground"}`}>
                {t("nav.myProfile")}
              </Link>

              <Link href="/messages" className="relative" data-testid="link-messages">
                <Button variant="ghost" size="icon" className="rounded-full relative">
                  <MessageSquare className={`w-5 h-5 ${isActive("/messages") ? "text-primary" : "text-muted-foreground"}`} />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground" data-testid="badge-unread-count">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </Link>

              <div className="relative" ref={notifRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full relative"
                  onClick={() => setNotifOpen(!notifOpen)}
                  data-testid="button-notifications"
                >
                  <Bell className={`w-5 h-5 ${notifOpen ? "text-primary" : "text-muted-foreground"}`} />
                  {notifUnreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground" data-testid="badge-notif-unread-count">
                      {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                    </Badge>
                  )}
                </Button>
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg z-50" data-testid="dropdown-notifications">
                    <div className="flex items-center justify-between gap-2 p-3 border-b">
                      <span className="text-sm font-semibold">{t("nav.notifications")}</span>
                      {notifUnreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => markAllReadMutation.mutate()}
                          data-testid="button-mark-all-read"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          {t("nav.markAllRead")}
                        </Button>
                      )}
                    </div>
                    {(!notificationsData || notificationsData.length === 0) ? (
                      <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
                        {t("nav.noNotifications")}
                      </div>
                    ) : (
                      notificationsData.map((notif) => (
                        <div
                          key={notif.id}
                          className={`flex items-start gap-3 p-3 cursor-pointer border-b last:border-b-0 hover-elevate ${!notif.isRead ? "bg-primary/5" : ""}`}
                          onClick={() => handleNotifClick(notif)}
                          data-testid={`notif-item-${notif.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${!notif.isRead ? "font-semibold" : "font-normal"}`} data-testid={`text-notif-title-${notif.id}`}>
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" data-testid={`text-notif-body-${notif.id}`}>
                                {notif.body}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatNotifTime(notif.createdAt)}
                            </p>
                          </div>
                          {notif.link && (
                            <ExternalLink className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />
                          )}
                          {!notif.isRead && (
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          )}
                        </div>
                      ))
                    )}
                    <Link href="/messages?tab=notifications" className="block p-2 text-center text-xs text-primary hover:underline border-t" data-testid="link-view-all-notifications" onClick={() => setNotifOpen(false)}>
                      {t("nav.viewAll", "View all notifications")}
                    </Link>
                  </div>
                )}
              </div>

              <Link href="/create">
                <Button size="sm" className="gap-2 shadow-sm hover:shadow-md transition-all">
                  <PlusCircle className="w-4 h-4" />
                  {t("nav.sellItem")}
                </Button>
              </Link>

              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full ring-2 ring-primary/10 hover:ring-primary/30 transition-all"
                onClick={() => setIsSidebarOpen(true)}
                data-testid="button-open-sidebar"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={(user as any).profileImageUrl || undefined} alt={(user as any).displayName || (user as any).firstName || "User"} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {((user as any).displayName?.[0] || (user as any).firstName?.[0] || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/help">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  data-testid="button-help-guest"
                >
                  <HelpCircle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setIsSidebarOpen(true)}
                data-testid="button-guest-menu"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
              <Link href="/login">
                <Button variant="ghost" className="font-semibold text-muted-foreground hover:text-foreground" data-testid="button-navbar-login">
                  {t("nav.logIn")}
                </Button>
              </Link>
              <Link href="/register">
                <Button className="font-semibold shadow-md shadow-primary/20" data-testid="button-navbar-signup">
                  {t("nav.signUp")}
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            data-testid="button-theme-toggle-mobile"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Sun className="w-5 h-5 text-yellow-400" />
            )}
          </Button>
          <button
            className="p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setIsSidebarOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

    </nav>
    {createPortal(
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-black/30 z-[9998]"
              onClick={closeSidebar}
              data-testid="sidebar-overlay"
            />
            <motion.aside
              key="sidebar-panel"
              initial={{ x: sidebarWidth }}
              animate={{ x: 0 }}
              exit={{ x: sidebarWidth }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ width: sidebarWidth }}
              className="fixed top-0 right-0 h-full bg-background border-l border-border shadow-2xl z-[9999] flex flex-col overflow-x-hidden overflow-y-auto"
              data-testid="sidebar-panel"
            >
              <div className="flex items-center justify-between p-4 border-b border-border/60">
                {user ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={(user as any).profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {((user as any).displayName?.[0] || (user as any).firstName?.[0] || "U").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-semibold truncate">{(user as any).displayName || `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim()}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <img src={logoSrc} alt="Yardees" className="h-10 w-auto" />
                )}
                <Button variant="ghost" size="icon" onClick={closeSidebar} className="rounded-full flex-shrink-0" data-testid="button-close-sidebar">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
                {user ? (
                  <>
                    <SidebarSection>
                      <SidebarLink href="/dashboard" icon={<Store className="w-4 h-4" />} active={isActive("/dashboard")} onClick={closeSidebar}>{t("nav.myProfile")}</SidebarLink>
                      <SidebarLink href="/messages" icon={<MessageSquare className="w-4 h-4" />} active={isActive("/messages")} onClick={closeSidebar} badge={unreadCount > 0 ? unreadCount : undefined}>{t("nav.messages")}</SidebarLink>
                      <SidebarLink href="/messages?tab=notifications" icon={<Bell className="w-4 h-4" />} active={false} onClick={closeSidebar} badge={notifUnreadCount > 0 ? notifUnreadCount : undefined}>{t("nav.notifications")}</SidebarLink>
                    </SidebarSection>

                    <SidebarDivider label={t("nav.sellItem")} />
                    <SidebarSection>
                      <SidebarLink href="/create" icon={<PlusCircle className="w-4 h-4" />} active={isActive("/create")} onClick={closeSidebar} highlight>{t("nav.sellAnItem")}</SidebarLink>
                      <SidebarLink href="/offers" icon={<HandshakeIcon className="w-4 h-4" />} active={isActive("/offers")} onClick={closeSidebar}>{t("nav.offers")}</SidebarLink>
                      <SidebarLink href="/orders" icon={<Package className="w-4 h-4" />} active={isActive("/orders")} onClick={closeSidebar}>{t("nav.orders")}</SidebarLink>
                      <SidebarLink href="/wallet" icon={<Wallet className="w-4 h-4" />} active={isActive("/wallet")} onClick={closeSidebar}>{t("nav.wallet", "Wallet")}</SidebarLink>
                      <SidebarLink href="/analytics" icon={<BarChart3 className="w-4 h-4" />} active={isActive("/analytics")} onClick={closeSidebar}>{t("nav.analytics")}</SidebarLink>
                      <SidebarLink href="/bulk-import" icon={<Upload className="w-4 h-4" />} active={isActive("/bulk-import")} onClick={closeSidebar}>{t("nav.bulkImport")}</SidebarLink>
                    </SidebarSection>

                    <SidebarDivider label={t("nav.explore")} />
                    <SidebarSection>
                      <SidebarLink href="/" icon={<Store className="w-4 h-4" />} active={isActive("/")} onClick={closeSidebar}>{t("nav.browseItems")}</SidebarLink>
                      <SidebarLink href="/explore" icon={<Store className="w-4 h-4" />} active={isActive("/explore")} onClick={closeSidebar}>{t("nav.explore")}</SidebarLink>
                      <SidebarLink href="/collections" icon={<Sparkles className="w-4 h-4" />} active={isActive("/collections")} onClick={closeSidebar}>{t("nav.collections", "Collections")}</SidebarLink>

                      <SidebarLink href="/events" icon={<Calendar className="w-4 h-4" />} active={isActive("/events")} onClick={closeSidebar}>{t("nav.events")}</SidebarLink>
                      <SidebarLink href="/neighborhood-events" icon={<MapPin className="w-4 h-4" />} active={isActive("/neighborhood-events")} onClick={closeSidebar}>{t("nav.neighborhoodEvents", "Neighborhood Events")}</SidebarLink>
                      <SidebarLink href="/tips" icon={<Lightbulb className="w-4 h-4" />} active={isActive("/tips")} onClick={closeSidebar}>{t("nav.tips", "Community Tips")}</SidebarLink>
                    </SidebarSection>

                    <SidebarDivider label={t("nav.more", "More")} />
                    <SidebarSection>
                      <SidebarLink href="/wishlist" icon={<Heart className="w-4 h-4" />} active={isActive("/wishlist")} onClick={closeSidebar}>{t("nav.wishlist", "Wishlist")}</SidebarLink>
                      <SidebarLink href="/rewards" icon={<Trophy className="w-4 h-4" />} active={isActive("/rewards")} onClick={closeSidebar}>{t("nav.rewards", "Rewards")}</SidebarLink>
                      <SidebarLink href="/scan" icon={<Camera className="w-4 h-4" />} active={isActive("/scan")} onClick={closeSidebar}>{t("nav.scan", "Scan Barcode")}</SidebarLink>
                      <SidebarLink href="/verify" icon={<ShieldCheck className="w-4 h-4" />} active={isActive("/verify")} onClick={closeSidebar}>{t("nav.verifyIdentity")}</SidebarLink>
                    </SidebarSection>

                    <SidebarDivider />
                    <SidebarSection>
                      <SidebarLink href="/help" icon={<HelpCircle className="w-4 h-4" />} active={isActive("/help")} onClick={closeSidebar}>{t("nav.helpCenter", "Help Center")}</SidebarLink>
                      <button
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md mx-2 transition-colors"
                        onClick={() => { startTour(); closeSidebar(); }}
                        data-testid="button-take-tour"
                      >
                        <HelpCircle className="w-4 h-4" />
                        {t("nav.takeTour")}
                      </button>
                      <a
                        href="mailto:support@yardees.net"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md mx-2 transition-colors"
                        onClick={closeSidebar}
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t("nav.contactSupport", "Contact Support")}
                      </a>
                    </SidebarSection>

                    <SidebarDivider label={t("accessibility.title", "Accessibility")} />
                    <div>
                      <button
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md mx-2 transition-colors"
                        onClick={() => setA11yOpen(!a11yOpen)}
                        data-testid="button-sidebar-accessibility"
                      >
                        <Accessibility className="w-4 h-4" />
                        <span className="flex-1 text-left">{t("accessibility.title", "Accessibility")}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${a11yOpen ? "rotate-90" : ""}`} />
                      </button>
                      {a11yOpen && <AccessibilityPanel />}
                    </div>
                  </>
                ) : (
                  <>
                  <SidebarSection>
                    <SidebarLink href="/" icon={<Store className="w-4 h-4" />} active={isActive("/")} onClick={closeSidebar}>{t("nav.browseItems")}</SidebarLink>
                    <SidebarLink href="/explore" icon={<Store className="w-4 h-4" />} active={isActive("/explore")} onClick={closeSidebar}>{t("nav.explore")}</SidebarLink>
                    <SidebarLink href="/events" icon={<Calendar className="w-4 h-4" />} active={isActive("/events")} onClick={closeSidebar}>{t("nav.events")}</SidebarLink>
                    <SidebarLink href="/help" icon={<HelpCircle className="w-4 h-4" />} active={isActive("/help")} onClick={closeSidebar}>{t("nav.helpCenter", "Help Center")}</SidebarLink>
                  </SidebarSection>

                  <SidebarDivider label={t("accessibility.title", "Accessibility")} />
                  <div>
                    <button
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md mx-2 transition-colors"
                      onClick={() => setA11yOpen(!a11yOpen)}
                      data-testid="button-sidebar-accessibility-guest"
                    >
                      <Accessibility className="w-4 h-4" />
                      <span className="flex-1 text-left">{t("accessibility.title", "Accessibility")}</span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${a11yOpen ? "rotate-90" : ""}`} />
                    </button>
                    {a11yOpen && <AccessibilityPanel />}
                  </div>
                  </>
                )}
              </nav>

              <div className="p-4 border-t border-border/60 space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                  onClick={toggleTheme}
                  data-testid="button-sidebar-theme-toggle"
                >
                  {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-yellow-400" />}
                  {theme === "light" ? t("nav.darkMode", "Dark Mode") : t("nav.lightMode", "Light Mode")}
                </Button>
                {user ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => { logout(); closeSidebar(); }}
                    data-testid="button-sidebar-logout"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("nav.logOut")}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link href="/login" onClick={closeSidebar}>
                      <Button variant="outline" className="w-full" data-testid="button-sidebar-login">{t("nav.logIn")}</Button>
                    </Link>
                    <Link href="/register" onClick={closeSidebar}>
                      <Button className="w-full" data-testid="button-sidebar-signup">{t("nav.signUp")}</Button>
                    </Link>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}

function SidebarLink({ href, icon, children, active, onClick, badge, highlight }: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm rounded-md mx-2 transition-colors ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : highlight
            ? "text-primary font-medium hover:bg-primary/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      }`}
      onClick={onClick}
      data-testid={`sidebar-link-${href.replace(/\//g, "-").replace(/^-/, "")}`}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge !== undefined && (
        <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 h-5 min-w-[20px] flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </Badge>
      )}
    </Link>
  );
}

function SidebarSection({ children }: { children: React.ReactNode }) {
  return <div className="py-1">{children}</div>;
}

function SidebarDivider({ label }: { label?: string }) {
  return (
    <div className="px-4 pt-3 pb-1">
      {label ? (
        <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      ) : (
        <div className="border-t border-border/40" />
      )}
    </div>
  );
}
