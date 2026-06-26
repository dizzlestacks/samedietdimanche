type HapticIntensity = "light" | "medium" | "heavy";

const vibrationDurations: Record<HapticIntensity, number> = {
  light: 10,
  medium: 25,
  heavy: 50,
};

export function triggerHaptic(intensity: HapticIntensity = "light") {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(vibrationDurations[intensity]);
    } catch {
    }
  }
}

export function isHapticSupported(): boolean {
  return "vibrate" in navigator;
}
