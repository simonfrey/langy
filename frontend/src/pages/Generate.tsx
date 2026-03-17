import { useEffect, useState } from 'react';
import { api, apiFormData } from '../lib/api';
import { formatLanguage } from '../lib/languages';
import { useOffline } from '../hooks/useOffline';
import OfflineBanner from '../components/OfflineBanner';

interface Deck {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
}

interface GeneratedCard {
  front: string;
  back: string;
  front_image_base64?: string;
  front_image_type?: string;
}

interface PendingCard extends GeneratedCard {
  selected: boolean;
}

export default function Generate() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [generateImages, setGenerateImages] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const isOffline = useOffline();

  useEffect(() => {
    api<Deck[]>('/decks').then((d) => {
      setDecks(d);
      if (d.length > 0) setDeckId(d[0].id);
    }).catch(() => {});
  }, []);

  const selectedDeck = decks.find((d) => d.id === deckId);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setPendingCards([]);
    try {
      let cards: GeneratedCard[];
      if (images.length > 0) {
        const fd = new FormData();
        fd.append('prompt', prompt);
        fd.append('source_lang', selectedDeck?.source_lang || '');
        fd.append('target_lang', selectedDeck?.target_lang || '');
        fd.append('deck_id', deckId);
        fd.append('generate_images', String(generateImages));
        images.forEach((img) => fd.append('images', img));
        cards = await apiFormData<GeneratedCard[]>('/generate', fd);
      } else {
        cards = await api<GeneratedCard[]>('/generate', {
          method: 'POST',
          body: JSON.stringify({
            prompt,
            source_lang: selectedDeck?.source_lang || '',
            target_lang: selectedDeck?.target_lang || '',
            deck_id: deckId,
            generate_images: generateImages,
          }),
        });
      }
      setPendingCards(cards.map((c) => ({ ...c, selected: true })));
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  function updateCard(index: number, updates: Partial<PendingCard>) {
    setPendingCards((prev) => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }

  function toggleAll(selected: boolean) {
    setPendingCards((prev) => prev.map((c) => ({ ...c, selected })));
  }

  async function handleSaveSelected() {
    const selected = pendingCards.filter((c) => c.selected);
    if (selected.length === 0) return;

    setSaving(true);
    setSaveProgress({ done: 0, total: selected.length });
    setError('');

    let saved = 0;
    for (const card of selected) {
      try {
        await api(`/decks/${deckId}/cards`, {
          method: 'POST',
          body: JSON.stringify({
            front: card.front,
            back: card.back,
            front_image_base64: card.front_image_base64 || undefined,
            front_image_type: card.front_image_type || undefined,
          }),
        });
        saved++;
        setSaveProgress({ done: saved, total: selected.length });
      } catch {
        setError(`Failed to save card "${card.front}". ${saved} of ${selected.length} saved.`);
        break;
      }
    }

    if (saved === selected.length) {
      setPendingCards([]);
      setPrompt('');
    }
    setSaving(false);
  }

  const selectedCount = pendingCards.filter((c) => c.selected).length;

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold text-white mb-6">Generate Cards</h1>

      {isOffline && <div className="mb-4"><OfflineBanner blocking message="You are offline. Card generation requires an internet connection." /></div>}

      <form onSubmit={handleGenerate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Deck</label>
          <select
            value={deckId}
            onChange={(e) => setDeckId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {selectedDeck && (
          <p className="text-slate-400 text-sm">
            {formatLanguage(selectedDeck.source_lang)} → {formatLanguage(selectedDeck.target_lang)}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            placeholder="e.g. Common greetings, food vocabulary, travel phrases..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Images (optional context)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages(Array.from(e.target.files || []))}
            className="w-full text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-300 file:text-sm"
          />
          {images.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img
                    src={URL.createObjectURL(img)}
                    alt=""
                    className="h-16 w-16 object-cover rounded-lg border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 bg-slate-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500 transition"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={generateImages}
              onChange={(e) => setGenerateImages(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-700 rounded-full peer-checked:bg-indigo-600 transition" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5" />
          </div>
          <span className="text-sm text-slate-300">Generate images for cards</span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !deckId || saving || isOffline}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </span>
          ) : (
            'Generate Cards'
          )}
        </button>
      </form>

      {pendingCards.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Review {pendingCards.length} generated cards
            </h2>
            <button
              type="button"
              onClick={() => toggleAll(selectedCount < pendingCards.length)}
              className="text-xs text-slate-400 hover:text-white transition px-2 py-1"
            >
              {selectedCount === pendingCards.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-3">
            {pendingCards.map((card, i) => (
              <div
                key={i}
                className={`bg-slate-900 border rounded-xl p-4 transition ${card.selected ? 'border-indigo-500/50' : 'border-slate-800 opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={card.selected}
                    onChange={(e) => updateCard(i, { selected: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="flex-1 space-y-2">
                    {card.front_image_base64 && (
                      <img
                        src={`data:${card.front_image_type};base64,${card.front_image_base64}`}
                        alt=""
                        className="h-20 w-20 object-cover rounded-lg border border-slate-700"
                      />
                    )}
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Front</label>
                      <input
                        value={card.front}
                        onChange={(e) => updateCard(i, { front: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Back</label>
                      <input
                        value={card.back}
                        onChange={(e) => updateCard(i, { back: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleSaveSelected}
              disabled={saving || selectedCount === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving {saveProgress.done}/{saveProgress.total}...
                </span>
              ) : (
                `Add ${selectedCount} Card${selectedCount !== 1 ? 's' : ''} to Deck`
              )}
            </button>
            <button
              type="button"
              onClick={() => setPendingCards([])}
              disabled={saving}
              className="px-4 py-3 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
