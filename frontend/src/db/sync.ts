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

  // Upsert server decks, then remove local decks not on server
  if (decks.length > 0) {
    await db.decks.bulkPut(decks);
  }
  const serverDeckIds = new Set(decks.map((d) => d.id));
  const localDecks = await db.decks.toArray();
  const staleDeckIds = localDecks.filter((d) => !serverDeckIds.has(d.id)).map((d) => d.id);
  if (staleDeckIds.length > 0) {
    await db.decks.bulkDelete(staleDeckIds);
  }

  for (const deck of decks) {
    const cards = await api<CardRecord[]>(`/decks/${deck.id}/cards`);
    if (cards.length > 0) {
      await db.cards.bulkPut(cards);
    }
    // Remove local cards for this deck that are no longer on server
    const serverCardIds = new Set(cards.map((c) => c.id));
    const localCards = await db.cards.where('deck_id').equals(deck.id).toArray();
    const staleCardIds = localCards.filter((c) => !serverCardIds.has(c.id)).map((c) => c.id);
    if (staleCardIds.length > 0) {
      await db.cards.bulkDelete(staleCardIds);
    }
  }

  // Delete cards belonging to decks that no longer exist
  if (staleDeckIds.length > 0) {
    for (const deckId of staleDeckIds) {
      const orphanCards = await db.cards.where('deck_id').equals(deckId).toArray();
      if (orphanCards.length > 0) {
        await db.cards.bulkDelete(orphanCards.map((c) => c.id));
      }
    }
  }
}

export async function syncAll() {
  await pushSyncQueue();
  await pullData();
}
