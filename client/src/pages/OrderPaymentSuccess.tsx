import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function OrderPaymentSuccess() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"confirming" | "success" | "error">("confirming");
  const [errorMsg, setErrorMsg] = useState("");

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id");
  const sessionId = params.get("session_id");

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/payment-confirm`, { sessionId });
      return res.json();
    },
    onSuccess: () => {
      setStatus("success");
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (err: Error) => {
      setStatus("error");
      setErrorMsg(err.message || "Payment confirmation failed");
    },
  });

  useEffect(() => {
    if (orderId && sessionId && status === "confirming") {
      confirmMutation.mutate();
    } else if (!orderId || !sessionId) {
      setStatus("error");
      setErrorMsg("Missing payment information");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-16 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="max-w-md w-full p-8 text-center space-y-6">
            {status === "confirming" && (
              <>
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Confirming Payment</h2>
                  <p className="text-muted-foreground">Please wait while we verify your payment...</p>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
                  <p className="text-muted-foreground mb-1">
                    Your payment has been confirmed and the seller has been notified.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your funds are held securely until you confirm delivery.
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Link href="/orders">
                    <Button className="w-full" size="lg" data-testid="button-view-orders">
                      View My Orders
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Payment Issue</h2>
                  <p className="text-muted-foreground">{errorMsg}</p>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Link href="/orders">
                    <Button className="w-full" data-testid="button-back-orders">
                      Back to Orders
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
