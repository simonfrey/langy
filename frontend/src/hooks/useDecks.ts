import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';

export function useDecks() {
  return useLiveQuery(() => db.decks.toArray()) ?? [];
}

export function useHasDecks() {
  return useLiveQuery(() => db.decks.count().then((c) => c > 0)) ?? false;
}

export interface DeckWithCounts {
  id: string;
  user_id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
  cardCount: number;
  dueCount: number;
}

export function useDecksWithCounts() {
  return useLiveQuery(async () => {
    const decks = await db.decks.toArray();
    const now = new Date();
    return Promise.all(
      decks.map(async (d) => {
        const cards = await db.cards.where('deck_id').equals(d.id).toArray();
        const dueCount = cards.filter((c) => new Date(c.next_review) <= now).length;
        return { ...d, cardCount: cards.length, dueCount } as DeckWithCounts;
      }),
    );
  }) ?? [];
}
