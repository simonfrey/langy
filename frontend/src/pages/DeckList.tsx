import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiFormData } from '../lib/api';
import { formatLanguage } from '../lib/languages';
import LanguageSelect from '../components/LanguageSelect';
import { db } from '../db/dexie';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';
import { BlobBackground, CardStackIllustration } from '../components/Blobs';

interface Deck {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

interface Card {
  id: string;
  front: string;
  back: string;
  front_image_url?: string;
  back_image_url?: string;
  next_review: string;
}

interface DeckWithCounts extends Deck {
  cardCount: number;
  dueCount: number;
}

export default function DeckList() {
  const [decks, setDecks] = useState<DeckWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAddCard, setShowAddCard] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', source_lang: '', target_lang: '' });
  const [cardForm, setCardForm] = useState({ front: '', back: '' });
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [editingDeck, setEditingDeck] = useState<string | null>(null);
  const [editCards, setEditCards] = useState<Card[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardForm, setEditCardForm] = useState({ front: '', back: '' });
  const navigate = useNavigate();
  const isOffline = useOffline();

  const loadFromDexie = useCallback(async () => {
    const localDecks = await db.decks.toArray();
    const now = new Date();
    const enriched: DeckWithCounts[] = await Promise.all(
      localDecks.map(async (d) => {
        const cards = await db.cards.where('deck_id').equals(d.id).toArray();
        const dueCount = cards.filter((c) => new Date(c.next_review) <= now).length;
        return { ...d, cardCount: cards.length, dueCount };
      }),
    );
    return enriched;
  }, []);

  const load = useCallback(async () => {
    const local = await loadFromDexie();
    if (local.length > 0) {
      setDecks(local);
      setLoading(false);
    }

    try {
      const rawDecks = await api<Deck[]>('/decks');
      const now = new Date();
      const enriched: DeckWithCounts[] = await Promise.all(
        rawDecks.map(async (d) => {
          const cards = await api<Card[]>(`/decks/${d.id}/cards`);
          const dueCount = cards.filter((c) => new Date(c.next_review) <= now).length;
          return { ...d, cardCount: cards.length, dueCount };
        }),
      );
      setDecks(enriched);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, [loadFromDexie]);

  useEffect(() => { load(); }, [load]);

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    await api('/decks', { method: 'POST', body: JSON.stringify(form) });
    setForm({ name: '', source_lang: '', target_lang: '' });
    setShowModal(false);
    load();
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!showAddCard) return;
    if (frontImage || backImage) {
      const fd = new FormData();
      fd.append('front', cardForm.front);
      fd.append('back', cardForm.back);
      if (frontImage) fd.append('front_image', frontImage);
      if (backImage) fd.append('back_image', backImage);
      await apiFormData(`/decks/${showAddCard}/cards`, fd);
    } else {
      await api(`/decks/${showAddCard}/cards`, { method: 'POST', body: JSON.stringify(cardForm) });
    }
    setCardForm({ front: '', back: '' });
    setFrontImage(null);
    setBackImage(null);
    setShowAddCard(null);
    load();
  }

  async function openEditDeck(deckId: string) {
    setEditingDeck(deckId);
    setEditingCardId(null);
    try {
      const cards = await api<Card[]>(`/decks/${deckId}/cards`);
      setEditCards(cards);
    } catch {
      setEditCards([]);
    }
  }

  async function saveCard(cardId: string) {
    if (!editCardForm.front || !editCardForm.back) return;
    try {
      await api(`/cards/${cardId}`, { method: 'PUT', body: JSON.stringify(editCardForm) });
      setEditCards((prev) => prev.map((c) => c.id === cardId ? { ...c, ...editCardForm } : c));
      setEditingCardId(null);
    } catch {
      // error
    }
  }

  async function deleteCard(cardId: string) {
    try {
      await api(`/cards/${cardId}`, { method: 'DELETE' });
      setEditCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch {
      // error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 relative">
      <BlobBackground />
      <div className="relative z-10">
      {isOffline && <div className="mb-4"><OfflineBanner /></div>}
      <h1 className="text-2xl font-extrabold text-warm-900 mb-6">Your Decks</h1>

      {decks.length === 0 ? (
        <div className="text-center py-16">
          <CardStackIllustration className="mx-auto mb-4" />
          <p className="text-warm-700 text-lg font-bold mb-2">No decks yet</p>
          <p className="text-warm-400 text-sm mb-6">Create your first deck and start learning a new language!</p>
          <button
            onClick={() => setShowModal(true)}
            disabled={isOffline}
            className="bg-coral hover:bg-coral-hover disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow-sm"
          >
            + Create Your First Deck
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="bg-white border border-warm-200 rounded-2xl p-4 active:bg-warm-100 transition shadow-sm cursor-pointer"
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
                  onClick={(e) => { e.stopPropagation(); setShowAddCard(deck.id); }}
                  disabled={isOffline}
                  className="text-sm text-coral hover:text-coral-hover disabled:text-warm-300 disabled:cursor-not-allowed font-bold"
                >
                  + Add Card
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEditDeck(deck.id); }}
                  disabled={isOffline}
                  className="text-sm text-coral hover:text-coral-hover disabled:text-warm-300 disabled:cursor-not-allowed font-bold"
                >
                  Edit Cards
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowModal(true)}
            disabled={isOffline}
            className="w-full border-2 border-dashed border-warm-300 hover:border-coral text-warm-400 hover:text-coral disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 rounded-2xl transition"
          >
            + New Deck
          </button>
        </div>
      )}

