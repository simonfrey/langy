import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDeck } from "../db/mutations";
import { useHandDrawn } from "../hooks/useHandDrawn";
import { languagesApi } from "../lib/api";
import { formatPair } from "../lib/languages";
import type { LanguagePairResponse } from "../api";

export default function CreateDeck() {
  const [name, setName] = useState("");
  const [pairs, setPairs] = useState<LanguagePairResponse[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const handDrawnStyle = useHandDrawn();

  useEffect(() => {
    languagesApi()
      .listLanguagePairs()
      .then((data) => {
        setPairs(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load language pairs");
        setLoading(false);
      });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selectedIdx < 0) {
      setError("Please select a language pair");
      return;
    }
    const pair = pairs[selectedIdx];
    try {
      await createDeck({
        name,
        source_lang: pair.source_lang,
        target_lang: pair.target_lang,
      });
      navigate("/");
    } catch {
      setError(
        "Failed to create deck. Please check your connection and try again.",
      );
    }
  }

  return (
    <div className="p-4 pb-24 relative">
      <div className="relative z-10">
        <button
          onClick={() => navigate("/")}
          className="text-warm-500 hover:text-warm-700 font-semibold text-sm mb-4"
        >
          &larr; Back
        </button>
        <form
          onSubmit={handleCreate}
          className="bg-white hand-drawn p-6 w-full max-w-sm mx-auto shadow-sm"
          style={handDrawnStyle}
        >
          <h2 className="font-display text-xl font-bold text-warm-900 mb-4">
            New Deck
          </h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deck name"
              required
              className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral"
            />
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-1">
                Language pair
              </label>
              <select
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                required
                disabled={loading}
                className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 focus:outline-none focus:ring-2 focus:ring-coral"
              >
                <option value={-1}>
                  {loading ? "Loading..." : "Select languages"}
                </option>
                {pairs.map((p, i) => (
                  <option key={`${p.source_lang}-${p.target_lang}`} value={i}>
                    {formatPair(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-xl text-warm-700 bg-warm-100 hover:bg-warm-200 transition font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl text-white bg-coral hover:bg-coral-hover transition font-bold shadow-sm disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
