import { useState, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const triggered = useRef(false);
  const controls = useAnimation();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop <= 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
      triggered.current = false;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0) {
      const dampened = Math.min(diff * 0.4, MAX_PULL);
      setPullDistance(dampened);

      if (dampened >= THRESHOLD && !triggered.current) {
        triggered.current = true;
        triggerHaptic("medium");
      }
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      triggerHaptic("heavy");

      try {
        await onRefresh();
      } catch {
      }

      await controls.start({ opacity: 0, transition: { duration: 0.2 } });
      setIsRefreshing(false);
      controls.set({ opacity: 1 });
    }

    setPullDistance(0);
  }, [pullDistance, onRefresh, controls]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {showIndicator && (
        <motion.div
          className="flex items-center justify-center overflow-hidden"
          animate={controls}
          style={{ height: isRefreshing ? 48 : pullDistance }}
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : { rotate: progress * 270 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { type: "spring" }}
          >
            <RefreshCw
              className={`w-5 h-5 ${progress >= 1 || isRefreshing ? "text-primary" : "text-muted-foreground"}`}
              strokeWidth={2}
            />
          </motion.div>
        </motion.div>
      )}
      {children}
    </div>
  );
}
