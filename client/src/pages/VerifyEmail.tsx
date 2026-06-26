import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
const logoSrc = "/yardees-logo.png";
import { useTranslation } from "react-i18next";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  const isSuccess = status === "success";
  const isInvalid = status === "invalid";

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
            <CardTitle className="text-2xl font-display">
              {isSuccess ? t("auth.emailVerified") : isInvalid ? t("auth.invalidLink") : t("auth.verificationError")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center py-4">
            {isSuccess ? (
              <>
                <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground mb-6" data-testid="text-verify-success">{t("auth.emailVerifiedDesc")}</p>
                <Link href="/">
                  <Button className="gap-2" data-testid="link-start-browsing">{t("auth.startBrowsing")}</Button>
                </Link>
              </>
            ) : isInvalid ? (
              <>
                <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <p className="text-muted-foreground mb-6" data-testid="text-verify-invalid">{t("auth.invalidLinkDesc")}</p>
                <Link href="/login">
                  <Button variant="outline" data-testid="link-go-to-login">{t("auth.goToLogin")}</Button>
                </Link>
              </>
            ) : (
              <>
                <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                <p className="text-muted-foreground mb-6" data-testid="text-verify-error">{t("auth.verificationErrorDesc")}</p>
                <Link href="/">
                  <Button variant="outline" data-testid="link-go-home">{t("auth.goHome")}</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
