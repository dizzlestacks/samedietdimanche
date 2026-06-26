import { useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Upload, CheckCircle, Clock, AlertCircle, FileText, ArrowLeft, History } from "lucide-react";
import { InlineLoader, ButtonLoader } from "@/components/PageLoader";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

interface VerificationRequest {
  id: number;
  userId: string;
  documentUrl: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  listingId?: number | null;
}

interface VerificationStatusResponse {
  request: VerificationRequest | null;
  verificationLevel: string;
  isGloballyVerified: boolean;
}

export default function VerifyBuyer() {
  const { t } = useTranslation();
  useOGMeta({ title: "Verify Identity", description: "Verify your identity to build trust on YARDEES marketplace.", url: `${window.location.origin}/verify` });
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: verificationData, isLoading, refetch } = useQuery<VerificationStatusResponse>({
    queryKey: ["/api/verification/status"],
    enabled: !!user,
  });

  const { data: history } = useQuery<VerificationRequest[]>({
    queryKey: ["/api/verification/history"],
    enabled: !!user && showHistory,
  });

  const isGloballyVerified = verificationData?.isGloballyVerified || false;
  const verificationLevel = verificationData?.verificationLevel || "unverified";
  const latestRequest = verificationData?.request;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const res = await fetch("/api/verification/submit", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      toast({ title: t("verify.idSubmitted"), description: t("verify.reviewMessage") });
      setFile(null);
      setPreview(null);
      setResubmitting(false);
      refetch();
    } catch {
      toast({ title: t("verify.submissionFailed"), description: t("verify.pleaseTryAgain"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <ShieldCheck className="w-16 h-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">{t("verify.pleaseLogIn")}</p>
          <a href="/api/login"><Button>{t("common.logIn")}</Button></a>
        </div>
      </div>
    );
  }

  const statusConfig = {
    pending: { icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-800", label: t("verify.underReview"), desc: t("verify.underReviewDesc") },
    approved: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-800", label: t("verify.verifiedBuyerLabel"), desc: t("verify.verifiedBuyerDesc") },
    rejected: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/5", border: "border-destructive/20", label: t("verify.rejectedLabel"), desc: t("verify.rejectedDesc") },
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />

      <main className="container mx-auto px-4 py-10 max-w-2xl flex-grow">
        <Link href="/">
          <Button variant="ghost" className="mb-6 pl-0 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("common.back")}
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            <h1 className="text-3xl font-display font-bold gradient-text">{t("verify.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("verify.subtitle")}
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {[
            { icon: ShieldCheck, title: t("verify.accessVerifiedListings"), desc: t("verify.accessVerifiedDesc") },
            { icon: CheckCircle, title: t("verify.verifiedBadge"), desc: t("verify.verifiedBadgeDesc") },
            { icon: FileText, title: t("verify.streamlinedComm"), desc: t("verify.streamlinedCommDesc") },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <InlineLoader />
        ) : isGloballyVerified ? (
          <div className="space-y-4">
            <div className="rounded-2xl border p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h3 className="font-semibold text-lg text-green-600">
                  Identity Verified
                </h3>
                <Badge variant="outline" className="ml-auto border-green-300 text-green-700 dark:text-green-400" data-testid="badge-verification-level">
                  {verificationLevel === "trusted_seller" ? "Trusted Seller" : "ID Verified"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mb-2">
                Your identity has been verified. This status is permanent and tied to your account. You don't need to re-upload your ID — sellers and listings that require verification will automatically recognize your verified status.
              </p>
              <p className="text-xs text-muted-foreground">
                When requesting access to address-protected listings, your verified status will be shared with the seller automatically.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowHistory(!showHistory)}
              data-testid="button-toggle-history"
            >
              <History className="w-4 h-4" />
              {showHistory ? "Hide Verification History" : "View Verification History"}
            </Button>

            {showHistory && history && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Verification History</h4>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No verification records found.</p>
                ) : (
                  history.map((req) => (
                    <div key={req.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`verification-history-${req.id}`}>
                      <div className="flex items-center gap-2">
                        {req.status === "approved" && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {req.status === "pending" && <Clock className="w-4 h-4 text-amber-500" />}
                        {req.status === "rejected" && <AlertCircle className="w-4 h-4 text-destructive" />}
                        <span className="text-sm font-medium capitalize">{req.status}</span>
                        {req.listingId && (
                          <span className="text-xs text-muted-foreground">(Listing #{req.listingId})</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : latestRequest && !resubmitting ? (
          <div className="space-y-4">
            <div className={`rounded-2xl border p-6 ${statusConfig[latestRequest.status].bg} ${statusConfig[latestRequest.status].border}`}>
              <div className="flex items-center gap-3 mb-3">
                {(() => {
                  const StatusIcon = statusConfig[latestRequest.status].icon;
                  return <StatusIcon className={`w-6 h-6 ${statusConfig[latestRequest.status].color}`} />;
                })()}
                <h3 className={`font-semibold text-lg ${statusConfig[latestRequest.status].color}`}>
                  {statusConfig[latestRequest.status].label}
                </h3>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                {statusConfig[latestRequest.status].desc}
              </p>
              {latestRequest.status === "pending" && (
                <p className="text-xs text-muted-foreground">
                  Your ID is being reviewed by our team. Once approved, your verification will be permanent and you won't need to upload again.
                </p>
              )}
              {latestRequest.status === "rejected" && (
                <Button onClick={() => { setFile(null); setPreview(null); setResubmitting(true); }} variant="outline" className="mt-2" data-testid="button-resubmit">
                  {t("verify.submitNewDocument")}
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowHistory(!showHistory)}
              data-testid="button-toggle-history"
            >
              <History className="w-4 h-4" />
              {showHistory ? "Hide Verification History" : "View Verification History"}
            </Button>

            {showHistory && history && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="font-semibold text-sm text-foreground">Verification History</h4>
                {history.map((req) => (
                  <div key={req.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`verification-history-${req.id}`}>
                    <div className="flex items-center gap-2">
                      {req.status === "approved" && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {req.status === "pending" && <Clock className="w-4 h-4 text-amber-500" />}
                      {req.status === "rejected" && <AlertCircle className="w-4 h-4 text-destructive" />}
                      <span className="text-sm font-medium capitalize">{req.status}</span>
                      {req.listingId && (
                        <span className="text-xs text-muted-foreground">(Listing #{req.listingId})</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-lg mb-2">{t("verify.submitYourId")}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {t("verify.submitIdDesc")}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Once approved, your verification is permanent. You won't need to re-upload your ID for future requests.
            </p>

            {preview ? (
              <div className="mb-6">
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={preview} alt="ID preview" className="w-full max-h-64 object-contain bg-muted" />
                  <button
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{file?.name}</p>
              </div>
            ) : (
              <label className="block border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-xl p-12 text-center cursor-pointer transition-colors mb-6" data-testid="label-upload-id">
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-foreground mb-1">{t("verify.clickToUpload")}</p>
                <p className="text-sm text-muted-foreground">{t("verify.fileTypes")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                  data-testid="input-upload-id"
                />
              </label>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!file || uploading}
              size="lg"
              className="w-full gap-2"
              data-testid="button-submit-id"
            >
              {uploading ? (
                <><ButtonLoader /> {t("verify.submitting")}</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> {t("verify.submitForVerification")}</>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {t("verify.agreementText")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
