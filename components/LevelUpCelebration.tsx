import React, { useCallback, useEffect, useRef } from "react";

/** Brand palette tokens — keep in sync with tailwind.config.js */
const BRAND = {
  terra: '#c86b4a',
  forest: '#4c7c59',
  navy: '#0f2b46',
  gold: '#d69e2e',
} as const;

interface LevelUpCelebrationProps {
  level: number;
  language: "en" | "fr";
  onDismiss: () => void;
}

const CONFETTI_COLORS = [
  BRAND.terra,
  BRAND.forest,
  BRAND.navy,
  BRAND.gold,
  "#3b82f6",
  "#9b2c2c",
];

export default function LevelUpCelebration({
  level,
  language,
  onDismiss,
}: LevelUpCelebrationProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  const heading = language === "fr" ? "NIVEAU SUP\u00c9RIEUR !" : "LEVEL UP!";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isLowEnd =
    typeof navigator !== "undefined" &&
    ("hardwareConcurrency" in navigator
      ? (navigator.hardwareConcurrency ?? 4) <= 2
      : false);

  const confettiCount = isLowEnd ? 8 : 20;

  const confettiPieces = prefersReducedMotion
    ? null
    : Array.from({ length: confettiCount }, (_, i) => {
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const left = Math.random() * 100;
        const width = Math.random() * 8 + 4;
        const height = Math.random() * 12 + 6;
        const duration = Math.random() * 3 + 2;
        const delay = Math.random() * 3;

        return (
          <div
            key={i}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -20,
              left: `${left}%`,
              width: `${width}px`,
              height: `${height}px`,
              backgroundColor: color,
              animation: `confetti-fall ${duration}s linear infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      });

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-label={
        language === "fr"
          ? `Niveau ${level} atteint !`
          : `Reached level ${level}!`
      }
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-navy/95 flex items-center justify-center outline-none overflow-hidden"
      onClick={onDismiss}
      onKeyDown={handleKeyDown}
    >
      <div className="ambient-orb left-[-4rem] top-[12%] h-44 w-44 bg-gold/20" />
      <div className="ambient-orb right-[-3rem] top-[20%] h-36 w-36 bg-terra/20" style={{ animationDelay: '-2s' }} />
      <div className="ambient-orb bottom-[10%] left-[12%] h-28 w-28 bg-white/10" style={{ animationDelay: '-4s' }} />
      {confettiPieces}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative">
          <div className="ring-pulse absolute inset-[-18px] rounded-full border border-white/30" />
          <div className="ring-pulse absolute inset-[-32px] rounded-full border border-gold/20" style={{ animationDelay: '0.8s' }} />
          <div
            className="reward-float w-28 h-28 rounded-full bg-white flex items-center justify-center shadow-2xl"
            style={{ animation: "level-scale-in 0.5s ease-out, reward-float 6s ease-in-out infinite 0.5s" }}
          >
            <span className="text-5xl font-extrabold text-navy">
              {level}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="micro-label-wide text-gold">
            {language === "fr" ? "CONFIANCE + STATUT" : "TRUST + STATUS"}
          </p>
          <h1 className="text-4xl font-extrabold text-white tracking-wider">
            {heading}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-white/75">
            {language === "fr"
              ? "Chaque niveau confirme une contribution plus fiable et une progression visible dans le terrain."
              : "Each level confirms more reliable contribution and more visible field progress."}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          <div className="rounded-2xl bg-white/8 px-3 py-4">
            <div className="micro-label text-white/60">{language === "fr" ? "Statut" : "Status"}</div>
            <div className="mt-2 text-sm font-bold text-white">{language === "fr" ? "Monte" : "Rising"}</div>
          </div>
          <div className="rounded-2xl bg-white/8 px-3 py-4">
            <div className="micro-label text-white/60">XP</div>
            <div className="mt-2 text-sm font-bold text-white">{language === "fr" ? "Visible" : "Visible"}</div>
          </div>
          <div className="rounded-2xl bg-white/8 px-3 py-4">
            <div className="micro-label text-white/60">{language === "fr" ? "Confiance" : "Trust"}</div>
            <div className="mt-2 text-sm font-bold text-white">{language === "fr" ? "Renforcee" : "Stronger"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
