import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { Send, MessageSquare, Package, ArrowLeft, Wifi, WifiOff, ShieldCheck, CheckCircle2, AlertTriangle, Shield, Trash2, Bell, Check, ExternalLink } from "lucide-react";
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
const logoSrc = "/yardees-logo.png";
import { format } from "date-fns";
import { Link, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";
import { Card } from "@/components/ui/card";

interface Conversation {
  otherId: string;
  listingId: number | null;
  lastMessage: {
    id: number;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  listing: {
    id: number;
    title: string;
    photos: string[];
  } | null;
}

interface Message {
  id: number;
  senderId: string;
  receiverId: string;
  listingId: number | null;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export default function Messages() {
  const { t } = useTranslation();
  const { toast } = useToast();
  useOGMeta({ title: "Messages", description: "Chat with buyers and sellers on YARDEES marketplace.", url: `${window.location.origin}/messages` });
  const { user } = useAuth();
  const qc = useQueryClient();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const tabParam = searchParams.get("tab");
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "idReview" | "notifications">(
    tabParam === "notifications" ? "notifications" : "messages"
  );
  const [typingUsers, setTypingUsers] = useState<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const handleWsMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case "new_message": {
        const incomingMsg = msg.message as Message;
        const currentSelected = selectedRef.current;
        const isInCurrentThread =
          currentSelected &&
          ((incomingMsg.senderId === currentSelected.otherId &&
            incomingMsg.listingId === currentSelected.listingId) ||
           (incomingMsg.receiverId === currentSelected.otherId &&
            incomingMsg.listingId === currentSelected.listingId));

        if (isInCurrentThread) {
          qc.setQueryData<Message[]>(
            ["/api/messages/thread", currentSelected!.otherId, currentSelected!.listingId],
            (old) => {
              if (!old) return [incomingMsg];
              if (old.some((m) => m.id === incomingMsg.id)) return old;
              return [...old, incomingMsg];
            }
          );

          if (incomingMsg.senderId !== user?.id) {
            send({ type: "read", senderId: incomingMsg.senderId, listingId: incomingMsg.listingId });
          }
        }

        qc.invalidateQueries({ queryKey: ["/api/messages"] });
        qc.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
        break;
      }

      case "message_sent": {
        const sentMsg = msg.message as Message;
        const currentSelected = selectedRef.current;
        if (
          currentSelected &&
          sentMsg.receiverId === currentSelected.otherId &&
          sentMsg.listingId === currentSelected.listingId
        ) {
          qc.setQueryData<Message[]>(
            ["/api/messages/thread", currentSelected.otherId, currentSelected.listingId],
            (old) => {
              if (!old) return [sentMsg];
              if (old.some((m) => m.id === sentMsg.id)) return old;
              return [...old, sentMsg];
            }
          );
        }
        qc.invalidateQueries({ queryKey: ["/api/messages"] });
        break;
      }

      case "typing": {
        const key = `${msg.senderId}-${msg.listingId}`;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          const existing = next.get(key);
          if (existing) clearTimeout(existing);
          next.set(
            key,
            setTimeout(() => {
              setTypingUsers((p) => {
                const n = new Map(p);
                n.delete(key);
                return n;
              });
            }, 3000)
          );
          return next;
        });
        break;
      }

      case "stop_typing": {
        const key = `${msg.senderId}-${msg.listingId}`;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          const existing = next.get(key);
          if (existing) clearTimeout(existing);
          next.delete(key);
          return next;
        });
        break;
      }

      case "presence": {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (msg.online) {
            next.add(msg.userId);
          } else {
            next.delete(msg.userId);
          }
          return next;
        });
        break;
      }

      case "read": {
        qc.invalidateQueries({ queryKey: ["/api/messages"] });
        break;
      }
    }
  }, [qc, user?.id]);

  const { connected, send } = useWebSocket(handleWsMessage, !!user);

  useEffect(() => {
    if (user && connected) {
      fetch("/api/messages/online", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (data.onlineUsers) {
            setOnlineUsers(new Set(data.onlineUsers));
          }
        })
        .catch(() => {});
    }
  }, [user, connected]);

  const { data: convos, isLoading: convosLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/messages"],
    refetchInterval: connected ? 60000 : 10000,
  });

  const { data: verificationRequests, refetch: refetchVerifRequests } = useQuery<any[]>({
    queryKey: ["/api/verification/seller-requests"],
    queryFn: async () => {
      const res = await fetch("/api/verification/seller-requests", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
  const allRequests = verificationRequests || [];
  const pendingCount = allRequests.filter(r => r.status === "pending").length;

  const { data: notifications, isLoading: notifsLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: notifCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!user,
    refetchInterval: 30000,
  });
  const notifUnreadCount = notifCountData?.count || 0;

  const markNotifReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllNotifsReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const [, navigate] = useLocation();

  const handleNotifClick = (notif: Notification) => {
    if (!notif.isRead) markNotifReadMutation.mutate(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const formatNotifTime = (date: string | Date | null) => {
    if (!date) return "";
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

  useEffect(() => {
    if (tabParam === "notifications" && activeTab !== "notifications") {
      setActiveTab("notifications");
    }
  }, [tabParam]);

  const { data: thread, isLoading: threadLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages/thread", selected?.otherId, selected?.listingId],
    enabled: !!selected,
    refetchInterval: connected ? 60000 : 5000,
    queryFn: async () => {
      const params = new URLSearchParams({ otherId: selected!.otherId });
      if (selected!.listingId) params.set("listingId", String(selected!.listingId));
      const res = await fetch(`/api/messages/thread?${params}`);
      if (!res.ok) throw new Error(t("messages.failedToFetch"));
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/messages", {
        receiverId: selected!.otherId,
        listingId: selected!.listingId,
        content,
      });
    },
    onSuccess: () => {
      setDraft("");
      send({ type: "stop_typing", receiverId: selected?.otherId, listingId: selected?.listingId });
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["/api/messages/thread", selected?.otherId, selected?.listingId] });
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const prevThreadLenRef = useRef(0);
  useEffect(() => {
    if (thread) {
      const newLen = thread.length;
      if (newLen !== prevThreadLenRef.current) {
        prevThreadLenRef.current = newLen;
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    }
  }, [thread]);

  const handleTyping = useCallback(() => {
    if (!selected) return;
    send({ type: "typing", receiverId: selected.otherId, listingId: selected.listingId });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      send({ type: "stop_typing", receiverId: selected.otherId, listingId: selected.listingId });
      typingTimerRef.current = null;
    }, 2000);
  }, [selected, send]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (selected) {
        send({ type: "stop_typing", receiverId: selected.otherId, listingId: selected.listingId });
      }
      typingUsers.forEach((timer) => clearTimeout(timer));
    };
  }, [selected, send, typingUsers]);

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\/listing\/\d+)/g);
    if (parts.length === 1) return <p>{content}</p>;
    return (
      <p>
        {parts.map((part, i) => {
          if (/^\/listing\/\d+$/.test(part)) {
            return (
              <Link key={i} href={part} className="underline font-medium hover:opacity-80">
                {t("messages.viewListing", "View listing")}
              </Link>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <MessageSquare className="w-16 h-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">{t("messages.pleaseLogIn")}</p>
          <a href="/api/login"><Button>{t("common.logIn")}</Button></a>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (!draft.trim() || !selected) return;
    sendMutation.mutate(draft.trim());
  };

  const isOtherTyping = selected
    ? typingUsers.has(`${selected.otherId}-${selected.listingId}`)
    : false;

  const isOtherOnline = selected ? onlineUsers.has(selected.otherId) : false;

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />

      <main className="container mx-auto px-4 py-6 flex-grow flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-2xl font-display font-bold gradient-text flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            {t("messages.title")}
          </h1>
          <div className="flex items-center gap-1 ml-auto" data-testid="ws-status">
            {connected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {connected ? t("messages.online") : t("messages.offline")}
            </span>
          </div>
        </div>

        <div className="flex-grow flex flex-col md:grid md:grid-cols-3 gap-4 min-h-0" style={{ height: "calc(100vh - 220px)" }}>
          <div className={`md:col-span-1 flex flex-col rounded-2xl border border-border bg-card ${selected ? "hidden md:flex" : ""}`} style={{ maxHeight: selected ? undefined : "calc(100vh - 220px)" }}>
            <div className="flex border-b border-border flex-shrink-0">
              <button
                onClick={() => setActiveTab("messages")}
                data-testid="tab-messages"
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "messages" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <MessageSquare className="w-4 h-4" />
                {t("messages.messagesTab", "Messages")}
                {convos && convos.some(c => c.unreadCount > 0) && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                    {convos.reduce((sum, c) => sum + c.unreadCount, 0)}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                data-testid="tab-notifications"
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "notifications" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <Bell className="w-4 h-4" />
                {t("nav.notifications", "Alerts")}
                {notifUnreadCount > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                    {notifUnreadCount}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("idReview")}
                data-testid="tab-id-review"
                className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "idReview" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <ShieldCheck className="w-4 h-4" />
                {t("messages.idReviewTab", "ID Review")}
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                    {pendingCount}
                  </Badge>
                )}
              </button>
            </div>

            <div className="overflow-y-auto flex-grow">
              {activeTab === "messages" && (
                <>
                  {convosLoading && (
                    <div className="p-4 space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                          <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                          <div className="flex-grow space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!convosLoading && (!convos || convos.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                      <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground text-sm">{t("messages.noConversations")}</p>
                      <p className="text-muted-foreground text-xs mt-1">{t("messages.messageFromListing")}</p>
                    </div>
                  )}

                  {convos?.map((convo, i) => {
                    const isSelected = selected?.otherId === convo.otherId && selected?.listingId === convo.listingId;
                    const isOwn = convo.lastMessage.senderId === user.id;
                    const isOnline = onlineUsers.has(convo.otherId);
                    return (
                      <div
                        key={i}
                        className={`w-full text-left p-4 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      >
                        <button
                          onClick={() => { prevThreadLenRef.current = 0; setSelected(convo); }}
                          data-testid={`conversation-${i}`}
                          className="flex gap-3 flex-grow min-w-0 text-left"
                        >
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                              {convo.listing?.photos?.[0] ? (
                                <img
                                  src={convo.listing.photos[0]}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    img.onerror = null;
                                    img.src = logoSrc;
                                    img.className = "w-full h-full object-contain p-2 bg-primary/5";
                                  }}
                                />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            {isOnline && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full"
                                data-testid={`online-indicator-${i}`}
                              />
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {convo.listing?.title || t("messages.directMessage")}
                              </p>
                              {convo.unreadCount > 0 && (
                                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 flex-shrink-0">
                                  {convo.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {isOwn ? `${t("messages.you")}: ` : ""}{convo.lastMessage.content}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                              {format(new Date(convo.lastMessage.createdAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center flex-shrink-0">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                                data-testid={`button-delete-thread-${i}`}
                                aria-label={t("messages.deleteChat", "Delete chat")}
                                title={t("messages.deleteChat", "Delete chat")}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("messages.deleteChatTitle", "Delete this conversation?")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("messages.deleteChatDescription", "This will permanently delete all messages in this conversation for both you and the other person. This action cannot be undone.")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  data-testid={`button-confirm-delete-thread-${i}`}
                                  onClick={async () => {
                                    try {
                                      const params = new URLSearchParams({ otherId: convo.otherId });
                                      if (convo.listingId) params.set("listingId", String(convo.listingId));
                                      await apiRequest("DELETE", `/api/messages/conversation?${params.toString()}`);
                                      if (isSelected) setSelected(null);
                                      qc.invalidateQueries({ queryKey: ["/api/messages"] });
                                      qc.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
                                      qc.removeQueries({ queryKey: ["/api/messages/thread", convo.otherId, convo.listingId] });
                                      toast({ title: t("messages.chatDeleted", "Conversation deleted") });
                                    } catch {
                                      toast({ title: t("common.error", "Error"), variant: "destructive" });
                                    }
                                  }}
                                >
                                  {t("messages.deleteConfirm", "Delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {activeTab === "idReview" && (
                <>
                  {allRequests.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                      <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground text-sm">{t("messages.noIdRequests", "No ID review requests")}</p>
                      <p className="text-muted-foreground text-xs mt-1">{t("messages.idRequestsWillAppear", "Buyer verification requests will appear here")}</p>
                    </div>
                  )}

                  {allRequests.map((req: any) => {
                    const isPending = req.status === "pending";
                    const isApproved = req.status === "approved";
                    const isRejected = req.status === "rejected";
                    return (
                      <div
                        key={req.id}
                        className={`p-4 border-b border-border last:border-0 transition-colors ${isPending ? "hover:bg-muted/50" : "opacity-75"}`}
                        data-testid={`verification-request-${req.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPending ? "bg-amber-100 dark:bg-amber-900/30" : isApproved ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                            <Shield className={`w-5 h-5 ${isPending ? "text-amber-600 dark:text-amber-400" : isApproved ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} />
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2">
                              <Link href={`/seller/${req.userId}`} className="text-sm font-semibold text-foreground hover:text-primary hover:underline truncate transition-colors" data-testid={`link-buyer-profile-${req.id}`}>{req.buyerName || "Unknown buyer"}</Link>
                              {isApproved && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-0">
                                  {t("messages.approved", "Approved")}
                                </Badge>
                              )}
                              {isRejected && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-0">
                                  {t("messages.rejected", "Rejected")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {req.listingTitle ? `${t("messages.forListing", "For")}: ${req.listingTitle}` : t("messages.generalVerification", "General verification")}
                            </p>
                            {req.listingDeactivated ? (
                              <p className="text-xs text-muted-foreground mt-1 italic flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Listing deactivated — submitted ID is no longer visible
                              </p>
                            ) : req.documentUrl ? (
                              <a
                                href={req.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                                data-testid={`link-view-id-${req.id}`}
                              >
                                <Shield className="w-3 h-3" /> {t("messages.viewSubmittedId", "View submitted ID")}
                              </a>
                            ) : null}
                            {isPending && !req.listingDeactivated && (
                              <div className="flex items-center gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs gap-1 px-2.5"
                                  data-testid={`button-approve-${req.id}`}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/verification/seller-requests/${req.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ status: "approved" }),
                                        credentials: "include",
                                      });
                                      if (res.ok) {
                                        toast({ title: t("messages.verificationApproved", "Buyer verified"), description: t("messages.buyerCanNowAccess", "The buyer can now access your listing details.") });
                                        refetchVerifRequests();
                                        qc.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
                                      }
                                    } catch { toast({ title: "Error", variant: "destructive" }); }
                                  }}
                                >
                                  <CheckCircle2 className="w-3 h-3" /> {t("messages.approve", "Approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 px-2.5 text-destructive hover:text-destructive"
                                  data-testid={`button-reject-${req.id}`}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(`/api/verification/seller-requests/${req.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ status: "rejected", sellerNote: "ID could not be verified." }),
                                        credentials: "include",
                                      });
                                      if (res.ok) {
                                        toast({ title: t("messages.verificationRejected", "Request rejected") });
                                        refetchVerifRequests();
                                        qc.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
                                      }
                                    } catch { toast({ title: "Error", variant: "destructive" }); }
                                  }}
                                >
                                  <AlertTriangle className="w-3 h-3" /> {t("messages.reject", "Reject")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {activeTab === "notifications" && (
                <>
                  {notifsLoading && (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="p-3 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      ))}
                    </div>
                  )}

                  {!notifsLoading && notifUnreadCount > 0 && (
                    <div className="p-3 border-b border-border flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => markAllNotifsReadMutation.mutate()}
                        disabled={markAllNotifsReadMutation.isPending}
                        data-testid="button-mark-all-notifs-read"
                      >
                        <Check className="w-3 h-3" />
                        {t("nav.markAllRead", "Mark all read")}
                      </Button>
                    </div>
                  )}

                  {!notifsLoading && (!notifications || notifications.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                      <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground text-sm">{t("nav.noNotifications", "No notifications yet")}</p>
                      <p className="text-muted-foreground text-xs mt-1">{t("nav.noNotificationsDesc", "You're all caught up! Notifications will appear here.")}</p>
                    </div>
                  )}

                  {notifications?.map(notif => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-muted/50 ${!notif.isRead ? "bg-primary/5" : ""}`}
                      onClick={() => handleNotifClick(notif)}
                      data-testid={`notif-item-${notif.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!notif.isRead ? "bg-primary/10" : "bg-muted"}`}>
                          <Bell className={`w-4 h-4 ${!notif.isRead ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notif.isRead ? "font-semibold" : ""}`} data-testid={`text-notif-title-${notif.id}`}>
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" data-testid={`text-notif-body-${notif.id}`}>
                              {notif.body}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {formatNotifTime(notif.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                          {notif.link && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                          {!notif.isRead && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className={`md:col-span-2 rounded-2xl border border-border bg-card flex flex-col overflow-hidden flex-grow ${!selected && activeTab !== "notifications" ? "hidden md:flex" : ""} ${activeTab === "notifications" ? "hidden" : ""}`}>
            {!selected ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground">{t("messages.selectConversation")}</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0">
                  <button
                    className="md:hidden p-1 rounded hover:bg-muted text-muted-foreground"
                    onClick={() => setSelected(null)}
                    data-testid="button-back-to-conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {selected.listing && (
                    <>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {selected.listing.photos?.[0] ? (
                          <img
                            src={selected.listing.photos[0]}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.onerror = null;
                              img.src = logoSrc;
                              img.className = "w-full h-full object-contain p-2 bg-primary/5";
                            }}
                          />
                        ) : (
                          <Package className="w-5 h-5 m-auto text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <Link href={`/listing/${selected.listing.id}`}>
                          <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">
                            {selected.listing.title}
                          </p>
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isOtherOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                          <p className="text-xs text-muted-foreground">
                            {isOtherOnline ? t("messages.online") : t("messages.offline")}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                  {!selected.listing && (
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-semibold truncate">{selected.otherId}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOtherOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                        <p className="text-xs text-muted-foreground">
                          {isOtherOnline ? t("messages.online") : t("messages.offline")}
                        </p>
                      </div>
                    </div>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        data-testid="button-delete-conversation"
                        title={t("messages.deleteChat", "Delete chat")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("messages.deleteChatTitle", "Delete this conversation?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("messages.deleteChatDescription", "This will permanently delete all messages in this conversation for both you and the other person. This action cannot be undone.")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-delete-conversation"
                          onClick={async () => {
                            try {
                              const params = new URLSearchParams({ otherId: selected.otherId });
                              if (selected.listingId) params.set("listingId", String(selected.listingId));
                              await apiRequest("DELETE", `/api/messages/conversation?${params.toString()}`);
                              setSelected(null);
                              qc.invalidateQueries({ queryKey: ["/api/messages"] });
                              qc.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
                              toast({ title: t("messages.chatDeleted", "Conversation deleted") });
                            } catch {
                              toast({ title: t("common.error", "Error"), variant: "destructive" });
                            }
                          }}
                        >
                          {t("messages.deleteConfirm", "Delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                  {threadLoading && (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                          <Skeleton className="h-10 w-48 rounded-2xl" />
                        </div>
                      ))}
                    </div>
                  )}

                  {thread?.map((msg) => {
                    const isMine = msg.senderId === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          data-testid={`message-${msg.id}`}
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {renderMessageContent(msg.content)}
                          <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {format(new Date(msg.createdAt), "h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {isOtherTyping && (
                    <div className="flex justify-start" data-testid="typing-indicator">
                      <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>

                <div className="p-4 border-t border-border flex gap-3 flex-shrink-0">
                  <Input
                    autoComplete="off"
                    placeholder={t("messages.typeMessage")}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (e.target.value.trim()) handleTyping();
                    }}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    data-testid="input-message"
                    className="flex-grow"
                  />
                  <Button onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending} data-testid="button-send-message">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
