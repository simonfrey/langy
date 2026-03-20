import { motion, useMotionValue, useTransform, animate as animateValue, type PanInfo } from 'framer-motion';
import AuthImage from './AuthImage';

interface Jitter {
  rotate: number;
  x: number;
  y: number;
}

interface Props {
  front: string;
  back: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  onSwipeComplete: (direction: 'left' | 'right' | 'up') => void;
  onDragSwipe: (direction: 'left' | 'right' | 'up') => void;
  flipped: boolean;
  onFlipChange: (flipped: boolean) => void;
  exitDirection: 'left' | 'right' | 'up' | null;
  jitter?: Jitter;
}

function getExitTarget(dir: 'left' | 'right' | 'up') {
  switch (dir) {
    case 'left': return { x: -800, y: 0, rotate: -30, opacity: 0 };
    case 'right': return { x: 800, y: 0, rotate: 30, opacity: 0 };
    case 'up': return { x: 0, y: -800, rotate: 0, opacity: 0 };
  }
}

export default function SwipeCard({ front, back, frontImageUrl, backImageUrl, onSwipeComplete, onDragSwipe, flipped, onFlipChange, exitDirection, jitter }: Props) {
  const effectiveFrontImage = frontImageUrl || backImageUrl;
  const effectiveBackImage = backImageUrl || frontImageUrl;

  const j = jitter ?? { rotate: 0, x: 0, y: 0 };
  const x = useMotionValue(j.x);
  const y = useMotionValue(j.y);
  const rotate = useTransform(x, [j.x - 200, j.x + 200], [j.rotate - 15, j.rotate + 15]);
  const opacity = useMotionValue(1);

  const greenOpacity = useTransform(x, [j.x, j.x + 100], [0, 1]);
  const redOpacity = useTransform(x, [j.x - 100, j.x], [1, 0]);
  const blueOpacity = useTransform(y, [j.y - 100, j.y], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 100;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) {
      onDragSwipe('up');
    } else if (info.offset.x > threshold) {
      onDragSwipe('right');
    } else if (info.offset.x < -threshold) {
      onDragSwipe('left');
    } else {
      animateValue(x, j.x, { type: 'spring', stiffness: 300, damping: 30 });
      animateValue(y, j.y, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }

  const animateProps = exitDirection
    ? { ...getExitTarget(exitDirection), transition: { duration: 0.3, ease: 'easeIn' as const } }
    : undefined;

  return (
    <div className="relative" style={{ zIndex: 5 }}>
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
          <div
            className="text-2xl font-bold text-warm-900 text-center"
          >
            {!flipped && effectiveFrontImage && (
              <AuthImage src={effectiveFrontImage} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
            )}
            {flipped && effectiveBackImage && (
              <AuthImage src={effectiveBackImage} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
            )}
            {flipped ? back : front}
          </div>
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
