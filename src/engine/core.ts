/*
 * Chart core: planet longitudes, ASC/MC, houses and aspects from astronomy-engine.
 *
 * Ported from the COSINE chart engine (https://www.cosineastro.com). The arithmetic is kept in
 * the same order as the original; tests/reference.test.ts checks every position against Swiss
 * Ephemeris reference values to within 1′ of arc. Only labels were changed (English names).
 */
import * as Astronomy from "astronomy-engine";

const D = Math.PI / 180;
export const norm = (x: number): number => ((x % 360) + 360) % 360;

export const BODIES = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
] as const;
export type BodyId = (typeof BODIES)[number];

/** Local civil birth time. `hh`/`mm` are null when the time is unknown. */
export interface BirthInput {
  y: number;
  m: number;
  d: number;
  hh: number | null;
  mm: number | null;
  lat: number;
  lon: number;
  /** IANA time zone, e.g. "Asia/Shanghai" */
  zone: string;
}

export interface Planet {
  id: BodyId;
  /** geocentric apparent ecliptic longitude of date, degrees */
  lon: number;
  retro: boolean;
  /** 1–12; only present when the birth time is known */
  house?: number;
}

export interface AspectType {
  key: "conj" | "sext" | "squa" | "trin" | "oppo";
  name: string;
  angle: number;
  orb: number;
  kind: "conj" | "soft" | "hard";
}

export interface Aspect {
  a: BodyId;
  b: BodyId;
  type: AspectType;
  /** distance from the exact angle, degrees */
  orb: number;
}

export type HouseSystem = "Placidus" | "Whole Sign";

export interface Chart {
  known: boolean;
  /** birth instant, UTC milliseconds */
  utc: number;
  /** zone offset at that instant, minutes east of UTC (DST included) */
  offsetMin: number;
  planets: Planet[];
  asc: number | null;
  mc: number | null;
  /** cusps of houses 1–12, degrees */
  cusps: number[] | null;
  system: HouseSystem | null;
  /** Moon at local 00:00 and 24 hours later, when the birth time is unknown */
  moonRange: [number, number] | null;
  aspects: Aspect[];
}

export interface Angles {
  ramc: number;
  /** true obliquity of the ecliptic, radians */
  eps: number;
  mc: number;
  asc: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/* Offset (ms) of an IANA zone at a UTC instant, from the runtime's tz database. */
function zoneOffsetMs(utcMs: number, zone: string): number {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(zone, f);
  }
  const p: Record<string, string> = {};
  f.formatToParts(new Date(utcMs)).forEach((x) => {
    p[x.type] = x.value;
  });
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** zone offset at a UTC instant, minutes east of UTC */
export const offsetMinutes = (utcMs: number, zone: string): number =>
  Math.round(zoneOffsetMs(utcMs, zone) / 60000);

/** Local civil time in a zone -> UTC ms (historical DST respected). */
export function localToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  zone: string,
): { utc: number; offsetMin: number } {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const off = zoneOffsetMs(guess, zone);
  let utc = guess - off;
  const off2 = zoneOffsetMs(utc, zone);
  if (off2 !== off) utc = guess - off2;
  return { utc, offsetMin: Math.round(zoneOffsetMs(utc, zone) / 60000) };
}

/** geocentric apparent ecliptic longitude of date, degrees */
export function lonOf(body: BodyId, time: Astronomy.AstroTime): number {
  if (body === "Sun") return Astronomy.SunPosition(time).elon;
  const v = Astronomy.GeoVector(Astronomy.Body[body], time, true);
  return Astronomy.Ecliptic(v).elon;
}

/* true obliquity of the ecliptic (nutation included), degrees, as Swiss Ephemeris uses for the
 * angles; the mean obliquity alone put the Ascendant 1.2′ off at 69° N (Murmansk, 1977) */
function obliquity(time: Astronomy.AstroTime): number {
  return Astronomy.e_tilt(time).tobl;
}

export function angles(time: Astronomy.AstroTime, lat: number, lon: number): Angles {
  const eps = obliquity(time) * D;
  const ramc = norm(Astronomy.SiderealTime(time) * 15 + lon);
  const th = ramc * D,
    ph = lat * D;
  const mc = norm(Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(eps)) / D);
  let asc = norm(
    Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(eps) + Math.tan(ph) * Math.sin(eps))) / D,
  );
  if (norm(asc - mc) > 180) asc = norm(asc + 180);
  return { ramc, eps, mc, asc };
}

