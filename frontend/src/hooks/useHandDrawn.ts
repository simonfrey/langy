import { useMemo } from "react";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getHandDrawnStyle(): React.CSSProperties {
  return {
    borderRadius: `${rand(180, 255)}px ${rand(10, 25)}px ${rand(180, 240)}px ${rand(10, 25)}px / ${rand(10, 25)}px ${rand(180, 240)}px ${rand(10, 25)}px ${rand(180, 255)}px`,
  };
}

export function useHandDrawn(): React.CSSProperties {
  return useMemo(() => getHandDrawnStyle(), []);
}
