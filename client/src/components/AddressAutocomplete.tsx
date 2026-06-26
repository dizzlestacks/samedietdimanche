import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface Prediction {
  description: string;
  placeId: string;
}

interface PlaceDetails {
  formattedAddress: string;
  lat?: number;
  lng?: number;
  city?: string;
  country?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (details: PlaceDetails) => void;
  placeholder?: string;
  "data-testid"?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`, { signal: controller.signal });
      const data = await res.json();
      setPredictions(data.predictions || []);
      setIsOpen((data.predictions || []).length > 0);
      setActiveIndex(-1);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPredictions([]);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    onChange(prediction.description);
    setIsOpen(false);
    setPredictions([]);
    if (onPlaceSelect) {
      try {
        const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`);
        const details = await res.json();
        onPlaceSelect(details);
      } catch {}
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(predictions[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          data-testid={testId}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {predictions.map((p, i) => (
            <button
              key={p.placeId}
              type="button"
              data-testid={`address-suggestion-${i}`}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-colors ${
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => handleSelect(p)}
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span className="line-clamp-2">{p.description}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground text-right border-t border-border/50">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
