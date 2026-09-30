import { getSetting, saveSetting } from '../api/supabase/settings'
import type { TestingClock } from '../api/supabase/types'

export type { TestingClock }

let testingClockCache: TestingClock | null = null
let hasLoadedTestingClock = false
let testingClockRequest: Promise<TestingClock | null> | null = null

export const setTestingClockCache = (clock: TestingClock | null) => {
  testingClockCache = clock
  hasLoadedTestingClock = true
}

export async function getTestingClock(force = false): Promise<TestingClock | null> {
  if (!force && hasLoadedTestingClock) return testingClockCache
  if (!force && testingClockRequest) return testingClockRequest

  testingClockRequest = (async () => {
  try {
      const clock = await getSetting<TestingClock>('testing_clock')
      setTestingClockCache(clock)
      return clock
  } catch (err) {
    console.warn(err);
      return testingClockCache
    } finally {
      testingClockRequest = null
  }
  })()

  return testingClockRequest
}

export async function setTestingClock(payload: TestingClock) {
  await saveSetting('testing_clock', payload)
  setTestingClockCache(payload)
}

export async function getTime(): Promise<Date> {
  const tc = await getTestingClock();
  if (tc?.enabled) {
    try {
      const datePart = tc.date ?? new Date().toISOString().slice(0, 10);
      const timePart = tc.time ?? "00:00";
      const [y, m, d] = datePart.split("-").map((s) => Number(s));
      const [hh, mm] = timePart.split(":").map((s) => Number(s));
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        return new Date(y, (m ?? 1) - 1, d, hh ?? 0, mm ?? 0, 0);
      }
    } catch (err) {
      console.warn("failed to parse testing clock", err);
    }
  }
  return new Date();
}

export default {
  getTime,
  getTestingClock,
  setTestingClock,
};
