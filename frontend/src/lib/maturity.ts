import type { CardRecord } from "../db/dexie";

function classifyCard(card: CardRecord): 1 | 2 | 3 {
  if (card.repetitions <= 2 || card.interval_days <= 3) return 1;
  if (card.repetitions <= 5 || card.interval_days <= 14) return 2;
  return 3;
}

export function selectExerciseCards(
  cards: CardRecord[],
  count: number,
): { card: CardRecord; level: 1 | 2 | 3 }[] {
  const l1: CardRecord[] = [];
  const l2: CardRecord[] = [];
  const l3: CardRecord[] = [];

  for (const card of cards) {
    const level = classifyCard(card);
    if (level === 1) l1.push(card);
    else if (level === 2) l2.push(card);
    else l3.push(card);
  }

  // Shuffle each level
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const l1Shuffled = shuffle(l1);
  const l2Shuffled = shuffle(l2);
  const l3Shuffled = shuffle(l3);

  // Target: 30% L1, 50% L2, 20% L3
  const l1Count = Math.round(count * 0.3);
  const l3Count = Math.round(count * 0.2);
  const l2Count = count - l1Count - l3Count;

  const result: { card: CardRecord; level: 1 | 2 | 3 }[] = [];

  // Pick from each level, overflow to others if not enough
  const pick = (arr: CardRecord[], n: number, level: 1 | 2 | 3) => {
    for (let i = 0; i < Math.min(n, arr.length); i++) {
      result.push({ card: arr[i], level });
    }
    return Math.max(0, n - arr.length);
  };

  let overflow = pick(l1Shuffled, l1Count, 1);
  overflow += pick(l2Shuffled, l2Count + overflow, 2);
  pick(l3Shuffled, l3Count + overflow, 3);

  // Shuffle final result
  return shuffle(result);
}
