import type { ExerciseComponentProps } from "./types";
import {
  InstructionText,
  SourceSentenceBox,
  HintBox,
  PromptBox,
} from "./shared";

// Used for: grammar_error_correction, grammar_transformation, grammar_conjugation_drill,
// grammar_fill_article, grammar_fill_preposition, tense_shifting, error_correction, morphing, article_check, full_translation
export default function ExerciseTypedAnswer({
  exercise,
  answer,
  setAnswer,
  gradeResult,
  onSubmit,
}: ExerciseComponentProps) {
  const variant = exercise.type.includes("error")
    ? ("error" as const)
    : ("default" as const);

  return (
    <>
      <InstructionText text={exercise.instruction} />
      <SourceSentenceBox text={exercise.source_sentence} />
      {exercise.prompt && (
        <PromptBox text={exercise.prompt} variant={variant} />
      )}
      <HintBox
        hint={exercise.hint}
        hideIfSourceSentence
        sourceSentence={exercise.source_sentence}
      />
      {!gradeResult && (
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && answer.trim()) onSubmit();
          }}
          placeholder="Type your answer..."
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full px-4 py-3 border-2 border-warm-200 rounded-xl text-warm-900 focus:border-coral focus:outline-none transition text-lg mt-3"
        />
      )}
    </>
  );
}
