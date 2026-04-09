import React, { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../lib/client/motion';

export type SnapPoint = 'peek' | 'half' | 'full';

interface BottomSheetProps {
  children: React.ReactNode;
  peekHeight?: number;
  onSnapChange?: (snap: SnapPoint) => void;
  hidden?: boolean;
  isLowEndDevice?: boolean;
  className?: string;
}

const VELOCITY_THRESHOLD = 0.4; // px/ms — flick sensitivity

function getViewportHeight() {
  return typeof window !== 'undefined' ? window.innerHeight : 720;
}

function getMaxHeight(viewportHeight: number) {
  return Math.max(320, viewportHeight - 112);
}

function getHalfHeight(viewportHeight: number) {
  return Math.max(260, Math.min(getMaxHeight(viewportHeight) - 72, viewportHeight * 0.5));
}

function snapOffsetFor(snap: SnapPoint, peekHeight: number, viewportHeight: number): number {
  // offset = how far the sheet is pushed DOWN from its full-open position
  // 0 = fully open, maxHeight - peekHeight = only peek visible
  const maxH = getMaxHeight(viewportHeight);
  if (snap === 'full') return 0;
  if (snap === 'half') return maxH - getHalfHeight(viewportHeight);
  return maxH - peekHeight; // peek
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  peekHeight = 80,
  onSnapChange,
  hidden = false,
  isLowEndDevice = false,
  className = '',
}) => {
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight());
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>('peek');
  const [translateY, setTranslateY] = useState(() => snapOffsetFor('peek', peekHeight, getViewportHeight()));
  const [isDragging, setIsDragging] = useState(false);
  const [entered, setEntered] = useState(false);

  const dragState = useRef<{
    startY: number;
    startTranslate: number;
    lastY: number;
    lastTime: number;
  } | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncViewport = () => setViewportHeight(getViewportHeight());
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  // Entrance animation
  useEffect(() => {
    if (hidden) {
      setEntered(false);
      return;
    }
    if (entered) return;
    // Start off-screen, then animate to peek
    const maxH = getMaxHeight(viewportHeight);
    setTranslateY(maxH + peekHeight);
    const raf = requestAnimationFrame(() => {
      setCurrentSnap('peek');
      setTranslateY(snapOffsetFor('peek', peekHeight, viewportHeight));
      setEntered(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [entered, hidden, peekHeight, viewportHeight]);

  useEffect(() => {
    if (hidden || isDragging) return;
    setTranslateY(snapOffsetFor(currentSnap, peekHeight, viewportHeight));
  }, [currentSnap, hidden, isDragging, peekHeight, viewportHeight]);

  const snapTo = useCallback(
    (snap: SnapPoint) => {
      const offset = snapOffsetFor(snap, peekHeight, viewportHeight);
      setTranslateY(offset);
      setCurrentSnap(snap);
      onSnapChange?.(snap);
    },
    [onSnapChange, peekHeight, viewportHeight],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only drag from the handle area (first child / top area)
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragState.current = {
        startY: e.clientY,
        startTranslate: translateY,
        lastY: e.clientY,
        lastTime: Date.now(),
      };
      setIsDragging(true);
    },
    [translateY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return;
      const dy = e.clientY - dragState.current.startY;
      const maxH = getMaxHeight(viewportHeight);
      const newY = Math.max(0, Math.min(maxH, dragState.current.startTranslate + dy));
      setTranslateY(newY);
      dragState.current.lastY = e.clientY;
      dragState.current.lastTime = Date.now();
    },
    [viewportHeight],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return;
      const dt = Date.now() - dragState.current.lastTime || 1;
      const dy = e.clientY - dragState.current.lastY;
      const velocity = dy / dt; // positive = dragging down

      setIsDragging(false);

      const peekOffset = snapOffsetFor('peek', peekHeight, viewportHeight);
      const halfOffset = snapOffsetFor('half', peekHeight, viewportHeight);
      const fullOffset = snapOffsetFor('full', peekHeight, viewportHeight);

      // If flick, snap in direction
      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        if (velocity > 0) {
          // Dragging down
          snapTo(currentSnap === 'full' ? 'half' : 'peek');
        } else {
          // Dragging up
          snapTo(currentSnap === 'peek' ? 'half' : 'full');
        }
      } else {
        // Snap to closest
        const current = translateY;
        const distances = [
          { snap: 'peek' as SnapPoint, d: Math.abs(current - peekOffset) },
          { snap: 'half' as SnapPoint, d: Math.abs(current - halfOffset) },
          { snap: 'full' as SnapPoint, d: Math.abs(current - fullOffset) },
        ];
        distances.sort((a, b) => a.d - b.d);
        snapTo(distances[0].snap);
      }

      dragState.current = null;
    },
    [currentSnap, peekHeight, snapTo, translateY, viewportHeight],
  );

  if (hidden) return null;

  const maxH = getMaxHeight(viewportHeight);
  const reducedMotion = prefersReducedMotion();
  const transitionStyle = isDragging || !entered || reducedMotion
    ? 'none'
    : 'transform var(--duration-base, 320ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1))';

  return (
    <div
      ref={sheetRef}
      className={`fixed inset-x-0 z-30 mx-auto w-full max-w-md rounded-t-[28px] border-t border-gray-100 shadow-[0_-4px_24px_rgba(15,43,70,0.12)] ${
        isLowEndDevice ? 'bg-white' : 'bg-white/98 backdrop-blur-xl'
      } ${className}`}
      style={{
        bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom, 0px) + 0.25rem)',
        height: `${maxH}px`,
        transform: `translateY(${translateY}px)`,
        transition: transitionStyle,
        willChange: 'transform',
      }}
    >
      {/* Drag handle */}
      <div
        className="bottom-sheet flex items-center justify-center h-8 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300" />
      </div>

      {/* Content */}
      <div
        className="bottom-sheet-content overflow-y-auto no-scrollbar px-4 pb-4"
        style={{ maxHeight: `${maxH - 32}px` }}
      >
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
