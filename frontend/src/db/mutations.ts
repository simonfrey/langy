import { db } from "./dexie";
import type { CardRecord } from "./dexie";
import {
  decksApi,
  cardsApi,
  reviewApi,
  imagesApi,
  cardToRecord,
  deckToRecord,
} from "../lib/api";
import { sm2 } from "../lib/sm2";
import { pullData } from "./sync";

export async function createDeck(form: {
  name: string;
  source_lang: string;
  target_lang: string;
}) {
  const deck = await decksApi().createDeck({
    CreateDeckRequest: {
      name: form.name,
      source_lang: form.source_lang,
      target_lang: form.target_lang,
    },
  });
  const record = deckToRecord(deck);
  await db.decks.put(record);
  return record;
}

export async function addCard(
  deckId: string,
  cardData: { front: string; back: string },
) {
  const card = await cardsApi().createCard({
    deckId,
    CreateCardRequest: cardData,
  });
  const record = cardToRecord(card);
  await db.cards.put(record);
  return record;
}

export async function addCardWithFormData(deckId: string, formData: FormData) {
  const front = formData.get("front") as string;
  const back = formData.get("back") as string;
  const frontImageFile = formData.get("front_image") as File | null;
  const backImageFile = formData.get("back_image") as File | null;

  let front_image_id: string | undefined;
  let back_image_id: string | undefined;

  if (frontImageFile) {
    const res = await imagesApi().uploadImage({ image: frontImageFile });
    front_image_id = res.id;
  }
  if (backImageFile) {
    const res = await imagesApi().uploadImage({ image: backImageFile });
    back_image_id = res.id;
  }

  const card = await cardsApi().createCard({
    deckId,
    CreateCardRequest: { front, back, front_image_id, back_image_id },
  });
  const record = cardToRecord(card);
  await db.cards.put(record);
  return record;
}

export async function saveCard(
  cardId: string,
  data: { front: string; back: string },
) {
  await cardsApi().updateCard({
    id: cardId,
    UpdateCardRequest: data,
  });
  await db.cards.update(cardId, {
    front: data.front,
    back: data.back,
    updated_at: new Date().toISOString(),
  });
}

export async function saveCardWithFormData(cardId: string, formData: FormData) {
  const front = formData.get("front") as string;
  const back = formData.get("back") as string;
  const frontImageFile = formData.get("front_image") as File | null;
  const backImageFile = formData.get("back_image") as File | null;

  let front_image_id: string | undefined;
  let back_image_id: string | undefined;

  if (frontImageFile) {
    const res = await imagesApi().uploadImage({ image: frontImageFile });
    front_image_id = res.id;
  }
  if (backImageFile) {
    const res = await imagesApi().uploadImage({ image: backImageFile });
    back_image_id = res.id;
  }

  await cardsApi().updateCard({
    id: cardId,
    UpdateCardRequest: { front, back, front_image_id, back_image_id },
  });
  await db.cards.update(cardId, {
    front,
    back,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteCard(cardId: string) {
  await cardsApi().deleteCard({ id: cardId });
  await db.cards.delete(cardId);
}

export async function reviewCard(
  card: CardRecord,
  grade: number,
  responseTimeMs?: number | null,
) {
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
    await reviewApi().submitReview({
      ReviewRequest: {
        card_id: card.id,
        grade,
        response_time_ms: responseTimeMs ?? undefined,
      },
    });
    const lastItem = await db.syncQueue.orderBy("id").last();
    if (lastItem?.id && lastItem.card_id === card.id) {
      await db.syncQueue.delete(lastItem.id);
    }
  } catch {
    // Will sync later
  }
}

export async function addCardFromGenerate(
  deckId: string,
  card: {
    front: string;
    back: string;
    front_image_base64?: string;
    front_image_type?: string;
  },
) {
  const created = await cardsApi().createCard({
    deckId,
    CreateCardRequest: {
      front: card.front,
      back: card.back,
    },
  });
  const record = cardToRecord(created);
  await db.cards.put(record);
  return record;
}

export async function refreshFromServer() {
  await pullData();
}
