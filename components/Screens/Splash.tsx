import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, MapPin, Trophy, ArrowRight, Route as RouteIcon } from 'lucide-react';
import { Screen } from '../../types';
import BrandLogo from '../BrandLogo';
import VerticalIcon from '../shared/VerticalIcon';
import { VERTICALS, VERTICAL_IDS, categoryLabel } from '../../shared/verticals';
import { apiJson } from '../../lib/client/api';
import type { LeaderboardEntry } from '../../shared/types';

interface Props {
  onStart: (screen: Screen) => void;
  language: 'en' | 'fr';
}

type SlideId = 'welcome' | 'permissions' | 'verticals' | 'rewards' | 'ready';

type LeaderboardState = 'loading' | LeaderboardEntry[] | 'fallback';

const t = (lang: 'en' | 'fr', en: string, fr: string) => (lang === 'fr' ? fr : en);

function useLeaderboardTop3(): LeaderboardState {
  const [state, setState] = useState<LeaderboardState>('loading');
  useEffect(() => {
    const controller = new AbortController();
    apiJson<LeaderboardEntry[]>('/api/leaderboard', { signal: controller.signal })
      .then((rows) => {
        if (controller.signal.aborted) return;
        if (Array.isArray(rows) && rows.length > 0) {
          setState(rows.slice(0, 3));
        } else {
          setState('fallback');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('fallback');
      });
    return () => controller.abort();
  }, []);
  return state;
}

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
  const leaderboard = useLeaderboardTop3();

  const slides: Array<{
    id: SlideId;
    eyebrow: string;
    title: string;
    body: string;
    Hero: React.FC;
  }> = [
    {
      id: 'welcome',
      eyebrow: t(language, 'Welcome', 'Bienvenue'),
      title: t(language, 'The city, mapped\nfrom the ground up.', 'La ville cartographiée\ndepuis le terrain.'),
      body: t(
        language,
        'African Data Layer turns everyday movement in Bonamoussadi into verified infrastructure data.',
        "African Data Layer transforme les déplacements quotidiens à Bonamoussadi en données d'infrastructure vérifiées."
      ),
      Hero: Hero1Welcome,
    },
    {
      id: 'permissions',
      eyebrow: t(language, 'Before you start', 'Avant de commencer'),
      title: t(language, 'Camera + GPS,\nverified at capture.', 'Caméra + GPS,\nvérifiés à la capture.'),
      body: t(
        language,
        'We need your camera and location to verify each capture. Only live photos are accepted — no gallery uploads.',
        'Nous avons besoin de votre caméra et de votre position pour vérifier chaque capture. Seules les photos en direct sont acceptées.'
      ),
      Hero: Hero2Permissions,
    },
    {
      id: 'verticals',
      eyebrow: t(language, '7 Verticals', '7 catégories'),
      title: t(language, 'Every corner\nof the city counts.', 'Chaque coin\nde la ville compte.'),
      body: t(
        language,
        'Pharmacies, mobile money, fuel, alcohol, billboards, roads, buildings — all mapped and verified in real time.',
        'Pharmacies, mobile money, carburant, alcool, panneaux, routes, bâtiments — tout cartographié et vérifié en temps réel.'
      ),
      Hero: () => <Hero3Verticals language={language} />,
    },
    {
      id: 'rewards',
      eyebrow: t(language, 'Rewards', 'Récompenses'),
      title: t(language, 'Map more.\nClimb higher.', 'Cartographiez plus.\nMontez plus haut.'),
      body:
        leaderboard === 'fallback'
          ? t(
              language,
              'Be among the first to climb. The leaderboard fills with the first verified submissions.',
              'Soyez parmi les premiers à grimper. Le classement se remplit avec les premières contributions vérifiées.'
            )
          : t(
              language,
              'Earn XP on every verified submission. Rise up the leaderboard. Unlock badges and real rewards.',
              'Gagnez des XP à chaque contribution vérifiée. Grimpez le classement. Débloquez des badges et de vraies récompenses.'
            ),
      Hero: () => <Hero4Rewards state={leaderboard} language={language} />,
    },
    {
      id: 'ready',
      eyebrow: t(language, 'Ready?', 'Prêt ?'),
      title: t(language, 'Join the\nmission.', 'Rejoignez la\nmission.'),
      body: t(
        language,
        'Sign in or create your account to start contributing. Data collection starts now.',
        'Connectez-vous ou créez un compte pour commencer à contribuer. La collecte démarre maintenant.'
      ),
      Hero: () => <Hero5Ready language={language} />,
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
        className="relative flex-[0_0_58%] overflow-hidden"
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
          {!isFinal && (
            <button
              type="button"
              onClick={() => goTo(total - 1)}
              className="motion-pressable inline-flex h-11 items-center rounded-full bg-white/10 px-4 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur min-w-[44px]"
            >
              {t(language, 'Skip', 'Passer')}
            </button>
          )}
        </div>

        {/* Bottom fade into sheet */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: SHEET_FADE }} />
      </div>

      {/* White sheet */}
      <div className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pt-7 pb-6 shadow-[0_-12px_30px_-22px_rgba(15,43,70,0.18)]">
        <div key={`sheet-${slide.id}`} className="surface-reveal flex flex-1 flex-col">
          <div className="micro-label-wide text-terra">{slide.eyebrow}</div>
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
              <button
                type="button"
                onClick={() => goRel(1)}
                className="motion-pressable flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-sm font-bold uppercase tracking-widest text-white shadow-sm"
                style={{ boxShadow: 'var(--shadow-lift)' }}
              >
                <span>{t(language, 'Next', 'Suivant')}</span>
                <ArrowRight size={18} />
              </button>
            )}

            {isFinal && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    stashAuthMode('signin');
                    onStart(Screen.AUTH);
                  }}
                  className="motion-pressable button-breathe flex h-14 w-full items-center justify-center rounded-2xl bg-terra text-sm font-bold uppercase tracking-widest text-white"
                  style={{ boxShadow: 'var(--shadow-terra)' }}
                >
                  <span>Sign In · Connexion</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stashAuthMode('signup');
                    onStart(Screen.AUTH);
                  }}
                  className="motion-pressable flex h-14 w-full items-center justify-center rounded-2xl border border-navy/20 bg-white text-sm font-bold uppercase tracking-widest text-navy"
                >
                  <span>Create Account · Créer un compte</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStart(Screen.HOME)}
                  className="motion-pressable flex h-12 w-full items-center justify-center text-xs font-semibold uppercase tracking-widest text-gray-500"
                >
                  {t(language, 'Browse as Guest', 'Continuer en invité')}
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

