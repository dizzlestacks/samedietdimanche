import { useState, useEffect, useCallback } from "react";
import { Accessibility, Type, Eye, Zap, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "yardees_accessibility";

interface AccessibilityPrefs {
  fontSize: "normal" | "large" | "xl";
  highContrast: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: AccessibilityPrefs = {
  fontSize: "normal",
  highContrast: false,
  reduceMotion: false,
};

function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function applyPrefs(prefs: AccessibilityPrefs) {
  const html = document.documentElement;
  html.classList.remove("a11y-font-large", "a11y-font-xl");
  if (prefs.fontSize === "large") html.classList.add("a11y-font-large");
  if (prefs.fontSize === "xl") html.classList.add("a11y-font-xl");
  html.classList.toggle("a11y-high-contrast", prefs.highContrast);
  html.classList.toggle("a11y-reduce-motion", prefs.reduceMotion);
}

export function useAccessibility() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(loadPrefs);

  useEffect(() => {
    applyPrefs(prefs);
  }, []);

  const update = useCallback((partial: Partial<AccessibilityPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyPrefs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFS));
      applyPrefs(DEFAULT_PREFS);
      return DEFAULT_PREFS;
    });
  }, []);

  return { prefs, update, reset };
}

export function AccessibilityPanel() {
  const { t } = useTranslation();
  const { prefs, update, reset } = useAccessibility();

  const fontSizes: { value: AccessibilityPrefs["fontSize"]; label: string }[] = [
    { value: "normal", label: t("accessibility.fontNormal") },
    { value: "large", label: t("accessibility.fontLarge") },
    { value: "xl", label: t("accessibility.fontXL") },
  ];

  return (
    <div className="space-y-4 px-4 py-3" data-testid="accessibility-panel">
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Type className="w-3.5 h-3.5" />
          {t("accessibility.textSize")}
        </label>
        <div className="flex gap-1.5">
          {fontSizes.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update({ fontSize: value })}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                prefs.fontSize === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-foreground border-border hover:border-primary/50"
              }`}
              data-testid={`button-font-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm text-foreground flex items-center gap-2" htmlFor="a11y-contrast-sidebar">
          <Eye className="w-4 h-4 text-primary" />
          {t("accessibility.highContrast")}
        </label>
        <button
          id="a11y-contrast-sidebar"
          role="switch"
          aria-checked={prefs.highContrast}
          onClick={() => update({ highContrast: !prefs.highContrast })}
          className={`relative w-10 h-5.5 rounded-full transition-colors ${
            prefs.highContrast ? "bg-primary" : "bg-muted-foreground/30"
          }`}
          style={{ width: 40, height: 22 }}
          data-testid="toggle-high-contrast"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${
              prefs.highContrast ? "translate-x-[18px]" : ""
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm text-foreground flex items-center gap-2" htmlFor="a11y-motion-sidebar">
          <Zap className="w-4 h-4 text-primary" />
          {t("accessibility.reduceMotion")}
        </label>
        <button
          id="a11y-motion-sidebar"
          role="switch"
          aria-checked={prefs.reduceMotion}
          onClick={() => update({ reduceMotion: !prefs.reduceMotion })}
          className={`relative rounded-full transition-colors ${
            prefs.reduceMotion ? "bg-primary" : "bg-muted-foreground/30"
          }`}
          style={{ width: 40, height: 22 }}
          data-testid="toggle-reduce-motion"
        >
          <span
            className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${
              prefs.reduceMotion ? "translate-x-[18px]" : ""
            }`}
          />
        </button>
      </div>

      <button
        onClick={reset}
        className="flex items-center gap-2 w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border hover:border-primary/50 justify-center"
        data-testid="button-reset-accessibility"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {t("accessibility.reset")}
      </button>
    </div>
  );
}

export function AccessibilityInit() {
  useAccessibility();
  return null;
}
