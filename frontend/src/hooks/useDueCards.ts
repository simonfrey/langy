import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import type { CardRecord } from "../db/dexie";

export function useDueCards() {
  return (
    useLiveQuery(async () => {
      const allCards = await db.cards.toArray();
      const now = new Date();

      const dueCards = allCards.filter(
        (c) => c.repetitions > 0 && new Date(c.next_review) <= now,
      );
      const newCards = allCards.filter((c) => c.repetitions === 0);

      const result: CardRecord[] = [];
      const maxLen = Math.max(dueCards.length, newCards.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < dueCards.length) result.push(dueCards[i]);
        if (i < newCards.length) result.push(newCards[i]);
      }

      if (result.length < 10) {
        const upcoming = allCards
          .filter((c) => c.repetitions > 0 && new Date(c.next_review) > now)
          .sort(
            (a, b) =>
              new Date(a.next_review).getTime() -
              new Date(b.next_review).getTime(),
          );
        for (const c of upcoming) {
          if (result.length >= 10) break;
          if (!result.some((r) => r.id === c.id)) result.push(c);
        }
      }

      // Shuffle
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }

      return result;
    }) ?? []
  );
}
