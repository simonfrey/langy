import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDeck } from "../db/mutations";
import LanguageSelect from "../components/LanguageSelect";
import { useHandDrawn } from "../hooks/useHandDrawn";

export default function CreateDeck() {
  const [form, setForm] = useState({
    name: "",
    source_lang: "",
    target_lang: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const handDrawnStyle = useHandDrawn();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createDeck(form);
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Deck name"
              required
              className="w-full bg-warm-100 rounded-xl border border-warm-200 px-4 py-3 text-warm-900 placeholder-warm-400 focus:outline-none focus:ring-2 focus:ring-coral"
            />
            <LanguageSelect
              value={form.source_lang}
              onChange={(code) => setForm({ ...form, source_lang: code })}
              required
              label="I speak"
            />
            <LanguageSelect
              value={form.target_lang}
              onChange={(code) => setForm({ ...form, target_lang: code })}
              required
              label="I'm learning"
            />
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
              className="flex-1 py-3 rounded-xl text-white bg-coral hover:bg-coral-hover transition font-bold shadow-sm"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
