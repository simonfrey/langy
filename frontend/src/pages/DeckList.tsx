import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiFormData } from '../lib/api';
import { formatLanguage } from '../lib/languages';
import LanguageSelect from '../components/LanguageSelect';

interface Deck {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

interface Card {
  id: string;
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
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const rawDecks = await api<Deck[]>('/decks');
      const enriched: DeckWithCounts[] = await Promise.all(
        rawDecks.map(async (d) => {
          const cards = await api<Card[]>(`/decks/${d.id}/cards`);
          const now = new Date();
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
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Your Decks</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
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
              <button
                onClick={(e) => { e.stopPropagation(); setShowAddCard(deck.id); }}
                className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
              >
                + Add Card
              </button>
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
