import { Navbar } from "@/components/Navbar";
import { useAllListings, useDeleteListing } from "@/hooks/use-listings";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import { Edit2, Trash2, PlusCircle, LayoutDashboard, Zap, Shield, Store, MapPin, CheckCircle2, Heart, RefreshCw, AlertTriangle, Bell, BarChart3, HandshakeIcon, Package, Upload, Share2, Copy, Calendar, Send, Camera, User as UserIcon, ShieldCheck, MessageSquare, Tag, Star, Truck, Megaphone, ChevronDown, ChevronUp, Globe, Phone, FileText, DollarSign } from "lucide-react";
import { InlineLoader, ButtonLoader, PageTransition } from "@/components/PageLoader";
import { useEffect, useState, useRef } from "react";
import { format, differenceInDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Listing, currencySymbols, type SavedSearch, categories } from "@shared/schema";
import { ListingCard } from "@/components/ListingCard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SellerBadge } from "@/components/SellerBadge";
const logoSrc = "/yardees-logo.png";

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

type TabType = "listings" | "saved" | "alerts";

const NOTIF_CATEGORIES = [
  { key: "messages", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { key: "offers", icon: Tag, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30" },
  { key: "reviews", icon: Star, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
  { key: "orders", icon: Truck, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
  { key: "marketing", icon: Megaphone, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
] as const;

function NotificationPreferences({ user, qc, toast, t }: { user: any; qc: any; toast: any; t: any }) {
  const [expanded, setExpanded] = useState(false);
  const masterEnabled = user?.emailNotifications !== false;
  const prefs = user?.notificationPreferences || { messages: true, offers: true, reviews: true, orders: true, marketing: true };

  const toggleMaster = async () => {
    try {
      await fetch("/api/profile/email-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: !masterEnabled }),
      });
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: !masterEnabled ? t("dashboard.notificationsEnabled") : t("dashboard.notificationsDisabled") });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const toggleCategory = async (key: string) => {
    const newValue = !prefs[key];
    try {
      await fetch("/api/profile/email-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferences: { [key]: newValue } }),
      });
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("dashboard.notifUpdated") });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const enabledCount = NOTIF_CATEGORIES.filter((c) => prefs[c.key] !== false).length;

  return (
    <Card className="p-5 mb-8" data-testid="email-settings">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{t("dashboard.emailNotifications")}</p>
            <p className="text-xs text-muted-foreground">
              {masterEnabled
                ? `${enabledCount}/${NOTIF_CATEGORIES.length} ${t("dashboard.notifPreferencesDesc")}`
                : t("dashboard.notificationsDisabled")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMaster}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${masterEnabled ? "bg-primary" : "bg-muted"}`}
            data-testid="toggle-email-notifications"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${masterEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

      {masterEnabled && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors py-1"
          data-testid="button-expand-notif-prefs"
        >
          {expanded ? t("dashboard.notifPreferences") : t("dashboard.notifPreferences")}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      {masterEnabled && expanded && (
        <div className="mt-3 space-y-2 pt-3 border-t border-border" data-testid="notif-preferences-list">
          {NOTIF_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isOn = prefs[cat.key] !== false;
            return (
              <div key={cat.key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t(`dashboard.notif${cat.key.charAt(0).toUpperCase() + cat.key.slice(1)}`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`dashboard.notif${cat.key.charAt(0).toUpperCase() + cat.key.slice(1)}Desc`)}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleCategory(cat.key)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isOn ? "bg-primary" : "bg-muted"}`}
                  data-testid={`toggle-notif-${cat.key}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${isOn ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// Apple App Store Guideline 5.1.1(v) requires every app with account creation
// to provide an in-app way to delete the account. This component lives at the
// bottom of the Dashboard settings stack and shows a destructive action with
// a typed confirmation step to prevent accidental deletion.
function DangerZone({ toast }: { toast: any }) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast({
        title: "Confirmation required",
        description: 'Type DELETE (all caps) to confirm.',
        variant: "destructive",
      });
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        // Active orders/disputes block deletion
        toast({
          title: "Active orders prevent deletion",
          description: data.message || "Please resolve open orders first.",
          variant: "destructive",
        });
        setIsDeleting(false);
        return;
      }
      if (!res.ok) throw new Error(data.message || "Delete failed");
      toast({
        title: "Account deleted",
        description: "Your account and all data have been permanently removed.",
      });
      // Brief delay so user sees the toast before redirect
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (err) {
      console.error(err);
      toast({
        title: "Couldn't delete account",
        description: "Something went wrong. Please contact support@yardees.net.",
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  return (
    <Card className="p-6 mb-6 border-destructive/30 bg-destructive/5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-base text-destructive" data-testid="text-danger-zone">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your YARDEES account and all associated data. This action cannot be undone.
          </p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            data-testid="button-delete-account"
          >
            <Trash2 className="w-4 h-4" />
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your YARDEES account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p>This will permanently delete:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Your profile, photo, bio, and storefront</li>
                  <li>All your listings, photos, and videos</li>
                  <li>Your messages, offers, and saved searches</li>
                  <li>Your favorites, wishlists, and reviews</li>
                  <li>Your order history and payout settings</li>
                </ul>
                <p className="font-semibold text-destructive pt-2">This cannot be undone.</p>
                <div className="pt-2">
                  <label className="text-sm font-medium block mb-2">
                    Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="DELETE"
                    data-testid="input-confirm-delete"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setConfirmText("")}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isDeleting ? "Deleting…" : "Permanently delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  useOGMeta({ title: "My Dashboard", description: "Manage your listings, profile, and account on YARDEES.", url: `${window.location.origin}/dashboard` });
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: listings, isLoading: isListingsLoading } = useAllListings(
    user ? { userId: user.id, includeSold: true, includeExpired: true } : undefined
  );
  const { mutate: deleteListing } = useDeleteListing();
  const [tab, setTab] = useState<TabType>("listings");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: favorites, isLoading: isFavLoading } = useQuery<Listing[]>({
    queryKey: ["/api/favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && tab === "saved",
  });

  const { data: savedSearches, isLoading: isSearchesLoading } = useQuery<SavedSearch[]>({
    queryKey: ["/api/saved-searches"],
    queryFn: async () => {
      const res = await fetch("/api/saved-searches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user && tab === "alerts",
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/saved-searches/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/saved-searches"] });
      toast({ title: t("home.savedSearchRemoved") });
    },
  });

  const soldMutation = useMutation({
    mutationFn: async ({ id, isSold }: { id: number; isSold: boolean }) => {
      const res = await fetch(`/api/listings/${id}/sold`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSold }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: data.isSold ? t("dashboard.markedAsSold") : t("dashboard.listedAvailable") });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/listings/${id}/renew`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to renew listing");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: t("dashboard.listingRenewed"), description: t("dashboard.listingExtended") });
    },
  });

  const { data: referralCode } = useQuery<{ code: string }>({
    queryKey: ["/api/referral/code"],
    queryFn: async () => {
      const res = await fetch("/api/referral/code", { credentials: "include" });
      if (!res.ok) return { code: "" };
      return res.json();
    },
    enabled: !!user,
  });

  const { data: referralStats } = useQuery<{ totalReferred: number; boostCredits: number }>({
    queryKey: ["/api/referral/stats"],
    queryFn: async () => {
      const res = await fetch("/api/referral/stats", { credentials: "include" });
      if (!res.ok) return { totalReferred: 0, boostCredits: 0 };
      return res.json();
    },
    enabled: !!user,
  });

  const { data: verification } = useQuery<any>({
    queryKey: ["/api/verification/status"],
    queryFn: async () => {
      const res = await fetch("/api/verification/status", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const { data: offersData } = useQuery<any[]>({
    queryKey: ["/api/offers"],
    enabled: !!user,
    refetchInterval: 30000,
  });
  const pendingReceivedOffers = offersData?.filter(o => o.sellerId === user?.id && o.status === "pending")?.length || 0;

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: "", lastName: "", displayName: "", email: "",
    bio: "", phone: "", website: "", city: "", country: "",
    favoriteCategories: [] as string[],
    storefrontBio: "", storefrontTagline: "", storefrontBanner: "",
  });
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: (user as any).firstName || "",
        lastName: (user as any).lastName || "",
        displayName: (user as any).displayName || "",
        email: (user as any).email || "",
        bio: (user as any).bio || "",
        phone: (user as any).phone || "",
        website: (user as any).website || "",
        city: (user as any).city || "",
        country: (user as any).country || "",
        favoriteCategories: (user as any).favoriteCategories || [],
        storefrontBio: (user as any).storefrontBio || "",
        storefrontTagline: (user as any).storefrontTagline || "",
        storefrontBanner: (user as any).storefrontBanner || "",
      });
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: async (updates: any) => {
      return apiRequest("PATCH", "/api/profile", updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("dashboard.profileUpdated") });
      setEditingProfile(false);
    },
    onError: async (err: any) => {
      let message = t("dashboard.failedToUpdateProfile");
      try {
        const raw = err?.message || "";
        const jsonPart = raw.substring(raw.indexOf("{"));
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          if (parsed.message) message = parsed.message;
        }
      } catch {}
      toast({ title: message, variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      profileMutation.mutate({ profileImageUrl: url });
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    }
  };

  const copyReferralLink = () => {
    if (!referralCode?.code) return;
    const link = `${window.location.origin}/register?ref=${referralCode.code}`;
    navigator.clipboard.writeText(link);
    toast({ title: t("dashboard.referralCopied") });
  };

  useEffect(() => {
    if (!isAuthLoading && !user) {
      window.location.href = "/api/login";
    }
  }, [user, isAuthLoading]);

  if (isAuthLoading) return null;

  const privacyLabels: Record<string, string> = {
    open: t("listing.public"),
    hidden: t("listing.onRequest"),
    request: t("listing.onRequest"),
    verified: t("listing.verifiedOnly"),
  };

  const TabButton = ({ value, label, icon: Icon }: { value: TabType; label: string; icon: any }) => (
    <button
      onClick={() => setTab(value)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
        tab === value
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {value === "saved" && favorites && favorites.length > 0 && (
        <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 h-4 min-w-4 no-default-hover-elevate no-default-active-elevate">{favorites.length}</Badge>
      )}
    </button>
  );

  const getExpiryBadge = (listing: Listing) => {
    if (!listing.expiresAt) return null;
    const daysLeft = differenceInDays(new Date(listing.expiresAt), new Date());
    const isExpired = daysLeft < 0;

    if (isExpired) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" /> Expired
        </Badge>
      );
    }

    if (daysLeft <= 7) {
      return (
        <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-600/30 text-xs">
          Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
        </Badge>
      );
    }

    return (
      <span className="text-xs text-muted-foreground">
        Expires {format(new Date(listing.expiresAt), "MMM d")}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <PageTransition>
      <main className="container mx-auto px-4 py-12">
        {(user as any)?.authType === "local" && !(user as any)?.emailVerified && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3" data-testid="banner-verify-email">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-grow">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{t("dashboard.verifyEmailTitle")}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">{t("dashboard.verifyEmailDesc")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              onClick={async () => {
                try {
                  const res = await fetch("/api/resend-verification", { method: "POST", credentials: "include" });
                  if (res.ok) toast({ title: t("dashboard.verificationSent") });
                  else toast({ title: t("dashboard.verificationFailed"), variant: "destructive" });
                } catch { toast({ title: t("dashboard.verificationFailed"), variant: "destructive" }); }
              }}
              data-testid="button-resend-verification"
            >
              {t("dashboard.resendVerification")}
            </Button>
          </div>
        )}
        <Card className="p-6 mb-8 overflow-hidden" data-testid="profile-header">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative group flex-shrink-0">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border-2 border-border flex items-center justify-center">
                {(user as any)?.profileImageUrl ? (
                  <img
                    src={(user as any).profileImageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    data-testid="img-profile-photo"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = logoSrc;
                      img.className = "w-full h-full object-contain p-2 bg-primary/5";
                    }}
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <button
                onClick={() => photoInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                data-testid="button-change-photo"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                data-testid="input-profile-photo"
              />
            </div>

            <div className="flex-grow text-center sm:text-left min-w-0">
              {editingProfile ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</p>
                    <div className="flex gap-2">
                      <input
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                        placeholder="First name"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-first-name"
                      />
                      <input
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                        placeholder="Last name"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Name</p>
                    <input
                      value={profileForm.displayName}
                      onChange={(e) => setProfileForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Display name (shown publicly)"
                      className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                      data-testid="input-display-name"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">About You</p>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm(f => ({ ...f, bio: e.target.value.slice(0, 500) }))}
                      placeholder="Tell other users a little about yourself..."
                      rows={3}
                      className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full resize-none"
                      data-testid="input-bio"
                    />
                    <p className="text-xs text-muted-foreground text-right">{profileForm.bio.length}/500</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                      <input
                        type="email"
                        autoComplete="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="Email address"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-profile-email"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Phone number (optional)"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Website</p>
                      <input
                        type="url"
                        value={profileForm.website}
                        onChange={(e) => setProfileForm(f => ({ ...f, website: e.target.value }))}
                        placeholder="https://yoursite.com"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-website"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</p>
                      <div className="flex gap-2">
                        <input
                          value={profileForm.city}
                          onChange={(e) => setProfileForm(f => ({ ...f, city: e.target.value }))}
                          onBlur={(e) => setProfileForm(f => ({ ...f, city: capitalizeWords(e.target.value.trim()) }))}
                          placeholder="City"
                          className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                          data-testid="input-city"
                        />
                        <input
                          value={profileForm.country}
                          onChange={(e) => setProfileForm(f => ({ ...f, country: e.target.value }))}
                          onBlur={(e) => setProfileForm(f => ({ ...f, country: capitalizeWords(e.target.value.trim()) }))}
                          placeholder="Country"
                          className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                          data-testid="input-country"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Favorite Categories <span className="normal-case font-normal">(up to 5)</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const selected = profileForm.favoriteCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setProfileForm(f => {
                                const favs = f.favoriteCategories.includes(cat)
                                  ? f.favoriteCategories.filter(c => c !== cat)
                                  : f.favoriteCategories.length < 5
                                    ? [...f.favoriteCategories, cat]
                                    : f.favoriteCategories;
                                return { ...f, favoriteCategories: favs };
                              });
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                            data-testid={`chip-category-${cat}`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-2 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Seller Storefront</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tagline</p>
                      <input
                        value={profileForm.storefrontTagline}
                        onChange={(e) => setProfileForm(f => ({ ...f, storefrontTagline: e.target.value.slice(0, 100) }))}
                        placeholder="A short tagline for your storefront"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-storefront-tagline"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Storefront Bio</p>
                      <textarea
                        value={profileForm.storefrontBio}
                        onChange={(e) => setProfileForm(f => ({ ...f, storefrontBio: e.target.value.slice(0, 1000) }))}
                        placeholder="Tell buyers about your shop, what you sell, your story..."
                        rows={3}
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full resize-none"
                        data-testid="input-storefront-bio"
                      />
                      <p className="text-xs text-muted-foreground text-right">{profileForm.storefrontBio.length}/1000</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Banner Image URL</p>
                      <input
                        value={profileForm.storefrontBanner}
                        onChange={(e) => setProfileForm(f => ({ ...f, storefrontBanner: e.target.value }))}
                        placeholder="https://example.com/banner.jpg"
                        className="px-3 py-1.5 rounded-md border border-input bg-background text-sm w-full"
                        data-testid="input-storefront-banner"
                      />
                      {profileForm.storefrontBanner && (
                        <img src={profileForm.storefrontBanner} alt="Banner preview" className="w-full h-24 object-cover rounded-md mt-1" />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => profileMutation.mutate(profileForm)} disabled={profileMutation.isPending} data-testid="button-save-profile">
                      {profileMutation.isPending ? <ButtonLoader /> : "Save Profile"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)} data-testid="button-cancel-profile">Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <h1 className="text-2xl font-display font-bold gradient-text" data-testid="text-profile-name">
                      {(user as any)?.displayName || `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || t("dashboard.setYourName")}
                    </h1>
                    {verification && <SellerBadge level={(user as any)?.verificationLevel || "unverified"} size={20} showLabel />}
                  </div>

                  {(user as any)?.bio && (
                    <p className="text-sm text-foreground/80 mt-2 max-w-lg" data-testid="text-bio">
                      {(user as any).bio}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground justify-center sm:justify-start">
                    {user?.email && (
                      <span className="inline-flex items-center gap-1" data-testid="text-email">
                        <Send className="w-3.5 h-3.5" /> {user.email}
                      </span>
                    )}
                    {(user as any)?.phone && (
                      <span className="inline-flex items-center gap-1" data-testid="text-phone">
                        <Phone className="w-3.5 h-3.5" /> {(user as any).phone}
                      </span>
                    )}
                    {(user as any)?.website && (
                      <a
                        href={(user as any).website.startsWith("http") ? (user as any).website : `https://${(user as any).website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        data-testid="link-website"
                      >
                        <Globe className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                    {((user as any)?.city || (user as any)?.country) && (
                      <span className="inline-flex items-center gap-1" data-testid="text-location">
                        <MapPin className="w-3.5 h-3.5" />
                        {[(user as any)?.city, (user as any)?.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {(user as any)?.createdAt && (
                      <span className="inline-flex items-center gap-1" data-testid="text-member-since">
                        <Calendar className="w-3.5 h-3.5" /> Member since {format(new Date((user as any).createdAt), "MMM yyyy")}
                      </span>
                    )}
                  </div>

                  {(user as any)?.favoriteCategories?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start" data-testid="favorite-categories">
                      {(user as any).favoriteCategories.map((cat: string) => (
                        <Badge key={cat} variant="secondary" className="text-xs font-normal">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3 justify-center sm:justify-start">
                    <Button size="sm" variant="outline" onClick={() => setEditingProfile(true)} data-testid="button-edit-profile">
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit Profile
                    </Button>
                    <Link href="/verify">
                      <Button size="sm" variant="outline" className="gap-1.5" data-testid="button-verify-link">
                        <ShieldCheck className="w-3.5 h-3.5" /> {verification?.status === "approved" ? t("verify.verified") : t("dashboard.getVerified")}
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>

            <Link href="/create" className="flex-shrink-0">
              <Button size="lg" className="shadow-lg shadow-primary/20" data-testid="button-post-new">
                <PlusCircle className="mr-2 h-5 w-5" /> Post New Item
              </Button>
            </Link>
          </div>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <Link href="/offers">
            <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer text-center relative" data-testid="link-offers">
              <HandshakeIcon className="w-6 h-6 text-primary mx-auto mb-1" />
              <span className="text-sm font-medium">Offers</span>
              {pendingReceivedOffers > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 w-5 h-5 p-0 flex items-center justify-center text-[10px] bg-orange-500 text-white border-0" data-testid="badge-pending-offers">
                  {pendingReceivedOffers > 9 ? "9+" : pendingReceivedOffers}
                </Badge>
              )}
            </Card>
          </Link>
          <Link href="/orders">
            <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer text-center" data-testid="link-orders">
              <Package className="w-6 h-6 text-primary mx-auto mb-1" />
              <span className="text-sm font-medium">Orders</span>
            </Card>
          </Link>
          <Link href="/wallet">
            <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer text-center" data-testid="link-wallet">
              <DollarSign className="w-6 h-6 text-primary mx-auto mb-1" />
              <span className="text-sm font-medium">Wallet</span>
            </Card>
          </Link>
          <Link href="/analytics">
            <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer text-center" data-testid="link-analytics">
              <BarChart3 className="w-6 h-6 text-primary mx-auto mb-1" />
              <span className="text-sm font-medium">Analytics</span>
            </Card>
          </Link>
          <Link href="/bulk-import">
            <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer text-center" data-testid="link-bulk-import">
              <Upload className="w-6 h-6 text-primary mx-auto mb-1" />
              <span className="text-sm font-medium">Bulk Import</span>
            </Card>
          </Link>
          <Link href="/events">
            <Card className="p-4 hover:border-primary/50 transition-colors cursor-pointer text-center" data-testid="link-events">
              <Calendar className="w-6 h-6 text-primary mx-auto mb-1" />
              <span className="text-sm font-medium">Events</span>
            </Card>
          </Link>
        </div>

        {referralCode?.code && (
          <Card className="p-5 mb-8 border-primary/20 bg-primary/5" data-testid="referral-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold">Referral Program</h3>
                  {verification && <SellerBadge level={verification.verificationLevel || "unverified"} size={18} />}
                </div>
                <p className="text-sm text-muted-foreground">
                  Invite friends and earn boost credits! {referralStats ? `${referralStats.totalReferred} invited, ${referralStats.boostCredits} credits earned` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="bg-muted px-3 py-1.5 rounded-lg text-sm font-mono" data-testid="text-referral-code">{referralCode.code}</code>
                <Button variant="outline" size="sm" onClick={copyReferralLink} data-testid="button-copy-referral">
                  <Copy className="w-4 h-4" />
                </Button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Join YARDEES and discover amazing yard sale deals! ${window.location.origin}/register?ref=${referralCode.code}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-whatsapp"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out YARDEES - the best marketplace for yard sales and thrift shopping! 🛍️`)}&url=${encodeURIComponent(`${window.location.origin}/register?ref=${referralCode.code}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-twitter"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-foreground"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/register?ref=${referralCode.code}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-facebook"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-blue-600"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent("Join YARDEES!")}&body=${encodeURIComponent(`Check out YARDEES - the best marketplace for yard sales and thrift shopping!\n\n${window.location.origin}/register?ref=${referralCode.code}`)}`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background hover:bg-accent transition-colors"
                  data-testid="button-share-email"
                >
                  <Send className="w-4 h-4" />
                </a>
              </div>
            </div>
          </Card>
        )}

        <NotificationPreferences user={user} qc={qc} toast={toast} t={t} />

        <DangerZone toast={toast} />


        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          <TabButton value="listings" label={t("dashboard.myListings")} icon={Store} />
          <TabButton value="saved" label={t("dashboard.savedItems")} icon={Heart} />
          <TabButton value="alerts" label={t("dashboard.savedSearches")} icon={Bell} />
        </div>

        {/* My Listings Tab */}
        {tab === "listings" && (
          isListingsLoading ? (
            <InlineLoader />
          ) : listings?.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No listings yet</h3>
              <p className="text-muted-foreground mb-6">Start selling your items today!</p>
              <Link href="/create">
                <Button>Create your first listing</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {listings?.map((listing) => (
                <Card key={listing.id} className={`p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 transition-colors ${(listing as any).isSold ? "opacity-70 border-dashed" : "hover:border-primary/50"}`} data-testid={`card-listing-${listing.id}`}>
                  <div className="w-full sm:w-32 h-32 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative">
                    {listing.photos && listing.photos.length > 0 ? (
                      <img
                        src={listing.photos[0]}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = logoSrc;
                          img.className = "w-full h-full object-contain p-4 bg-primary/5";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/5">
                        <img src={logoSrc} alt="Yardees" className="h-12 w-auto opacity-40" />
                      </div>
                    )}
                    {listing.isBoosted && !(listing as any).isSold && (() => {
                      const bt = (listing as any).boostType;
                      if (bt === "spotlight") {
                        return (
                          <Badge className="absolute top-1 left-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 shadow-md text-[10px] px-1.5 py-0.5 font-bold">
                            <Zap className="w-3 h-3 mr-0.5" /> Spotlight
                          </Badge>
                        );
                      }
                      if (bt === "featured") {
                        return (
                          <Badge className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 font-bold">
                            <Zap className="w-3 h-3 mr-0.5" /> Featured
                          </Badge>
                        );
                      }
                      return (
                        <Badge className="absolute top-1 left-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5">
                          <Zap className="w-3 h-3 mr-0.5" /> Boosted
                        </Badge>
                      );
                    })()}
                    {(listing as any).isSold && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg">
                        <Badge className="bg-secondary text-secondary-foreground text-xs">SOLD</Badge>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={`font-bold text-lg ${(listing as any).isSold ? "line-through text-muted-foreground" : ""}`}>{listing.title}</h3>
                        <p className="text-muted-foreground text-sm line-clamp-1">{listing.description}</p>
                      </div>
                      <span className="font-bold text-accent ml-2 text-sm sm:text-base whitespace-nowrap">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: listing.currency || "USD" }).format(listing.price / 100)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded-full">{listing.category}</span>
                      {listing.isShop && (
                        <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600/30 text-xs">
                          <Store className="w-3 h-3 mr-1" /> Shop
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" /> {privacyLabels[listing.privacyLevel] || listing.privacyLevel}
                      </Badge>
                      {listing.country && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" /> {listing.city}, {listing.country}
                        </Badge>
                      )}
                      {(listing as any).viewCount > 0 && (
                        <span className="text-xs px-2 py-1 text-muted-foreground">
                          {(listing as any).viewCount} view{(listing as any).viewCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 text-muted-foreground">
                        Posted {format(new Date(listing.createdAt || new Date()), "MMM d, yyyy")}
                      </span>
                      {getExpiryBadge(listing)}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2 justify-start">
                      <Button
                        variant={(listing as any).isSold ? "default" : "outline"}
                        size="sm"
                        onClick={() => soldMutation.mutate({ id: listing.id, isSold: !(listing as any).isSold })}
                        disabled={soldMutation.isPending}
                        data-testid={`button-sold-${listing.id}`}
                        className={(listing as any).isSold ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        {(listing as any).isSold ? t("dashboard.markAsAvailable") : t("dashboard.markAsSold")}
                      </Button>

                      {!(listing as any).isSold && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => renewMutation.mutate(listing.id)}
                          disabled={renewMutation.isPending}
                          data-testid={`button-renew-${listing.id}`}
                        >
                          <RefreshCw className={`w-4 h-4 mr-1 ${renewMutation.isPending ? "animate-spin" : ""}`} />
                          Renew
                        </Button>
                      )}

                      {!(listing as any).isSold && (
                        <Link href={`/boost/${listing.id}`}>
                          <Button variant={listing.isBoosted ? "secondary" : "outline"} size="sm" data-testid={`button-boost-${listing.id}`}>
                            <Zap className={`w-4 h-4 mr-1 ${listing.isBoosted ? "text-amber-500" : ""}`} />
                            {listing.isBoosted ? (() => {
                              const bt = (listing as any).boostType;
                              const label = bt === "spotlight" ? t("listing.spotlight") : bt === "featured" ? t("listing.featured") : t("listing.boosted");
                              if (listing.boostExpiresAt) {
                                const daysLeft = differenceInDays(new Date(listing.boostExpiresAt), new Date());
                                if (daysLeft < 0) return `${label} (Expired)`;
                                return `${label} (${daysLeft}d left)`;
                              }
                              return label;
                            })() : t("dashboard.boost")}
                          </Button>
                        </Link>
                      )}

                      <Link href={`/edit/${listing.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-edit-${listing.id}`}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </Button>
                      </Link>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-${listing.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{listing.title}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteListing(listing.id)} className="bg-destructive hover:bg-destructive/90 text-white">
                              Delete Listing
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        )}

        {/* Saved Items Tab */}
        {tab === "saved" && (
          isFavLoading ? (
            <InlineLoader />
          ) : !favorites || favorites.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No saved items yet</h3>
              <p className="text-muted-foreground mb-6">Tap the heart on any listing to save it here.</p>
              <Link href="/"><Button>Browse Listings</Button></Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {favorites.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )
        )}

        {/* Saved Searches Tab */}
        {tab === "alerts" && (
          isSearchesLoading ? (
            <InlineLoader />
          ) : !savedSearches || savedSearches.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No saved searches</h3>
              <p className="text-muted-foreground mb-6">Save a search on the home page to get email alerts.</p>
              <Link href="/"><Button>Browse Listings</Button></Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedSearches.map((search) => (
                <Card key={search.id} className="p-4 flex flex-col gap-3 hover-elevate" data-testid={`card-saved-search-${search.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{search.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        Saved on {format(new Date(search.createdAt || new Date()), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSearchMutation.mutate(search.id)}
                      disabled={deleteSearchMutation.isPending}
                      data-testid={`button-delete-search-${search.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(search.query as any).map(([key, value]) => {
                      if (!value || value === "all") return null;
                      return (
                        <Badge key={key} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 capitalize">
                          {key}: {String(value)}
                        </Badge>
                      );
                    })}
                  </div>

                  <Link href={`/?${new URLSearchParams(Object.entries(search.query as any).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`}>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      Run Search
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          )
        )}
      </main>
      </PageTransition>
    </div>
  );
}
