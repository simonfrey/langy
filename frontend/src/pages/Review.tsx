import { useEffect, useState, useCallback, useMemo } from 'react';
import { api, imageUrl } from '../lib/api';
import { db } from '../db/dexie';
import type { CardRecord } from '../db/dexie';
import SwipeCard from '../components/SwipeCard';
import AuthImage from '../components/AuthImage';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';
import { BlobBackground, CelebrationIllustration } from '../components/Blobs';
import { reviewCard as reviewCardMutation } from '../db/mutations';
import { computeGrade, recordTiming } from '../lib/adaptiveGrade';
import { getHandDrawnStyle } from '../hooks/useHandDrawn';

interface ReviewCard extends CardRecord {
  reversed: boolean;
}

const ROTATIONS = [2.5, -2, 3, -1.5, 1.8];
const X_OFFSETS = [5, -4, 7, -3, 6];
const Y_OFFSETS = [3, 4, 2, 5, 3];

function getJitter(layerIndex: number) {
  return {
    rotate: ROTATIONS[layerIndex % ROTATIONS.length],
    x: X_OFFSETS[layerIndex % X_OFFSETS.length],
    y: Y_OFFSETS[layerIndex % Y_OFFSETS.length],
  };
}

export default function Review() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [cardShownTimestamp, setCardShownTimestamp] = useState<number>(Date.now());
  const isOffline = useOffline();

  const stackStyles = useMemo(
    () => cards.map(() => getHandDrawnStyle()),
    [cards],
  );

  const loadDueFromDexie = useCallback(async (): Promise<CardRecord[]> => {
    const allCards = await db.cards.toArray();
    const now = new Date();

    const dueCards = allCards.filter(
      (c) => c.repetitions > 0 && new Date(c.next_review) <= now,
    );
    const newCards = allCards.filter((c) => c.repetitions === 0);

    const result: CardRecord[] = [];
    const maxLen = Math.max(dueCards.length, newCards.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < dueCards.length) result.push(dueCards[i]);
      if (i < newCards.length) result.push(newCards[i]);
    }

    if (result.length < 10) {
      const upcoming = allCards
        .filter((c) => c.repetitions > 0 && new Date(c.next_review) > now)
        .sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime());
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

  const addDirection = (cards: CardRecord[]): ReviewCard[] =>
    cards.map((c) => ({ ...c, reversed: Math.random() < 0.5 }));

  const load = useCallback(async () => {
    try {
      const due = await api<CardRecord[]>('/review/due');
      setCards(addDirection(due));
      setDone(due.length === 0);
      // Cache API results in Dexie for offline use
      if (due.length > 0) {
        db.cards.bulkPut(due).catch(() => {});
      }
    } catch {
      const local = await loadDueFromDexie();
      setCards(addDirection(local));
      setDone(local.length === 0);
    } finally {
      setLoading(false);
      setCardShownTimestamp(Date.now());
    }
  }, [loadDueFromDexie]);

  useEffect(() => { load(); }, [load]);

  function startSwipe(dir: 'left' | 'right') {
    if (exitDirection) return;
    setExitDirection(dir);
    setFlipped(false);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (done || loading || exitDirection) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped(f => !f);
      } else if (e.key === 'ArrowLeft' && flipped) {
        startSwipe('left');
      } else if (e.key === 'ArrowRight' && flipped) {
        startSwipe('right');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [done, loading, flipped, exitDirection]);

  async function handleSwipeComplete(direction: 'left' | 'right') {
    setExitDirection(null);
    const card = cards[index];
    if (!card) return;

    const responseTimeMs = Date.now() - cardShownTimestamp;
    let grade = direction === 'left' ? 1 : 4;

    if (grade === 4) {
      grade = await computeGrade(responseTimeMs);
      await recordTiming(responseTimeMs);
    }

    await reviewCardMutation(card, grade, responseTimeMs);

    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setCardShownTimestamp(Date.now());
    }
    setFlipped(false);
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
      let moreCards: CardRecord[];
      try {
        moreCards = await api<CardRecord[]>('/review/due');
      } catch {
        moreCards = await loadDueFromDexie();
      }
      if (moreCards.length > 0) {
        setCards(addDirection(moreCards));
        setIndex(0);
        setCardShownTimestamp(Date.now());
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
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center relative">
        <BlobBackground />
        <CelebrationIllustration className="mb-2 relative z-10" />
        <h2 className="text-2xl font-extrabold text-warm-900 mb-2 relative z-10">{msg.title}</h2>
        <p className="text-warm-500 mb-8 relative z-10">{msg.subtitle}</p>
        <button
          onClick={handleContinueLearning}
          disabled={loadingMore}
          className="px-6 py-3 bg-coral hover:bg-coral-hover disabled:opacity-50 text-white font-bold rounded-xl transition shadow-sm relative z-10"
        >
          {loadingMore ? 'Loading...' : 'Continue Learning'}
        </button>
      </div>
    );
  }

  const card = cards[index];
  const total = cards.length;

  return (
    <div className="p-4 pb-24 relative overflow-hidden">
      <BlobBackground />
      {isOffline && <div className="mb-4 relative z-10"><OfflineBanner message="You're offline. Reviews will sync when you reconnect." /></div>}


      <h1 className="text-2xl font-extrabold text-warm-900 mb-2 relative z-20">Review</h1>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4 relative z-20">
        <div className="flex-1 bg-warm-200 rounded-full">
          <div
            className="min-w-fit p-1 bg-coral rounded-full transition-all duration-300 text-right text-xs text-cream font-bold"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          >{index + 1}/{total}
          </div>

        </div>
      </div>

      <div className="relative" style={{ isolation: 'isolate' }}>
        {/* Stack cards behind — rendered bottom-up with real content */}
        {cards.slice(index + 1, index + 3).reverse().map((stackCard, i, arr) => {
          const layerIndex = arr.length - i; // 2, 1 (bottom first)
          const originalOffset = arr.length - i; // offset from current top card
          const jitter = getJitter(index + originalOffset);
          const frontText = stackCard.reversed ? stackCard.back : stackCard.front;
          const frontImg = imageUrl(stackCard.reversed ? stackCard.back_image_url : stackCard.front_image_url)
            || imageUrl(stackCard.reversed ? stackCard.front_image_url : stackCard.back_image_url);
          const stackIdx = cards.indexOf(stackCard);
          return (
            <div
              key={stackCard.id}
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `rotate(${jitter.rotate}deg) translate(${jitter.x}px, ${jitter.y}px)`,
                opacity: 1,
                zIndex: 3 - layerIndex,
              }}
            >
              <div className="bg-white hand-drawn shadow-lg p-8 min-h-[340px] flex flex-col items-center justify-center" style={stackStyles[stackIdx]}>
                <div className="text-xs text-warm-400 uppercase tracking-wider mb-4 font-semibold">Front</div>
                <div className="text-2xl font-bold text-warm-900 text-center">
                  {frontImg && (
                    <AuthImage src={frontImg} alt="" className="max-h-32 mx-auto mb-3 rounded-lg object-contain" />
                  )}
                  {frontText}
                </div>
                <p className="text-warm-400 text-sm mt-6">Tap to reveal</p>
              </div>
            </div>
          );
        })}

        <SwipeCard
          key={card.id}
          front={card.reversed ? card.back : card.front}
          back={card.reversed ? card.front : card.back}
          frontImageUrl={imageUrl(card.reversed ? card.back_image_url : card.front_image_url)}
          backImageUrl={imageUrl(card.reversed ? card.front_image_url : card.back_image_url)}
          onSwipeComplete={handleSwipeComplete}
          onDragSwipe={startSwipe}
          flipped={flipped}
          onFlipChange={(f) => { setFlipped(f); }}
          exitDirection={exitDirection}
          jitter={getJitter(index)}
          handDrawnStyle={stackStyles[index]}
        />
      </div>

      {!flipped ? (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => { setFlipped(true); }}
            className="px-8 py-3 bg-warm-100 hover:bg-warm-200 text-warm-700 font-bold rounded-xl border-2 border-warm-200 transition"
          >
            Tap to Flip
          </button>
        </div>
      ) : (
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => startSwipe('left')}
            className="flex-1 max-w-[140px] py-3 bg-red-50 hover:bg-red-100 text-red-500 font-bold rounded-xl border-2 border-red-200 transition"
          >
            Again
          </button>
          <button
            onClick={() => startSwipe('right')}
            className="flex-1 max-w-[140px] py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold rounded-xl border-2 border-emerald-200 transition"
          >
            Good
          </button>
        </div>
      )}
    </div>
  );
}
