import { useState, useEffect } from "react";
import type { ExerciseComponentProps } from "./types";
import { InstructionText, HintBox } from "./shared";

// Used for: vocab_matching_pairs, grammar_matching
export default function ExerciseMatchingPairs({
  exercise,
  setAnswer,
  gradeResult,
}: ExerciseComponentProps) {
  const pairs = exercise.data?.pairs || [];
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setMatched(new Set());
    setWrongPair(null);
  }, [exercise.id]);

  // Determine left/right labels
  const isGrammar = exercise.type === "grammar_matching";
  const leftItems = pairs.map((p) =>
    isGrammar ? p.left || "" : p.native || "",
  );
  const rightItems = pairs.map((p) =>
    isGrammar ? p.right || "" : p.target || "",
  );

  // Shuffle right side, reset when exercise changes
  const [shuffledRight, setShuffledRight] = useState<
    { item: string; origIdx: number }[]
  >([]);

  useEffect(() => {
    const arr = rightItems.map((item, i) => ({ item, origIdx: i }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledRight(arr);
  }, [exercise.id]);

  function handleTap(side: "left" | "right", _value: string, idx: number) {
    if (matched.has(`${side === "left" ? "L" : "R"}${idx}`)) return;

    const key = `${side}:${idx}`;
    if (!selected) {
      setSelected(key);
      setWrongPair(null);
      return;
    }

    const [prevSide, prevIdxStr] = selected.split(":");
    const prevIdx = parseInt(prevIdxStr);

    if (prevSide === side) {
      setSelected(key);
      return;
    }

    // Check match
    const leftIdx = side === "left" ? idx : prevIdx;
    const rightIdx = side === "right" ? idx : prevIdx;
    const rightOrigIdx = shuffledRight[rightIdx].origIdx;

    if (leftIdx === rightOrigIdx) {
      const next = new Set(matched);
      next.add(`L${leftIdx}`);
      next.add(`R${rightIdx}`);
      setMatched(next);
      setSelected(null);

      // Check if all matched
      if (next.size === pairs.length * 2) {
        setAnswer("matched");
      }
    } else {
      setWrongPair(key);
      setSelected(null);
      setTimeout(() => setWrongPair(null), 600);
    }
  }

  const allMatched = matched.size === pairs.length * 2;

  return (
    <>
      <InstructionText text={exercise.instruction} />
      <HintBox hint={exercise.hint} />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="space-y-2">
          {leftItems.map((item, i) => {
            const isMatched = matched.has(`L${i}`);
            const isSelected = selected === `left:${i}`;
            const isWrong = wrongPair === `left:${i}`;
            return (
              <button
                key={i}
                onClick={() =>
                  !isMatched && !gradeResult && handleTap("left", item, i)
                }
                disabled={isMatched || !!gradeResult}
                className={`w-full px-3 py-3 rounded-xl border-2 font-medium transition text-center ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 opacity-60"
                    : isWrong
                      ? "bg-red-50 border-red-300 text-red-700"
                      : isSelected
                        ? "bg-coral/10 border-coral text-coral"
                        : "bg-warm-50 border-warm-200 text-warm-700 hover:border-coral"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {shuffledRight.map(({ item }, i) => {
            const isMatched = matched.has(`R${i}`);
            const isSelected = selected === `right:${i}`;
            const isWrong = wrongPair === `right:${i}`;
            return (
              <button
                key={i}
                onClick={() =>
                  !isMatched && !gradeResult && handleTap("right", item, i)
                }
                disabled={isMatched || !!gradeResult}
                className={`w-full px-3 py-3 rounded-xl border-2 font-medium transition text-center ${
                  isMatched
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 opacity-60"
                    : isWrong
                      ? "bg-red-50 border-red-300 text-red-700"
                      : isSelected
                        ? "bg-coral/10 border-coral text-coral"
                        : "bg-warm-50 border-warm-200 text-warm-700 hover:border-coral"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
      {allMatched && !gradeResult && (
        <p className="text-center text-emerald-600 font-bold mt-3">
          All pairs matched!
        </p>
      )}
    </>
  );
}
