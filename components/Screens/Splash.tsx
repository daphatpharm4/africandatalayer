import React, { useRef, useState, useCallback } from 'react';
import { Camera, MapPin, ArrowRight, Route as RouteIcon } from 'lucide-react';
import { Screen } from '../../types';
import BrandLogo from '../BrandLogo';

interface Props {
  onStart: (screen: Screen) => void;
  language: 'en' | 'fr';
}

type SlideId = 'mission' | 'proof';

const t = (lang: 'en' | 'fr', en: string, fr: string) => (lang === 'fr' ? fr : en);

function useSwipe(go: (delta: 1 | -1) => void) {
  const downRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    downRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = downRef.current;
    downRef.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 600) return;
    if (Math.abs(dy) > 60) return;
    if (Math.abs(dx) < 40) return;
    go(dx < 0 ? 1 : -1);
  };
  const onPointerCancel = () => {
    downRef.current = null;
  };
  return { onPointerDown, onPointerUp, onPointerCancel };
}

const HERO_GRADIENT = 'linear-gradient(180deg, #0b2236 0%, #0f2b46 60%, #1d4565 100%)';
const SHEET_FADE = 'linear-gradient(180deg, rgba(15,43,70,0) 0%, rgba(15,43,70,0) 70%, #ffffff 100%)';

