import { useState, useEffect } from "react";
import type { ExerciseComponentProps } from "./types";
import { InstructionText, PromptBox } from "./shared";

// Used for: integrative_reading
export default function ExerciseReadingComprehension({
  exercise,
  setAnswer,
  gradeResult,
}: ExerciseComponentProps) {
  const questions = exercise.data?.questions || [];
  const [answers, setAnswers] = useState<string[]>([]);

  useEffect(() => {
    setAnswers(new Array(questions.length).fill(""));
  }, [exercise.id]);

  function handleSelect(qIdx: number, option: string) {
    if (gradeResult) return;
    const next = [...answers];
    next[qIdx] = option;
    setAnswers(next);

    // Update parent answer
    const allAnswered = next.every((a) => a !== "");
    if (allAnswered) {
      const allCorrect = questions.every((q, i) => next[i] === q.answer);
      setAnswer(allCorrect ? "correct" : "incorrect");
    }
  }

  return (
    <>
      <InstructionText text={exercise.instruction} />
      {exercise.prompt && <PromptBox text={exercise.prompt} />}

      <div className="space-y-4 mt-3">
        {questions.map((q, qIdx) => (
          <div key={qIdx}>
            <p className="text-sm font-bold text-warm-700 mb-2">{q.question}</p>
            <div className="space-y-1">
              {q.options.map((opt, oIdx) => {
                const isSelected = answers[qIdx] === opt;
                const showResult = gradeResult && isSelected;
                const isCorrectOption = opt === q.answer;
                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelect(qIdx, opt)}
                    disabled={!!gradeResult}
                    className={`w-full text-left px-3 py-2 rounded-lg border-2 text-sm font-medium transition ${
                      showResult
                        ? isCorrectOption
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "bg-red-50 border-red-300 text-red-700"
                        : gradeResult && isCorrectOption
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : isSelected
                            ? "bg-coral/10 border-coral text-coral"
                            : "bg-warm-50 border-warm-200 text-warm-700 hover:border-coral"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