      {/* Create Deck Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <form
            onSubmit={createDeck}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-full max-w-sm border border-warm-200 shadow-xl"
          >
            <h2 className="text-xl font-bold text-warm-900 mb-4">New Deck</h2>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Deck name"
                required
                className="w-full bg-warm-100 border border-warm-200 rounded-xl px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral"
              />
              <LanguageSelect
                value={form.source_lang}
                onChange={(code) => setForm({ ...form, source_lang: code })}
                required
                label="Language 1"
              />
              <LanguageSelect
                value={form.target_lang}
                onChange={(code) => setForm({ ...form, target_lang: code })}
                required
                label="Language 2"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl text-warm-700 bg-warm-100 hover:bg-warm-200 transition font-semibold">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-xl text-white bg-coral hover:bg-coral-hover transition font-bold shadow-sm">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Cards Modal */}
      {editingDeck && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => { setEditingDeck(null); load(); }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-full max-w-md border border-warm-200 shadow-xl max-h-[80vh] flex flex-col"
          >
            <h2 className="text-xl font-bold text-warm-900 mb-4">Edit Cards</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {editCards.length === 0 ? (
                <p className="text-warm-400 text-sm text-center py-4">No cards in this deck</p>
              ) : (
                editCards.map((card) => (
                  <div key={card.id} className="bg-warm-100 rounded-xl p-3">
                    {editingCardId === card.id ? (
                      <div className="space-y-2">
                        <input
                          value={editCardForm.front}
                          onChange={(e) => setEditCardForm({ ...editCardForm, front: e.target.value })}
                          className="w-full bg-white border border-warm-200 rounded-lg px-3 py-2 text-warm-900 text-sm focus:outline-none focus:ring-2 focus:ring-coral"
                          placeholder="Front"
                        />
                        <input
                          value={editCardForm.back}
                          onChange={(e) => setEditCardForm({ ...editCardForm, back: e.target.value })}
                          className="w-full bg-white border border-warm-200 rounded-lg px-3 py-2 text-warm-900 text-sm focus:outline-none focus:ring-2 focus:ring-coral"
                          placeholder="Back"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveCard(card.id)} className="text-xs text-emerald-600 hover:text-emerald-500 font-bold">Save</button>
                          <button onClick={() => setEditingCardId(null)} className="text-xs text-warm-500 hover:text-warm-700 font-semibold">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-warm-900 text-sm truncate font-semibold">{card.front}</p>
                          <p className="text-warm-500 text-xs truncate">{card.back}</p>
                        </div>
                        <div className="flex gap-2 ml-2 shrink-0">
                          <button
                            onClick={() => { setEditingCardId(card.id); setEditCardForm({ front: card.front, back: card.back }); }}
                            className="text-xs text-coral hover:text-coral-hover font-bold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCard(card.id)}
                            className="text-xs text-red-400 hover:text-red-500 font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <button onClick={() => { setEditingDeck(null); load(); }} className="mt-4 w-full py-3 rounded-xl text-warm-700 bg-warm-100 hover:bg-warm-200 transition font-semibold">Close</button>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShowAddCard(null)}>
          <form
            onSubmit={addCard}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-full max-w-sm border border-warm-200 shadow-xl"
          >
            <h2 className="text-xl font-bold text-warm-900 mb-4">Add Card</h2>
            <div className="space-y-3">
              <input
                value={cardForm.front}
                onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })}
                placeholder="Front (word/phrase)"
                required
                className="w-full bg-warm-100 border border-warm-200 rounded-xl px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral"
              />
              <input
                value={cardForm.back}
                onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })}
                placeholder="Back (translation)"
                required
                className="w-full bg-warm-100 border border-warm-200 rounded-xl px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral"
              />
              <div>
                <label className="block text-xs text-warm-500 mb-1 font-semibold">Front image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFrontImage(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-warm-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-warm-100 file:text-warm-700 file:text-sm file:font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs text-warm-500 mb-1 font-semibold">Back image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBackImage(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-warm-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-warm-100 file:text-warm-700 file:text-sm file:font-semibold"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowAddCard(null)} className="flex-1 py-3 rounded-xl text-warm-700 bg-warm-100 hover:bg-warm-200 transition font-semibold">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-xl text-white bg-coral hover:bg-coral-hover transition font-bold shadow-sm">Add</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}
