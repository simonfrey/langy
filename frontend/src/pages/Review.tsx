import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { sm2 } from '../lib/sm2';
import { db } from '../db/dexie';
import SwipeCard from '../components/SwipeCard';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';

interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  created_at: string;
  front_image_url?: string;
  back_image_url?: string;
}

export default function Review() {
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const isOffline = useOffline();

  const loadDueFromDexie = useCallback(async (): Promise<Card[]> => {
    const now = new Date();
    const dueCards = (await db.cards.toArray()).filter(
      (c) => c.repetitions > 0 && new Date(c.next_review) <= now,
    ) as Card[];
    const newCards = (await db.cards.toArray()).filter(
      (c) => c.repetitions === 0,
    ) as Card[];

    const result: Card[] = [];
    const maxLen = Math.max(dueCards.length, newCards.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < dueCards.length) result.push(dueCards[i]);
      if (i < newCards.length) result.push(newCards[i]);
    }

    if (result.length < 10) {
      const upcoming = (await db.cards.toArray()).filter(
        (c) => c.repetitions > 0 && new Date(c.next_review) > now,
      ) as Card[];
      upcoming.sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime());
      for (const c of upcoming) {
        if (result.length >= 10) break;
        if (!result.some((r) => r.id === c.id)) result.push(c);
      }
    }

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }, []);

  const load = useCallback(async () => {
    try {
      const due = await api<Card[]>('/review/due');
      setCards(due);
      setDone(due.length === 0);
    } catch {
      const local = await loadDueFromDexie();
      setCards(local);
      setDone(local.length === 0);
    } finally {
      setLoading(false);
    }
  }, [loadDueFromDexie]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (done || loading) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped(f => !f);
      } else if (e.key === 'ArrowLeft' && flipped) {
        handleSwipe('left');
        setFlipped(false);
      } else if (e.key === 'ArrowRight' && flipped) {
        handleSwipe('right');
        setFlipped(false);
      } else if (e.key === 'ArrowUp' && flipped) {
        e.preventDefault();
        handleSwipe('up');
        setFlipped(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [done, loading, flipped, handleSwipe]);

  async function handleSwipe(direction: 'left' | 'right' | 'up') {
    const card = cards[index];
    if (!card) return;

    const gradeMap = { left: 1, right: 4, up: 5 };
    const grade = gradeMap[direction];

    const result = sm2({
      grade,
      repetitions: card.repetitions,
      easeFactor: card.ease_factor,
      intervalDays: card.interval_days,
    });

    await db.cards.put({
      ...card,
      ease_factor: result.easeFactor,
      interval_days: result.intervalDays,
      repetitions: result.repetitions,
      next_review: result.nextReview.toISOString(),
      created_at: card.created_at,
      updated_at: new Date().toISOString(),
    });

    await db.syncQueue.add({
      card_id: card.id,
      grade,
      reviewed_at: new Date().toISOString(),
    });

    try {
      await api('/review', {
        method: 'POST',
        body: JSON.stringify({ card_id: card.id, grade }),
      });
      const lastItem = await db.syncQueue.orderBy('id').last();
      if (lastItem?.id && lastItem.card_id === card.id) {
        await db.syncQueue.delete(lastItem.id);
      }
    } catch {
      // Will sync later
    }

    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleContinueLearning() {
    setLoadingMore(true);
    try {
      let moreCards: Card[];
      try {
        moreCards = await api<Card[]>('/review/due');
      } catch {
        moreCards = await loadDueFromDexie();
      }
      if (moreCards.length > 0) {
        setCards(moreCards);
        setIndex(0);
        setDone(false);
        setFlipped(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  if (done) {
    const messages = [
      { emoji: '🎉', title: 'All done!', subtitle: 'You crushed it! Take a well-deserved break.' },
      { emoji: '🏆', title: 'Session complete!', subtitle: 'Your brain just got a little stronger.' },
      { emoji: '🚀', title: 'Nailed it!', subtitle: 'Consistency is the key — see you next time!' },
      { emoji: '⭐', title: 'Great work!', subtitle: 'Every review brings you closer to fluency.' },
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center">
        <div className="text-7xl mb-6 animate-bounce">{msg.emoji}</div>
        <h2 className="text-2xl font-extrabold text-warm-900 mb-2">{msg.title}</h2>
        <p className="text-warm-500 mb-8">{msg.subtitle}</p>
        <button
          onClick={handleContinueLearning}
          disabled={loadingMore}
          className="px-6 py-3 bg-coral hover:bg-coral-hover disabled:opacity-50 text-white font-bold rounded-xl transition shadow-sm"
        >
          {loadingMore ? 'Loading...' : 'Continue Learning'}
        </button>
      </div>
    );
  }

  const card = cards[index];
  const total = cards.length;

  return (
    <div className="p-4 pb-24">
      {isOffline && <div className="mb-4"><OfflineBanner message="You're offline. Reviews will sync when you reconnect." /></div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-warm-900">Review</h1>
        <span className="text-sm text-warm-500 font-semibold">
          {index + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 bg-warm-200 rounded-full h-2.5">
          <div
            className="bg-coral h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-warm-400 font-semibold whitespace-nowrap">{index + 1} of {total}</span>
      </div>

      <SwipeCard
        front={card.front}
        back={card.back}
        frontImageUrl={card.front_image_url}
        backImageUrl={card.back_image_url}
        onSwipe={(dir) => { handleSwipe(dir); setFlipped(false); }}
        flipped={flipped}
        onFlipChange={setFlipped}
      />

      {!flipped ? (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setFlipped(true)}
            className="px-8 py-3 bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold rounded-xl transition border border-warm-200"
          >
            Tap to Flip
          </button>
        </div>
      ) : (
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => { handleSwipe('left'); setFlipped(false); }}
            className="flex-1 max-w-[140px] py-3 bg-red-50 hover:bg-red-100 text-red-500 font-bold rounded-xl transition border border-red-200"
          >
            Again
          </button>
          <button
            onClick={() => { handleSwipe('right'); setFlipped(false); }}
            className="flex-1 max-w-[140px] py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-xl transition border border-emerald-200"
          >
            Good
          </button>
          <button
            onClick={() => { handleSwipe('up'); setFlipped(false); }}
            className="flex-1 max-w-[140px] py-3 bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold rounded-xl transition border border-sky-200"
          >
            Easy
          </button>
        </div>
      )}
    </div>
  );
}
