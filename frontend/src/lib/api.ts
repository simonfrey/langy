import {
  Configuration,
  AuthApi,
  DecksApi,
  CardsApi,
  ReviewApi,
  SyncApi,
  GenerateApi,
  ExercisesApi,
  ImagesApi,
} from "../api";
import type { Card, Deck, ExerciseResponse } from "../api";
import type { CardRecord, DeckRecord, ExerciseRecord } from "../db/dexie";

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

function getToken(): string | null {
  return localStorage.getItem("langy_token");
}

export function setToken(token: string) {
  localStorage.setItem("langy_token", token);
}

export function clearToken() {
  localStorage.removeItem("langy_token");
}

function handleUnauthorized() {
  clearToken();
  localStorage.removeItem("langy_user");
  onUnauthorized?.();
}

/** Shared API configuration with Bearer auth and 401 handling */
function apiConfig(): Configuration {
  return new Configuration({
    basePath: "/api",
    accessToken: getToken() ?? undefined,
    middleware: [
      {
        post: async (context) => {
          if (context.response.status === 401) {
            handleUnauthorized();
            throw new Error("Unauthorized");
          }
          return context.response;
        },
      },
    ],
  });
}

/** Get a configured API instance. Creates a new one each call to pick up current token. */
export const authApi = () => new AuthApi(apiConfig());
export const decksApi = () => new DecksApi(apiConfig());
export const cardsApi = () => new CardsApi(apiConfig());
export const reviewApi = () => new ReviewApi(apiConfig());
export const syncApi = () => new SyncApi(apiConfig());
export const generateApi = () => new GenerateApi(apiConfig());
export const exercisesApi = () => new ExercisesApi(apiConfig());
export const imagesApi = () => new ImagesApi(apiConfig());

/** Convert generated API Card (Date fields) to Dexie CardRecord (string fields) */
export function cardToRecord(card: Card): CardRecord {
  return {
    ...card,
    next_review: card.next_review.toISOString(),
    created_at: card.created_at.toISOString(),
    updated_at: card.updated_at.toISOString(),
  };
}

/** Convert generated API Deck (Date fields) to Dexie DeckRecord (string fields) */
export function deckToRecord(deck: Deck): DeckRecord {
  return {
    ...deck,
    created_at: deck.created_at.toISOString(),
  };
}

/** Convert generated ExerciseResponse to Dexie ExerciseRecord */
export function exerciseToRecord(
  ex: ExerciseResponse,
  sessionId: string,
): ExerciseRecord {
  return {
    ...ex,
    session_id: sessionId,
    completed: false,
  };
}
