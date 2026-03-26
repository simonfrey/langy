import { useMemo } from "react";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getHandDrawnStyle(): React.CSSProperties {
  return {
    borderRadius: `${rand(18, 28)}px ${rand(12, 22)}px ${rand(18, 28)}px ${rand(12, 22)}px / ${rand(12, 22)}px ${rand(18, 28)}px ${rand(12, 22)}px ${rand(18, 28)}px`,
  };
}

export function useHandDrawn(): React.CSSProperties {
  return useMemo(() => getHandDrawnStyle(), []);
}
