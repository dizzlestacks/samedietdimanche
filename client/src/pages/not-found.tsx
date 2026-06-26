import { Button } from "@/components/ui/button";
import { Home, Search, ArrowLeft, ShoppingBag, MapPin, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { motion } from "framer-motion";
const logoSrc = "/yardees-logo.png";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-[10%] left-[5%] text-primary/[0.06] dark:text-primary/[0.04]"
          animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <ShoppingBag className="w-24 h-24" />
        </motion.div>
        <motion.div
          className="absolute top-[20%] right-[8%] text-primary/[0.06] dark:text-primary/[0.04]"
          animate={{ y: [0, 15, 0], rotate: [0, -15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <Tag className="w-20 h-20" />
        </motion.div>
        <motion.div
          className="absolute bottom-[15%] left-[12%] text-primary/[0.06] dark:text-primary/[0.04]"
          animate={{ y: [0, 18, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        >
          <MapPin className="w-16 h-16" />
        </motion.div>
        <motion.div
          className="absolute bottom-[25%] right-[15%] text-primary/[0.06] dark:text-primary/[0.04]"
          animate={{ y: [0, -12, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        >
          <Search className="w-14 h-14" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex flex-col items-center text-center gap-6">
          <motion.img
            src={logoSrc}
            alt="Yardees"
            className="h-20 w-auto object-contain drop-shadow-lg"
            data-testid="img-404-logo"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 200 }}
          />

          <div className="flex flex-col items-center gap-3">
            <motion.span
              className="text-8xl font-bold gradient-text tracking-tight"
              data-testid="text-404-code"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring", stiffness: 150 }}
            >
              404
            </motion.span>
            <motion.h1
              className="text-2xl font-semibold text-foreground"
              data-testid="text-404-title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {t("notFound.title")}
            </motion.h1>
            <motion.p
              className="text-muted-foreground max-w-xs leading-relaxed"
              data-testid="text-404-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {t("notFound.message")}
            </motion.p>
          </div>

          <motion.div
            className="flex flex-col gap-3 w-full max-w-xs"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Link href="/">
              <Button className="w-full gap-2 h-11 text-[15px] shadow-md" data-testid="link-404-home">
                <Home className="h-4 w-4" />
                {t("notFound.goHome")}
              </Button>
            </Link>
            <Link href="/explore">
              <Button variant="outline" className="w-full gap-2 h-11 text-[15px]" data-testid="link-404-browse">
                <Search className="h-4 w-4" />
                {t("notFound.browseListing")}
              </Button>
            </Link>
          </motion.div>

          <motion.button
            onClick={() => window.history.back()}
            className="text-sm text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors rounded-md px-3 py-1.5"
            data-testid="button-404-back"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            whileHover={{ x: -3 }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("notFound.goBack")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
