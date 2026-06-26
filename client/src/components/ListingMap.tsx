import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { currencySymbols } from "@shared/schema";
const logoSrc = "/yardees-logo.png";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin } from "lucide-react";

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    window.initGoogleMaps = () => resolve();

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function GoogleMapView({ listings, apiKey, onLoadError }: { listings: any[]; apiKey: string; onLoadError: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) onLoadError();
      });

    return () => { cancelled = true; };
  }, [apiKey, onLoadError]);

  const buildInfoContent = useCallback((listing: any) => {
    const symbol = currencySymbols[listing.currency] || "$";
    const priceText = listing.price === 0 ? "FREE" : `${symbol}${(listing.price / 100).toFixed(2)}`;
    const photoHtml = listing.photos?.[0]
      ? `<img src="${listing.photos[0]}" alt="${listing.title}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:6px;" onerror="this.onerror=null;this.src='${logoSrc}';this.style.objectFit='contain';this.style.padding='8px';this.style.background='rgba(16,185,129,0.05)';" />`
      : "";
    return `
      <div style="min-width:180px;max-width:220px;font-family:system-ui,-apple-system,sans-serif;">
        ${photoHtml}
        <div style="font-weight:600;font-size:13px;margin-bottom:2px;line-height:1.3;">${listing.title}</div>
        <div style="color:#16a34a;font-weight:700;font-size:14px;margin-bottom:2px;">${priceText}</div>
        <div style="color:#6b7280;font-size:11px;">${[listing.city, listing.country].filter(Boolean).join(", ")}</div>
        <a href="/listing/${listing.id}" style="color:#10b981;font-size:11px;text-decoration:none;display:block;margin-top:4px;">View Details →</a>
      </div>
    `;
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;

    const mappable = listings.filter(l => l.lat && l.lng);
    if (mappable.length === 0) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: parseFloat(mappable[0].lat), lng: parseFloat(mappable[0].lng) },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();

    mappable.forEach((listing) => {
      const position = { lat: parseFloat(listing.lat), lng: parseFloat(listing.lng) };
      bounds.extend(position);

      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: listing.title,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#10b981",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        infoWindowRef.current.setContent(buildInfoContent(listing));
        infoWindowRef.current.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    if (mappable.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else {
      mapInstanceRef.current.setCenter({ lat: parseFloat(mappable[0].lat), lng: parseFloat(mappable[0].lng) });
      mapInstanceRef.current.setZoom(14);
    }

    return () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [mapReady, listings, buildInfoContent]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: "500px" }}
      data-testid="google-map-container"
    />
  );
}

export function ListingMap({ listings }: { listings: any[] }) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const { data: mapsKeyData, isLoading: keyLoading, isError: keyError } = useQuery<{ key: string }>({
    queryKey: ["/api/maps/key"],
    staleTime: Infinity,
  });

  const mappable = listings.filter(l => l.lat && l.lng);

  const handleGoogleLoadError = useCallback(() => {
    setGoogleFailed(true);
  }, []);

  if (mappable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/50" data-testid="map-empty">
        <MapPin className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">No listings with location data to display on map.</p>
      </div>
    );
  }

  if (keyLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (keyError || !mapsKeyData?.key || googleFailed) {
    return (
      <FallbackLeafletMap listings={listings} />
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm" data-testid="listing-map">
      <GoogleMapView listings={mappable} apiKey={mapsKeyData.key} onLoadError={handleGoogleLoadError} />
    </div>
  );
}

function FallbackLeafletMap({ listings }: { listings: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const mappable = listings.filter(l => l.lat && l.lng);

  useEffect(() => {
    if (!mapRef.current || mappable.length === 0) return;

    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (!mapRef.current) return;

      const center: [number, number] = [parseFloat(mappable[0].lat), parseFloat(mappable[0].lng)];
      const map = L.map(mapRef.current).setView(center, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      const symbol = (c: string) => currencySymbols[c] || "$";

      mappable.forEach((listing) => {
        const pos: [number, number] = [parseFloat(listing.lat), parseFloat(listing.lng)];
        bounds.extend(pos);

        const icon = L.divIcon({
          className: "custom-marker",
          html: `<div style="width:20px;height:20px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker(pos, { icon }).addTo(map);
        const priceText = listing.price === 0 ? "FREE" : `${symbol(listing.currency)}${(listing.price / 100).toFixed(2)}`;
        marker.bindPopup(`
          <div style="min-width:160px;font-family:system-ui;">
            <b style="font-size:13px;">${listing.title}</b><br/>
            <span style="color:#16a34a;font-weight:700;">${priceText}</span><br/>
            <span style="color:#888;font-size:11px;">${listing.city || ""}</span><br/>
            <a href="/listing/${listing.id}" style="color:#10b981;font-size:11px;">View Details →</a>
          </div>
        `);
      });

      if (mappable.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }

      mapInstanceRef.current = map;
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mappable.length]);

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm" data-testid="listing-map">
      <div ref={mapRef} className="w-full" style={{ height: "500px" }} />
    </div>
  );
}
