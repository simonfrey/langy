import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLanguage } from '../lib/languages';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';
import { CardStackIllustration } from '../components/Blobs';
import { useDecksWithCounts } from '../hooks/useDecks';
import { refreshFromServer } from '../db/mutations';
import { getHandDrawnStyle } from '../hooks/useHandDrawn';

export default function DeckList() {
  const decks = useDecksWithCounts();
  const navigate = useNavigate();
  const isOffline = useOffline();
  const [syncError, setSyncError] = useState(false);

  const deckStyles = useMemo(
    () => decks.map(() => getHandDrawnStyle()),
    [decks.length],
  );

  useEffect(() => {
    refreshFromServer()
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true));
  }, []);

  return (
    <div className="p-4 pb-24 relative">
      <div className="relative z-10">
      {isOffline && <div className="mb-4"><OfflineBanner /></div>}
      {syncError && !isOffline && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span>Failed to sync with server. Showing cached data.</span>
          <button onClick={() => setSyncError(false)} className="text-amber-500 hover:text-amber-700 font-bold ml-2">&times;</button>
        </div>
      )}
      <h1 className="text-2xl font-extrabold text-warm-900 mb-6">Your Decks</h1>

      {decks.length === 0 ? (
        <div className="text-center py-16">
          <CardStackIllustration className="mx-auto mb-4" />
          <p className="text-warm-700 text-lg font-bold mb-2">No decks yet</p>
          <p className="text-warm-400 text-sm mb-6">Create your first deck and start learning a new language!</p>
          <button
            onClick={() => navigate('/decks/new')}
            disabled={isOffline}
            className="bg-coral hover:bg-coral-hover disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow-sm"
          >
            + Create Your First Deck
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck, i) => (
            <div
              key={deck.id}
              className="bg-white hand-drawn p-4 active:bg-warm-100 transition shadow-sm cursor-pointer"
              style={deckStyles[i]}
              onClick={() => navigate('/review')}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-warm-900 truncate">{deck.name}</h3>
                  <p className="text-warm-500 text-sm mt-0.5">
                    {formatLanguage(deck.source_lang)} ↔ {formatLanguage(deck.target_lang)}
                  </p>
                  <p className="text-warm-400 text-xs mt-1">{deck.cardCount} cards</p>
                </div>
                {deck.dueCount > 0 ? (
                  <div className="bg-coral text-white rounded-2xl px-4 py-2 text-center shrink-0">
                    <div className="text-2xl font-extrabold leading-tight">{deck.dueCount}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide opacity-90">due</div>
                  </div>
                ) : (
                  <div className="bg-warm-100 text-warm-400 rounded-2xl px-4 py-2 text-center shrink-0">
                    <div className="text-2xl font-extrabold leading-tight">0</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide">due</div>
                  </div>
                )}
                <svg className="w-5 h-5 text-warm-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-warm-200">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/decks/${deck.id}/add-card`); }}
                  disabled={isOffline}
                  className="text-sm text-coral hover:text-coral-hover disabled:text-warm-300 disabled:cursor-not-allowed font-bold"
                >
                  + Add Card
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/decks/${deck.id}/edit`); }}
                  disabled={isOffline}
                  className="text-sm text-coral hover:text-coral-hover disabled:text-warm-300 disabled:cursor-not-allowed font-bold"
                >
                  Edit Cards
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => navigate('/decks/new')}
            disabled={isOffline}
            className="w-full border-2 border-dashed border-warm-300 hover:border-coral text-warm-400 hover:text-coral disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 rounded-xl transition"
          >
            + New Deck
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