const Hero3Verticals: React.FC<{ language: 'en' | 'fr' }> = ({ language }) => {
  const ids = VERTICAL_IDS;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox="0 0 390 490" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <pattern id="dotgrid" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="rgba(255,255,255,0.06)" />
        </pattern>
        <rect width="390" height="490" fill="url(#dotgrid)" />
      </svg>
      <div className="absolute inset-x-0 top-16 flex justify-center px-5">
        <div className="grid w-full max-w-[340px] grid-cols-4 gap-2">
          {ids.map((id) => {
            const v = VERTICALS[id];
            return (
              <div
                key={id}
                className="flex h-[78px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 px-1 py-1.5 text-center"
                style={{ background: `${v.bgColor}20` }}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  {v.icon === 'route' ? (
                    <RouteIcon size={16} style={{ color: v.color }} />
                  ) : (
                    <VerticalIcon name={v.icon} size={16} style={{ color: v.color }} />
                  )}
                </div>
                <div className="text-[9px] font-bold leading-[1.1] text-white/85">
                  {categoryLabel(id, language)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Hero4Rewards: React.FC<{ state: LeaderboardState; language: 'en' | 'fr' }> = ({ state, language }) => {
  const isFallback = state === 'fallback';
  const isLoading = state === 'loading';
  const rows = Array.isArray(state) ? state : [];

  if (isFallback) {
    return (
      <div className="relative h-full w-full">
        <svg viewBox="0 0 390 490" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <radialGradient id="reward-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f4c317" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f4c317" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="195" cy="240" rx="180" ry="140" fill="url(#reward-glow)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-[32px] bg-white/10 backdrop-blur" style={{ boxShadow: '0 18px 40px -20px rgba(244,195,23,0.4)' }}>
            <Trophy size={48} className="text-gold" />
          </div>
          <div className="mt-5 text-center text-sm font-semibold text-white/85">
            {t(language, 'Be the first verified.', 'Soyez le premier vérifié.')}
          </div>
        </div>
      </div>
    );
  }

  const maxXp = Math.max(1, ...rows.map((r) => r.xp));
  const initials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  const rankColors = ['#f4c317', '#cbd5e1', '#c86b4a'];

  return (
    <div className="relative h-full w-full">
      {/* Background dots */}
      <svg viewBox="0 0 390 490" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => {
          const x = 18 + (i * 47) % 360;
          const y = 30 + ((i * 53) % 380);
          return <circle key={i} cx={x} cy={y} r={1.4} fill="#f4c317" opacity={0.25 + (i % 3) * 0.12} />;
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col justify-center px-5 pt-14 pb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
          <div className="micro-label text-white/60 mb-2">
            {t(language, 'Top agents', 'Meilleurs agents')}
          </div>
          {(isLoading ? ([null, null, null] as Array<LeaderboardEntry | null>) : rows).map((entry, i) => {
            const isSkeleton = entry === null;
            const widthPct = entry ? Math.max(28, Math.round((entry.xp / maxXp) * 100)) : 80 - i * 18;
            return (
              <div key={i} className="mb-2 flex items-center gap-2.5 last:mb-0">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: rankColors[i] ?? 'rgba(255,255,255,0.15)', color: i === 1 ? '#0f2b46' : '#0f2b46' }}
                >
                  {i + 1}
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
                  {entry ? initials(entry.name) : ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`truncate text-[11px] font-bold text-white ${isSkeleton ? 'animate-pulse' : ''}`}>
                    {entry ? entry.name : <span className="inline-block h-2 w-20 rounded bg-white/15" />}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${widthPct}%`,
                        background: 'linear-gradient(90deg, #f4c317 0%, #c86b4a 100%)',
                      }}
                    />
                  </div>
                </div>
                <div className="text-[10px] font-bold text-white/85 min-w-[44px] text-right">
                  {entry ? `${entry.xp.toLocaleString()} XP` : <span className="inline-block h-2 w-10 rounded bg-white/15" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* "You" placeholder row */}
        <div className="mt-3 rounded-2xl border border-terra/30 bg-terra/10 p-2.5 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-terra/30 text-[10px] font-bold text-white">
              {t(language, 'YOU', 'VOUS')}
            </div>
            <div className="flex-1 text-[11px] font-bold text-white">
              {t(language, 'Your level — start to rank', 'Votre niveau — commencez à grimper')}
            </div>
            <div className="rounded-full bg-forest/80 px-2 py-0.5 text-[10px] font-bold text-white">+25 XP</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Hero5Ready: React.FC<{ language: 'en' | 'fr' }> = ({ language }) => {
  const pillIds = ['pharmacy', 'fuel_station', 'mobile_money', 'transport_road', 'census_proxy'];
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 390 490" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {[60, 110, 160, 220].map((r, i) => (
          <circle key={i} cx="195" cy="220" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center pt-14">
        <BrandLogo size={88} />
        <div className="mt-3 text-base font-extrabold tracking-tight text-white">African Data Layer</div>
        <div className="mt-1 micro-label-wide text-white/55">DOUALA · CAMEROON</div>

        <div className="absolute inset-x-0 bottom-20 flex flex-wrap items-center justify-center gap-1.5 px-4">
          {pillIds.map((id) => (
            <span
              key={id}
              className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/85 backdrop-blur"
            >
              {categoryLabel(id, language)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Splash;
