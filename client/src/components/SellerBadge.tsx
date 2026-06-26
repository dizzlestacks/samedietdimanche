import { Shield, ShieldCheck, BadgeCheck, Star, Award } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SellerBadge({ level, size = 16, showLabel = false }: { level?: string | null; size?: number; showLabel?: boolean }) {
  if (!level || level === "unverified") return null;

  if (level === "id_verified") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(16,185,129,0.12) 50%, rgba(6,182,212,0.08) 100%)",
              border: "1px solid rgba(34,197,94,0.25)",
              boxShadow: "0 0 8px rgba(34,197,94,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
            data-testid="badge-seller-id_verified"
          >
            <span className="relative flex items-center justify-center">
              <BadgeCheck
                size={size}
                className="text-green-500 drop-shadow-sm"
                style={{ filter: "drop-shadow(0 0 3px rgba(34,197,94,0.4))" }}
              />
            </span>
            {showLabel && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                ID Verified
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2 font-medium">
          <BadgeCheck className="w-4 h-4 text-green-500" />
          Identity Verified
        </TooltipContent>
      </Tooltip>
    );
  }

  if (level === "trusted_seller") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(245,158,11,0.12) 50%, rgba(217,119,6,0.08) 100%)",
              border: "1px solid rgba(234,179,8,0.3)",
              boxShadow: "0 0 8px rgba(234,179,8,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
            data-testid="badge-seller-trusted_seller"
          >
            <span className="relative flex items-center justify-center">
              <Award
                size={size}
                className="text-yellow-500"
                style={{ filter: "drop-shadow(0 0 3px rgba(234,179,8,0.5))" }}
              />
            </span>
            {showLabel && (
              <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                Trusted Seller
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2 font-medium">
          <Award className="w-4 h-4 text-yellow-500" />
          Trusted Seller
        </TooltipContent>
      </Tooltip>
    );
  }

  if (level === "email_verified") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center" data-testid="badge-seller-email_verified">
            <ShieldCheck className="text-blue-500" size={size} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Email Verified</TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

export function VerifiedBadgeInline({ level }: { level?: string | null }) {
  if (!level || level === "unverified" || level === "email_verified") return null;

  if (level === "id_verified") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.15) 100%)",
          border: "1.5px solid rgba(34,197,94,0.3)",
          color: "rgb(22,163,74)",
          boxShadow: "0 0 12px rgba(34,197,94,0.12)",
        }}
        data-testid="badge-inline-id-verified"
      >
        <BadgeCheck className="w-3.5 h-3.5" style={{ filter: "drop-shadow(0 0 2px rgba(34,197,94,0.5))" }} />
        ID Verified
      </span>
    );
  }

  if (level === "trusted_seller") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
        style={{
          background: "linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(245,158,11,0.15) 100%)",
          border: "1.5px solid rgba(234,179,8,0.3)",
          color: "rgb(202,138,4)",
          boxShadow: "0 0 12px rgba(234,179,8,0.12)",
        }}
        data-testid="badge-inline-trusted-seller"
      >
        <Award className="w-3.5 h-3.5" style={{ filter: "drop-shadow(0 0 2px rgba(234,179,8,0.5))" }} />
        Trusted Seller
      </span>
    );
  }

  return null;
}

export function StarRating({ rating, count, size = 14 }: { rating?: string | number | null; count?: number; size?: number }) {
  const numRating = typeof rating === 'string' ? parseFloat(rating) : (rating || 0);
  if (!numRating || numRating === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-sm" data-testid="seller-star-rating">
      <Star className="text-yellow-500 fill-yellow-500" size={size} />
      <span className="font-medium">{numRating.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted-foreground">({count})</span>}
    </span>
  );
}
