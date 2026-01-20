import { supabase } from "./supabaseClient";

export type TestingClock = {
  enabled: boolean;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
};

export async function getTestingClock(): Promise<TestingClock | null> {
  try {
    const { data, error } = await supabase.from("settings").select("value").eq("key", "testing_clock").maybeSingle();
    if (error) {
      console.warn("getTestingClock error", error);
    }
    if (data?.value) return data.value as TestingClock;
    return null;
  } catch (err) {
    console.warn(err);
    return null;
  }
}

export async function setTestingClock(payload: TestingClock) {
  await supabase.from("settings").upsert({ key: "testing_clock", value: payload });
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
