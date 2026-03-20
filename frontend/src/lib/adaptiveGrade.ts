import { db } from '../db/dexie';

const MIN_REVIEWS = 20;
const MAX_TIMINGS = 200;

export async function computeGrade(responseTimeMs: number): Promise<number> {
  const timings = await db.reviewTimings.reverse().limit(MAX_TIMINGS).toArray();
  if (timings.length < MIN_REVIEWS) return 4;

  const times = timings.map((t: { response_time_ms: number }) => t.response_time_ms);
  const mean = times.reduce((a: number, b: number) => a + b, 0) / times.length;
  const variance = times.reduce((sum: number, t: number) => sum + (t - mean) ** 2, 0) / times.length;
  const stddev = Math.sqrt(variance);

  return responseTimeMs < mean - stddev ? 5 : 4;
}

export async function recordTiming(responseTimeMs: number): Promise<void> {
  await db.reviewTimings.add({ response_time_ms: responseTimeMs });

  const count = await db.reviewTimings.count();
  if (count > MAX_TIMINGS) {
    const oldest = await db.reviewTimings.orderBy('id').limit(count - MAX_TIMINGS).primaryKeys();
    await db.reviewTimings.bulkDelete(oldest);
  }
}
