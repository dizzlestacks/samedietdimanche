import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
const logoSrc = "/yardees-logo.png";

interface PhotoGalleryProps {
  photos: string[];
  activeIndex: number;
  onClose: () => void;
  onChangeIndex: (i: number) => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_THRESHOLD = 60;
const ZOOM_STEP = 0.5;
const DOUBLE_TAP_WINDOW = 300;

export function PhotoGallery({ photos, activeIndex, onClose, onChangeIndex }: PhotoGalleryProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragTranslateStartRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const isPinchingRef = useRef(false);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });

  scaleRef.current = scale;
  translateRef.current = translate;

  const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
    if (s <= 1) return { x: 0, y: 0 };
    const el = imageRef.current;
    if (!el) return { x: tx, y: ty };
    const rect = el.getBoundingClientRect();
    const imgW = rect.width / s;
    const imgH = rect.height / s;
    const maxX = (imgW * (s - 1)) / 2;
    const maxY = (imgH * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const goNext = useCallback(() => {
    resetZoom();
    onChangeIndex(activeIndex < photos.length - 1 ? activeIndex + 1 : 0);
  }, [activeIndex, photos.length, onChangeIndex, resetZoom]);

  const goPrev = useCallback(() => {
    resetZoom();
    onChangeIndex(activeIndex > 0 ? activeIndex - 1 : photos.length - 1);
  }, [activeIndex, photos.length, onChangeIndex, resetZoom]);

  const zoomIn = useCallback(() => {
    setScale((s) => {
      const newScale = Math.min(MAX_SCALE, s + ZOOM_STEP);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const newScale = Math.max(MIN_SCALE, s - ZOOM_STEP);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
      if (e.key === "0") resetZoom();

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev, zoomIn, zoomOut, resetZoom]);

  useEffect(() => {
    resetZoom();
  }, [activeIndex, resetZoom]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      const prev = scaleRef.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
      setScale(newScale);
      if (newScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      } else {
        setTranslate((t) => clampTranslate(t.x, t.y, newScale));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampTranslate]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragTranslateStartRef.current = { ...translateRef.current };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || scaleRef.current <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setTranslate(clampTranslate(
      dragTranslateStartRef.current.x + dx,
      dragTranslateStartRef.current.y + dy,
      scaleRef.current
    ));
  }, [isDragging, clampTranslate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches);
      pinchRef.current = { dist, scale: scaleRef.current };
      isPinchingRef.current = true;
      dragStartRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      dragTranslateStartRef.current = { ...translateRef.current };
    } else if (e.touches.length === 1) {
      const now = Date.now();

      if (now - lastTapRef.current < DOUBLE_TAP_WINDOW && !isPinchingRef.current) {
        e.preventDefault();
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
        if (scaleRef.current > 1) {
          resetZoom();
        } else {
          setScale(DOUBLE_TAP_SCALE);
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const cx = e.touches[0].clientX - rect.left - rect.width / 2;
            const cy = e.touches[0].clientY - rect.top - rect.height / 2;
            setTranslate(clampTranslate(-cx, -cy, DOUBLE_TAP_SCALE));
          }
        }
        lastTapRef.current = 0;
        return;
      }

      lastTapRef.current = now;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => { lastTapRef.current = 0; }, DOUBLE_TAP_WINDOW + 50);

      swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isPinchingRef.current = false;

      if (scaleRef.current > 1) {
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        dragTranslateStartRef.current = { ...translateRef.current };
      }
    }
  }, [resetZoom, clampTranslate]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const pinchScale = dist / pinchRef.current.dist;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchRef.current.scale * pinchScale));
      setScale(newScale);

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = midX - dragStartRef.current.x;
      const dy = midY - dragStartRef.current.y;
      setTranslate(clampTranslate(dragTranslateStartRef.current.x + dx, dragTranslateStartRef.current.y + dy, newScale));
    } else if (e.touches.length === 1 && scaleRef.current > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setTranslate(clampTranslate(dragTranslateStartRef.current.x + dx, dragTranslateStartRef.current.y + dy, scaleRef.current));
    }
  }, [clampTranslate]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinchingRef.current && e.touches.length < 2) {
      pinchRef.current = null;
      isPinchingRef.current = false;
      if (scaleRef.current < 1) {
        setScale(1);
        setTranslate({ x: 0, y: 0 });
      }
      return;
    }

    if (e.touches.length === 0 && swipeRef.current && scaleRef.current <= 1) {
      const diffX = e.changedTouches[0].clientX - swipeRef.current.x;
      const diffY = e.changedTouches[0].clientY - swipeRef.current.y;
      if (Math.abs(diffX) > SWIPE_THRESHOLD && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
        if (diffX > 0) goPrev();
        else goNext();
        swipeRef.current = null;
        return;
      }
    }
    swipeRef.current = null;
  }, [goNext, goPrev]);

  const handleDoubleClick = useCallback(() => {
    if (scaleRef.current > 1) {
      resetZoom();
    } else {
      setScale(DOUBLE_TAP_SCALE);
      setTranslate(clampTranslate(0, 0, DOUBLE_TAP_SCALE));
    }
  }, [resetZoom, clampTranslate]);

  const isZoomed = scale > 1;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
      className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="lightbox-overlay"
    >
      <div className="flex items-center justify-between px-4 py-3 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white/80 text-sm font-medium min-w-[3.5rem] text-center" data-testid="text-zoom-level" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          {isZoomed && (
            <button
              onClick={resetZoom}
              aria-label="Reset zoom"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ml-1"
              data-testid="button-zoom-reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        <span className="text-white/70 text-sm font-medium" aria-live="polite">
          {activeIndex + 1} / {photos.length}
        </span>

        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close gallery"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          data-testid="button-lightbox-close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {photos.length > 1 && !isZoomed && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              data-testid="button-lightbox-prev"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
            <button
              onClick={goNext}
              aria-label="Next photo"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              data-testid="button-lightbox-next"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </>
        )}

        <div
          ref={containerRef}
          className={`w-full h-full flex items-center justify-center ${isZoomed ? "cursor-grab" : ""} ${isDragging ? "cursor-grabbing" : ""}`}
          style={{ touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              <img
                ref={imageRef}
                src={photos[activeIndex]}
                alt={`Photo ${activeIndex + 1} of ${photos.length}`}
                className="max-w-[90vw] max-h-[calc(100vh-10rem)] object-contain select-none pointer-events-none"
                style={{
                  transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                  transition: isDragging || isPinchingRef.current ? "none" : "transform 0.2s ease-out",
                }}
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.onerror = null;
                  img.src = logoSrc;
                  img.className = "max-w-[90vw] max-h-[calc(100vh-10rem)] object-contain select-none pointer-events-none p-12";
                }}
                data-testid="img-lightbox"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="py-3 px-4 z-20">
          <div className="flex gap-2 justify-center overflow-x-auto max-w-[90vw] mx-auto pb-1">
            {photos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => {
                  resetZoom();
                  onChangeIndex(idx);
                }}
                aria-label={`View photo ${idx + 1}`}
                aria-current={activeIndex === idx ? "true" : undefined}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                  activeIndex === idx ? "border-white ring-1 ring-white/40 scale-105" : "border-transparent opacity-50 hover:opacity-80"
                }`}
                data-testid={`button-lightbox-thumb-${idx}`}
              >
                <img
                  src={photo}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.onerror = null;
                    img.src = logoSrc;
                    img.className = "w-full h-full object-contain p-1 bg-white/10";
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {isZoomed && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            Drag to pan · Double-click to reset
          </span>
        </div>
      )}
    </div>
  );
}
