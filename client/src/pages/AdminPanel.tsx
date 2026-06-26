import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Shield, Flag, Loader2, Eye, Trash2, LogOut, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface VerificationRequest {
  id: number;
  userId: string;
  documentUrl: string;
  status: string;
  createdAt: string;
}

interface Report {
  id: number;
  listingId: number;
  reporterId: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: string;
  listing?: { id: number; title: string; userId: string };
}

export default function AdminPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();

  useOGMeta({ title: "Admin Panel" });

  const { data: adminCheck, isLoading: isCheckLoading } = useQuery<{ isAdmin: boolean; sessionAuthed: boolean; passwordAuthed: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      if (!res.ok) return { isAdmin: false, sessionAuthed: false, passwordAuthed: false };
      return res.json();
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Invalid password");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/check"] });
      toast({ title: "Welcome, Admin!" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Incorrect password", variant: "destructive" });
    },
  });

  const handleSignOut = async () => {
    if (adminCheck?.sessionAuthed) {
      window.location.href = "/api/logout";
    } else {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      qc.removeQueries({ queryKey: ["/api/admin/check"] });
      qc.removeQueries({ queryKey: ["/api/admin/verifications"] });
      qc.removeQueries({ queryKey: ["/api/admin/reports"] });
      navigate("/admin");
    }
  };

  const { data: verifications, isLoading: verLoading } = useQuery<VerificationRequest[]>({
    queryKey: ["/api/admin/verifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/verifications", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin,
  });

  const { data: reportsData, isLoading: repLoading } = useQuery<Report[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reports", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: !!adminCheck?.isAdmin,
  });

  const verMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
      toast({ title: status === "approved" ? "Verification approved" : "Verification rejected" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Report updated" });
    },
  });

  if (isCheckLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-6 p-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold font-display mb-2">Admin Access</h2>
            <p className="text-muted-foreground text-sm">Enter the admin password to continue</p>
          </div>
          <div className="w-full max-w-sm space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-10"
                data-testid="input-admin-password"
                onKeyDown={e => { if (e.key === "Enter") loginMutation.mutate(); }}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => loginMutation.mutate()}
              disabled={!password || loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Sign In as Admin
            </Button>
            <Link href="/">
              <Button variant="ghost" className="w-full text-muted-foreground">Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pendingVer = verifications?.filter(v => v.status === "pending") || [];
  const pendingRep = reportsData?.filter(r => r.status === "pending") || [];

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-5xl flex-grow">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
              <div className="flex gap-2 mt-1">
                {pendingVer.length > 0 && <Badge className="bg-amber-500 text-white text-xs">{pendingVer.length} verifications pending</Badge>}
                {pendingRep.length > 0 && <Badge className="bg-red-500 text-white text-xs">{pendingRep.length} reports pending</Badge>}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleSignOut}
            data-testid="button-admin-logout"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>

        <Tabs defaultValue="verifications">
          <TabsList className="mb-6">
            <TabsTrigger value="verifications" className="gap-2">
              <Shield className="w-4 h-4" /> Verifications
              {pendingVer.length > 0 && <Badge className="bg-amber-500 text-white text-xs px-1.5">{pendingVer.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <Flag className="w-4 h-4" /> Reports
              {pendingRep.length > 0 && <Badge className="bg-red-500 text-white text-xs px-1.5">{pendingRep.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="verifications">
            {verLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : verifications?.length === 0 ? (
              <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border">
                <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No verification requests yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {verifications?.map(v => (
                  <Card key={v.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">User: <span className="font-mono text-xs text-muted-foreground">{v.userId}</span></p>
                        <Badge variant={v.status === "approved" ? "default" : v.status === "rejected" ? "destructive" : "outline"} className="text-xs">
                          {v.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Submitted {format(new Date(v.createdAt), "MMM d, yyyy h:mm a")}</p>
                    </div>
                    <div className="flex gap-2 items-center flex-shrink-0">
                      <a href={v.documentUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <Eye className="w-3.5 h-3.5" /> View ID
                        </Button>
                      </a>
                      {v.status === "pending" && (
                        <>
                          <Button size="sm" className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                            disabled={verMutation.isPending}
                            onClick={() => verMutation.mutate({ id: v.id, status: "approved" })}>
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5 text-xs"
                            disabled={verMutation.isPending}
                            onClick={() => verMutation.mutate({ id: v.id, status: "rejected" })}>
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports">
            {repLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : reportsData?.length === 0 ? (
              <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border">
                <Flag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No reports yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reportsData?.map(r => (
                  <Card key={r.id} className="p-4 flex flex-col sm:flex-row gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{r.reason}</Badge>
                        <Badge variant={r.status === "dismissed" ? "outline" : r.status === "removed" ? "destructive" : "secondary"} className="text-xs">
                          {r.status}
                        </Badge>
                      </div>
                      {r.listing && (
                        <Link href={`/listing/${r.listing.id}`}>
                          <p className="font-medium text-sm hover:text-primary cursor-pointer mb-1">
                            "{r.listing.title}"
                          </p>
                        </Link>
                      )}
                      {r.details && <p className="text-xs text-muted-foreground mb-1">"{r.details}"</p>}
                      <p className="text-xs text-muted-foreground">Reported {format(new Date(r.createdAt), "MMM d, yyyy")}</p>
                    </div>
                    {r.status === "pending" && (
                      <div className="flex gap-2 flex-shrink-0 items-start">
                        <Button variant="outline" size="sm" className="text-xs"
                          onClick={() => reportMutation.mutate({ id: r.id, status: "dismissed" })}>
                          Dismiss
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-1.5 text-xs"
                          onClick={() => reportMutation.mutate({ id: r.id, status: "removed" })}>
                          <Trash2 className="w-3.5 h-3.5" /> Remove Listing
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
