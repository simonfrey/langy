import { db } from './dexie';
import { api } from '../lib/api';

interface Deck {
  id: string;
  user_id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  created_at: string;
  updated_at: string;
}

export async function pushSyncQueue() {
  const items = await db.syncQueue.toArray();
  if (items.length === 0) return;

  const actions = items.map((item) => ({
    card_id: item.card_id,
    grade: item.grade,
    reviewed_at: item.reviewed_at,
  }));

  try {
    await api('/sync', {
      method: 'POST',
      body: JSON.stringify({ actions }),
    });
    await db.syncQueue.clear();
  } catch {
    // Will retry on next sync
  }
}

export async function pullData() {
  try {
    const decks = await api<Deck[]>('/decks');
    await db.decks.clear();
    if (decks.length > 0) {
      await db.decks.bulkPut(decks);
    }

    for (const deck of decks) {
      const cards = await api<Card[]>(`/decks/${deck.id}/cards`);
      if (cards.length > 0) {
        await db.cards.bulkPut(cards);
      }
    }
  } catch {
    // Offline - use cached data
  }
}

export async function syncAll() {
  await pushSyncQueue();
  await pullData();
}
