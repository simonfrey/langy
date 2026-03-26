import type { ExerciseComponentProps } from "./types";
import {
  InstructionText,
  SourceSentenceBox,
  HintBox,
  RenderPromptWithBlanks,
} from "./shared";

// Used for: vocab_fill_blank, grammar_fill_conjugation, grammar_fill_preposition, integrative_cloze_passage
// Also: cloze_with_translation, context_typing, conjugation_cloze, adjective_agreement, paragraph_cloze (legacy)
export default function ExerciseFillBlank({
  exercise,
  answer,
  setAnswer,
  gradeResult,
  onSubmit,
}: ExerciseComponentProps) {
  return (
    <>
      <InstructionText text={exercise.instruction} />
      <SourceSentenceBox text={exercise.source_sentence} />
      <RenderPromptWithBlanks
        prompt={exercise.prompt}
        correctAnswer={exercise.correct_answer}
        answer={answer}
        setAnswer={setAnswer}
        gradeResult={gradeResult}
        onSubmit={onSubmit}
      />
      <HintBox
        hint={exercise.hint}
        hideIfSourceSentence
        sourceSentence={exercise.source_sentence}
      />
    </>
  );
}
