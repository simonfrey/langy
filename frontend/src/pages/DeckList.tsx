import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiFormData } from '../lib/api';
import { formatLanguage } from '../lib/languages';
import LanguageSelect from '../components/LanguageSelect';
import { db } from '../db/dexie';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';

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
    // Show local data immediately
    const local = await loadFromDexie();
    if (local.length > 0) {
      setDecks(local);
      setLoading(false);
    }

    // Then try to refresh from API
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
      // offline — local data already shown
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
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {isOffline && <div className="mb-4"><OfflineBanner /></div>}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Your Decks</h1>
        <button
          onClick={() => setShowModal(true)}
          disabled={isOffline}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + New Deck
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg mb-2">No decks yet</p>
          <p className="text-slate-500 text-sm">Create your first deck to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 active:bg-slate-800 transition"
            >
              <div className="flex items-start justify-between" onClick={() => navigate('/review')}>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{deck.name}</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {formatLanguage(deck.source_lang)} → {formatLanguage(deck.target_lang)}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-slate-400">{deck.cardCount} cards</span>
                    {deck.dueCount > 0 && (
                      <span className="text-indigo-400 font-medium">{deck.dueCount} due</span>
                    )}
                  </div>
                </div>
                {deck.dueCount > 0 && (
                  <span className="bg-indigo-600/20 text-indigo-400 text-xs font-medium px-2.5 py-1 rounded-full">
                    Review
                  </span>
                )}
              </div>
              <div className="flex gap-4 mt-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAddCard(deck.id); }}
                  disabled={isOffline}
                  className="text-sm text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 disabled:cursor-not-allowed font-medium"
                >
                  + Add Card
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEditDeck(deck.id); }}
                  disabled={isOffline}
                  className="text-sm text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 disabled:cursor-not-allowed font-medium"
                >
                  Edit Cards
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Deck Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <form
            onSubmit={createDeck}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-800 shadow-xl"
          >
            <h2 className="text-xl font-semibold text-white mb-4">New Deck</h2>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Deck name"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <LanguageSelect
                value={form.source_lang}
                onChange={(code) => setForm({ ...form, source_lang: code })}
                required
                label="Source language"
              />
              <LanguageSelect
                value={form.target_lang}
                onChange={(code) => setForm({ ...form, target_lang: code })}
                required
                label="Target language"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition font-medium">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition font-medium">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Cards Modal */}
      {editingDeck && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => { setEditingDeck(null); load(); }}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-xl max-h-[80vh] flex flex-col"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Edit Cards</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {editCards.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No cards in this deck</p>
              ) : (
                editCards.map((card) => (
                  <div key={card.id} className="bg-slate-800 rounded-lg p-3">
                    {editingCardId === card.id ? (
                      <div className="space-y-2">
                        <input
                          value={editCardForm.front}
                          onChange={(e) => setEditCardForm({ ...editCardForm, front: e.target.value })}
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Front"
                        />
                        <input
                          value={editCardForm.back}
                          onChange={(e) => setEditCardForm({ ...editCardForm, back: e.target.value })}
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Back"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveCard(card.id)} className="text-xs text-green-400 hover:text-green-300 font-medium">Save</button>
                          <button onClick={() => setEditingCardId(null)} className="text-xs text-slate-400 hover:text-slate-300 font-medium">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{card.front}</p>
                          <p className="text-slate-400 text-xs truncate">{card.back}</p>
                        </div>
                        <div className="flex gap-2 ml-2 shrink-0">
                          <button
                            onClick={() => { setEditingCardId(card.id); setEditCardForm({ front: card.front, back: card.back }); }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCard(card.id)}
                            className="text-xs text-red-400 hover:text-red-300 font-medium"
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
            <button onClick={() => { setEditingDeck(null); load(); }} className="mt-4 w-full py-3 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition font-medium">Close</button>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShowAddCard(null)}>
          <form
            onSubmit={addCard}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-800 shadow-xl"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Add Card</h2>
            <div className="space-y-3">
              <input
                value={cardForm.front}
                onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })}
                placeholder="Front (word/phrase)"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={cardForm.back}
                onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })}
                placeholder="Back (translation)"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div>
                <label className="block text-xs text-slate-400 mb-1">Front image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFrontImage(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300 file:text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Back image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBackImage(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300 file:text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setShowAddCard(null)} className="flex-1 py-3 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition font-medium">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition font-medium">Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
