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
}

class LangyDB extends Dexie {
  decks!: EntityTable<DeckRecord, 'id'>;
  cards!: EntityTable<CardRecord, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('langy');
    this.version(1).stores({
      decks: 'id, user_id',
      cards: 'id, deck_id, next_review',
      syncQueue: '++id, card_id',
    });
  }
}

export const db = new LangyDB();
