import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useOGMeta } from "@/hooks/use-og-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle2, XCircle, DollarSign, Building2, CreditCard, Banknote, TrendingUp, ShieldCheck, AlertTriangle, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { currencySymbols } from "@shared/schema";

interface WalletBalance {
  totalEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawal: number;
  availableBalance: number;
  currency: string;
  orderCount: number;
}

interface PayoutRecord {
  id: number;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  bankName: string | null;
  accountHolderName: string | null;
  accountLastFour: string | null;
  routingNumber: string | null;
  paypalEmail: string | null;
  paymentMethod: string;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
}

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  useOGMeta({ title: "Wallet & Payouts", description: "Manage your earnings and withdraw funds.", url: `${window.location.origin}/wallet` });

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [routingNumber, setRoutingNumber] = useState("");
  const [swiftCode, setSwiftCode] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");

  const { data: balance, isLoading: balanceLoading } = useQuery<WalletBalance>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user,
  });

  const { data: payoutHistory = [], isLoading: payoutsLoading } = useQuery<PayoutRecord[]>({
    queryKey: ["/api/wallet/payouts"],
    enabled: !!user,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Withdrawal Requested", description: "Your payout request has been submitted for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/payouts"] });
      setShowWithdrawDialog(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to submit withdrawal", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setWithdrawAmount("");
    setBankName("");
    setAccountHolderName("");
    setAccountNumber("");
    setAccountType("checking");
    setRoutingNumber("");
    setSwiftCode("");
    setBankAddress("");
    setPaypalEmail("");
    setPaymentMethod("bank_transfer");
  };

  const isPaypal = paymentMethod === "paypal";

  const handleWithdraw = () => {
    const amountInCents = Math.round(parseFloat(withdrawAmount) * 100);
    if (isNaN(amountInCents) || amountInCents < 500) {
      toast({ title: "Invalid Amount", description: "Minimum withdrawal is $5.00", variant: "destructive" });
      return;
    }
    if (isPaypal) {
      if (!paypalEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim())) {
        toast({ title: "Missing Info", description: "A valid PayPal email address is required", variant: "destructive" });
        return;
      }
      withdrawMutation.mutate({
        amount: amountInCents,
        paypalEmail: paypalEmail.trim(),
        paymentMethod: "paypal",
      });
    } else if (paymentMethod === "bank_transfer") {
      if (!accountHolderName.trim() || !accountNumber.trim() || !bankName.trim() || !routingNumber.trim()) {
        toast({ title: "Missing Info", description: "Account holder name, bank name, account number, and routing number are all required", variant: "destructive" });
        return;
      }
      withdrawMutation.mutate({
        amount: amountInCents,
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        accountType,
        routingNumber: routingNumber.trim(),
        paymentMethod,
      });
    } else {
      if (!accountHolderName.trim() || !accountNumber.trim() || !bankName.trim() || !swiftCode.trim()) {
        toast({ title: "Missing Info", description: "Account holder name, bank name, account number, and SWIFT/BIC code are all required", variant: "destructive" });
        return;
      }
      withdrawMutation.mutate({
        amount: amountInCents,
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        accountType,
        routingNumber: routingNumber.trim() || undefined,
        swiftCode: swiftCode.trim(),
        bankAddress: bankAddress.trim() || undefined,
        paymentMethod,
      });
    }
  };

  const formatAmount = (cents: number, currency = "USD") => {
    const symbol = currencySymbols[currency] || "$";
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Pending Review", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300", icon: Clock },
    processing: { label: "Processing", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", icon: ArrowUpFromLine },
    completed: { label: "Completed", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300", icon: CheckCircle2 },
    rejected: { label: "Rejected", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300", icon: XCircle },
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <WalletIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Please log in to view your wallet.</p>
            <Link href="/login">
              <Button className="mt-4" data-testid="button-login-wallet">Log In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-28">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-3" data-testid="text-wallet-title">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-primary" />
            </div>
            Wallet & Payouts
          </h1>
          <p className="text-muted-foreground mt-1">Manage your earnings and withdraw funds via bank transfer or PayPal.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available Balance</p>
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-primary" data-testid="text-available-balance">
                  {balanceLoading ? "..." : formatAmount(balance?.availableBalance || 0, balance?.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Earnings</p>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-earnings">
                  {balanceLoading ? "..." : formatAmount(balance?.totalEarnings || 0, balance?.currency)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From {balance?.orderCount || 0} completed orders</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Withdrawn</p>
                  <ArrowUpFromLine className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-withdrawn">
                  {balanceLoading ? "..." : formatAmount(balance?.totalWithdrawn || 0, balance?.currency)}
                </p>
                {(balance?.pendingWithdrawal || 0) > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {formatAmount(balance?.pendingWithdrawal || 0)} pending
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={() => setShowWithdrawDialog(true)}
            disabled={!balance || balance.availableBalance < 500}
            className="gap-2"
            data-testid="button-withdraw"
          >
            <ArrowDownToLine className="w-4 h-4" /> Withdraw Funds
          </Button>
          {balance && balance.availableBalance < 500 && balance.availableBalance > 0 && (
            <p className="text-xs text-muted-foreground">Minimum withdrawal: $5.00</p>
          )}
        </div>

        <Card className="mb-6 border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Secure Payouts</p>
                <p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                  Withdrawals are reviewed and processed within 3-5 business days. Your earnings are held securely until you request a payout. Funds from completed orders with confirmed delivery are available for withdrawal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="w-5 h-5" /> Payout History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payoutsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : payoutHistory.length === 0 ? (
              <div className="text-center py-12">
                <Banknote className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No payouts yet</p>
                <p className="text-muted-foreground text-xs mt-1">Your withdrawal history will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {payoutHistory.map((payout, idx) => {
                    const config = statusConfig[payout.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <motion.div
                        key={payout.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/30 transition-colors"
                        data-testid={`payout-row-${payout.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.color}`}>
                            <StatusIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{formatAmount(payout.amount, payout.currency)}</p>
                            <p className="text-xs text-muted-foreground">
                              {payout.paymentMethod === "bank_transfer" ? "Bank Transfer" : payout.paymentMethod === "paypal" ? "PayPal" : payout.paymentMethod === "wire_transfer" ? "Wire Transfer" : payout.paymentMethod}
                              {payout.paymentMethod === "paypal" && payout.paypalEmail ? ` • ${payout.paypalEmail}` : ""}
                              {payout.paymentMethod !== "paypal" && payout.bankName ? ` • ${payout.bankName}` : ""}
                              {payout.paymentMethod !== "paypal" && payout.accountLastFour ? ` ••••${payout.accountLastFour}` : payout.paymentMethod !== "paypal" && (payout as any).accountNumber ? ` ••••${(payout as any).accountNumber.slice(-4)}` : ""}
                            </p>
                            {payout.adminNote && (
                              <p className="text-xs text-muted-foreground mt-0.5 italic">Note: {payout.adminNote}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${config.color}`}>
                            {config.label}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(payout.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-primary" /> Request Withdrawal
            </DialogTitle>
            <DialogDescription>
              Enter the amount and choose your payout method. Payouts are processed within 3-5 business days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="withdraw-amount" className="text-sm font-medium">Amount ({currencySymbols[balance?.currency || "USD"] || "$"})</Label>
              <div className="relative mt-1.5">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="5"
                  max={balance ? balance.availableBalance / 100 : 0}
                  placeholder="0.00"
                  className="pl-9"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  data-testid="input-withdraw-amount"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Available: {formatAmount(balance?.availableBalance || 0, balance?.currency)} • Min: $5.00
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Payout Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1.5" data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">
                    <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Bank Transfer (ACH)</span>
                  </SelectItem>
                  <SelectItem value="wire_transfer">
                    <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Wire Transfer</span>
                  </SelectItem>
                  <SelectItem value="paypal">
                    <span className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> PayPal</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isPaypal ? (
              <div>
                <Label htmlFor="paypal-email" className="text-sm font-medium">PayPal Email Address</Label>
                <Input
                  id="paypal-email"
                  type="email"
                  placeholder="you@example.com"
                  className="mt-1.5"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  data-testid="input-paypal-email"
                />
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Funds will be sent directly to this PayPal account.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="account-holder" className="text-sm font-medium">Account Holder Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="account-holder"
                    placeholder="John Doe"
                    className="mt-1.5"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    data-testid="input-account-holder"
                  />
                </div>

                <div>
                  <Label htmlFor="bank-name" className="text-sm font-medium">Bank Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="bank-name"
                    placeholder="Chase, Wells Fargo..."
                    className="mt-1.5"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    data-testid="input-bank-name"
                  />
                </div>

                <div>
                  <Label htmlFor="account-number" className="text-sm font-medium">Account Number {paymentMethod === "wire_transfer" ? "/ IBAN" : ""} <span className="text-destructive">*</span></Label>
                  <Input
                    id="account-number"
                    placeholder={paymentMethod === "wire_transfer" ? "Account number or IBAN" : "Enter your full account number"}
                    className="mt-1.5"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(paymentMethod === "wire_transfer" ? e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : e.target.value.replace(/\D/g, ""))}
                    data-testid="input-account-number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="account-type" className="text-sm font-medium">Account Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger className="mt-1.5" data-testid="select-account-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="routing" className="text-sm font-medium">
                      Routing Number {paymentMethod === "bank_transfer" && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="routing"
                      placeholder="021000021"
                      className="mt-1.5"
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, ""))}
                      data-testid="input-routing-number"
                    />
                  </div>
                </div>

                {paymentMethod === "wire_transfer" && (
                  <>
                    <div>
                      <Label htmlFor="swift-code" className="text-sm font-medium">SWIFT / BIC Code <span className="text-destructive">*</span></Label>
                      <Input
                        id="swift-code"
                        placeholder="e.g. CHASUS33"
                        className="mt-1.5"
                        value={swiftCode}
                        onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
                        data-testid="input-swift-code"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bank-address" className="text-sm font-medium">Bank Address</Label>
                      <Input
                        id="bank-address"
                        placeholder="123 Main St, New York, NY 10001"
                        className="mt-1.5"
                        value={bankAddress}
                        onChange={(e) => setBankAddress(e.target.value)}
                        data-testid="input-bank-address"
                      />
                    </div>
                  </>
                )}

                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Your details are securely stored and only visible to the admin for processing payouts.
                </p>
              </>
            )}

            {balance && parseFloat(withdrawAmount) * 100 > (balance.availableBalance || 0) && withdrawAmount !== "" && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5" /> Amount exceeds available balance
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowWithdrawDialog(false); resetForm(); }} data-testid="button-cancel-withdraw">
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                withdrawMutation.isPending ||
                !withdrawAmount ||
                parseFloat(withdrawAmount) < 5 ||
                (balance ? parseFloat(withdrawAmount) * 100 > balance.availableBalance : true) ||
                (isPaypal ? !paypalEmail.trim() : (
                  !accountHolderName.trim() || !bankName.trim() || accountNumber.length < 4 ||
                  (paymentMethod === "bank_transfer" && !routingNumber.trim()) ||
                  (paymentMethod === "wire_transfer" && !swiftCode.trim())
                ))
              }
              className="gap-2"
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? "Submitting..." : "Request Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
