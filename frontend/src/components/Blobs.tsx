import { useMemo } from "react";

/** Langy mascot — friendly rounded rectangle, white eyes + smile, consistent proportions
 *  Reference face: 96x62 rect rx=12, eyes at ~33%/67% x and ~39% y, smile arc below center.
 *  All variants maintain 1.55:1 aspect ratio for the main face rectangle.
 *  Primary color: #4A90B8 (warm dusty blue)
 */

const BLUE = "#4A90B8";
const BLUE_LIGHT = "#B8D8E8";
const BLUE_GLOW = "#D6EAF2";
const BLUE_MUTED = "#6BA8C9"; // slightly lighter blue for accents
const BLUE_PALE = "#A3CCDE"; // pale blue for subtle dots
const BLUE_DEEP = "#3A7CA5"; // deeper blue for variety

function MascotFace({
  x,
  y,
  w,
  color = BLUE,
}: {
  x: number;
  y: number;
  w: number;
  color?: string;
}) {
  const s = w / 96;
  const h = 62 * s;
  const rx = 12 * s;
  const eyeR = 3 * s;
  const eyeLx = x + 32 * s;
  const eyeRx = x + 64 * s;
  const eyeY = y + 24 * s;
  const smX1 = x + 35 * s;
  const smX2 = x + 61 * s;
  const smY = y + 36 * s;
  const smQx = x + 48 * s;
  const smQy = y + 46 * s;
  const smW = 2.5 * s;

  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={color} />
      <circle cx={eyeLx} cy={eyeY} r={eyeR} fill="white" />
      <circle cx={eyeRx} cy={eyeY} r={eyeR} fill="white" />
      <path
        d={`M${smX1} ${smY} Q${smQx} ${smQy} ${smX2} ${smY}`}
        stroke="white"
        strokeWidth={smW}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

/** Large mascot for Login page */
export function Mascot({
  className = "",
  size = 140,
}: {
  className?: string;
  size?: number;
}) {
  const w = size * 0.69;
  const h = w * (62 / 96);
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  const glowPad = size * 0.06;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden
    >
      <rect
        x={x - glowPad}
        y={y - glowPad}
        width={w + glowPad * 2}
        height={h + glowPad * 2}
        rx={18}
        fill={BLUE_GLOW}
      />
      <MascotFace x={x} y={y} w={w} />
      <circle
        cx={size * 0.04}
        cy={size * 0.09}
        r={size * 0.035}
        fill={BLUE_MUTED}
        opacity="0.5"
      />
      <circle
        cx={size * 0.96}
        cy={size * 0.06}
        r={size * 0.028}
        fill={BLUE_PALE}
        opacity="0.6"
      />
      <circle
        cx={size * 0.01}
        cy={size * 0.91}
        r={size * 0.028}
        fill={BLUE_DEEP}
        opacity="0.4"
      />
      <circle
        cx={size * 0.97}
        cy={size * 0.94}
        r={size * 0.035}
        fill={BLUE_MUTED}
        opacity="0.4"
      />
    </svg>
  );
}

/** Small inline mascot for headers */
export function MascotSmall({ className = "" }: { className?: string }) {
  const w = 30;
  const x = (40 - w) / 2;
  const y = (40 - w * (62 / 96)) / 2;

  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <MascotFace x={x} y={y} w={w} />
    </svg>
  );
}

