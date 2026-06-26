import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Search, BookOpen, Package, ArrowRight, X, Loader2 } from "lucide-react";
import { useOGMeta } from "@/hooks/use-og-meta";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface BarcodeResult {
  found: boolean;
  source?: string;
  title?: string;
  brand?: string;
  authors?: string;
  publishers?: string;
  category?: string;
  image?: string;
  description?: string;
  publishDate?: string;
}

export default function BarcodeScanner() {
  const { t } = useTranslation();
  const { toast } = useToast();
  useOGMeta({ title: "Barcode Scanner", description: "Scan a barcode or ISBN to auto-fill listing details." });

  const [code, setCode] = useState("");
  const [result, setResult] = useState<BarcodeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const lookup = useCallback(async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(barcodeValue.trim())}`);
      const data = await res.json();
      setResult(data);
      if (!data.found) {
        toast({ title: t("barcode.notFound", "No product found for this code"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("barcode.error", "Lookup failed"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });
        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const value = barcodes[0].rawValue;
                setCode(value);
                stopCamera();
                lookup(value);
              }
            } catch { }
          }
        }, 500);
      } else {
        toast({ title: t("barcode.noBrowserSupport", "Your browser doesn't support barcode scanning. Please enter the code manually.") });
      }
    } catch {
      toast({ title: t("barcode.cameraError", "Could not access camera"), variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const createListingUrl = result?.found
    ? `/create?prefill_title=${encodeURIComponent(result.title || "")}&prefill_description=${encodeURIComponent(
        [result.description, result.brand ? `Brand: ${result.brand}` : "", result.authors ? `By: ${result.authors}` : "", result.publishers ? `Publisher: ${result.publishers}` : ""]
          .filter(Boolean).join("\n")
      )}`
    : "/create";

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Camera className="w-6 h-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">{t("barcode.title", "Barcode Scanner")}</h1>
          </div>
          <p className="text-muted-foreground/60 text-sm mb-6">{t("barcode.subtitle", "Scan a barcode or ISBN to auto-fill your listing details")}</p>

          <Card className="p-5 mb-6">
            <div className="flex gap-2 mb-4">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("barcode.placeholder", "Enter barcode or ISBN...")}
                onKeyDown={(e) => e.key === "Enter" && lookup(code)}
                data-testid="input-barcode"
              />
              <Button onClick={() => lookup(code)} disabled={isLoading || !code.trim()} data-testid="button-lookup">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex gap-2">
              {!cameraActive ? (
                <Button variant="outline" onClick={startCamera} className="gap-1.5 flex-1" data-testid="button-start-camera">
                  <Camera className="w-4 h-4" /> {t("barcode.scanWithCamera", "Scan with Camera")}
                </Button>
              ) : (
                <Button variant="outline" onClick={stopCamera} className="gap-1.5 flex-1">
                  <X className="w-4 h-4" /> {t("barcode.stopCamera", "Stop Camera")}
                </Button>
              )}
            </div>

            <AnimatePresence>
              {cameraActive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4"
                >
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      data-testid="video-camera"
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-primary/40 m-8 rounded-lg pointer-events-none" />
                    <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/60">
                      {t("barcode.pointCamera", "Point camera at barcode")}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <AnimatePresence>
            {result?.found && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Card className="p-5" data-testid="card-barcode-result">
                  <div className="flex gap-4">
                    {result.image && (
                      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <img src={result.image} alt={result.title} className="w-full h-full object-cover" data-testid="img-barcode-result" />
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {result.source === "openlibrary" ? (
                          <BookOpen className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Package className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                          {result.source === "openlibrary" ? "Book" : "Product"}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-lg leading-tight" data-testid="text-barcode-title">{result.title}</h3>
                      {result.brand && <p className="text-sm text-muted-foreground/60">{result.brand}</p>}
                      {result.authors && <p className="text-sm text-muted-foreground/60">By {result.authors}</p>}
                      {result.publishers && <p className="text-xs text-muted-foreground/40">{result.publishers}</p>}
                      {result.publishDate && <p className="text-xs text-muted-foreground/40">{result.publishDate}</p>}
                      {result.description && <p className="text-sm text-muted-foreground/60 mt-1 line-clamp-2">{result.description}</p>}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Link href={createListingUrl}>
                      <Button className="w-full gap-2" data-testid="button-create-from-barcode">
                        {t("barcode.createListing", "Create Listing from This")} <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {result && !result.found && (
            <Card className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <h3 className="font-display font-bold text-lg mb-1">{t("barcode.noResults", "No Product Found")}</h3>
              <p className="text-sm text-muted-foreground/50 mb-4">{t("barcode.tryAnother", "Try a different barcode or enter details manually")}</p>
              <Link href="/create">
                <Button variant="outline" className="gap-1.5">
                  <ArrowRight className="w-4 h-4" /> {t("barcode.createManually", "Create Listing Manually")}
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
