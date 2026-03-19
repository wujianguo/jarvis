/**
 * Convert a millisecond timestamp to an ISO 8601 string with +08:00 timezone offset.
 *
 * Beijing time (Asia/Shanghai, UTC+8) does NOT observe Daylight Saving Time,
 * so the UTC+8 offset is constant year-round. The arithmetic shift is safe.
 *
 * Note: `Date.prototype.toISOString()` always returns a UTC string regardless of
 * the runtime system timezone, so the result is environment-independent.
 */
export function toIso8601Beijing(ms: number): string {
  const OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, constant (no DST in China)
  const local = new Date(ms + OFFSET_MS);
  // toISOString() produces the UTC view of the shifted value; replace 'Z' with '+08:00'.
  return local.toISOString().replace('Z', '+08:00');
}
