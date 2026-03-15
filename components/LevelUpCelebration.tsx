import React, { useCallback, useEffect, useRef } from "react";

interface LevelUpCelebrationProps {
  level: number;
  language: "en" | "fr";
  onDismiss: () => void;
}

const CONFETTI_COLORS = [
  "#c86b4a",
  "#4c7c59",
  "#0f2b46",
  "#d69e2e",
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
      className="fixed inset-0 z-50 bg-navy/90 backdrop-blur flex items-center justify-center outline-none"
      onClick={onDismiss}
      onKeyDown={handleKeyDown}
    >
      {confettiPieces}
      <div className="flex flex-col items-center gap-6">
        <div
          className="w-28 h-28 rounded-full bg-white flex items-center justify-center"
          style={{ animation: "level-scale-in 0.5s ease-out" }}
        >
          <span className="text-5xl font-extrabold text-navy">
            {level}
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-wider">
          {heading}
        </h1>
      </div>
    </div>
  );
}
