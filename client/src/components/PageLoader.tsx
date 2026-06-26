import { motion } from "framer-motion";
const logoSrc = "/yardees-logo.png";

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-emerald-950 via-green-900 to-emerald-950 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${200 + i * 120}px`,
              height: `${200 + i * 120}px`,
              left: `${10 + i * 12}%`,
              top: `${15 + i * 8}%`,
              background: i % 2 === 0
                ? "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -20, 30, 0],
              scale: [1, 1.1, 0.95, 1],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.02) 40%, transparent 70%)",
        }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="relative flex flex-col items-center gap-8 z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="relative">
          <motion.div
            className="absolute -inset-8 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)",
            }}
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="absolute -inset-12 rounded-full border border-emerald-400/10"
            animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2], rotate: [0, 180, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />

          <motion.div
            className="relative"
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.img
              src={logoSrc}
              alt="YARDEES"
              className="h-20 w-auto drop-shadow-2xl"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
            />
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <motion.p
            className="text-emerald-200/60 text-xs tracking-[0.3em] uppercase font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            Yard Sales & Thrift Shopping
          </motion.p>

          <motion.div
            className="relative h-[2px] w-32 overflow-hidden rounded-full bg-white/10"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
              animate={{
                x: ["-100%", "300%"],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </div>

        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{
                scale: [0.8, 1.5, 0.8],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

export function InlineLoader({ text }: { text?: string }) {
  return (
    <motion.div
      className="flex items-center justify-center gap-3 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-primary"
            animate={{
              y: [0, -8, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.12,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {text && (
        <span className="text-sm text-muted-foreground">{text}</span>
      )}
    </motion.div>
  );
}

export function ButtonLoader() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
