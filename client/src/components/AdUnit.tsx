import { useEffect, useRef } from "react";
const logoSrc = "/yardees-logo.png";

// Falls back to the site's public AdSense publisher ID (already exposed in
// index.html) so real ads render even when VITE_ADSENSE_CLIENT_ID isn't set.
const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID || "ca-pub-1344150540989825";
const SHOW_PREVIEW = !ADSENSE_CLIENT_ID;

type AdFormat = "horizontal" | "rectangle" | "fluid";

interface AdUnitProps {
  slot?: string;
  format?: AdFormat;
  className?: string;
}

const formatStyles: Record<AdFormat, React.CSSProperties> = {
  horizontal: { display: "block", width: "100%", height: "90px" },
  rectangle: { display: "block", width: "100%", height: "250px" },
  fluid: { display: "block", width: "100%" },
};

const previewHeights: Record<AdFormat, string> = {
  horizontal: "h-[90px]",
  rectangle: "h-[250px]",
  fluid: "h-[100px]",
};

let scriptLoaded = false;

function loadAdSenseScript() {
  if (scriptLoaded || !ADSENSE_CLIENT_ID) return;
  scriptLoaded = true;

  const script = document.createElement("script");
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

function AdPreview({ format = "fluid", className = "" }: { format?: AdFormat; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/30 ${previewHeights[format]} ${className}`}
      data-testid="ad-preview"
    >
      <img src={logoSrc} alt="Ad placement" className="h-8 w-auto opacity-40" />
      <span className="text-xs text-muted-foreground/50 font-medium uppercase tracking-wider">Ad Space</span>
    </div>
  );
}

export function AdUnit({ slot, format = "fluid", className = "" }: AdUnitProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID) return;

    loadAdSenseScript();

    const timer = setTimeout(() => {
      if (adRef.current && !pushed.current) {
        pushed.current = true;
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch {
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (SHOW_PREVIEW) {
    return (
      <div className={`ad-container my-4 ${className}`} data-testid="ad-unit">
        <AdPreview format={format} />
      </div>
    );
  }

  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <div className={`ad-container my-4 ${className}`} data-testid="ad-unit">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={formatStyles[format]}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot || "auto"}
        data-ad-format={format === "fluid" ? "fluid" : "auto"}
        data-full-width-responsive="true"
      />
    </div>
  );
}

export function InFeedAd({ className = "" }: { className?: string }) {
  return (
    <div className={`col-span-full ${className}`}>
      <div className="max-w-2xl mx-auto py-2">
        <AdUnit format="horizontal" />
      </div>
    </div>
  );
}

export function SidebarAd({ className = "" }: { className?: string }) {
  return (
    <div className={`hidden lg:block ${className}`}>
      <div className="sticky top-20">
        <AdUnit format="rectangle" />
      </div>
    </div>
  );
}

export function ContentAd({ className = "" }: { className?: string }) {
  return (
    <div className={`my-6 ${className}`}>
      <AdUnit format="fluid" />
    </div>
  );
}

export function isAdSenseEnabled(): boolean {
  return !!ADSENSE_CLIENT_ID;
}
