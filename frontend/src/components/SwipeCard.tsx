import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';

interface Props {
  front: string;
  back: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
  flipped: boolean;
  onFlipChange: (flipped: boolean) => void;
}

export default function SwipeCard({ front, back, frontImageUrl, backImageUrl, onSwipe, flipped, onFlipChange }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(
    x,
    [-200, -100, 0, 100, 200],
    [0.5, 0.8, 1, 0.8, 0.5],
  );

  // Indicator opacities
  const greenOpacity = useTransform(x, [0, 100], [0, 1]);
  const redOpacity = useTransform(x, [-100, 0], [1, 0]);
  const blueOpacity = useTransform(y, [-100, 0], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 100;
    if (info.offset.y < -threshold && Math.abs(info.offset.x) < threshold) {
      onSwipe('up');
    } else if (info.offset.x > threshold) {
      onSwipe('right');
    } else if (info.offset.x < -threshold) {
      onSwipe('left');
    }
  }

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto cursor-grab active:cursor-grabbing"
      style={{ x, y, rotate, opacity }}
      drag
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      onClick={() => onFlipChange(!flipped)}
      whileTap={{ scale: 0.98 }}
    >
      {/* Swipe indicators */}
      <motion.div
        className="absolute -right-2 top-1/2 -translate-y-1/2 bg-green-500 text-white font-bold px-3 py-1 rounded-lg text-sm z-10"
        style={{ opacity: greenOpacity }}
      >
        GOOD
      </motion.div>
      <motion.div
        className="absolute -left-2 top-1/2 -translate-y-1/2 bg-red-500 text-white font-bold px-3 py-1 rounded-lg text-sm z-10"
        style={{ opacity: redOpacity }}
      >
        AGAIN
      </motion.div>
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 -top-2 bg-blue-500 text-white font-bold px-3 py-1 rounded-lg text-sm z-10"
        style={{ opacity: blueOpacity }}
      >
        EASY
      </motion.div>

      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700/50 p-8 min-h-[280px] flex flex-col items-center justify-center">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">
          {flipped ? 'Back' : 'Front'}
        </div>
        <motion.div
          key={flipped ? 'back' : 'front'}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="text-2xl font-semibold text-white text-center"
        >
          {!flipped && frontImageUrl && (
            <img src={frontImageUrl} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
          )}
          {flipped && backImageUrl && (
            <img src={backImageUrl} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
          )}
          {flipped ? back : front}
        </motion.div>
        {!flipped && (
          <p className="text-slate-500 text-sm mt-6">Tap to reveal</p>
        )}
        {flipped && (
          <p className="text-slate-500 text-sm mt-6">
            Swipe: <span className="text-red-400">left</span> again &middot;{' '}
            <span className="text-green-400">right</span> good &middot;{' '}
            <span className="text-blue-400">up</span> easy
          </p>
        )}
      </div>
    </motion.div>
  );
}