/** Placidus cusps; null inside the polar circles where the system is undefined. */
export function placidus(a: Angles, lat: number): number[] | null {
  const ph = lat * D,
    eps = a.eps;
  function cusp(kind: "up" | "down", frac: number): number | null {
    let ra = kind === "up" ? a.ramc + frac * 90 : a.ramc + 180 - frac * 90;
    let lam = 0;
    for (let i = 0; i < 40; i++) {
      const r = ra * D;
      lam = Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(eps));
      const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
      const x = -Math.tan(ph) * Math.tan(dec);
      if (x < -1 || x > 1) return null;
      const dsa = Math.acos(x) / D;
      const next = kind === "up" ? a.ramc + frac * dsa : a.ramc + 180 - frac * (180 - dsa);
      if (Math.abs(next - ra) < 1e-7) {
        ra = next;
        break;
      }
      ra = next;
    }
    return norm(lam / D);
  }
  const c11 = cusp("up", 1 / 3),
    c12 = cusp("up", 2 / 3),
    c2 = cusp("down", 2 / 3),
    c3 = cusp("down", 1 / 3);
  if (c11 === null || c12 === null || c2 === null || c3 === null) return null;
  const c = [a.asc, c2, c3, norm(a.mc + 180), norm(c11 + 180), norm(c12 + 180)];
  for (let i = 0; i < 6; i++) c.push(norm(c[i] + 180));
  // cusps must advance monotonically round the zodiac
  for (let k = 0; k < 12; k++) {
    const span = norm(c[(k + 1) % 12] - c[k]);
    if (span <= 0 || span >= 180) return null;
  }
  return c;
}

export function wholeSign(asc: number): number[] {
  const start = Math.floor(asc / 30) * 30,
    c: number[] = [];
  for (let i = 0; i < 12; i++) c.push(norm(start + i * 30));
  return c;
}

export function houseOf(lon: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const span = norm(cusps[(i + 1) % 12] - cusps[i]);
    if (norm(lon - cusps[i]) < span) return i + 1;
  }
  return 1;
}

export const ASPECTS: readonly AspectType[] = [
  { key: "conj", name: "conjunction", angle: 0, orb: 8, kind: "conj" },
  { key: "sext", name: "sextile", angle: 60, orb: 4, kind: "soft" },
  { key: "squa", name: "square", angle: 90, orb: 6, kind: "hard" },
  { key: "trin", name: "trine", angle: 120, orb: 6, kind: "soft" },
  { key: "oppo", name: "opposition", angle: 180, orb: 8, kind: "hard" },
];

export function compute(inp: BirthInput): Chart {
  const known = inp.hh !== null && inp.hh !== undefined;
  const t = localToUtc(
    inp.y,
    inp.m,
    inp.d,
    known ? (inp.hh as number) : 12,
    known ? (inp.mm ?? 0) : 0,
    inp.zone,
  );
  const time = Astronomy.MakeTime(new Date(t.utc));
  const later = Astronomy.MakeTime(new Date(t.utc + 3600000));
  const planets: Planet[] = BODIES.map((b) => {
    const lon = norm(lonOf(b, time));
    const d = norm(lonOf(b, later) - lon + 180) - 180;
    return { id: b, lon, retro: d < 0 && b !== "Sun" && b !== "Moon" };
  });
  const out: Chart = {
    known,
    utc: t.utc,
    offsetMin: t.offsetMin,
    planets,
    asc: null,
    mc: null,
    cusps: null,
    system: null,
    moonRange: null,
    aspects: [],
  };
  if (known) {
    const a = angles(time, inp.lat, inp.lon);
    const c = placidus(a, inp.lat);
    const cusps = c || wholeSign(a.asc);
    out.asc = a.asc;
    out.mc = a.mc;
    out.cusps = cusps;
    out.system = c ? "Placidus" : "Whole Sign";
    planets.forEach((p) => {
      p.house = houseOf(p.lon, cusps);
    });
  } else {
    // Moon moves ~13°/day: report where it was at local 00:00 and 24 hours later
    const t0 = localToUtc(inp.y, inp.m, inp.d, 0, 0, inp.zone).utc;
    const a0 = norm(lonOf("Moon", Astronomy.MakeTime(new Date(t0))));
    const a1 = norm(lonOf("Moon", Astronomy.MakeTime(new Date(t0 + 86400000))));
    out.moonRange = [a0, a1];
  }
  const asp: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      let diff = Math.abs(planets[i].lon - planets[j].lon) % 360;
      if (diff > 180) diff = 360 - diff;
      for (let k = 0; k < ASPECTS.length; k++) {
        const orb = Math.abs(diff - ASPECTS[k].angle);
        if (orb <= ASPECTS[k].orb)
          asp.push({ a: planets[i].id, b: planets[j].id, type: ASPECTS[k], orb });
      }
    }
  }
  out.aspects = asp;
  return out;
}

/** shortest distance between two longitudes, 0–180 */
export const separation = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b)) % 360;
  return d > 180 ? 360 - d : d;
};

/** degrees per day at an instant, from the positions an hour either side; negative = retrograde */
export function speeds(utc: number): Record<BodyId, number> {
  const before = Astronomy.MakeTime(new Date(utc - 3600000)),
    after = Astronomy.MakeTime(new Date(utc + 3600000));
  const out = {} as Record<BodyId, number>;
  for (const b of BODIES)
    out[b] = ((norm(lonOf(b, after) - lonOf(b, before) + 180) - 180) / 2) * 24;
  return out;
}

/**
 * Applying (the two are still closing on the exact angle) or separating, from their daily
 * motions. A point that does not move here (an angle, or a natal point) passes 0.
 */
export function applying(
  lonA: number,
  speedA: number,
  lonB: number,
  speedB: number,
  angle: number,
): boolean {
  const dt = 0.01; // days
  const now = Math.abs(separation(lonA, lonB) - angle);
  const next = Math.abs(separation(lonA + speedA * dt, lonB + speedB * dt) - angle);
  return next < now;
}
