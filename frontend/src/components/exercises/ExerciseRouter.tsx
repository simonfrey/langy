import type { ExerciseComponentProps } from "./types";
import ExerciseFillBlank from "./ExerciseFillBlank";
import ExerciseTypedAnswer from "./ExerciseTypedAnswer";
import ExerciseWordBank from "./ExerciseWordBank";
import ExerciseMultipleChoice from "./ExerciseMultipleChoice";
import ExerciseMatchingPairs from "./ExerciseMatchingPairs";
import ExerciseCategorization from "./ExerciseCategorization";
import ExerciseReadingComprehension from "./ExerciseReadingComprehension";

const EXERCISE_MAP: Record<
  string,
  React.ComponentType<ExerciseComponentProps>
> = {
  // Vocabulary - fill blank
  vocab_fill_blank: ExerciseFillBlank,
  cloze_with_translation: ExerciseFillBlank,

  // Vocabulary - word bank
  vocab_word_bank: ExerciseWordBank,
  word_order_scramble: ExerciseWordBank,

  // Vocabulary - matching
  vocab_matching_pairs: ExerciseMatchingPairs,
  vocab_picture_word: ExerciseMultipleChoice,

  // Grammar - fill blank
  grammar_fill_conjugation: ExerciseFillBlank,
  conjugation_cloze: ExerciseFillBlank,
  adjective_agreement: ExerciseFillBlank,
  context_typing: ExerciseFillBlank,
  paragraph_cloze: ExerciseFillBlank,

  // Grammar - fill blank (has ___ in prompt)
  grammar_fill_article: ExerciseFillBlank,
  grammar_fill_preposition: ExerciseFillBlank,
  grammar_conjugation_drill: ExerciseTypedAnswer,
  grammar_error_correction: ExerciseTypedAnswer,
  grammar_transformation: ExerciseTypedAnswer,
  error_correction: ExerciseTypedAnswer,
  tense_shifting: ExerciseTypedAnswer,
  article_check: ExerciseTypedAnswer,
  morphing: ExerciseTypedAnswer,
  full_translation: ExerciseTypedAnswer,

  // Grammar - word bank
  grammar_reorder: ExerciseWordBank,

  // Grammar - multiple choice
  grammar_multiple_choice: ExerciseMultipleChoice,

  // Grammar - matching/categorization
  grammar_categorization: ExerciseCategorization,
  grammar_matching: ExerciseMatchingPairs,

  // Integrative
  integrative_dialogue: ExerciseFillBlank,
  integrative_reading: ExerciseReadingComprehension,
  integrative_cloze_passage: ExerciseFillBlank,
};

export default function ExerciseRouter(props: ExerciseComponentProps) {
  const Component = EXERCISE_MAP[props.exercise.type] || ExerciseFillBlank;
  return <Component {...props} />;
}
