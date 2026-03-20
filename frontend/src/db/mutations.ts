import { db } from './dexie';
import type { DeckRecord, CardRecord } from './dexie';
import { api, apiFormData } from '../lib/api';
import { sm2 } from '../lib/sm2';
import { pullData } from './sync';

export async function createDeck(form: { name: string; source_lang: string; target_lang: string }) {
  const deck = await api<DeckRecord>('/decks', { method: 'POST', body: JSON.stringify(form) });
  await db.decks.put(deck);
  return deck;
}

export async function addCard(deckId: string, cardData: { front: string; back: string }) {
  const card = await api<CardRecord>(`/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify(cardData),
  });
  await db.cards.put(card);
  return card;
}

export async function addCardWithFormData(deckId: string, formData: FormData) {
  const card = await apiFormData<CardRecord>(`/decks/${deckId}/cards`, formData);
  await db.cards.put(card);
  return card;
}

export async function saveCard(cardId: string, data: { front: string; back: string }) {
  const updated = await api<CardRecord>(`/cards/${cardId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  await db.cards.put(updated);
  return updated;
}

export async function saveCardWithFormData(cardId: string, formData: FormData) {
  const updated = await apiFormData<CardRecord>(`/cards/${cardId}`, formData, 'PUT');
  await db.cards.put(updated);
  return updated;
}

export async function deleteCard(cardId: string) {
  await api(`/cards/${cardId}`, { method: 'DELETE' });
  await db.cards.delete(cardId);
}

export async function reviewCard(card: CardRecord, grade: number, responseTimeMs?: number | null) {
  const result = sm2({
    grade,
    repetitions: card.repetitions,
    easeFactor: card.ease_factor,
    intervalDays: card.interval_days,
  });

  const updated: CardRecord = {
    ...card,
    ease_factor: result.easeFactor,
    interval_days: result.intervalDays,
    repetitions: result.repetitions,
    next_review: result.nextReview.toISOString(),
    updated_at: new Date().toISOString(),
  };

  await db.cards.put(updated);
  await db.syncQueue.add({
    card_id: card.id,
    grade,
    reviewed_at: new Date().toISOString(),
    response_time_ms: responseTimeMs ?? undefined,
  });

  try {
    await api('/review', {
      method: 'POST',
      body: JSON.stringify({ card_id: card.id, grade, response_time_ms: responseTimeMs ?? undefined }),
    });
    const lastItem = await db.syncQueue.orderBy('id').last();
    if (lastItem?.id && lastItem.card_id === card.id) {
      await db.syncQueue.delete(lastItem.id);
    }
  } catch {
    // Will sync later
  }
}

export async function addCardFromGenerate(
  deckId: string,
  card: { front: string; back: string; front_image_base64?: string; front_image_type?: string },
) {
  const created = await api<CardRecord>(`/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify(card),
  });
  await db.cards.put(created);
  return created;
}

export async function refreshFromServer() {
  await pullData();
}
