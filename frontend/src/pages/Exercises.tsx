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

const TYPES_WITHOUT_BLANKS = new Set([
  'full_translation', 'error_correction', 'tense_shifting', 'article_check', 'morphing',
]);

function exerciseNeedsBlanks(type: string): boolean {
  return !TYPES_WITHOUT_BLANKS.has(type);
}

function normalizeBlankChars(s: string): string {
  // Normalize Unicode dash/line characters to underscore
  return s.replace(/[—–―＿]/g, '_');
}

function promptHasBlank(prompt: string): boolean {
  const normalized = normalizeBlankChars(prompt).replace(/_[\s_]*_/g, '_');
  return normalized.includes('_');
}

interface GradeResult {
  correct: boolean;
  feedback: string;
  corrected_answer?: string;
  state: 'correct' | 'close' | 'wrong';
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

export default function Exercises() {
  const navigate = useNavigate();
  const isOffline = useOffline();
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [answer, setAnswer] = useState('');
  const grading = false; // no async grading needed
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
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

    // Send all known words so the LLM builds sentences from familiar vocabulary
    const knownWords = allCards.map(c => ({ front: c.front, back: c.back }));

    try {
      const result = await api<ExerciseRecord[]>('/exercises/generate', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sid,
          cards: cardsPayload,
          known_words: knownWords,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      });

      const records: ExerciseRecord[] = result.map((ex) => ({
        ...ex,
        session_id: sid,
        completed: false,
      }));

      const valid = records.filter(ex => {
        if (exerciseNeedsBlanks(ex.type) && !promptHasBlank(ex.prompt)) {
          console.warn('Skipping exercise with missing blank:', ex.type, ex.prompt);
          return false;
        }
        return true;
      });

      await db.exercises.bulkPut(valid);
      return valid;
    } catch (err) {
      console.error('Failed to generate exercises:', err);
      throw err;
    }
  }, []);

  // Initial load: show cached exercises instantly, refresh from backend in background
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Load uncompleted exercises from local IndexedDB first (instant)
        const cached = await db.exercises.filter(e => !e.completed).toArray();
        if (cached.length > 0 && !cancelled) {
          setExercises(cached);
          const decks = await db.decks.toArray();
          if (decks.length > 0) {
            setDeckLangs({ source: decks[0].source_lang, target: decks[0].target_lang });
          }
          setLoading(false);
        }

        // 2. Fetch from backend in background and merge
        if (!isOffline) {
          try {
            const due = await api<ExerciseRecord[]>('/exercises/due', { method: 'GET' });
            if (due && due.length > 0 && !cancelled) {
              const records: ExerciseRecord[] = due.map((ex) => ({
                ...ex,
                session_id: sessionId,
                completed: false,
              }));
              await db.exercises.bulkPut(records);
              // Merge: combine cached and backend, deduplicate by id
              const all = await db.exercises.filter(e => !e.completed).toArray();
              if (!cancelled) {
                setExercises(all);
                const decks = await db.decks.toArray();
                if (decks.length > 0) {
                  setDeckLangs({ source: decks[0].source_lang, target: decks[0].target_lang });
                }
                setLoading(false);
                return;
              }
            }
          } catch {
            // If we already have cached exercises, that's fine
            if (cached.length > 0) {
              if (!cancelled) setLoading(false);
              return;
            }
          }
        }

        // 3. Only generate if both local and backend had nothing
        if (cached.length === 0) {
          setGenerating(true);
          const batch = await generateBatch(sessionId);
          if (cancelled) return;
          setExercises(batch);
        }
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
  }, [generateBatch, sessionId, isOffline]);

  // Prefetch next batch
  useEffect(() => {
    const remaining = exercises.length - index;
    if (remaining <= PREFETCH_THRESHOLD && !prefetchingRef.current && !isOffline && exercises.length > 0) {
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
  }, [index, exercises.length, isOffline, generateBatch, sessionId]);

  const currentExercise = exercises[index];

  async function handleSubmit() {
    if (!currentExercise || !answer.trim()) return;

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const stripPunctuation = (s: string) => s.replace(/[^\w\s\u00C0-\u024F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

    const isScramble = currentExercise.type === 'word_order_scramble';
    const normAnswer = isScramble ? stripPunctuation(answer) : normalize(answer);
    const normCorrect = isScramble ? stripPunctuation(currentExercise.correct_answer) : normalize(currentExercise.correct_answer);

    let state: 'correct' | 'close' | 'wrong';
    if (normAnswer === normCorrect) {
      state = 'correct';
    } else {
      const dist = levenshtein(normAnswer, normCorrect);
      const threshold = Math.max(1, Math.floor(normCorrect.length * 0.2));
      state = dist <= threshold ? 'close' : 'wrong';
    }

    const correct = state !== 'wrong';
    const result: GradeResult = {
      correct,
      state,
      feedback: state === 'correct' ? 'Correct!' : state === 'close' ? `Almost! Expected: ${currentExercise.correct_answer}` : `Expected: ${currentExercise.correct_answer}`,
      corrected_answer: state !== 'correct' ? currentExercise.correct_answer : undefined,
    };
    setGradeResult(result);
    setExplanation(null);
    await db.exercises.update(currentExercise.id, { completed: true, user_answer: answer, correct });

    // Sync completion to backend (fire-and-forget)
    if (!isOffline && currentExercise.id) {
      api('/exercises/complete', {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: currentExercise.id,
          user_answer: answer,
          correct,
        }),
      }).catch(err => console.warn('Failed to sync exercise completion:', err));
    }
  }

  async function handleExplain() {
    if (!currentExercise) return;
    setExplaining(true);
    try {
      const result = await api<{ feedback: string }>('/exercises/grade', {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: currentExercise.id,
          exercise_type: currentExercise.type,
          prompt: currentExercise.prompt,
          correct_answer: currentExercise.correct_answer,
          user_answer: answer,
          source_lang: deckLangs?.source || 'en',
          target_lang: deckLangs?.target || 'es',
        }),
      });
      setExplanation(result.feedback);
    } catch {
      setExplanation('Could not load explanation. Please try again.');
    } finally {
      setExplaining(false);
    }
  }

  function handleNext() {
    setGradeResult(null);
    setExplanation(null);
    setAnswer('');
    setScrambleOrder([]);
    setIndex(index + 1);
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

  // Render inline blank input for prompts containing a blank (_)
  function renderPromptWithBlanks(prompt: string, correctAnswer: string) {
    // Normalize Unicode dashes and multi-underscore sequences to a single _
    const normalized = normalizeBlankChars(prompt).replace(/_[\s_]*_/g, '_');
    const blankIdx = normalized.indexOf('_');
    if (blankIdx === -1) {
      return <p className="text-lg text-warm-900 font-medium whitespace-pre-wrap">{normalized}</p>;
    }
    // Split at first blank only — guarantees one input
    const parts = [normalized.slice(0, blankIdx), normalized.slice(blankIdx + 1)];
    return (
      <p className="text-lg text-warm-900 font-medium whitespace-pre-wrap">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              gradeResult ? (
                <span className={`inline-block border-b-2 px-1 font-bold ${gradeResult.state === 'correct' ? 'border-emerald-500 text-emerald-700' : gradeResult.state === 'close' ? 'border-amber-500 text-amber-700' : 'border-red-500 text-red-700'}`}>
                  {answer || '_'}
                </span>
              ) : (
                <input
                  type="text"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) handleSubmit(); }}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  size={Math.max(correctAnswer.length, 4)}
                  className="inline-block border-b-2 border-warm-400 focus:border-coral bg-transparent text-center text-lg text-warm-900 font-medium outline-none px-1 mx-1"
                  style={{ width: `${Math.max(correctAnswer.length, 4) * 0.65}em` }}
                />
              )
            )}
          </span>
        ))}
      </p>
    );
  }

  function renderHint(hint: string | undefined) {
    if (!hint) return null;
    return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">{hint}</p>;
  }

  function renderExerciseCard(ex: ExerciseRecord) {
    const type = ex.type;

    switch (type) {
      case 'full_translation':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-2">{ex.instruction}</p>
            <div className="bg-warm-50 border-2 border-warm-200 rounded-xl p-4 mb-3">
              <p className="text-xl text-warm-900 font-bold">{ex.prompt}</p>
            </div>
            <p className="text-sm text-warm-500 font-medium">Translate to {deckLangs?.target || 'target language'}:</p>
            {renderHint(ex.hint)}
          </>
        );

      case 'cloze_with_translation':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-2">{ex.instruction}</p>
            {ex.hint && (
              <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mb-3">
                <p className="text-sm text-sky-700 font-medium">{ex.hint}</p>
              </div>
            )}
            {renderPromptWithBlanks(ex.prompt, ex.correct_answer)}
          </>
        );

      case 'error_correction':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-2">{ex.instruction}</p>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-3">
              <p className="text-xl text-warm-900 font-bold">{ex.prompt}</p>
            </div>
            <p className="text-sm text-warm-500 font-medium">Type the corrected word:</p>
            {renderHint(ex.hint)}
          </>
        );

      case 'tense_shifting':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-2">{ex.instruction}</p>
            <div className="bg-warm-50 border-2 border-warm-200 rounded-xl p-4 mb-3">
              <p className="text-lg text-warm-900 font-medium">{ex.prompt}</p>
            </div>
            {renderHint(ex.hint)}
          </>
        );

      case 'article_check':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-2">{ex.instruction}</p>
            <div className="flex items-center justify-center py-4">
              <p className="text-3xl text-warm-900 font-bold">{ex.prompt}</p>
            </div>
            <p className="text-sm text-warm-500 font-medium">Type with correct article:</p>
            {renderHint(ex.hint)}
          </>
        );

      case 'morphing':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-3">{ex.instruction}</p>
            <div className="flex items-center justify-center py-4">
              <p className="text-3xl text-warm-900 font-bold">{ex.prompt}</p>
            </div>
            {renderHint(ex.hint)}
          </>
        );

      case 'word_order_scramble':
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-3">{ex.instruction}</p>
            {renderPromptWithBlanks(ex.prompt, ex.correct_answer)}
            {renderHint(ex.hint)}
          </>
        );

      // context_typing, conjugation_cloze, adjective_agreement, paragraph_cloze
      default:
        return (
          <>
            <p className="text-sm text-warm-500 font-semibold mb-3">{ex.instruction}</p>
            {renderPromptWithBlanks(ex.prompt, ex.correct_answer)}
            {renderHint(ex.hint)}
          </>
        );
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
        <p className="text-warm-500 text-sm">Loading exercises...</p>
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

  if (!currentExercise) {
    return (
      <div className="p-4 pb-24">
        <h1 className="text-2xl font-extrabold text-warm-900 mb-4">Practice</h1>
        <p className="text-warm-500">No exercises available.</p>
      </div>
    );
  }

  const hasInlineBlank = exerciseNeedsBlanks(currentExercise.type) && promptHasBlank(currentExercise.prompt);
  const levelLabel = currentExercise.level === 1 ? 'Beginner' : currentExercise.level === 2 ? 'Intermediate' : 'Advanced';
  const levelColor = currentExercise.level === 1 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : currentExercise.level === 2 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="p-4 pb-24">
      {isOffline && <div className="mb-4"><OfflineBanner message={"You're offline. \"Explain this error\" is unavailable."} /></div>}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-warm-900">Practice</h1>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${levelColor}`}>{levelLabel}</span>
      </div>

      {/* Exercise card */}
      <div className="bg-white hand-drawn shadow-lg p-6 mb-4" style={handDrawnStyle}>
        {renderExerciseCard(currentExercise)}
      </div>

      {/* Input area — only show separate input when there's no inline blank */}
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
          ) : !hasInlineBlank ? (
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) handleSubmit(); }}
              placeholder="Type your answer..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-4 py-3 border-2 border-warm-200 rounded-xl text-warm-900 focus:border-coral focus:outline-none transition text-lg"
            />
          ) : null}
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
          <div className={`p-4 rounded-xl border-2 ${
            gradeResult.state === 'correct' ? 'bg-emerald-50 border-emerald-200' :
            gradeResult.state === 'close' ? 'bg-amber-50 border-amber-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{gradeResult.state === 'correct' ? '✓' : gradeResult.state === 'close' ? '≈' : '✗'}</span>
              <span className={`font-bold ${
                gradeResult.state === 'correct' ? 'text-emerald-700' :
                gradeResult.state === 'close' ? 'text-amber-700' :
                'text-red-700'
              }`}>
                {gradeResult.state === 'correct' ? 'Correct!' : gradeResult.state === 'close' ? 'Almost!' : 'Incorrect'}
              </span>
            </div>
            {gradeResult.corrected_answer && (
              <p className="text-warm-900 font-medium mt-1">
                Expected: <span className={gradeResult.state === 'close' ? 'text-amber-700' : 'text-emerald-700'}>{gradeResult.corrected_answer}</span>
              </p>
            )}
            {gradeResult.state === 'wrong' && !isOffline && (
              <div className="mt-3">
                {!explanation && (
                  <button
                    onClick={handleExplain}
                    disabled={explaining}
                    className="text-sm px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {explaining ? 'Loading...' : 'Explain this error'}
                  </button>
                )}
                {explanation && (
                  <p className="text-warm-700 text-sm mt-2 bg-white/50 rounded-lg p-3">{explanation}</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleNext}
            className="w-full py-3 bg-coral hover:bg-coral-hover text-white font-bold rounded-xl transition"
          >
            Next Exercise
          </button>
        </div>
      )}

      {generating && (
        <p className="text-center text-warm-400 text-xs mt-4">Generating more exercises...</p>
      )}
    </div>
  );
}
