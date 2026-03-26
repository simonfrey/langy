import { useState } from "react";
import type { ExerciseComponentProps } from "./types";
import { InstructionText, SourceSentenceBox, HintBox } from "./shared";

// Used for: vocab_word_bank, grammar_reorder, word_order_scramble
export default function ExerciseWordBank({
  exercise,
  answer,
  setAnswer,
  gradeResult,
}: ExerciseComponentProps) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);

  function handleWordClick(word: string) {
    if (selectedWords.includes(word)) {
      const next = selectedWords.filter((w) => w !== word);
      setSelectedWords(next);
      setAnswer(next.join(" "));
    } else {
      const next = [...selectedWords, word];
      setSelectedWords(next);
      setAnswer(next.join(" "));
    }
  }

  return (
    <>
      <InstructionText text={exercise.instruction} />
      <SourceSentenceBox text={exercise.source_sentence} />
      <HintBox
        hint={exercise.hint}
        hideIfSourceSentence
        sourceSentence={exercise.source_sentence}
      />
      <div>
        {!gradeResult && (
          <div className="flex flex-wrap gap-2 mb-3 mt-3">
            {(exercise.options || []).map((word, i) => (
              <button
                key={i}
                onClick={() => handleWordClick(word)}
                className={`px-3 py-2 rounded-lg border-2 font-medium transition ${
                  selectedWords.includes(word)
                    ? "bg-coral text-white border-coral"
                    : "bg-warm-50 text-warm-700 border-warm-200 hover:border-coral"
                }`}
              >
                {word}
              </button>
            ))}
          </div>
        )}
        {answer && (
          <div className="bg-warm-50 border-2 border-warm-200 rounded-xl p-3 text-warm-700 font-medium">
            {answer}
          </div>
        )}
      </div>
    </>
  );
}
