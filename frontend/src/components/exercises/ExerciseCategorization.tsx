import { useState, useEffect } from 'react';
import type { ExerciseComponentProps } from './types';
import { InstructionText, HintBox } from './shared';

// Used for: grammar_categorization
export default function ExerciseCategorization({ exercise, setAnswer, gradeResult }: ExerciseComponentProps) {
  const categories = exercise.data?.categories || [];
  const words = exercise.data?.words || [];
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    setAssignments({});
    setUnassigned(words.map(w => w.word));
    setSelectedCategory(null);
  }, [exercise.id]);

  function handleWordClick(word: string) {
    if (!selectedCategory || gradeResult) return;
    const next = { ...assignments, [word]: selectedCategory };
    setAssignments(next);
    const remaining = unassigned.filter(w => w !== word);
    setUnassigned(remaining);

    if (remaining.length === 0) {
      // Check correctness
      const allCorrect = words.every(w => next[w.word] === w.category);
      setAnswer(allCorrect ? 'correct' : 'incorrect');
    }
  }

  function handleCategoryClick(cat: string) {
    setSelectedCategory(selectedCategory === cat ? null : cat);
  }

  return (
    <>
      <InstructionText text={exercise.instruction} />
      <HintBox hint={exercise.hint} />

      <div className="flex gap-2 mt-3 mb-3">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            disabled={!!gradeResult}
            className={`flex-1 px-3 py-2 rounded-xl border-2 font-bold transition text-center ${
              selectedCategory === cat
                ? 'bg-coral text-white border-coral'
                : 'bg-warm-50 text-warm-700 border-warm-200 hover:border-coral'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {selectedCategory && !gradeResult && (
        <p className="text-sm text-warm-500 mb-2 text-center">Tap a word to add it to "{selectedCategory}"</p>
      )}

      {unassigned.length > 0 && !gradeResult && (
        <div className="flex flex-wrap gap-2 mb-3">
          {unassigned.map(word => (
            <button
              key={word}
              onClick={() => handleWordClick(word)}
              disabled={!selectedCategory}
              className="px-3 py-2 rounded-lg border-2 bg-warm-50 text-warm-700 border-warm-200 hover:border-coral font-medium transition disabled:opacity-50"
            >
              {word}
            </button>
          ))}
        </div>
      )}

      {categories.map(cat => {
        const catWords = Object.entries(assignments).filter(([, c]) => c === cat).map(([w]) => w);
        if (catWords.length === 0) return null;
        return (
          <div key={cat} className="mb-2">
            <p className="text-xs font-bold text-warm-500 mb-1">{cat}</p>
            <div className="flex flex-wrap gap-1">
              {catWords.map(w => {
                const isCorrect = words.find(cw => cw.word === w)?.category === cat;
                return (
                  <span
                    key={w}
                    className={`px-2 py-1 rounded-lg text-sm font-medium ${
                      gradeResult
                        ? isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        : 'bg-warm-100 text-warm-700'
                    }`}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
