import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../db/dexie";
import type { ExerciseRecord } from "../db/dexie";
import { exercisesApi, exerciseToRecord } from "../lib/api";
import { selectExerciseCards } from "../lib/maturity";
import { useOffline } from "../hooks/useOffline";
import OfflineBanner from "../components/OfflineBanner";
import { getHandDrawnStyle } from "../hooks/useHandDrawn";
import ExerciseRouter from "../components/exercises/ExerciseRouter";
import {
  exerciseNeedsBlanks,
  exerciseUsesCustomUI,
  promptHasBlank,
} from "../components/exercises/sharedUtils";
import type { GradeResult } from "../components/exercises/types";

const BATCH_SIZE = 10;
const PREFETCH_THRESHOLD = 3;

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// Types that are graded by their component (matching, categorization, reading)
const SELF_GRADED_TYPES = new Set([
  "vocab_matching_pairs",
  "grammar_matching",
  "grammar_categorization",
  "integrative_reading",
]);

export default function Exercises() {
  const navigate = useNavigate();
  const isOffline = useOffline();
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [answer, setAnswerState] = useState("");
  const answerRef = useRef("");
  const setAnswer = useCallback((val: string) => {
    answerRef.current = val;
    setAnswerState(val);
  }, []);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const prefetchingRef = useRef(false);
  const [deckLangs, setDeckLangs] = useState<{
    source: string;
    target: string;
  } | null>(null);

  const handDrawnStyle = getHandDrawnStyle();

  const generateBatch = useCallback(async (sid: string) => {
    const allCards = await db.cards.toArray();
    if (allCards.length === 0) {
      setError("No cards available. Add some vocabulary first!");
      setLoading(false);
      return [];
    }

    const decks = await db.decks.toArray();
    const deckMap = new Map(decks.map((d) => [d.id, d]));
    const firstDeck = deckMap.get(allCards[0].deck_id);
    if (firstDeck) {
      setDeckLangs({
        source: firstDeck.source_lang,
        target: firstDeck.target_lang,
      });
    }

    const selected = selectExerciseCards(allCards, BATCH_SIZE);
    if (selected.length === 0) {
      setError("No cards available for exercises.");
      setLoading(false);
      return [];
    }

    const deck = deckMap.get(selected[0].card.deck_id);
    const sourceLang = deck?.source_lang || "en";
    const targetLang = deck?.target_lang || "es";

    const cardsPayload = selected.map((s) => ({
      id: s.card.id,
      front: s.card.front,
      back: s.card.back,
      level: s.level,
    }));

    const knownWords = allCards.map((c) => ({ front: c.front, back: c.back }));

    try {
      const result = await exercisesApi().generateExercises({
        ExerciseGenerateRequest: {
          session_id: sid,
          cards: cardsPayload,
          known_words: knownWords,
          source_lang: sourceLang,
          target_lang: targetLang,
        },
      });

      const records: ExerciseRecord[] = result.map((ex) =>
        exerciseToRecord(ex, sid),
      );

      // Parse data field if it's a string (from JSON response)
      for (const r of records) {
        if (typeof r.data === "string") {
          try {
            r.data = JSON.parse(r.data);
          } catch {
            /* keep as-is */
          }
        }
      }

      const valid = records.filter((ex) => {
        if (
          exerciseNeedsBlanks(ex.type) &&
          ex.prompt &&
          !promptHasBlank(ex.prompt)
        ) {
          console.warn(
            "Skipping exercise with missing blank:",
            ex.type,
            ex.prompt,
          );
          return false;
        }
        return true;
      });

      await db.exercises.bulkPut(valid);
      return valid;
    } catch (err) {
      console.error("Failed to generate exercises:", err);
      throw err;
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await db.exercises.filter((e) => !e.completed).toArray();
        if (cached.length > 0 && !cancelled) {
          setExercises(cached);
          const decks = await db.decks.toArray();
          if (decks.length > 0) {
            setDeckLangs({
              source: decks[0].source_lang,
              target: decks[0].target_lang,
            });
          }
          setLoading(false);
        }

        if (!isOffline) {
          try {
            await db.exercises.filter((e) => e.completed).delete();
            const due = await exercisesApi().getDueExercises();
            if (due && due.length > 0 && !cancelled) {
              const records: ExerciseRecord[] = due.map((ex) => ({
                ...ex,
                session_id: sessionId,
                completed: false,
              }));
              for (const r of records) {
                if (typeof r.data === "string") {
                  try {
                    r.data = JSON.parse(r.data);
                  } catch {
                    /* keep */
                  }
                }
              }
              const dueIds = new Set(records.map((r) => r.id));
              await db.exercises
                .filter((e) => !e.completed && !dueIds.has(e.id))
                .delete();
              await db.exercises.bulkPut(records);
              const all = await db.exercises
                .filter((e) => !e.completed)
                .toArray();
              if (!cancelled) {
                setExercises(all);
                const decks = await db.decks.toArray();
                if (decks.length > 0) {
                  setDeckLangs({
                    source: decks[0].source_lang,
                    target: decks[0].target_lang,
                  });
                }
                setLoading(false);
                return;
              }
            }
          } catch {
            if (cached.length > 0) {
              if (!cancelled) setLoading(false);
              return;
            }
          }
        }

        if (cached.length === 0) {
          setGenerating(true);
          const batch = await generateBatch(sessionId);
          if (cancelled) return;
          setExercises(batch);
        }
      } catch {
        setError(
          "Failed to generate exercises. Check your connection and try again.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setGenerating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generateBatch, sessionId, isOffline]);

  // Prefetch
  useEffect(() => {
    const remaining = exercises.length - index;
    if (
      remaining <= PREFETCH_THRESHOLD &&
      !prefetchingRef.current &&
      !isOffline &&
      exercises.length > 0
    ) {
      prefetchingRef.current = true;
      generateBatch(sessionId)
        .then((newBatch) => {
          if (newBatch.length > 0) {
            setExercises((prev) => [...prev, ...newBatch]);
          }
        })
        .catch(() => {})
        .finally(() => {
          prefetchingRef.current = false;
        });
    }
  }, [index, exercises.length, isOffline, generateBatch, sessionId]);

  const currentExercise = exercises[index];

  async function handleSubmit() {
    if (!currentExercise) return;
    // Read from ref to avoid stale closure (e.g., multiple choice setTimeout)
    const answer = answerRef.current;

    const isSelfGraded = SELF_GRADED_TYPES.has(currentExercise.type);

    if (isSelfGraded) {
      if (!answer) return; // Not finished yet (no pairs matched / no words sorted)
      const correct = answer === "matched" || answer === "correct";
      const result: GradeResult = {
        correct,
        state: correct ? "correct" : "wrong",
        feedback: correct ? "Correct!" : "Some answers were incorrect.",
      };
      setGradeResult(result);
      setExplanation(null);
      await db.exercises.update(currentExercise.id, {
        completed: true,
        user_answer: answer,
        correct,
      });
      syncCompletion(currentExercise.id, answer, correct);
      return;
    }

    if (!answer.trim()) return;

    // For multi-blank exercises, reconstruct the full sentence from pipe-delimited answers
    let finalAnswer = answer;
    if (answer.includes("|") && currentExercise.prompt) {
      const blanks = answer.split("|");
      const parts = currentExercise.prompt
        .replace(/[—–―＿]/g, "_")
        .replace(/_[\s_]*_/g, "___")
        .split("___");
      let reconstructed = "";
      for (let i = 0; i < parts.length; i++) {
        reconstructed += parts[i];
        if (i < blanks.length) reconstructed += blanks[i];
      }
      finalAnswer = reconstructed;
    }

    const normalize = (s: string) =>
      s.trim().toLowerCase().replace(/\s+/g, " ");
    const stripPunctuation = (s: string) =>
      s
        .replace(/[^\w\s\u00C0-\u024F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    const isScramble =
      currentExercise.type === "word_order_scramble" ||
      currentExercise.type === "vocab_word_bank" ||
      currentExercise.type === "grammar_reorder";
    const normAnswer = isScramble
      ? stripPunctuation(finalAnswer)
      : normalize(finalAnswer);
    const normCorrect = isScramble
      ? stripPunctuation(currentExercise.correct_answer)
      : normalize(currentExercise.correct_answer);

    let state: "correct" | "close" | "wrong";
    if (normAnswer === normCorrect) {
      state = "correct";
    } else {
      const dist = levenshtein(normAnswer, normCorrect);
      const threshold = Math.max(1, Math.floor(normCorrect.length * 0.2));
      state = dist <= threshold ? "close" : "wrong";
    }

    const correct = state !== "wrong";
    const result: GradeResult = {
      correct,
      state,
      feedback:
        state === "correct"
          ? "Correct!"
          : state === "close"
            ? `Almost! Expected: ${currentExercise.correct_answer}`
            : `Expected: ${currentExercise.correct_answer}`,
      corrected_answer:
        state !== "correct" ? currentExercise.correct_answer : undefined,
    };
    setGradeResult(result);
    setExplanation(null);
    await db.exercises.update(currentExercise.id, {
      completed: true,
      user_answer: answer,
      correct,
    });
    syncCompletion(currentExercise.id, answer, correct);
  }

  function syncCompletion(
    exerciseId: string,
    userAnswer: string,
    correct: boolean,
  ) {
    if (!isOffline && exerciseId) {
      exercisesApi()
        .completeExercise({
          ExerciseCompleteRequest: {
            exercise_id: exerciseId,
            user_answer: userAnswer,
            correct,
          },
        })
        .catch((err) =>
          console.warn("Failed to sync exercise completion:", err),
        );
    }
  }

  async function handleExplain() {
    if (!currentExercise) return;
    setExplaining(true);
    try {
      const result = await exercisesApi().gradeExercise({
        ExerciseGradeRequest: {
          exercise_id: currentExercise.id,
          exercise_type: currentExercise.type,
          prompt: currentExercise.prompt,
          correct_answer: currentExercise.correct_answer,
          user_answer: answer,
          source_lang: deckLangs?.source || "en",
          target_lang: deckLangs?.target || "es",
        },
      });
      setExplanation(result.feedback);
    } catch {
      setExplanation("Could not load explanation. Please try again.");
    } finally {
      setExplaining(false);
    }
  }

  function handleNext() {
    setGradeResult(null);
    setExplanation(null);
    setAnswer("");
    setIndex(index + 1);
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
        <h1 className="font-display text-2xl font-extrabold text-warm-900 mb-4">
          Practice
        </h1>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
        <button
          onClick={() => navigate("/decks")}
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
        <h1 className="font-display text-2xl font-extrabold text-warm-900 mb-4">
          Practice
        </h1>
        <p className="text-warm-500">No exercises available.</p>
      </div>
    );
  }

  const usesCustomUI = exerciseUsesCustomUI(currentExercise.type);
  const isSelfGraded = SELF_GRADED_TYPES.has(currentExercise.type);
  const hasInlineBlank =
    exerciseNeedsBlanks(currentExercise.type) &&
    currentExercise.prompt &&
    promptHasBlank(currentExercise.prompt);
  const needsSeparateInput =
    !usesCustomUI &&
    !hasInlineBlank &&
    exerciseNeedsBlanks(currentExercise.type);
  const levelLabel =
    currentExercise.level === 1
      ? "Beginner"
      : currentExercise.level === 2
        ? "Intermediate"
        : "Advanced";
  const levelColor =
    currentExercise.level === 1
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : currentExercise.level === 2
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="p-4 pb-24">
      {isOffline && (
        <div className="mb-4">
          <OfflineBanner
            message={'You\'re offline. "Explain this error" is unavailable.'}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-extrabold text-warm-900">
          Practice
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-warm-400 font-medium">
            {index + 1}/{exercises.length}
          </span>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-lg border ${levelColor}`}
          >
            {levelLabel}
          </span>
        </div>
      </div>

      <div className="w-full bg-warm-100 rounded-full h-1.5 mb-4">
        <div
          className="bg-coral h-1.5 rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(((index + 1) / exercises.length) * 100, 100)}%`,
          }}
        />
      </div>

      <div
        className="bg-white hand-drawn shadow-lg p-6 mb-4"
        style={handDrawnStyle}
      >
        <ExerciseRouter
          key={currentExercise.id}
          exercise={currentExercise}
          answer={answer}
          setAnswer={setAnswer}
          gradeResult={gradeResult}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Submit button */}
      {!gradeResult && (
        <div className="space-y-3">
          {needsSeparateInput && (
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && answer.trim()) handleSubmit();
              }}
              placeholder="Type your answer..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-4 py-3 border-2 border-warm-200 rounded-xl text-warm-900 focus:border-coral focus:outline-none transition text-lg"
            />
          )}
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() && !isSelfGraded}
            className="w-full py-3 bg-coral hover:bg-coral-hover disabled:opacity-50 text-white font-bold rounded-xl transition"
          >
            Check Answer
          </button>
        </div>
      )}

      {/* Grade result */}
      {gradeResult && (
        <div className="space-y-3">
          <div
            className={`p-4 rounded-xl border-2 ${
              gradeResult.state === "correct"
                ? "bg-emerald-50 border-emerald-200"
                : gradeResult.state === "close"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">
                {gradeResult.state === "correct"
                  ? "✓"
                  : gradeResult.state === "close"
                    ? "≈"
                    : "✗"}
              </span>
              <span
                className={`font-bold ${
                  gradeResult.state === "correct"
                    ? "text-emerald-700"
                    : gradeResult.state === "close"
                      ? "text-amber-700"
                      : "text-red-700"
                }`}
              >
                {gradeResult.state === "correct"
                  ? "Correct!"
                  : gradeResult.state === "close"
                    ? "Almost!"
                    : "Incorrect"}
              </span>
            </div>
            {gradeResult.corrected_answer && (
              <p className="text-warm-900 font-medium mt-1">
                Expected:{" "}
                <span
                  className={
                    gradeResult.state === "close"
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }
                >
                  {gradeResult.corrected_answer}
                </span>
              </p>
            )}
            {gradeResult.state === "wrong" && !isOffline && (
              <div className="mt-3">
                {!explanation && (
                  <button
                    onClick={handleExplain}
                    disabled={explaining}
                    className="text-sm px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {explaining ? "Loading..." : "Explain this error"}
                  </button>
                )}
                {explanation && (
                  <p className="text-warm-700 text-sm mt-2 bg-white/50 rounded-lg p-3">
                    {explanation}
                  </p>
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
        <p className="text-center text-warm-400 text-xs mt-4">
          Generating more exercises...
        </p>
      )}
    </div>
  );
}
