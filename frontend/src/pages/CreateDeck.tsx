import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import LanguageSelect from '../components/LanguageSelect';
import { BlobBackground } from '../components/Blobs';

export default function CreateDeck() {
  const [form, setForm] = useState({ name: '', source_lang: '', target_lang: '' });
  const navigate = useNavigate();

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    await api('/decks', { method: 'POST', body: JSON.stringify(form) });
    navigate('/');
  }

  return (
    <div className="p-4 pb-24 relative">
      <BlobBackground />
      <div className="relative z-10">
        <button onClick={() => navigate('/')} className="text-warm-500 hover:text-warm-700 font-semibold text-sm mb-4">
          &larr; Back
        </button>
        <form onSubmit={createDeck} className="bg-white rounded-2xl p-6 w-full max-w-sm mx-auto border border-warm-200 shadow-sm">
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
            <button type="button" onClick={() => navigate('/')} className="flex-1 py-3 rounded-xl text-warm-700 bg-warm-100 hover:bg-warm-200 transition font-semibold">Cancel</button>
            <button type="submit" className="flex-1 py-3 rounded-xl text-white bg-coral hover:bg-coral-hover transition font-bold shadow-sm">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
