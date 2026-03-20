import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { db } from '../db/dexie';
import { saveCard, saveCardWithFormData, deleteCard as deleteCardMutation } from '../db/mutations';
import { useLiveQuery } from 'dexie-react-hooks';
import AuthImage from '../components/AuthImage';
import { BlobBackground } from '../components/Blobs';

export default function EditCards() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardForm, setEditCardForm] = useState({ front: '', back: '' });
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [error, setError] = useState('');

  const cards = useLiveQuery(
    () => deckId ? db.cards.where('deck_id').equals(deckId).toArray() : [],
    [deckId],
    [],
  );

  // Fetch from API and populate Dexie
  useEffect(() => {
    if (!deckId) return;
    api(`/decks/${deckId}/cards`)
      .then((serverCards: any) => {
        if (serverCards.length > 0) {
          db.cards.bulkPut(serverCards);
        }
      })
      .catch(() => {
        // Offline — useLiveQuery will show cached cards
      });
  }, [deckId]);

  async function handleSave(cardId: string) {
    if (!editCardForm.front || !editCardForm.back) return;
    setError('');
    try {
      if (frontImage || backImage) {
        const fd = new FormData();
        fd.append('front', editCardForm.front);
        fd.append('back', editCardForm.back);
        if (frontImage) fd.append('front_image', frontImage);
        if (backImage) fd.append('back_image', backImage);
        await saveCardWithFormData(cardId, fd);
      } else {
        await saveCard(cardId, editCardForm);
      }
      setEditingCardId(null);
      setFrontImage(null);
      setBackImage(null);
    } catch {
      setError('Failed to save card. Please check your connection and try again.');
    }
  }

  async function handleDelete(cardId: string) {
    setError('');
    try {
      await deleteCardMutation(cardId);
    } catch {
      setError('Failed to delete card. Please check your connection and try again.');
    }
  }

  return (
    <div className="p-4 pb-24 relative">
      <BlobBackground />
      <div className="relative z-10">
        <button onClick={() => navigate('/')} className="text-warm-500 hover:text-warm-700 font-semibold text-sm mb-4">
          &larr; Back
        </button>
        <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-auto border border-warm-200 shadow-sm">
          <h2 className="text-xl font-bold text-warm-900 mb-4">Edit Cards</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold ml-2">&times;</button>
            </div>
          )}
          <div className="space-y-2">
            {cards.length === 0 ? (
              <p className="text-warm-400 text-sm text-center py-4">No cards in this deck</p>
            ) : (
              cards.map((card) => (
                <div key={card.id} className="bg-warm-100 rounded-xl p-3">
                  {editingCardId === card.id ? (
                    <div className="space-y-2">
                      <input
                        value={editCardForm.front}
                        onChange={(e) => setEditCardForm({ ...editCardForm, front: e.target.value })}
                        className="w-full bg-white border border-warm-200 rounded-lg px-3 py-2 text-warm-900 text-sm focus:outline-none focus:ring-2 focus:ring-coral"
                        placeholder="Front"
                      />
                      <div>
                        <label className="block text-xs text-warm-500 mb-1 font-semibold">Front image</label>
                        {card.front_image_url && !frontImage && (
                          <AuthImage src={card.front_image_url} alt="" className="w-16 h-16 rounded object-cover mb-1" />
                        )}
                        {frontImage && (
                          <img src={URL.createObjectURL(frontImage)} alt="" className="w-16 h-16 rounded object-cover mb-1" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setFrontImage(e.target.files?.[0] ?? null)}
                          className="w-full text-xs text-warm-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-warm-100 file:text-warm-700 file:text-xs file:font-semibold"
                        />
                      </div>
                      <input
                        value={editCardForm.back}
                        onChange={(e) => setEditCardForm({ ...editCardForm, back: e.target.value })}
                        className="w-full bg-white border border-warm-200 rounded-lg px-3 py-2 text-warm-900 text-sm focus:outline-none focus:ring-2 focus:ring-coral"
                        placeholder="Back"
                      />
                      <div>
                        <label className="block text-xs text-warm-500 mb-1 font-semibold">Back image</label>
                        {card.back_image_url && !backImage && (
                          <AuthImage src={card.back_image_url} alt="" className="w-16 h-16 rounded object-cover mb-1" />
                        )}
                        {backImage && (
                          <img src={URL.createObjectURL(backImage)} alt="" className="w-16 h-16 rounded object-cover mb-1" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setBackImage(e.target.files?.[0] ?? null)}
                          className="w-full text-xs text-warm-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-warm-100 file:text-warm-700 file:text-xs file:font-semibold"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSave(card.id)} className="text-xs text-emerald-600 hover:text-emerald-500 font-bold">Save</button>
                        <button onClick={() => { setEditingCardId(null); setFrontImage(null); setBackImage(null); }} className="text-xs text-warm-500 hover:text-warm-700 font-semibold">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      {card.front_image_url && (
                        <AuthImage src={card.front_image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0 mr-3" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-warm-900 text-sm truncate font-semibold">{card.front}</p>
                        <p className="text-warm-500 text-xs truncate">{card.back}</p>
                      </div>
                      <div className="flex gap-2 ml-2 shrink-0">
                        <button
                          onClick={() => { setEditingCardId(card.id); setEditCardForm({ front: card.front, back: card.back }); setFrontImage(null); setBackImage(null); }}
                          className="text-xs text-coral hover:text-coral-hover font-bold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(card.id)}
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
        </div>
      </div>
    </div>
  );
}
