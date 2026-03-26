import type { ExerciseComponentProps } from "./types";
import {
  InstructionText,
  SourceSentenceBox,
  HintBox,
  RenderPromptWithBlanks,
} from "./shared";

// Used for: grammar_multiple_choice, vocab_picture_word
export default function ExerciseMultipleChoice({
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
      {exercise.prompt && (
        <RenderPromptWithBlanks
          prompt={exercise.prompt}
          correctAnswer={exercise.correct_answer}
          answer={answer}
          setAnswer={setAnswer}
          gradeResult={gradeResult}
          onSubmit={onSubmit}
        />
      )}
      {exercise.data?.image_url && (
        <div className="flex justify-center my-3">
          <img
            src={exercise.data.image_url}
            alt="Exercise"
            className="max-h-48 rounded-xl"
          />
        </div>
      )}
      <HintBox
        hint={exercise.hint}
        hideIfSourceSentence
        sourceSentence={exercise.source_sentence}
      />
      {!gradeResult && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {(exercise.options || []).map((option, i) => (
            <button
              key={i}
              onClick={() => {
                setAnswer(option);
                requestAnimationFrame(() => onSubmit());
              }}
              className={`px-4 py-3 rounded-xl border-2 font-medium transition text-left ${
                answer === option
                  ? "bg-coral text-white border-coral"
                  : "bg-warm-50 text-warm-700 border-warm-200 hover:border-coral"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
