import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { ButtonLoader } from "@/components/PageLoader";
import { useToast } from "@/hooks/use-toast";
const logoSrc = "/yardees-logo.png";
import { useTranslation } from "react-i18next";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSent(true);
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
            <CardTitle className="text-2xl font-display">{t("auth.resetPassword")}</CardTitle>
            <CardDescription>{t("auth.resetPasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4" data-testid="text-reset-sent">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="font-medium mb-2">{t("auth.resetEmailSent")}</p>
                <p className="text-sm text-muted-foreground mb-6">{t("auth.checkInbox")}</p>
                <Link href="/login">
                  <Button variant="outline" className="gap-2" data-testid="link-back-to-login">
                    <ArrowLeft className="w-4 h-4" />
                    {t("auth.backToLogin")}
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        data-testid="input-forgot-email"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading} data-testid="button-forgot-submit">
                    {loading ? <ButtonLoader /> : <Mail className="w-4 h-4" />}
                    {t("auth.sendResetLink")}
                  </Button>
                </form>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-back-to-login">
                    <ArrowLeft className="w-3 h-3 inline mr-1" />
                    {t("auth.backToLogin")}
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
