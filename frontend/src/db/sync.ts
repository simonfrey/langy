import { db } from './dexie';
import type { CardRecord, DeckRecord } from './dexie';
import { api } from '../lib/api';

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
  if (!navigator.onLine) return;

  const decks = await api<DeckRecord[]>('/decks');
  await db.decks.clear();
  if (decks.length > 0) {
    await db.decks.bulkPut(decks);
  }

  for (const deck of decks) {
    const cards = await api<CardRecord[]>(`/decks/${deck.id}/cards`);
    if (cards.length > 0) {
      await db.cards.bulkPut(cards);
    }
  }
}

export async function syncAll() {
  await pushSyncQueue();
  await pullData();
}
