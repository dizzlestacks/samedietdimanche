import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Link } from "wouter";
import {
  Search,
  ShoppingBag,
  Tag,
  Shield,
  CreditCard,
  MessageSquare,
  MapPin,
  Camera,
  ChevronDown,
  ChevronUp,
  Mail,
  BookOpen,
  Truck,
  Star,
  AlertTriangle,
  Users,
  Gavel,
  Gift,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: any;
  color: string;
  items: FAQItem[];
}

export default function HelpCenter() {
  const { t } = useTranslation();
  useOGMeta({ title: "Help Center", description: "Get help with YARDEES marketplace.", url: `${window.location.origin}/help` });
  const [searchQuery, setSearchQuery] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const categories: FAQCategory[] = [
    {
      title: t("help.buyingTitle", "Buying"),
      icon: ShoppingBag,
      color: "text-blue-600 dark:text-blue-400",
      items: [
        { question: t("help.buyQ1", "How do I purchase an item?"), answer: t("help.buyA1", "Browse listings on the homepage or use the search bar to find items. When you find something you like, click on it to view details, then use the 'Message Seller' button to arrange the purchase. You can also make an offer directly from the listing page.") },
        { question: t("help.buyQ2", "How does buyer verification work?"), answer: t("help.buyA2", "Some listings require ID verification before showing the full address. Go to the listing, click 'Request Address', and upload a valid photo ID. The seller will review and approve your request, and you'll be notified when the address is revealed.") },
        { question: t("help.buyQ3", "Can I save items for later?"), answer: t("help.buyA3", "Yes! Click the heart icon on any listing to add it to your favorites. You can view all your saved items from your Dashboard. You'll also get notified if the price drops on any of your favorited items.") },
        { question: t("help.buyQ4", "How do I make an offer on a listing?"), answer: t("help.buyA4", "From the listing detail page, click 'Make Offer' and enter your proposed price. The seller will be notified and can accept, counter, or decline your offer. You'll receive a notification with their response.") },
        { question: t("help.buyQ5", "How do I search by location?"), answer: t("help.buyA5", "Use the location filter on the homepage to browse items near you. You can set your location, choose a country and city, or search worldwide. The distance filter lets you find items within a specific radius.") },
      ],
    },
    {
      title: t("help.sellingTitle", "Selling"),
      icon: Tag,
      color: "text-green-600 dark:text-green-400",
      items: [
        { question: t("help.sellQ1", "How do I create a listing?"), answer: t("help.sellA1", "Click 'Sell an Item' in the navigation bar. Fill in the details including title, description, price, category, and upload up to 20 photos. You can also add videos and set your item's location. Once submitted, your listing will be live immediately.") },
        { question: t("help.sellQ2", "How do I edit or delete my listing?"), answer: t("help.sellA2", "Go to your Dashboard and find the listing you want to modify. Click the edit icon to update details or photos. To mark an item as sold, use the 'Mark as Sold' option. You can also renew expired listings from your dashboard.") },
        { question: t("help.sellQ3", "How do I boost my listing?"), answer: t("help.sellA3", "From your listing detail page, click 'Boost'. Choose from three boost tiers: Category Boost (appears first in its category), Featured (highlighted across the site), or Spotlight (premium placement at the top of all listings). Boosts are processed securely through Stripe.") },
        { question: t("help.sellQ4", "Can I import multiple listings at once?"), answer: t("help.sellA4", "Yes! Use the Bulk Import feature from your dashboard menu. Prepare a CSV file with your listings and upload it. The system will create all your listings at once, saving you time if you have many items to sell.") },
        { question: t("help.sellQ5", "How do I set up my seller storefront?"), answer: t("help.sellA5", "Go to your Dashboard and customize your storefront with a banner image, tagline, and bio. Buyers can visit your storefront to see all your active listings in one place, making it easier for repeat customers to find you.") },
      ],
    },
    {
      title: t("help.safetyTitle", "Safety & Verification"),
      icon: Shield,
      color: "text-amber-600 dark:text-amber-400",
      items: [
        { question: t("help.safeQ1", "Is my personal information safe?"), answer: t("help.safeA1", "Yes. Listings with privacy protection require buyer verification before revealing the address. Your ID documents are only visible to the seller for verification purposes. We never share your personal details with third parties.") },
        { question: t("help.safeQ2", "How do I report a suspicious listing?"), answer: t("help.safeA2", "Click the 'Report' button on any listing detail page. Provide a reason and description of the issue. Our moderation team reviews all reports and takes appropriate action, including removing listings that violate our terms.") },
        { question: t("help.safeQ3", "How do I verify my identity?"), answer: t("help.safeA3", "Go to 'Verify Identity' in your profile menu. Upload a clear photo of a valid government-issued ID. Verified users get a badge on their profile, which builds trust with other users.") },
      ],
    },
    {
      title: t("help.paymentsTitle", "Payments & Boosts"),
      icon: CreditCard,
      color: "text-purple-600 dark:text-purple-400",
      items: [
        { question: t("help.payQ1", "How do payments work?"), answer: t("help.payA1", "Listing boosts are processed securely through Stripe. For item purchases, buyers and sellers arrange payment directly. We recommend meeting in safe, public locations for in-person transactions.") },
        { question: t("help.payQ2", "What are boost credits?"), answer: t("help.payA2", "Boost credits can be earned through the referral program. When someone signs up using your referral code and creates a listing, you earn credits that can be applied toward boosting your own listings.") },
        { question: t("help.payQ3", "How does shipping work?"), answer: t("help.payA3", "Sellers can add shipping options to their listings with different methods, prices, and estimated delivery times. As a buyer, you'll see available shipping options on the listing detail page and can choose your preferred method.") },
      ],
    },
    {
      title: t("help.messagingTitle", "Messaging"),
      icon: MessageSquare,
      color: "text-cyan-600 dark:text-cyan-400",
      items: [
        { question: t("help.msgQ1", "How do I message a seller?"), answer: t("help.msgA1", "Click 'Message Seller' on any listing page to start a conversation. Messages are tied to specific listings so you can easily reference what you're discussing. You'll receive real-time notifications for new messages.") },
        { question: t("help.msgQ2", "Can I delete a conversation?"), answer: t("help.msgA2", "Yes. Open the conversation and click the trash icon in the chat header. You'll be asked to confirm before the entire conversation is permanently deleted.") },
        { question: t("help.msgQ3", "How do typing indicators work?"), answer: t("help.msgA3", "When you're in a conversation, you'll see a typing indicator when the other person is composing a message. You'll also see an online/offline status indicator for real-time presence awareness.") },
      ],
    },
    {
      title: t("help.featuresTitle", "Features & Tools"),
      icon: Star,
      color: "text-yellow-600 dark:text-yellow-400",
      items: [
        { question: t("help.featQ1", "What is the barcode scanner?"), answer: t("help.featA1", "Use the barcode scanner to quickly look up product information. Scan any barcode or ISBN to auto-fill listing details including product name, description, and suggested category. Access it from the navigation menu or the create listing page.") },
        { question: t("help.featQ2", "How do auctions work?"), answer: t("help.featA2", "Create an auction on any listing by setting a starting price and end date. Buyers place bids with minimum increments. You'll be notified of each bid, and the highest bidder wins when the auction ends.") },
        { question: t("help.featQ3", "What is the rewards program?"), answer: t("help.featA3", "Earn loyalty points through daily logins, creating listings, making sales, and referring friends. Points unlock tiers (Bronze, Silver, Gold, Platinum) with increasing benefits. Visit the Rewards page to track your progress.") },
        { question: t("help.featQ4", "How do wishlists work?"), answer: t("help.featA4", "Create wishlists with keywords, categories, and max prices. When a new listing matches your wishlist criteria, you'll automatically receive a notification so you never miss an item you're looking for.") },
        { question: t("help.featQ5", "What are neighborhood events?"), answer: t("help.featA5", "Neighborhood yard sale events let multiple sellers in an area coordinate a joint sale. Create or join events, RSVP, and browse all participating sellers in one place. Great for attracting more buyers to your area.") },
      ],
    },
    {
      title: t("help.communityTitle", "Community"),
      icon: Users,
      color: "text-rose-600 dark:text-rose-400",
      items: [
        { question: t("help.commQ1", "How do reviews work?"), answer: t("help.commA1", "After a transaction, buyers can leave reviews for sellers. Reviews include a rating and comment. Sellers can reply to reviews. Your average rating is displayed on your profile and listings.") },
        { question: t("help.commQ2", "What are community tips?"), answer: t("help.commA2", "Community tips are helpful advice shared by experienced buyers and sellers. Browse tips by category, upvote useful ones, and share your own expertise to help the community. Visit the Tips page from the navigation menu.") },
        { question: t("help.commQ3", "How does the referral program work?"), answer: t("help.commA3", "Share your unique referral code with friends. When they sign up and create a listing, you'll earn boost credits. Find your referral code on your Dashboard page.") },
      ],
    },
    {
      title: t("help.accountTitle", "Account & Settings"),
      icon: BookOpen,
      color: "text-indigo-600 dark:text-indigo-400",
      items: [
        { question: t("help.acctQ1", "How do I edit my profile?"), answer: t("help.acctA1", "Go to your Dashboard to update your profile photo, display name, email, and other details. You can also set up your seller storefront with a custom banner, tagline, and bio.") },
        { question: t("help.acctQ2", "How do I reset my password?"), answer: t("help.acctA2", "Click 'Forgot Password' on the login page and enter your email address. You'll receive a reset link via email. The link expires after a set time for security, so use it promptly.") },
        { question: t("help.acctQ3", "Can I change the language or theme?"), answer: t("help.acctA3", "Yes! Use the language selector in the navigation bar to switch between supported languages. Toggle dark mode with the sun/moon icon. You can also adjust font size and contrast from the accessibility widget.") },
        { question: t("help.acctQ4", "How do I enable notifications?"), answer: t("help.acctA4", "Notifications are enabled by default. You'll receive in-app notifications for messages, offers, verification updates, and more. Check the bell icon in the navigation bar to see your recent notifications.") },
      ],
    },
  ];

  const filteredCategories = searchQuery.trim()
    ? categories.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.items.length > 0)
    : categories;

  const totalQuestions = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />

      <div className="bg-gradient-to-b from-primary/5 to-transparent py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl font-display font-bold gradient-text mb-3" data-testid="text-help-title">
            {t("help.title", "Help Center")}
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            {t("help.subtitle", "Find answers to common questions about buying, selling, and using YARDEES.")}
          </p>

          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("help.searchPlaceholder", "Search help articles...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
              data-testid="input-help-search"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {t("help.totalArticles", `${totalQuestions} articles across ${categories.length} topics`)}
          </p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("help.noResults", "No articles found matching your search.")}</p>
            <Button variant="ghost" onClick={() => setSearchQuery("")} className="mt-2">
              {t("help.clearSearch", "Clear search")}
            </Button>
          </div>
        )}

        <div className="space-y-8 max-w-3xl mx-auto">
          {filteredCategories.map((category, catIdx) => (
            <div key={catIdx} data-testid={`help-category-${catIdx}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-9 rounded-xl bg-muted flex items-center justify-center ${category.color}`}>
                  <category.icon className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-display font-semibold">{category.title}</h2>
                <span className="text-xs text-muted-foreground ml-auto">{category.items.length} {category.items.length === 1 ? "article" : "articles"}</span>
              </div>

              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {category.items.map((item, itemIdx) => {
                    const key = `${catIdx}-${itemIdx}`;
                    const isOpen = openItems.has(key);
                    return (
                      <div key={itemIdx} className="border-b border-border last:border-0">
                        <button
                          onClick={() => toggleItem(key)}
                          className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                          data-testid={`faq-question-${catIdx}-${itemIdx}`}
                        >
                          <span className="text-sm font-medium flex-grow">{item.question}</span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed" data-testid={`faq-answer-${catIdx}-${itemIdx}`}>
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-3xl mx-auto">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-display font-semibold mb-2">{t("help.stillNeedHelp", "Still need help?")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("help.contactDescription", "Can't find what you're looking for? Reach out to our support team.")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="mailto:support@yardees.net">
                  <Button variant="outline" className="gap-2" data-testid="button-email-support">
                    <Mail className="w-4 h-4" />
                    {t("help.emailSupport", "Email Support")}
                  </Button>
                </a>
                <Link href="/tips">
                  <Button variant="outline" className="gap-2" data-testid="button-community-tips">
                    <Users className="w-4 h-4" />
                    {t("help.communityTips", "Community Tips")}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 max-w-3xl mx-auto">
          <h3 className="text-lg font-display font-semibold mb-4">{t("help.quickLinks", "Quick Links")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { label: t("help.linkBrowse", "Browse Items"), href: "/", icon: ShoppingBag },
              { label: t("help.linkSell", "Sell an Item"), href: "/create", icon: Tag },
              { label: t("help.linkMessages", "Messages"), href: "/messages", icon: MessageSquare },
              { label: t("help.linkExplore", "Explore"), href: "/explore", icon: MapPin },
              { label: t("help.linkAuctions", "Auctions"), href: "/auctions", icon: Gavel },
              { label: t("help.linkRewards", "Rewards"), href: "/rewards", icon: Gift },
              { label: t("help.linkEvents", "Events"), href: "/events", icon: Users },
              { label: t("help.linkTerms", "Terms of Service"), href: "/terms", icon: BookOpen },
            ].map((link, i) => (
              <Link key={i} href={link.href}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-3 flex items-center gap-2">
                    <link.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-xs font-medium">{link.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
