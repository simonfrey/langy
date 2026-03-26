import type { ExerciseRecord } from "../../db/dexie";

export interface ExerciseComponentProps {
  exercise: ExerciseRecord;
  answer: string;
  setAnswer: (answer: string) => void;
  gradeResult: GradeResult | null;
  onSubmit: () => void;
}

export interface GradeResult {
  correct: boolean;
  feedback: string;
  corrected_answer?: string;
  state: "correct" | "close" | "wrong";
}
