import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { sm2 } from '../lib/sm2';
import { db } from '../db/dexie';
import SwipeCard from '../components/SwipeCard';

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

  const load = useCallback(async () => {
    try {
      const due = await api<Card[]>('/review/due');
      setCards(due);
      setDone(due.length === 0);
    } catch {
      // offline
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, []);

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

    // Update locally in Dexie
    await db.cards.put({
      ...card,
      ease_factor: result.easeFactor,
      interval_days: result.intervalDays,
      repetitions: result.repetitions,
      next_review: result.nextReview.toISOString(),
      created_at: card.created_at,
      updated_at: new Date().toISOString(),
    });

    // Queue sync
    await db.syncQueue.add({
      card_id: card.id,
      grade,
      reviewed_at: new Date().toISOString(),
    });

    // Also try online review
    try {
      await api('/review', {
        method: 'POST',
        body: JSON.stringify({ card_id: card.id, grade }),
      });
      // If successful, remove from sync queue (last item)
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
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center">
        <div className="text-5xl mb-4">&#10003;</div>
        <h2 className="text-2xl font-bold text-white mb-2">All done!</h2>
        <p className="text-slate-400">No more cards to review right now. Come back later.</p>
      </div>
    );
  }

  const card = cards[index];
  const total = cards.length;

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Review</h1>
        <span className="text-sm text-slate-400">
          {index + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-1.5 mb-8">
        <div
          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
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
        <div className="flex justify-center mt-6 text-xs text-slate-500">
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">Space</kbd> Flip</span>
        </div>
      ) : (
        <div className="flex justify-center gap-6 mt-6 text-xs text-slate-500">
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">&larr;</kbd> Again</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">&uarr;</kbd> Easy</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">&rarr;</kbd> Good</span>
        </div>
      )}
    </div>
  );
}
