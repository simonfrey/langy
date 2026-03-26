import { useState } from "react";

const BLUE = "#4A90B8";
const BLUE_LIGHT = "#B8D8E8";
const BLUE_MUTED = "#6BA8C9";
const BLUE_PALE = "#A3CCDE";
const BLUE_DEEP = "#3A7CA5";

const COLORS = [BLUE, BLUE_MUTED, BLUE_PALE, BLUE_DEEP, BLUE_LIGHT];

/** Large mascot for Login page */
export function Mascot({
  className = "",
  size = 140,
}: {
  className?: string;
  size?: number;
}) {
  const w = size * 0.69;
  return (
    <div className={className} style={{ width: size, height: size }}>
      <img
        src="/mascot.svg"
        alt="Langy mascot"
        style={{
          width: w,
          margin: "auto",
          display: "block",
          filter: "drop-shadow(0 8px 24px rgba(74,144,184,.25))",
        }}
      />
    </div>
  );
}

interface Blob {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: string;
  rotation: number;
  opacity: number;
  color: string;
  cx: number;
  cy: number;
  radius: number;
}

function generateBlobs(): Blob[] {
  const count = 5 + Math.floor(Math.random() * 4);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.sqrt(vw * vh) / 1000;

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
    // Use flashcard aspect ratio (96:62 ≈ 1.55:1)
    const h = w * (62 / 96);
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
      rx: "12%",
      rotation: Math.random() * 360,
      opacity: 0.03 + Math.random() * 0.05,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      cx: x,
      cy: y,
      radius,
    });
  }
  return placed;
}

export function BlobBackground({ className = "" }: { className?: string }) {
  const [blobs] = useState(generateBlobs);

  return (
    <div
      className={`pointer-events-none fixed inset-0 min-h-screen overflow-hidden ${className}`}
      aria-hidden
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: `${b.y}%`,
            left: `${b.x}%`,
            width: b.w,
            height: b.h,
            opacity: b.opacity,
            transform: `rotate(${b.rotation}deg) translate(-50%, -50%)`,
            backgroundColor: b.color,
            borderRadius: b.rx,
            aspectRatio: "96 / 62",
          }}
        />
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
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative">
        <div
          className="absolute -rotate-[4deg] bg-[#B8D8E8] rounded-[12%]"
          style={{ width: 96, aspectRatio: "96/62", top: 0, left: 0 }}
        />
        <div
          className="absolute rotate-[2deg] bg-[#8FBDD4] rounded-[12%]"
          style={{ width: 96, aspectRatio: "96/62", top: 0, left: 0 }}
        />
        <img
          src="/mascot.svg"
          alt=""
          style={{ width: 96, position: "relative" }}
        />
      </div>
    </div>
  );
}

/** Mascot with sparkle rays — for Generate page */
export function SparkleIllustration({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/mascot.svg"
        alt=""
        style={{
          width: 80,
          filter: "drop-shadow(0 8px 24px rgba(74,144,184,.2))",
        }}
      />
    </div>
  );
}

/** Happy mascot celebrating — for review completion */
export function CelebrationIllustration({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src="/mascot.svg"
        alt=""
        style={{
          width: 120,
          filter: "drop-shadow(0 12px 32px rgba(74,144,184,.25))",
        }}
      />
    </div>
  );
}
