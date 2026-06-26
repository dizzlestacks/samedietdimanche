import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import { AccessibilityInit } from "@/components/AccessibilityWidget";
import { Footer } from "@/components/Footer";
import { BottomTabBar } from "@/components/BottomTabBar";
import { OnboardingTourTrigger } from "@/components/OnboardingTour";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import CreateListing from "@/pages/CreateListing";
import EditListing from "@/pages/EditListing";
import ListingDetail from "@/pages/ListingDetail";
import Dashboard from "@/pages/Dashboard";
import NearbyShops from "@/pages/NearbyShops";
import Explore from "@/pages/Explore";
import CollectionsPage from "@/pages/Collections";
import Messages from "@/pages/Messages";
import BoostListing from "@/pages/BoostListing";
import BoostSuccess from "@/pages/BoostSuccess";
import VerifyBuyer from "@/pages/VerifyBuyer";
import SellerProfile from "@/pages/SellerProfile";
import CategoryBrowse from "@/pages/CategoryBrowse";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Events from "@/pages/Events";
import CreateEvent from "@/pages/CreateEvent";
import EventDetail from "@/pages/EventDetail";
import BulkImport from "@/pages/BulkImport";
import Offers from "@/pages/Offers";
import Orders from "@/pages/Orders";
import Analytics from "@/pages/Analytics";
import Welcome from "@/pages/Welcome";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import WishlistPage from "@/pages/Wishlist";
import RewardsPage from "@/pages/Rewards";
import BarcodeScanner from "@/pages/BarcodeScanner";

import CommunityTipsPage from "@/pages/CommunityTips";
import NeighborhoodEventsPage from "@/pages/NeighborhoodEvents";
import NotificationsPage from "@/pages/Notifications";
import HelpCenter from "@/pages/HelpCenter";
import OrderPaymentSuccess from "@/pages/OrderPaymentSuccess";
import Wallet from "@/pages/Wallet";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import { CookieConsent } from "@/components/CookieConsent";

function Router() {
  return (
    <Switch>
      <Route path="/welcome" component={Welcome} />
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/create" component={CreateListing} />
      <Route path="/edit/:id" component={EditListing} />
      <Route path="/listing/:id" component={ListingDetail} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/explore" component={Explore} />
      <Route path="/collections/:slug" component={CollectionsPage} />
      <Route path="/collections" component={CollectionsPage} />
      <Route path="/nearby-shops" component={NearbyShops} />
      <Route path="/messages" component={Messages} />
      <Route path="/boost/success" component={BoostSuccess} />
      <Route path="/boost/:id" component={BoostListing} />
      <Route path="/verify" component={VerifyBuyer} />
      <Route path="/seller/:userId" component={SellerProfile} />
      <Route path="/category/:category" component={CategoryBrowse} />
      <Route path="/events" component={Events} />
      <Route path="/events/create" component={CreateEvent} />
      <Route path="/events/:id" component={EventDetail} />
      <Route path="/bulk-import" component={BulkImport} />
      <Route path="/offers" component={Offers} />
      <Route path="/orders/payment-success" component={OrderPaymentSuccess} />
      <Route path="/orders" component={Orders} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/wishlist" component={WishlistPage} />
      <Route path="/rewards" component={RewardsPage} />
      <Route path="/scan" component={BarcodeScanner} />

      <Route path="/tips" component={CommunityTipsPage} />
      <Route path="/neighborhood-events" component={NeighborhoodEventsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      <Route path="/help" component={HelpCenter} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route component={NotFound} />
    </Switch>
  );
}

const noFooterRoutes = ["/messages", "/login", "/register"];

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
  }, [location]);
  return null;
}

function AppShell() {
  const [location] = useLocation();
  const hideFooter = noFooterRoutes.some((r) => location.startsWith(r));

  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <Router />
      {!hideFooter && <Footer />}
      {!hideFooter && <div className="h-16 md:hidden" />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <OfflineBanner />
            <AppShell />
            <BottomTabBar />
            <AccessibilityInit />
            <InstallPrompt />
            <OnboardingTourTrigger />
            <CookieConsent />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
