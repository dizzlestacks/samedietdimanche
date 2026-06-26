import { useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "yardees_tour_completed";

export function useOnboardingTour() {
  const { t } = useTranslation();

  const startTour = useCallback(() => {
    const steps = [
      {
        popover: {
          title: t("tour.welcome.title"),
          description: t("tour.welcome.description"),
        },
      },
      {
        element: '[data-testid="input-search"]',
        popover: {
          title: t("tour.search.title"),
          description: t("tour.search.description"),
        },
      },
      {
        element: '[data-testid="button-filters-toggle"], [data-testid="select-category"]',
        popover: {
          title: t("tour.filters.title"),
          description: t("tour.filters.description"),
        },
      },
      {
        element: '[data-testid="button-map-view"]',
        popover: {
          title: t("tour.mapView.title"),
          description: t("tour.mapView.description"),
        },
      },
      {
        element: '[data-testid="button-navbar-signup"], [data-testid="button-sell-item"], a[href="/create"]',
        popover: {
          title: t("tour.sell.title"),
          description: t("tour.sell.description"),
        },
      },
      {
        element: '[data-testid="button-language-selector"]',
        popover: {
          title: t("tour.language.title"),
          description: t("tour.language.description"),
        },
      },
    ].filter(step => {
      if (!step.element) return true;
      const selectors = step.element.split(", ");
      return selectors.some(s => document.querySelector(s));
    });

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0, 0, 0, 0.6)",
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "yardees-tour-popover",
      nextBtnText: t("tour.next"),
      prevBtnText: t("tour.prev"),
      doneBtnText: t("tour.done"),
      progressText: "{{current}} / {{total}}",
      onDestroyed: () => {
        localStorage.setItem(TOUR_KEY, "true");
      },
      steps,
    });

    driverObj.drive();
  }, [t]);

  return { startTour };
}

export function OnboardingTourTrigger() {
  const { startTour } = useOnboardingTour();

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      const timer = setTimeout(() => {
        startTour();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  return null;
}
