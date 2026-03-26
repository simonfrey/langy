interface SM2Input {
  grade: number;
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

interface SM2Output {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  nextReview: Date;
}

export function sm2(input: SM2Input): SM2Output {
  const grade = Math.max(0, Math.min(5, input.grade));

  let newReps: number;
  let newInterval: number;
  let newEF = input.easeFactor;

  if (grade < 3) {
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = input.repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(input.intervalDays * newEF);
      if (newInterval < 1) newInterval = 1;
    }
  }

  newEF = newEF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (newEF < 1.3) newEF = 1.3;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    repetitions: newReps,
    easeFactor: newEF,
    intervalDays: newInterval,
    nextReview,
  };
}
