import Dexie, { type EntityTable } from 'dexie';

export interface DeckRecord {
  id: string;
  user_id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  created_at: string;
}

export interface CardRecord {
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
  front_image_url?: string;
  back_image_url?: string;
}

export interface SyncQueueItem {
  id?: number;
  card_id: string;
  grade: number;
  reviewed_at: string;
  response_time_ms?: number;
}

export interface ReviewTiming {
  id?: number;
  response_time_ms: number;
}

export interface ExerciseRecord {
  id: string;
  session_id: string;
  type: string;
  level: number;
  instruction: string;
  prompt: string;
  correct_answer: string;
  options?: string[];
  source_card_id: string;
  completed: boolean;
  user_answer?: string;
  correct?: boolean;
  feedback?: string;
}

class LangyDB extends Dexie {
  decks!: EntityTable<DeckRecord, 'id'>;
  cards!: EntityTable<CardRecord, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  reviewTimings!: EntityTable<ReviewTiming, 'id'>;
  exercises!: EntityTable<ExerciseRecord, 'id'>;

  constructor() {
    super('langy');
    this.version(1).stores({
      decks: 'id, user_id',
      cards: 'id, deck_id, next_review',
      syncQueue: '++id, card_id',
    });
    this.version(2).stores({
      decks: 'id, user_id',
      cards: 'id, deck_id, next_review',
      syncQueue: '++id, card_id',
      reviewTimings: '++id',
    });
    this.version(3).stores({
      decks: 'id, user_id',
      cards: 'id, deck_id, next_review',
      syncQueue: '++id, card_id',
      reviewTimings: '++id',
      exercises: 'id, session_id, completed',
    });
  }
}

export const db = new LangyDB();
