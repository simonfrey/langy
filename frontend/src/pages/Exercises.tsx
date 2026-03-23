import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/dexie';
import type { ExerciseRecord } from '../db/dexie';
import { api } from '../lib/api';
import { selectExerciseCards } from '../lib/maturity';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';
import { getHandDrawnStyle } from '../hooks/useHandDrawn';

const BATCH_SIZE = 10;
const PREFETCH_THRESHOLD = 3;

interface GradeResult {
  correct: boolean;
  feedback: string;
  corrected_answer?: string;
}

export default function Exercises() {
  const navigate = useNavigate();
  const isOffline = useOffline();
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [answer, setAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrambleOrder, setScrambleOrder] = useState<string[]>([]);
  const prefetchingRef = useRef(false);
  const [deckLangs, setDeckLangs] = useState<{ source: string; target: string } | null>(null);

  const handDrawnStyle = getHandDrawnStyle();

  const generateBatch = useCallback(async (sid: string) => {
    const allCards = await db.cards.toArray();
    if (allCards.length === 0) {
      setError('No cards available. Add some vocabulary first!');
      setLoading(false);
      return [];
    }

    const decks = await db.decks.toArray();
    const deckMap = new Map(decks.map(d => [d.id, d]));

    // Get languages from first card's deck
    const firstDeck = deckMap.get(allCards[0].deck_id);
    if (firstDeck) {
      setDeckLangs({ source: firstDeck.source_lang, target: firstDeck.target_lang });
    }

    const selected = selectExerciseCards(allCards, BATCH_SIZE);
    if (selected.length === 0) {
      setError('No cards available for exercises.');
      setLoading(false);
      return [];
    }

    const deck = deckMap.get(selected[0].card.deck_id);
    const sourceLang = deck?.source_lang || 'en';
    const targetLang = deck?.target_lang || 'es';

    const cardsPayload = selected.map(s => ({
      id: s.card.id,
      front: s.card.front,
      back: s.card.back,
      level: s.level,
    }));

    try {
      const result = await api<ExerciseRecord[]>('/exercises/generate', {
        method: 'POST',
        body: JSON.stringify({
          cards: cardsPayload,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      });

      const records: ExerciseRecord[] = result.map((ex, i) => ({
        ...ex,
        id: `${sid}-${Date.now()}-${i}`,
        session_id: sid,
        completed: false,
      }));

      await db.exercises.bulkPut(records);
      return records;
    } catch (err) {
      console.error('Failed to generate exercises:', err);
      throw err;
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Clear old exercises
        await db.exercises.clear();

        setGenerating(true);
        const batch = await generateBatch(sessionId);
        if (cancelled) return;
        setExercises(batch);
      } catch {
        setError('Failed to generate exercises. Check your connection and try again.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setGenerating(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [generateBatch, sessionId]);

  // Prefetch next batch
  useEffect(() => {
    const remaining = exercises.length - index;
    if (remaining <= PREFETCH_THRESHOLD && !prefetchingRef.current && !done && !isOffline && exercises.length > 0) {
      prefetchingRef.current = true;
      generateBatch(sessionId)
        .then(newBatch => {
          if (newBatch.length > 0) {
            setExercises(prev => [...prev, ...newBatch]);
          }
        })
        .catch(() => {})
        .finally(() => { prefetchingRef.current = false; });
    }
  }, [index, exercises.length, done, isOffline, generateBatch, sessionId]);

  const currentExercise = exercises[index];

  async function handleSubmit() {
    if (!currentExercise || !answer.trim()) return;

    setGrading(true);
    try {
      if (isOffline) {
        // Offline fallback: simple string comparison
        const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        const isCorrect = normalize(answer) === normalize(currentExercise.correct_answer);
        setGradeResult({
          correct: isCorrect,
          feedback: isCorrect ? 'Correct!' : `Expected: ${currentExercise.correct_answer}`,
          corrected_answer: isCorrect ? undefined : currentExercise.correct_answer,
        });
        setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
      } else {
        const result = await api<GradeResult>('/exercises/grade', {
          method: 'POST',
          body: JSON.stringify({
            exercise_type: currentExercise.type,
            prompt: currentExercise.prompt,
            correct_answer: currentExercise.correct_answer,
            user_answer: answer,
            source_lang: deckLangs?.source || 'en',
            target_lang: deckLangs?.target || 'es',
          }),
        });
        setGradeResult(result);
        setScore(s => ({ correct: s.correct + (result.correct ? 1 : 0), total: s.total + 1 }));
      }

      // Mark completed in Dexie
      await db.exercises.update(currentExercise.id, {
        completed: true,
        user_answer: answer,
        correct: gradeResult?.correct,
      });
    } catch {
      // Fallback to simple grading
      const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const isCorrect = normalize(answer) === normalize(currentExercise.correct_answer);
      setGradeResult({
        correct: isCorrect,
        feedback: isCorrect ? 'Correct!' : `Expected: ${currentExercise.correct_answer}`,
        corrected_answer: isCorrect ? undefined : currentExercise.correct_answer,
      });
      setScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    } finally {
      setGrading(false);
    }
  }

  function handleNext() {
    setGradeResult(null);
    setAnswer('');
    setScrambleOrder([]);
    if (index + 1 >= exercises.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
    }
  }

  // Initialize scramble options when exercise changes
  useEffect(() => {
    if (currentExercise?.type === 'word_order_scramble' && currentExercise.options?.length) {
      setScrambleOrder([]);
    }
  }, [currentExercise]);

  function handleScrambleWordClick(word: string) {
    if (scrambleOrder.includes(word)) {
      setScrambleOrder(prev => prev.filter(w => w !== word));
      setAnswer(prev => {
        const words = prev.split(' ').filter(w => w !== word);
        return words.join(' ');
      });
    } else {
      setScrambleOrder(prev => [...prev, word]);
      setAnswer(prev => (prev ? prev + ' ' + word : word));
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        <p className="text-warm-500 text-sm">Generating exercises...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 pb-24">
        <h1 className="text-2xl font-extrabold text-warm-900 mb-4">Practice</h1>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
        <button
          onClick={() => navigate('/decks')}
          className="mt-4 px-6 py-3 bg-coral hover:bg-coral-hover text-white font-bold rounded-xl transition"
        >
          Go to Decks
        </button>
      </div>
    );
  }

  if (done) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center">
        <div className="text-6xl mb-4">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <h2 className="text-2xl font-extrabold text-warm-900 mb-2">Session Complete!</h2>
        <p className="text-warm-500 mb-2">
          {score.correct}/{score.total} correct ({pct}%)
        </p>
        <p className="text-warm-400 text-sm mb-8">
          {pct >= 80 ? 'Excellent work!' : pct >= 50 ? 'Keep practicing!' : 'Review your vocabulary and try again.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-coral hover:bg-coral-hover text-white font-bold rounded-xl transition"
          >
            New Session
          </button>
          <button
            onClick={() => navigate('/review')}
            className="px-6 py-3 bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold rounded-xl border-2 border-warm-200 transition"
          >
            Review Cards
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <div className="p-4 pb-24">
        <h1 className="text-2xl font-extrabold text-warm-900 mb-4">Practice</h1>
        <p className="text-warm-500">No exercises available.</p>
      </div>
    );
  }

  const total = exercises.length;
  const levelLabel = currentExercise.level === 1 ? 'Beginner' : currentExercise.level === 2 ? 'Intermediate' : 'Advanced';
  const levelColor = currentExercise.level === 1 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : currentExercise.level === 2 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="p-4 pb-24">
      {isOffline && <div className="mb-4"><OfflineBanner message="You're offline. Exercises use approximate grading." /></div>}

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-extrabold text-warm-900">Practice</h1>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${levelColor}`}>{levelLabel}</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 bg-warm-200 rounded-full">
          <div
            className="min-w-fit p-1 bg-coral rounded-full transition-all duration-300 text-right text-xs text-cream font-bold"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          >
            {index + 1}/{total}
          </div>
        </div>
        <span className="text-xs text-warm-400 font-semibold whitespace-nowrap">
          {score.correct}/{score.total} correct
        </span>
      </div>

      {/* Exercise card */}
      <div className="bg-white hand-drawn shadow-lg p-6 mb-4" style={handDrawnStyle}>
        <p className="text-sm text-warm-500 font-semibold mb-3">{currentExercise.instruction}</p>
        <p className="text-lg text-warm-900 font-medium whitespace-pre-wrap">{currentExercise.prompt}</p>
      </div>

      {/* Input area */}
      {!gradeResult && (
        <div className="space-y-3">
          {currentExercise.type === 'word_order_scramble' && currentExercise.options?.length ? (
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {currentExercise.options.map((word, i) => (
                  <button
                    key={i}
                    onClick={() => handleScrambleWordClick(word)}
                    className={`px-3 py-2 rounded-lg border-2 font-medium transition ${
                      scrambleOrder.includes(word)
                        ? 'bg-coral text-white border-coral'
                        : 'bg-warm-50 text-warm-700 border-warm-200 hover:border-coral'
                    }`}
                  >
                    {word}
                  </button>
                ))}
              </div>
              {answer && (
                <div className="bg-warm-50 border-2 border-warm-200 rounded-xl p-3 text-warm-700 font-medium">
                  {answer}
                </div>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) handleSubmit(); }}
              placeholder="Type your answer..."
              autoFocus
              className="w-full px-4 py-3 border-2 border-warm-200 rounded-xl text-warm-900 focus:border-coral focus:outline-none transition text-lg"
            />
          )}
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || grading}
            className="w-full py-3 bg-coral hover:bg-coral-hover disabled:opacity-50 text-white font-bold rounded-xl transition"
          >
            {grading ? 'Checking...' : 'Check Answer'}
          </button>
        </div>
      )}

      {/* Grade result */}
      {gradeResult && (
        <div className="space-y-3">
          <div className={`p-4 rounded-xl border-2 ${gradeResult.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{gradeResult.correct ? '✓' : '✗'}</span>
              <span className={`font-bold ${gradeResult.correct ? 'text-emerald-700' : 'text-red-700'}`}>
                {gradeResult.correct ? 'Correct!' : 'Not quite'}
              </span>
            </div>
            <p className="text-warm-700 text-sm">{gradeResult.feedback}</p>
            {gradeResult.corrected_answer && (
              <p className="text-warm-900 font-medium mt-2">
                Correct answer: <span className="text-emerald-700">{gradeResult.corrected_answer}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleNext}
            className="w-full py-3 bg-coral hover:bg-coral-hover text-white font-bold rounded-xl transition"
          >
            {index + 1 >= exercises.length ? 'Finish' : 'Next Exercise'}
          </button>
        </div>
      )}

      {generating && (
        <p className="text-center text-warm-400 text-xs mt-4">Generating more exercises...</p>
      )}
    </div>
  );
}
