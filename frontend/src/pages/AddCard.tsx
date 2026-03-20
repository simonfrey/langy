import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiFormData } from '../lib/api';
import { BlobBackground } from '../components/Blobs';

export default function AddCard() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [cardForm, setCardForm] = useState({ front: '', back: '' });
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!deckId) return;
    if (frontImage || backImage) {
      const fd = new FormData();
      fd.append('front', cardForm.front);
      fd.append('back', cardForm.back);
      if (frontImage) fd.append('front_image', frontImage);
      if (backImage) fd.append('back_image', backImage);
      await apiFormData(`/decks/${deckId}/cards`, fd);
    } else {
      await api(`/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify(cardForm) });
    }
    navigate('/');
  }

  return (
    <div className="p-4 pb-24 relative">
      <BlobBackground />
      <div className="relative z-10">
        <button onClick={() => navigate('/')} className="text-warm-500 hover:text-warm-700 font-semibold text-sm mb-4">
          &larr; Back
        </button>
        <form onSubmit={addCard} className="bg-white rounded-2xl p-6 w-full max-w-sm mx-auto border border-warm-200 shadow-sm">
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
            <button type="button" onClick={() => navigate('/')} className="flex-1 py-3 rounded-xl text-warm-700 bg-warm-100 hover:bg-warm-200 transition font-semibold">Cancel</button>
            <button type="submit" className="flex-1 py-3 rounded-xl text-white bg-coral hover:bg-coral-hover transition font-bold shadow-sm">Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}
