import { Link } from "wouter";
import { ArrowLeft, ShoppingBag, Shield, Globe, Users, Heart, Leaf, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { useOGMeta } from "@/hooks/use-og-meta";
import { Navbar } from "@/components/Navbar";
const logoSrc = "/yardees-logo.png";

export default function About() {
  const { t } = useTranslation();
  useOGMeta({
    title: "About YARDEES — Our Story & Mission",
    description: "Learn about YARDEES, the world's marketplace for yard sales, garage sales, and thrift shopping. Our mission is to make second-hand shopping sustainable, accessible, and beautiful.",
    url: `${window.location.origin}/about`,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-about">
      <Navbar />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="gap-2" data-testid="link-about-back">
                <ArrowLeft className="w-4 h-4" />
                {t("common.back", "Back")}
              </Button>
            </Link>
          </div>

          <div className="text-center mb-12">
            <img src={logoSrc} alt="YARDEES" className="h-16 w-auto mx-auto mb-4" data-testid="img-about-logo" />
            <h1 className="text-4xl font-bold mb-3 font-display" data-testid="text-about-title">
              About YARDEES
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-about-tagline">
              Second Hand Never Looked This Good
            </p>
          </div>

          <div className="prose dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Our Story
              </h2>
              <p className="text-muted-foreground leading-relaxed text-base">
                YARDEES was born from a simple belief: buying and selling second-hand items should be as easy, safe, and enjoyable as shopping new. We saw a world full of perfectly good items sitting in garages, attics, and closets — and communities of people who would love to find them. So we built a platform to connect them.
              </p>
              <p className="text-muted-foreground leading-relaxed text-base mt-3">
                From yard sales in quiet neighborhoods to bustling thrift shops in city centers, YARDEES brings the treasure-hunting experience online while keeping the local, community-driven spirit alive. Whether you're decluttering your home, hunting for vintage finds, or running a thrift store, YARDEES is your marketplace.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-6 h-6 text-primary" />
                Our Mission
              </h2>
              <p className="text-muted-foreground leading-relaxed text-base">
                Our mission is to become the world's leading marketplace for second-hand goods — making sustainable shopping accessible, safe, and beautiful for everyone. We believe that every item deserves a second life, and every person deserves access to affordable, quality goods.
              </p>
            </section>

            <div className="grid md:grid-cols-3 gap-4 my-8">
              <Card className="text-center" data-testid="card-about-value-1">
                <CardContent className="pt-6">
                  <Leaf className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Sustainability</h3>
                  <p className="text-sm text-muted-foreground">Every second-hand purchase keeps items out of landfills and reduces the demand for new manufacturing.</p>
                </CardContent>
              </Card>
              <Card className="text-center" data-testid="card-about-value-2">
                <CardContent className="pt-6">
                  <Users className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Community</h3>
                  <p className="text-sm text-muted-foreground">We connect neighbors, support local sellers, and build communities around the shared joy of finding great deals.</p>
                </CardContent>
              </Card>
              <Card className="text-center" data-testid="card-about-value-3">
                <CardContent className="pt-6">
                  <Shield className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Trust & Safety</h3>
                  <p className="text-sm text-muted-foreground">Secure escrow payments, buyer verification, and seller reviews ensure every transaction is safe and trustworthy.</p>
                </CardContent>
              </Card>
            </div>

            <section>
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-primary" />
                What We Offer
              </h2>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-base"><strong className="text-foreground">Local Discovery:</strong> Find yard sales, garage sales, estate sales, and thrift shops near you with interactive maps and location-based search.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <Globe className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-base"><strong className="text-foreground">Global Reach:</strong> List and sell to buyers worldwide. YARDEES supports 6 languages and multiple currencies.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-base"><strong className="text-foreground">Secure Payments:</strong> Our escrow system holds funds until delivery is confirmed, protecting both buyers and sellers.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <ShoppingBag className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-base"><strong className="text-foreground">15 Categories:</strong> From electronics and furniture to vintage clothing and collectibles — find anything second-hand on YARDEES.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-base"><strong className="text-foreground">Community Features:</strong> Reviews, tips, neighborhood events, wishlists, auctions, and a rewards program that makes selling and buying even more fun.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-6 h-6 text-primary" />
                Available Worldwide
              </h2>
              <p className="text-muted-foreground leading-relaxed text-base">
                YARDEES is available in English, Spanish, French, German, Portuguese, and Chinese. Whether you call it a yard sale, boot sale, vide-grenier, Flohmarkt, or mercado de pulgas — YARDEES is your marketplace. We serve buyers and sellers in every country, making second-hand shopping a truly global experience.
              </p>
            </section>

            <section className="bg-muted/30 rounded-lg p-6 mt-8">
              <h2 className="text-2xl font-semibold mb-3">Get in Touch</h2>
              <p className="text-muted-foreground text-base mb-4">
                Have questions, suggestions, or partnership inquiries? We'd love to hear from you.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/contact">
                  <Button className="gap-2" data-testid="button-about-contact">
                    Contact Us
                  </Button>
                </Link>
                <Link href="/help">
                  <Button variant="outline" className="gap-2" data-testid="button-about-help">
                    Help Center
                  </Button>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