const Splash: React.FC<Props> = ({ onStart, language }) => {
  const [idx, setIdx] = useState(0);

  const slides: Array<{
    id: SlideId;
    eyebrow: string;
    title: string;
    body: string;
    Hero: React.FC;
  }> = [
    {
      id: 'mission',
      eyebrow: t(language, 'Your first mission', 'Votre première mission'),
      title: t(language, 'Find what your area\nstill needs.', 'Repérez ce qui manque\ndans votre quartier.'),
      body: t(
        language,
        'Explore the live map, choose a nearby coverage gap, and turn one short field visit into trusted local data.',
        'Explorez la carte, choisissez un manque à proximité et transformez une courte visite terrain en donnée locale fiable.'
      ),
      Hero: Hero1Welcome,
    },
    {
      id: 'proof',
      eyebrow: t(language, 'How verification works', 'Comment fonctionne la vérification'),
      title: t(language, 'One live photo.\nOne trusted location.', 'Une photo en direct.\nUn lieu vérifié.'),
      body: t(
        language,
        'When you begin a capture, ADL asks for camera and precise location access to prove the visit. Your result is then saved or queued safely.',
        "Au début d'une collecte, ADL demande la caméra et la position précise pour prouver la visite. Le résultat est ensuite enregistré ou mis en attente en toute sécurité."
      ),
      Hero: Hero2Permissions,
    },
  ];

  const total = slides.length;
  const isFinal = idx === total - 1;
  const slide = slides[idx];
  const HeroComponent = slide.Hero;

  const goRel = useCallback(
    (delta: 1 | -1) => {
      setIdx((cur) => {
        const next = cur + delta;
        if (next < 0 || next > total - 1) return cur;
        return next;
      });
    },
    [total]
  );

  const goTo = useCallback(
    (j: number) => {
      if (j < 0 || j > total - 1) return;
      setIdx(j);
    },
    [total]
  );

  const swipeHandlers = useSwipe(goRel);

  const stashAuthMode = (mode: 'signin' | 'signup') => {
    try {
      sessionStorage.setItem('adl_auth_initial_mode', mode);
    } catch {
      /* private browsing */
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-white"
      style={{ touchAction: 'pan-y' }}
      {...swipeHandlers}
    >
      {/* Hero region (dark) */}
      <div
        className="relative flex-[0_0_52%] overflow-hidden"
        style={{ background: HERO_GRADIENT }}
      >
        <div key={slide.id} className="surface-reveal absolute inset-0">
          <HeroComponent />
        </div>

        {/* Top chrome: brand + skip */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
            <BrandLogo size={18} />
            <span className="micro-label text-white/90">ADL</span>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
            {t(language, 'Map · Verify · Improve', 'Cartographier · Vérifier')}
          </span>
        </div>

        {/* Bottom fade into sheet */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: SHEET_FADE }} />
      </div>

      {/* White sheet */}
      <div className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pt-7 pb-6 shadow-[0_-12px_30px_-22px_rgba(15,43,70,0.18)]">
        <div key={`sheet-${slide.id}`} className="surface-reveal flex flex-1 flex-col">
          <div className="micro-label-wide text-terra-dark">{slide.eyebrow}</div>
          <h1 className="mt-2 whitespace-pre-line text-[28px] font-extrabold leading-[1.12] tracking-tight text-ink">
            {slide.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{slide.body}</p>

          <div className="mt-auto pt-6">
            {/* Progress dots */}
            <div className="mb-5 flex items-center justify-center gap-2">
              {slides.map((s, j) => {
                const active = j === idx;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goTo(j)}
                    aria-label={`Slide ${j + 1}`}
                    className="motion-pressable flex min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        active ? 'w-6 bg-navy' : j < idx ? 'w-3 bg-terra/60' : 'w-3 bg-gray-200'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* CTA row */}
            {!isFinal && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => onStart(Screen.HOME)}
                  className="motion-pressable flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-sm font-bold uppercase tracking-widest text-white shadow-sm"
                  style={{ boxShadow: 'var(--shadow-lift)' }}
                >
                  <RouteIcon size={18} />
                  <span>{t(language, 'Explore nearby missions', 'Explorer les missions proches')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => goRel(1)}
                  className="motion-pressable flex h-12 w-full items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-navy"
                >
                  <span>{t(language, 'How verification works', 'Comment ça marche')}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {isFinal && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => onStart(Screen.HOME)}
                  className="motion-pressable button-breathe flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-terra text-sm font-bold uppercase tracking-widest text-white"
                  style={{ boxShadow: 'var(--shadow-terra)' }}
                >
                  <RouteIcon size={18} />
                  <span>{t(language, 'Find my first mission', 'Trouver ma première mission')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stashAuthMode('signin');
                    onStart(Screen.AUTH);
                  }}
                  className="motion-pressable flex h-12 w-full items-center justify-center rounded-2xl border border-navy/20 bg-white text-xs font-bold uppercase tracking-widest text-navy"
                >
                  <span>{t(language, 'Already contributing? Sign in', 'Déjà contributeur ? Connexion')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------- Hero scenes -------------------------- */

const Hero1Welcome: React.FC<{ cityLabel?: string }> = ({ cityLabel = 'Bonamoussadi · Douala' }) => (
  <svg viewBox="0 0 390 490" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id="welcome-glow" cx="50%" cy="48%" r="38%">
        <stop offset="0%" stopColor="#f4c317" stopOpacity="0.45" />
        <stop offset="55%" stopColor="#f4c317" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#f4c317" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="welcome-arterial" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#c86b4a" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#c86b4a" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Faint grid lines */}
    <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={40 + i * 38} x2="390" y2={40 + i * 38} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`v${i}`} x1={20 + i * 40} y1="0" x2={20 + i * 40} y2="490" />
      ))}
    </g>

    {/* Arterial paths */}
    <path d="M-20 180 C 80 160, 200 240, 410 200" stroke="url(#welcome-arterial)" strokeWidth="3" fill="none" />
    <path d="M-20 320 C 120 280, 260 360, 410 310" stroke="rgba(244,195,23,0.25)" strokeWidth="2" fill="none" />

    {/* Block rects */}
    {[
      [60, 140, 36, 28],
      [140, 200, 50, 30],
      [240, 130, 42, 36],
      [80, 280, 34, 28],
      [220, 290, 60, 26],
      [310, 230, 38, 32],
    ].map(([x, y, w, h], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="rgba(15,43,70,0.55)" stroke="rgba(255,255,255,0.05)" />
    ))}

    {/* Gold dot lights */}
    {Array.from({ length: 16 }).map((_, i) => {
      const x = 30 + (i * 53) % 360;
      const y = 80 + ((i * 71) % 320);
      return <circle key={i} cx={x} cy={y} r={1.6} fill="#f4c317" opacity={0.35 + (i % 3) * 0.18} />;
    })}

    {/* Logo glow + medallion */}
    <circle cx="195" cy="240" r="180" fill="url(#welcome-glow)" />
    <g className="ring-pulse" style={{ transformOrigin: '195px 240px' }}>
      <circle cx="195" cy="240" r="64" fill="none" stroke="rgba(244,195,23,0.35)" strokeWidth="1.5" />
    </g>
    <circle cx="195" cy="240" r="48" fill="#0f2b46" stroke="rgba(244,195,23,0.5)" strokeWidth="1" />
    <g transform="translate(165 210) scale(0.47)">
      <path d="M64 14L112 40L64 66L16 40L64 14Z" fill="#0f2b46" stroke="#ffffff" strokeWidth="6" strokeLinejoin="round" />
      <path d="M64 44L112 70L64 96L16 70L64 44Z" fill="#f4c317" stroke="#ffffff" strokeWidth="6" strokeLinejoin="round" />
      <path d="M16 76L64 102L112 76L76 114C73 117 68.9 118.5 64.8 118.5C60.7 118.5 56.6 117 53.6 114L16 76Z" fill="#0f2b46" stroke="#ffffff" strokeWidth="6" strokeLinejoin="round" />
    </g>

    {/* Location pill */}
    <g transform="translate(195 358)">
      <rect x="-94" y="-14" width="188" height="28" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" />
      <text x="0" y="4" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="11" fontWeight="700" letterSpacing="2" fill="rgba(255,255,255,0.78)">
        {cityLabel.toUpperCase()}
      </text>
    </g>
  </svg>
);

const Hero2Permissions: React.FC = () => (
  <div className="relative h-full w-full">
    <svg viewBox="0 0 390 490" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="perm-glow" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#c86b4a" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#c86b4a" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#c86b4a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="195" cy="245" rx="180" ry="140" fill="url(#perm-glow)" />
      {/* Faint grid */}
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`p${i}`} x1="0" y1={60 + i * 56} x2="390" y2={60 + i * 56} />
        ))}
      </g>
    </svg>
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/10 backdrop-blur" style={{ boxShadow: '0 18px 40px -20px rgba(15,43,70,0.6)' }}>
          <Camera size={42} className="text-white" />
        </div>
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/10 backdrop-blur" style={{ boxShadow: '0 18px 40px -20px rgba(15,43,70,0.6)' }}>
          <MapPin size={42} className="text-white" />
        </div>
      </div>
    </div>
  </div>
);

export default Splash;
