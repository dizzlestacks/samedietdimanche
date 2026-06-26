import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, LogIn } from "lucide-react";
import { ButtonLoader } from "@/components/PageLoader";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
const logoSrc = "/yardees-logo.png";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";

export default function Login() {
  const { t } = useTranslation();
  useOGMeta({ title: "Log In", description: "Sign in to your YARDEES account to buy and sell second-hand items.", url: `${window.location.origin}/login` });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/login/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("auth.loginFailed"));
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
            <CardTitle className="text-2xl font-display">{t("auth.welcomeBack")}</CardTitle>
            <CardDescription>{t("auth.signInToAccount")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLocalLogin} className="space-y-4">
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
                        data-testid="input-login-email"
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
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-login-password"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading} data-testid="button-login-submit">
                    {loading ? <ButtonLoader /> : <LogIn className="w-4 h-4" />}
                    {t("auth.signIn")}
                  </Button>
                  <p className="text-right mt-2">
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
                      {t("auth.forgotPassword")}
                    </Link>
                  </p>
                </form>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  {t("auth.dontHaveAccount")}{" "}
                  <Link href="/register" className="text-primary hover:underline font-medium">
                    {t("auth.createOne")}
                  </Link>
                </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
