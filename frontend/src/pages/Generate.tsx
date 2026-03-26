import { useEffect, useState, useMemo } from "react";
import { api, apiFormData } from "../lib/api";
import { formatLanguage } from "../lib/languages";
import { useOffline } from "../hooks/useOffline";
import OfflineBanner from "../components/OfflineBanner";
import { SparkleIllustration } from "../components/Blobs";
import { useDecksWithCounts } from "../hooks/useDecks";
import { addCardFromGenerate } from "../db/mutations";
import { useHandDrawn, getHandDrawnStyle } from "../hooks/useHandDrawn";

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
  const decks = useDecksWithCounts();
  const [deckId, setDeckId] = useState("");
  const [mode, setMode] = useState<"vocabulary" | "grammar">("vocabulary");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [generateImages, setGenerateImages] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const isOffline = useOffline();
  const formStyle = useHandDrawn();
  const fromDeckStyle = useHandDrawn();

  const pendingCardStyles = useMemo(
    () => pendingCards.map(() => getHandDrawnStyle()),
    [pendingCards.length],
  );

  useEffect(() => {
    if (decks.length > 0 && !deckId) setDeckId(decks[0].id);
  }, [decks, deckId]);

  const selectedDeck = decks.find((d) => d.id === deckId);

  async function handleGenerateFromDeck() {
    if (!selectedDeck) return;
    setError("");
    setLoading(true);
    setPendingCards([]);
    try {
      const cards = await api<GeneratedCard[]>("/generate", {
        method: "POST",
        body: JSON.stringify({
          from_deck: true,
          source_lang: selectedDeck.source_lang,
          target_lang: selectedDeck.target_lang,
          deck_id: deckId,
          generate_images: generateImages,
          mode,
        }),
      });
      setPendingCards(cards.map((c) => ({ ...c, selected: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setPendingCards([]);
    try {
      let cards: GeneratedCard[];
      if (images.length > 0) {
        const fd = new FormData();
        fd.append("prompt", prompt);
        fd.append("source_lang", selectedDeck?.source_lang || "");
        fd.append("target_lang", selectedDeck?.target_lang || "");
        fd.append("deck_id", deckId);
        fd.append("generate_images", String(generateImages));
        fd.append("mode", mode);
        images.forEach((img) => fd.append("images", img));
        cards = await apiFormData<GeneratedCard[]>("/generate", fd);
      } else {
        cards = await api<GeneratedCard[]>("/generate", {
          method: "POST",
          body: JSON.stringify({
            prompt,
            source_lang: selectedDeck?.source_lang || "",
            target_lang: selectedDeck?.target_lang || "",
            deck_id: deckId,
            generate_images: generateImages,
            mode,
          }),
        });
      }
      setPendingCards(cards.map((c) => ({ ...c, selected: true })));
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function updateCard(index: number, updates: Partial<PendingCard>) {
    setPendingCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    );
  }

  function toggleAll(selected: boolean) {
    setPendingCards((prev) => prev.map((c) => ({ ...c, selected })));
  }

  async function handleSaveSelected() {
    const selected = pendingCards.filter((c) => c.selected);
    if (selected.length === 0) return;

    setSaving(true);
    setSaveProgress({ done: 0, total: selected.length });
    setError("");

    let saved = 0;
    for (const card of selected) {
      try {
        await addCardFromGenerate(deckId, {
          front: card.front,
          back: card.back,
          front_image_base64: card.front_image_base64 || undefined,
          front_image_type: card.front_image_type || undefined,
        });
        saved++;
        setSaveProgress({ done: saved, total: selected.length });
      } catch {
        setError(
          `Failed to save card "${card.front}". ${saved} of ${selected.length} saved.`,
        );
        break;
      }
    }

    if (saved === selected.length) {
      setPendingCards([]);
      setPrompt("");
    }
    setSaving(false);
  }

  const selectedCount = pendingCards.filter((c) => c.selected).length;

  return (
    <div className="p-4 pb-24 relative">
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <SparkleIllustration className="w-16 h-16 shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold text-warm-900">
              Generate Cards
            </h1>
            <p className="text-warm-500 text-sm">
              Use AI to create flashcards for any topic.
            </p>
          </div>
        </div>

        {isOffline && (
          <div className="mb-4">
            <OfflineBanner
              blocking
              message="You are offline. Card generation requires an internet connection."
            />
          </div>
        )}

        <form
          onSubmit={handleGenerate}
          className="bg-white hand-drawn p-5 shadow-sm space-y-4"
          style={formStyle}
        >
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1">
              Deck
            </label>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              required
              className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 focus:outline-none focus:ring-2 focus:ring-coral"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {selectedDeck && (
            <p className="text-warm-500 text-sm font-semibold">
              {formatLanguage(selectedDeck.source_lang)} →{" "}
              {formatLanguage(selectedDeck.target_lang)}
            </p>
          )}

          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1">
              Card Type
            </label>
            <div className="flex rounded-xl overflow-hidden border border-warm-200">
              {(["vocabulary", "grammar"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm font-semibold transition ${mode === m ? "bg-coral text-white" : "bg-warm-100 text-warm-600 hover:bg-warm-200"}`}
                >
                  {m === "vocabulary" ? "Vocabulary" : "Grammar"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              rows={3}
              placeholder="e.g. Common greetings, food vocabulary, travel phrases..."
              className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral resize-none"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {(mode === "grammar"
                ? [
                    "Present tense conjugation",
                    "Past tense rules",
                    "Word order",
                    "Cases & declension",
                    "Subjunctive mood",
                    "Common prepositions",
                  ]
                : [
                    "Food & drinks",
                    "Travel basics",
                    "Common greetings",
                    "Numbers 1-100",
                    "Daily routines",
                    "At the restaurant",
                  ]
              ).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setPrompt(chip)}
                  className="text-xs bg-warm-100 hover:bg-warm-200 text-warm-600 font-semibold px-3 py-1.5 rounded-full transition border border-warm-200"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-1">
              Images (optional context)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(Array.from(e.target.files || []))}
              className="w-full text-sm text-warm-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-warm-100 file:text-warm-700 file:text-sm file:font-semibold"
            />
            {images.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(img)}
                      alt=""
                      className="h-16 w-16 object-cover rounded-xl border border-warm-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages(images.filter((_, j) => j !== i))
                      }
                      className="absolute -top-1.5 -right-1.5 bg-warm-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500 transition"
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
              <div className="w-10 h-5 bg-warm-300 rounded-full peer-checked:bg-coral transition" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5 shadow-sm" />
            </div>
            <span className="text-sm text-warm-700 font-semibold">
              Generate images for cards
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !deckId || saving || isOffline}
            className="w-full bg-coral hover:bg-coral-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              "Generate Cards"
            )}
          </button>
        </form>

        {selectedDeck && selectedDeck.cardCount >= 30 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-warm-300" />
              <span className="text-warm-400 text-sm font-semibold">or</span>
              <div className="flex-1 h-px bg-warm-300" />
            </div>

            <div
              className="bg-white hand-drawn p-5 shadow-sm space-y-4"
              style={fromDeckStyle}
            >
              <p className="text-sm text-warm-600">
                Generate 10 more cards based on the{" "}
                <span className="font-semibold">
                  {selectedDeck.cardCount} existing cards
                </span>{" "}
                in this deck.
              </p>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={generateImages}
                    onChange={(e) => setGenerateImages(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-warm-300 rounded-full peer-checked:bg-coral transition" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition peer-checked:translate-x-5 shadow-sm" />
                </div>
                <span className="text-sm text-warm-700 font-semibold">
                  Generate images for cards
                </span>
              </label>

              <button
                type="button"
                onClick={handleGenerateFromDeck}
                disabled={loading || !deckId || saving || isOffline}
                className="w-full bg-coral hover:bg-coral-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </span>
                ) : (
                  "Generate Cards from Deck Content"
                )}
              </button>
            </div>
          </>
        )}

        {pendingCards.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-warm-900">
                Review {pendingCards.length} generated cards
              </h2>
              <button
                type="button"
                onClick={() => toggleAll(selectedCount < pendingCards.length)}
                className="text-xs text-warm-500 hover:text-warm-900 transition px-2 py-1 font-semibold"
              >
                {selectedCount === pendingCards.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-3">
              {pendingCards.map((card, i) => (
                <div
                  key={i}
                  className={`bg-white hand-drawn p-4 transition shadow-sm ${card.selected ? "!border-coral/40" : "opacity-60"}`}
                  style={pendingCardStyles[i]}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={card.selected}
                      onChange={(e) =>
                        updateCard(i, { selected: e.target.checked })
                      }
                      className="mt-1 w-4 h-4 rounded border-warm-300 bg-warm-100 text-coral focus:ring-coral focus:ring-offset-0 cursor-pointer accent-coral"
                    />
                    <div className="flex-1 space-y-2">
                      {card.front_image_base64 && (
                        <img
                          src={`data:${card.front_image_type};base64,${card.front_image_base64}`}
                          alt=""
                          className="h-20 w-20 object-cover rounded-xl border border-warm-200"
                        />
                      )}
                      <div>
                        <label className="block text-xs text-warm-400 mb-0.5 font-semibold">
                          Front
                        </label>
                        <input
                          value={card.front}
                          onChange={(e) =>
                            updateCard(i, { front: e.target.value })
                          }
                          className="w-full bg-warm-100 border border-warm-200 rounded-lg px-3 py-2 text-warm-900 text-sm focus:outline-none focus:ring-1 focus:ring-coral"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-warm-400 mb-0.5 font-semibold">
                          Back
                        </label>
                        <input
                          value={card.back}
                          onChange={(e) =>
                            updateCard(i, { back: e.target.value })
                          }
                          className="w-full bg-warm-100 border border-warm-200 rounded-lg px-3 py-2 text-warm-900 text-sm focus:outline-none focus:ring-1 focus:ring-coral"
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
                className="flex-1 bg-coral hover:bg-coral-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition shadow-sm"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving {saveProgress.done}/{saveProgress.total}...
                  </span>
                ) : (
                  `Add ${selectedCount} Card${selectedCount !== 1 ? "s" : ""} to Deck`
                )}
              </button>
              <button
                type="button"
                onClick={() => setPendingCards([])}
                disabled={saving}
                className="px-4 py-3 text-warm-500 hover:text-warm-900 rounded-xl border-2 border-warm-200 hover:border-warm-300 transition disabled:opacity-50 font-semibold"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
