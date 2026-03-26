import type { GradeResult } from "./types";
import { normalizeBlankChars } from "./sharedUtils";

export function RenderPromptWithBlanks({
  prompt,
  correctAnswer,
  answer,
  setAnswer,
  gradeResult,
  onSubmit,
}: {
  prompt: string;
  correctAnswer: string;
  answer: string;
  setAnswer: (a: string) => void;
  gradeResult: GradeResult | null;
  onSubmit: () => void;
}) {
  const normalized = normalizeBlankChars(prompt).replace(/_[\s_]*_/g, "___");
  const parts = normalized.split("___");

  if (parts.length <= 1) {
    return (
      <p className="text-lg text-warm-900 font-medium whitespace-pre-wrap">
        {normalized}
      </p>
    );
  }

  // Multiple blanks: split answer by some delimiter or handle single input for single blank
  const blankCount = parts.length - 1;
  const answers = blankCount === 1 ? [answer] : answer.split("|");

  const setBlankAnswer = (idx: number, val: string) => {
    if (blankCount === 1) {
      setAnswer(val);
    } else {
      const parts = answer.split("|");
      while (parts.length < blankCount) parts.push("");
      parts[idx] = val;
      setAnswer(parts.join("|"));
    }
  };

  return (
    <p className="text-lg text-warm-900 font-medium whitespace-pre-wrap leading-10">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 &&
            (gradeResult ? (
              <span
                className={`inline-block border-b-2 px-1 font-bold ${gradeResult.state === "correct" ? "border-emerald-500 text-emerald-700" : gradeResult.state === "close" ? "border-amber-500 text-amber-700" : "border-red-500 text-red-700"}`}
              >
                {answers[i] || "_"}
              </span>
            ) : (
              <input
                type="text"
                value={answers[i] || ""}
                onChange={(e) => setBlankAnswer(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSubmit();
                }}
                autoFocus={i === 0}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                size={Math.max(correctAnswer.length / blankCount, 4)}
                className="inline-block border-b-2 border-warm-400 focus:border-coral bg-transparent text-center text-lg text-warm-900 font-medium outline-none px-1 mx-1"
                style={{
                  width: `${Math.max(correctAnswer.length / blankCount, 4) * 0.65}em`,
                }}
              />
            ))}
        </span>
      ))}
    </p>
  );
}

export function SourceSentenceBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mb-3">
      <p className="text-sm text-sky-700 font-medium">{text}</p>
    </div>
  );
}

export function HintBox({
  hint,
  hideIfSourceSentence,
  sourceSentence,
}: {
  hint?: string;
  hideIfSourceSentence?: boolean;
  sourceSentence?: string;
}) {
  if (!hint || (hideIfSourceSentence && sourceSentence)) return null;
  return (
    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
      {hint}
    </p>
  );
}

export function InstructionText({ text }: { text: string }) {
  return <p className="text-sm text-warm-500 font-semibold mb-2">{text}</p>;
}

export function PromptBox({
  text,
  variant,
}: {
  text: string;
  variant?: "error" | "default";
}) {
  const colors =
    variant === "error"
      ? "bg-red-50 border-red-200"
      : "bg-warm-50 border-warm-200";
  return (
    <div className={`${colors} border-2 rounded-xl p-4 mb-3`}>
      <p className="text-lg text-warm-900 font-medium">{text}</p>
    </div>
  );
}
