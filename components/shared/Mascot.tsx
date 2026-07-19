import React from 'react';
// Web-optimized WebP (512px, ~22KB) — light enough for low-end Android on 2G.
// Full-res PNG originals live one level up in assets/mascot/ for marketing use.
import canonical from '@/assets/mascot/web/data-canonical.webp';
import standing from '@/assets/mascot/web/data-standing.webp';
import cheering from '@/assets/mascot/web/data-cheering.webp';
import sleeping from '@/assets/mascot/web/data-sleeping.webp';
import determined from '@/assets/mascot/web/data-determined.webp';
import tierBronze from '@/assets/mascot/web/data-tier-bronze.webp';
import tierGold from '@/assets/mascot/web/data-tier-gold.webp';

/**
 * "Data" le Lionceau — ADL agent-app mascot.
 *
 * AGENT APP ONLY. Do not render on the company console (console.html /
 * Admin / Client screens). The mascot belongs to the agent's celebratory
 * emotional register; console surfaces stay mascot-free.
 *
 * Static transparent PNG + optional CSS micro-animation. No video/Lottie —
 * keeps it cheap for low-end Android on 2G. Motion respects
 * `prefers-reduced-motion` via the global rule in index.css.
 */

export type MascotPose =
  | 'canonical'
  | 'standing'
  | 'cheering'
  | 'sleeping'
  | 'determined'
  | 'tier-bronze'
  | 'tier-gold';

export type MascotAnimation = 'none' | 'pop' | 'float' | 'wiggle';

const POSE_SRC: Record<MascotPose, string> = {
  canonical,
  standing,
  cheering,
  sleeping,
  determined,
  'tier-bronze': tierBronze,
  'tier-gold': tierGold,
};

const ANIM_CLASS: Record<MascotAnimation, string> = {
  none: '',
  pop: 'mascot-pop',
  float: 'mascot-float',
  wiggle: 'mascot-wiggle',
};

const POSE_ALT: Record<MascotPose, string> = {
  canonical: 'Data the lion cub',
  standing: 'Data the lion cub',
  cheering: 'Data celebrating',
  sleeping: 'Data resting',
  determined: 'Data ready for the field',
  'tier-bronze': 'Data — beginner tier',
  'tier-gold': 'Data — veteran tier',
};

interface Props {
  pose?: MascotPose;
  animate?: MascotAnimation;
  /** px size of the square bounding box. Default 64. */
  size?: number;
  className?: string;
  /** Decorative by default (empty alt). Set a label when the mascot carries meaning. */
  alt?: string;
}

const Mascot: React.FC<Props> = ({
  pose = 'canonical',
  animate = 'none',
  size = 64,
  className = '',
  alt,
}) => {
  const decorative = alt === undefined;
  return (
    <img
      src={POSE_SRC[pose]}
      alt={decorative ? '' : alt || POSE_ALT[pose]}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      draggable={false}
      className={`${ANIM_CLASS[animate]} select-none object-contain ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
};

export default Mascot;
