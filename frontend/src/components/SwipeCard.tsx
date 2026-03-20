import { motion, useMotionValue, useTransform, animate as animateValue, type PanInfo } from 'framer-motion';
import AuthImage from './AuthImage';

interface Props {
  front: string;
  back: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  onSwipeComplete: (direction: 'left' | 'right' | 'up') => void;
  onDragSwipe: (direction: 'left' | 'right' | 'up') => void;
  flipped: boolean;
  onFlipChange: (flipped: boolean) => void;
  remainingCards: number;
  exitDirection: 'left' | 'right' | 'up' | null;
}

function getExitTarget(dir: 'left' | 'right' | 'up') {
  switch (dir) {
    case 'left': return { x: -800, y: 0, rotate: -30, opacity: 0 };
    case 'right': return { x: 800, y: 0, rotate: 30, opacity: 0 };
    case 'up': return { x: 0, y: -800, rotate: 0, opacity: 0 };
  }
}

// Deterministic pseudo-random per layer index for the stack look
function stackJitter(layerIndex: number) {
  const rotations = [3, -2.5, 4];
  const xOffsets = [6, -4, 8];
  const yOffsets = [4, 4, 3];
  return {
    rotate: rotations[layerIndex % rotations.length],
    x: xOffsets[layerIndex % xOffsets.length],
    y: yOffsets[layerIndex % yOffsets.length],
  };
}

export default function SwipeCard({ front, back, frontImageUrl, backImageUrl, onSwipeComplete, onDragSwipe, flipped, onFlipChange, remainingCards, exitDirection }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(
    x,
    [-200, -100, 0, 100, 200],
    [0.5, 0.8, 1, 0.8, 0.5],
  );

  const greenOpacity = useTransform(x, [0, 100], [0, 1]);
  const redOpacity = useTransform(x, [-100, 0], [1, 0]);
  const blueOpacity = useTransform(y, [-100, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 100;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) {
      onDragSwipe('up');
    } else if (info.offset.x > threshold) {
      onDragSwipe('right');
    } else if (info.offset.x < -threshold) {
      onDragSwipe('left');
    } else {
      animateValue(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      animateValue(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }

  const stackCards = Math.min(remainingCards - 1, 2);

  const animateProps = exitDirection
    ? { ...getExitTarget(exitDirection), transition: { duration: 0.3, ease: 'easeIn' as const } }
    : { x: 0, y: 0, rotate: 0, opacity: 1 };

  return (
    <div className="relative" style={{ isolation: 'isolate' }}>
      {/* Stack cards behind — rendered bottom-up */}
      {Array.from({ length: stackCards }).map((_, i) => {
        const layerIndex = stackCards - i; // 2, 1 (bottom first)
        const jitter = stackJitter(layerIndex);
        return (
          <div
            key={`stack-${layerIndex}`}
            className="absolute inset-0"
            style={{
              transform: `rotate(${jitter.rotate}deg) translate(${jitter.x}px, ${jitter.y}px)`,
              opacity: 1 - layerIndex * 0.12,
              zIndex: 3 - layerIndex,
            }}
          >
            <div className="bg-white rounded-2xl shadow-lg border border-warm-200 p-8 min-h-[340px]" />
          </div>
        );
      })}

      <motion.div
        className="relative w-full mx-auto cursor-grab active:cursor-grabbing"
        style={{ x, y, rotate, opacity, zIndex: 10 }}
        animate={exitDirection ? animateProps : undefined}
        drag={flipped && !exitDirection}
        onDragEnd={handleDragEnd}
        onClick={() => !exitDirection && onFlipChange(!flipped)}
        whileTap={exitDirection ? undefined : { scale: 0.98 }}
        onAnimationComplete={() => {
          if (exitDirection) {
            onSwipeComplete(exitDirection);
          }
        }}
      >
        {/* Swipe indicators */}
        <motion.div
          className="absolute -right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-white font-bold px-3 py-1 rounded-lg text-sm z-10 shadow-md"
          style={{ opacity: greenOpacity }}
        >
          GOOD
        </motion.div>
        <motion.div
          className="absolute -left-2 top-1/2 -translate-y-1/2 bg-red-400 text-white font-bold px-3 py-1 rounded-lg text-sm z-10 shadow-md"
          style={{ opacity: redOpacity }}
        >
          AGAIN
        </motion.div>
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 -top-2 bg-sky-500 text-white font-bold px-3 py-1 rounded-lg text-sm z-10 shadow-md"
          style={{ opacity: blueOpacity }}
        >
          EASY
        </motion.div>

        <div className="bg-white rounded-2xl shadow-lg border border-warm-200 p-8 min-h-[340px] flex flex-col items-center justify-center">
          <div className="text-xs text-warm-400 uppercase tracking-wider mb-4 font-semibold">
            {flipped ? 'Back' : 'Front'}
          </div>
          <motion.div
            key={flipped ? 'back' : 'front'}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="text-2xl font-bold text-warm-900 text-center"
          >
            {!flipped && frontImageUrl && (
              <AuthImage src={frontImageUrl} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
            )}
            {flipped && backImageUrl && (
              <AuthImage src={backImageUrl} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
            )}
            {flipped ? back : front}
          </motion.div>
          {!flipped && (
            <p className="text-warm-400 text-sm mt-6">Tap to reveal</p>
          )}
          {flipped && (
            <p className="text-warm-400 text-sm mt-6">
              Swipe: <span className="text-red-400 font-semibold">left</span> again &middot;{' '}
              <span className="text-emerald-500 font-semibold">right</span> good &middot;{' '}
              <span className="text-sky-500 font-semibold">up</span> easy
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
