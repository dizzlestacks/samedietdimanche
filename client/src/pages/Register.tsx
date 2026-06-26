import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, User, UserPlus } from "lucide-react";
import { ButtonLoader } from "@/components/PageLoader";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
const logoSrc = "/yardees-logo.png";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function Register() {
  const { t } = useTranslation();
  useOGMeta({ title: "Sign Up", description: "Create a free YARDEES account to start buying and selling second-hand items.", url: `${window.location.origin}/register` });
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get("ref") || "";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: t("auth.passwordsDontMatch"), variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: t("auth.passwordMinLength"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("auth.registrationFailed"));
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      if (referralCode && data.userId) {
        fetch("/api/referral/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode, userId: data.userId }),
        }).catch(() => {});
      }
      toast({ title: t("auth.welcomeToYardees") });
      navigate("/");
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <img src={logoSrc} alt="Yardees" className="h-16 w-auto cursor-pointer" />
          </Link>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-display">{t("auth.createYourAccount")}</CardTitle>
            <CardDescription>{t("auth.joinYardees")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">{t("auth.displayName")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    autoComplete="name"
                    placeholder={t("auth.displayNamePlaceholder")}
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-register-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t("auth.emailPlaceholder")}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-register-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("auth.passwordPlaceholder")}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-register-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t("auth.confirmPassword")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="pl-10"
                    required
                    data-testid="input-register-confirm"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading} data-testid="button-register-submit">
                {loading ? <ButtonLoader /> : <UserPlus className="w-4 h-4" />}
                {t("auth.createAccount")}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-4" data-testid="text-register-legal">
              {t("auth.agreeToTerms")}{" "}
              <Link href="/terms" className="text-primary hover:underline font-medium" data-testid="link-register-terms">
                {t("legal.termsOfService")}
              </Link>{" "}
              {t("common.and")}{" "}
              <Link href="/privacy" className="text-primary hover:underline font-medium" data-testid="link-register-privacy">
                {t("legal.privacyPolicy")}
              </Link>
            </p>

            <p className="text-center text-sm text-muted-foreground mt-3">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                {t("auth.signIn")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