export function BlobBackground({ className = "" }: { className?: string }) {
  const blobs = useMemo(() => {
    const colors = [BLUE, BLUE_MUTED, BLUE_PALE, BLUE_DEEP, BLUE_LIGHT];
    const count = 5 + Math.floor(Math.random() * 4); // 5-8 blobs
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.sqrt(vw * vh) / 1000;

    interface Blob {
      x: number;
      y: number;
      w: number;
      h: number;
      rx: number;
      ry: number;
      rotation: number;
      opacity: number;
      color: string;
      cx: number;
      cy: number;
      radius: number;
    }
    const placed: Blob[] = [];

    function overlaps(cx: number, cy: number, radius: number) {
      return placed.some((b) => {
        const dx = ((cx - b.cx) * vw) / 100;
        const dy = ((cy - b.cy) * vh) / 100;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < radius + b.radius;
      });
    }

    for (let i = 0; i < count; i++) {
      const w = (40 + Math.random() * 200) * scale;
      const h = (0.4 + Math.random() * 1.2) * w;
      const radius = Math.max(w, h) / 2;

      let x: number, y: number;
      let attempts = 0;
      do {
        x = Math.random() * 100;
        y = Math.random() * 100;
        attempts++;
      } while (overlaps(x, y, radius) && attempts < 50);

      placed.push({
        x,
        y,
        w,
        h,
        rx: Math.min(10 + Math.random() * 80, w * 0.25),
        ry: Math.min(10 + Math.random() * 80, h * 0.25),
        rotation: Math.random() * 360,
        opacity: 0.03 + Math.random() * 0.05,
        color: colors[Math.floor(Math.random() * colors.length)],
        cx: x,
        cy: y,
        radius,
      });
    }
    return placed;
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-0 min-h-screen overflow-hidden ${className}`}
      aria-hidden
    >
      {blobs.map((b, i) => (
        <svg
          key={i}
          className="absolute transition-all duration-1000"
          style={{
            top: `${b.y}%`,
            left: `${b.x}%`,
            width: b.w,
            height: b.h,
            opacity: b.opacity,
            transform: `rotate(${b.rotation}deg) translate(-50%, -50%)`,
          }}
          viewBox={`0 0 ${b.w} ${b.h}`}
        >
          <rect width={b.w} height={b.h} rx={b.rx} ry={b.ry} fill={b.color} />
        </svg>
      ))}
    </div>
  );
}

/** Mascot on card stack — for empty deck state */
export function CardStackIllustration({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="160"
      height="150"
      viewBox="0 0 160 150"
      fill="none"
      aria-hidden
    >
      <rect
        x="20"
        y="10"
        width="120"
        height="100"
        rx="30"
        fill={BLUE_GLOW}
        opacity="0.4"
      />
      <rect
        x="32"
        y="22"
        width="96"
        height="62"
        rx="12"
        fill={BLUE_LIGHT}
        transform="rotate(-4 80 53)"
      />
      <rect
        x="32"
        y="22"
        width="96"
        height="62"
        rx="12"
        fill="#8FBDD4"
        transform="rotate(2 80 53)"
      />
      <MascotFace x={32} y={22} w={96} />
      <rect x="63" y="104" width="34" height="28" rx="8" fill={BLUE_MUTED} />
      <line
        x1="80"
        y1="111"
        x2="80"
        y2="125"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="73"
        y1="118"
        x2="87"
        y2="118"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="145" cy="18" r="4" fill={BLUE_PALE} opacity="0.5" />
      <circle cx="15" cy="95" r="3" fill={BLUE_DEEP} opacity="0.5" />
    </svg>
  );
}

/** Mascot with sparkle rays — for Generate page */
export function SparkleIllustration({
  className = "",
}: {
  className?: string;
}) {
  const fw = 52;
  const fx = (100 - fw) / 2;
  const fy = 30;

  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden>
      <rect
        x={fx - 6}
        y={fy - 6}
        width={fw + 12}
        height={fw * (62 / 96) + 12}
        rx="16"
        fill={BLUE_GLOW}
        opacity="0.5"
      />
      <MascotFace x={fx} y={fy} w={fw} />
      <line
        x1="50"
        y1="16"
        x2="50"
        y2="10"
        stroke={BLUE_PALE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="76"
        y1="26"
        x2="81"
        y2="21"
        stroke={BLUE_PALE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="26"
        x2="19"
        y2="21"
        stroke={BLUE_PALE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="84"
        y1="48"
        x2="90"
        y2="48"
        stroke={BLUE_PALE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="48"
        x2="10"
        y2="48"
        stroke={BLUE_PALE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="42" y="72" width="16" height="6" rx="3" fill={BLUE_LIGHT} />
      <rect x="39" y="81" width="22" height="5" rx="2.5" fill={BLUE_LIGHT} />
      <circle cx="90" cy="68" r="3" fill={BLUE_MUTED} opacity="0.5" />
      <circle cx="8" cy="63" r="2.5" fill={BLUE_DEEP} opacity="0.4" />
    </svg>
  );
}

/** Happy mascot celebrating — for review completion */
export function CelebrationIllustration({
  className = "",
}: {
  className?: string;
}) {
  const fw = 96;
  const fx = (180 - fw) / 2;
  const fy = 42;

  return (
    <svg
      className={className}
      width="180"
      height="160"
      viewBox="0 0 180 160"
      fill="none"
      aria-hidden
    >
      <rect
        x={fx - 18}
        y={fy - 18}
        width={fw + 36}
        height={62 + 36}
        rx="30"
        fill={BLUE_PALE}
        opacity="0.2"
      />
      <rect
        x={fx - 8}
        y={fy - 8}
        width={fw + 16}
        height={62 + 16}
        rx="22"
        fill={BLUE_PALE}
        opacity="0.2"
      />
      <MascotFace x={fx} y={fy} w={fw} />
      <circle cx="22" cy="22" r="7" fill={BLUE_MUTED} opacity="0.6" />
      <circle cx="160" cy="18" r="5" fill={BLUE_PALE} opacity="0.5" />
      <circle cx="18" cy="135" r="5" fill={BLUE_DEEP} opacity="0.5" />
      <circle cx="162" cy="140" r="4" fill={BLUE_PALE} opacity="0.6" />
      <circle cx="38" cy="10" r="3" fill={BLUE_LIGHT} opacity="0.6" />
      <circle cx="148" cy="138" r="6" fill={BLUE_MUTED} opacity="0.4" />
      <rect
        x="15"
        y="80"
        width="10"
        height="10"
        rx="3"
        fill={BLUE_PALE}
        opacity="0.4"
        transform="rotate(15 20 85)"
      />
      <rect
        x="155"
        y="85"
        width="8"
        height="8"
        rx="2.5"
        fill={BLUE_DEEP}
        opacity="0.4"
        transform="rotate(-20 159 89)"
      />
    </svg>
  );
}
