import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CheckCircle, ArrowLeft } from "lucide-react";
import { ButtonLoader } from "@/components/PageLoader";
import { useToast } from "@/hooks/use-toast";
const logoSrc = "/yardees-logo.png";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [, params] = useRoute("/reset-password/:token");
  const token = params?.token || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t("auth.passwordsMismatch"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccess(true);
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
            <CardTitle className="text-2xl font-display">{t("auth.chooseNewPassword")}</CardTitle>
            <CardDescription>{t("auth.enterNewPassword")}</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-4" data-testid="text-reset-success">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="font-medium mb-2">{t("auth.passwordResetSuccess")}</p>
                <p className="text-sm text-muted-foreground mb-6">{t("auth.canNowLogin")}</p>
                <Link href="/login">
                  <Button className="gap-2" data-testid="link-go-to-login">
                    {t("auth.goToLogin")}
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.newPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                      data-testid="input-reset-password"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("auth.passwordRequirements")}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-reset-confirm"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading} data-testid="button-reset-submit">
                  {loading ? <ButtonLoader /> : <Lock className="w-4 h-4" />}
                  {t("auth.resetPasswordBtn")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="text-primary hover:underline font-medium">
                    <ArrowLeft className="w-3 h-3 inline mr-1" />
                    {t("auth.backToLogin")}
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
