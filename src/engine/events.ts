/*
 * Retrograde stations and shadow periods, from the same ephemeris as the charts. Instants are
 * UTC milliseconds, found to the minute. Ported from the COSINE chart engine.
 */
import * as Astronomy from "astronomy-engine";
import { lonOf, norm, type BodyId } from "./core.js";

const DAY = 864e5;
const MIN = 6e4;
export const lonAt = (b: BodyId, ms: number) => norm(lonOf(b, Astronomy.MakeTime(new Date(ms))));
/** daily motion in degrees (negative while retrograde) */
const speed = (b: BodyId, ms: number) => {
  const d = lonAt(b, ms + 3600e3) - lonAt(b, ms - 3600e3);
  return (((d + 540) % 360) - 180) * 12;
};

/** narrows [lo, hi] (where test(lo) is false and test(hi) true) to a minute */
function bisect(lo: number, hi: number, test: (ms: number) => boolean): number {
  while (hi - lo > MIN) {
    const mid = (lo + hi) / 2;
    if (test(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface Retrograde {
  /** stations: turning retrograde, turning direct */
  station: number;
  direct: number;
  /**
   * shadow: when the planet first reaches the degree where it will turn direct, and when it
   * gets back past the degree where it turned retrograde
   */
  shadowStart: number;
  shadowEnd: number;
  /** longitudes at the two stations */
  stationLon: number;
  directLon: number;
}

/** Retrograde periods whose retrograde station falls between two years (inclusive). */
export function retrogrades(b: BodyId, fromYear: number, toYear: number): Retrograde[] {
  const end = Date.UTC(toYear + 1, 0, 1);
  const out: Retrograde[] = [];
  let t = Date.UTC(fromYear, 0, 1);
  let retro = speed(b, t) < 0;
  let station = retro ? NaN : 0;
  for (let next = t + DAY; next <= end + 120 * DAY; t = next, next += DAY) {
    const r = speed(b, next) < 0;
    if (r === retro) continue;
    const at = bisect(t, next, (ms) => speed(b, ms) < 0 === r);
    if (r) {
      if (at >= end) break;
      station = at;
    } else if (!Number.isNaN(station) && station) {
      const sLon = lonAt(b, station),
        dLon = lonAt(b, at);
      // forward motion before the station: last time it passed the direct station's degree
      const before = (ms: number) => norm(lonAt(b, ms) - dLon) < 180;
      let lo = station - 90 * DAY;
      while (before(lo)) lo -= 30 * DAY;
      const shadowStart = bisect(lo, station, before);
      const after = (ms: number) =>
        norm(lonAt(b, ms) - sLon) < 180 && norm(lonAt(b, ms) - sLon) > 0;
      let hi = at + DAY;
      while (!after(hi)) hi += 7 * DAY;
      const shadowEnd = bisect(at, hi, after);
      out.push({ station, direct: at, shadowStart, shadowEnd, stationLon: sLon, directLon: dLon });
    }
    retro = r;
  }
  return out;
}
