import { db } from "./dexie";
import {
  syncApi,
  decksApi,
  cardsApi,
  cardToRecord,
  deckToRecord,
} from "../lib/api";

async function pushSyncQueue() {
  const items = await db.syncQueue.toArray();
  if (items.length === 0) return;

  const actions = items.map((item) => ({
    card_id: item.card_id,
    grade: item.grade,
    reviewed_at: new Date(item.reviewed_at),
    response_time_ms: item.response_time_ms,
  }));

  try {
    await syncApi().sync({
      SyncRequest: { actions },
    });
    await db.syncQueue.clear();
  } catch {
    // Will retry on next sync
  }
}

export async function pullData() {
  if (!navigator.onLine) return;

  const decks = await decksApi().listDecks();
  const deckRecords = decks.map(deckToRecord);

  // Upsert server decks, then remove local decks not on server
  if (deckRecords.length > 0) {
    await db.decks.bulkPut(deckRecords);
  }
  const serverDeckIds = new Set(deckRecords.map((d) => d.id));
  const localDecks = await db.decks.toArray();
  const staleDeckIds = localDecks
    .filter((d) => !serverDeckIds.has(d.id))
    .map((d) => d.id);
  if (staleDeckIds.length > 0) {
    await db.decks.bulkDelete(staleDeckIds);
  }

  for (const deck of deckRecords) {
    const cards = await cardsApi().listCards({ deckId: deck.id });
    const cardRecords = cards.map(cardToRecord);
    if (cardRecords.length > 0) {
      await db.cards.bulkPut(cardRecords);
    }
    // Remove local cards for this deck that are no longer on server
    const serverCardIds = new Set(cardRecords.map((c) => c.id));
    const localCards = await db.cards
      .where("deck_id")
      .equals(deck.id)
      .toArray();
    const staleCardIds = localCards
      .filter((c) => !serverCardIds.has(c.id))
      .map((c) => c.id);
    if (staleCardIds.length > 0) {
      await db.cards.bulkDelete(staleCardIds);
    }
  }

  // Delete cards belonging to decks that no longer exist
  if (staleDeckIds.length > 0) {
    for (const deckId of staleDeckIds) {
      const orphanCards = await db.cards
        .where("deck_id")
        .equals(deckId)
        .toArray();
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
