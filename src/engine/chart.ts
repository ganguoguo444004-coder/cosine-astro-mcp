/*
 * From tool arguments to a cast chart: validating the date, time, place and zone, the house
 * system choice, and the element / modality balance.
 */
import {
  applying,
  compute,
  houseOf,
  speeds,
  wholeSign,
  type BodyId,
  type Chart,
  type HouseSystem,
} from "./core.js";
import { findCity, type City } from "./cities.js";
import {
  coord,
  ELEMENTS,
  lonInfo,
  MODES,
  offsetLabel,
  position,
  round,
  signIndex,
  signOf,
  type Element,
  type Mode,
} from "./format.js";

export class InputError extends Error {}

export interface BirthArgs {
  date: string;
  time?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  house_system?: "placidus" | "whole_sign";
}

export interface ResolvedBirth {
  y: number;
  m: number;
  d: number;
  hh: number | null;
  mm: number | null;
  lat: number | null;
  lon: number | null;
  zone: string;
  city: City | null;
  houseSystem: "placidus" | "whole_sign";
  /** echo of what was asked, for the output */
  date: string;
  time: string | null;
}

export function validZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function parseDate(s: string, field = "date"): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new InputError(`${field} must be YYYY-MM-DD, got "${s}"`);
  const y = +m[1],
    mo = +m[2],
    d = +m[3];
  if (y < 1800 || y > 2200) throw new InputError(`${field}: years 1800–2200 are supported`);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d)
    throw new InputError(`${field}: ${s} is not a calendar date`);
  return { y, m: mo, d };
}

export function parseTime(s: string, field = "time"): { hh: number; mm: number } {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s.trim());
  if (!m || +m[1] > 23 || +m[2] > 59)
    throw new InputError(`${field} must be 24-hour HH:MM local time, got "${s}"`);
  return { hh: +m[1], mm: +m[2] };
}

export function resolveZone(zone: string | undefined, fallback: string | null, field: string) {
  const z = zone ?? fallback;
  if (!z)
    throw new InputError(
      `${field}: an IANA time zone is required (e.g. "Asia/Shanghai", "America/New_York"), or a city from the built-in table`,
    );
  if (!validZone(z)) throw new InputError(`${field}: unknown IANA time zone "${z}"`);
  return z;
}

export function resolveBirth(a: BirthArgs, label = "birth"): ResolvedBirth {
  const { y, m, d } = parseDate(a.date, `${label}.date`);
  const t = a.time ? parseTime(a.time, `${label}.time`) : null;
  let city: City | null = null;
  if (a.city) {
    city = findCity(a.city);
    if (!city && (a.latitude === undefined || a.longitude === undefined || !a.timezone))
      throw new InputError(
        `${label}.city: "${a.city}" is not in the built-in city table; give latitude, longitude and timezone instead`,
      );
  }
  if ((a.latitude === undefined) !== (a.longitude === undefined))
    throw new InputError(`${label}: give both latitude and longitude, or neither`);
  const lat = a.latitude ?? city?.latitude ?? null;
  const lon = a.longitude ?? city?.longitude ?? null;
  const zone = resolveZone(a.timezone, city?.timezone ?? null, `${label}.timezone`);
  return {
    y,
    m,
    d,
    hh: t ? t.hh : null,
    mm: t ? t.mm : null,
    lat,
    lon,
    zone,
    city,
    houseSystem: a.house_system ?? "placidus",
    date: a.date,
    time: a.time ?? null,
  };
}

export interface CastChart {
  birth: ResolvedBirth;
  chart: Chart;
  /** time and place known: angles and houses exist */
  angles: boolean;
  /** Placidus was asked for but has no solution at this latitude */
  fallback: boolean;
  speeds: Record<BodyId, number>;
}

export function cast(b: ResolvedBirth): CastChart {
  const chart = compute({
    y: b.y,
    m: b.m,
    d: b.d,
    hh: b.hh,
    mm: b.mm,
    lat: b.lat ?? 0,
    lon: b.lon ?? 0,
    zone: b.zone,
  });
  const angles = chart.known && b.lat !== null && b.lon !== null;
  let fallback = false;
  if (chart.known && !angles) {
    // planets do not depend on the place; the angles and houses do
    chart.asc = chart.mc = null;
    chart.cusps = null;
    chart.system = null;
    for (const p of chart.planets) delete p.house;
  } else if (angles) {
    if (b.houseSystem === "whole_sign") {
      chart.cusps = wholeSign(chart.asc!);
      chart.system = "Whole Sign";
      for (const p of chart.planets) p.house = houseOf(p.lon, chart.cusps);
    } else fallback = chart.system === "Whole Sign";
  }
  return { birth: b, chart, angles, fallback, speeds: speeds(chart.utc) };
}

/* ---------- element and modality balance ---------- */

export interface Balance {
  elements: Record<Element, number>;
  modes: Record<Mode, number>;
  dominant_element: Element;
  dominant_mode: Mode;
  weighting: string;
}

/**
 * The Sun, Moon and Ascendant count two points, Mercury to Pluto and the Midheaven one each
 * (the COSINE archetype weighting). Without a birth time the angles are left out, and so is the
 * Moon when its sign that day is not certain. Ties go to the Sun's, then the Moon's, then the
 * Ascendant's element (or modality). Values are shares of the points, in percent.
 */
export function balance(c: Chart): Balance {
  const el = [0, 0, 0, 0],
    mo = [0, 0, 0];
  const add = (lon: number, w: number) => {
    const s = signIndex(lon);
    el[s % 4] += w;
    mo[s % 3] += w;
  };
  const moonSure =
    c.known || !c.moonRange || signIndex(c.moonRange[0]) === signIndex(c.moonRange[1]);
  for (const p of c.planets) {
    if (p.id === "Moon" && !moonSure) continue;
    add(p.lon, p.id === "Sun" || p.id === "Moon" ? 2 : 1);
  }
  const ang = c.asc !== null;
  if (ang) {
    add(c.asc!, 2);
    if (c.mc !== null) add(c.mc, 1);
  }
  const order = [c.planets[0].lon, ...(moonSure ? [c.planets[1].lon] : []), ...(ang ? [c.asc!] : [])];
  const pick = (counts: number[], k: number) => {
    const top = Math.max(...counts);
    const tied = counts.map((n, i) => (n === top ? i : -1)).filter((i) => i >= 0);
    if (tied.length === 1) return tied[0];
    for (const lon of order) if (tied.includes(signIndex(lon) % k)) return signIndex(lon) % k;
    return tied[0];
  };
  const total = el.reduce((a, b) => a + b, 0);
  const pct = (n: number) => Math.round((n / total) * 100);
  return {
    elements: Object.fromEntries(ELEMENTS.map((e, i) => [e, pct(el[i])])) as Record<Element, number>,
    modes: Object.fromEntries(MODES.map((m, i) => [m, pct(mo[i])])) as Record<Mode, number>,
    dominant_element: ELEMENTS[pick(el, 4)],
    dominant_mode: MODES[pick(mo, 3)],
    weighting:
      "Sun, Moon, Ascendant 2 points; Mercury–Pluto and Midheaven 1 point" +
      (ang ? "" : "; angles left out (no birth time or place)") +
      (moonSure ? "" : "; Moon left out (it changes sign that day)"),
  };
}

/* ---------- output ---------- */

export function birthEcho(cc: CastChart) {
  const b = cc.birth;
  return {
    date: b.date,
    time: b.time,
    timezone: b.zone,
    utc_offset: offsetLabel(cc.chart.offsetMin),
    utc: new Date(cc.chart.utc).toISOString().replace(".000", ""),
    latitude: b.lat,
    longitude: b.lon,
    city: b.city ? `${b.city.name} (${b.city.name_zh})` : null,
  };
}

export function houseSystemNote(cc: CastChart): string | null {
  if (!cc.chart.known) return "Birth time unknown: no Ascendant, Midheaven or houses; planets are for local noon.";
  if (!cc.angles) return "No birth place given: no Ascendant, Midheaven or houses.";
  if (cc.fallback)
    return "Placidus has no solution at this latitude (inside the polar circle); whole-sign houses are used instead.";
  return null;
}

export function natalJson(cc: CastChart) {
  const c = cc.chart;
  const notes: string[] = [];
  const hs = houseSystemNote(cc);
  if (hs) notes.push(hs);
  const moonRange = c.moonRange
    ? {
        from: lonInfo(c.moonRange[0]),
        to: lonInfo(c.moonRange[1]),
        sign_certain: signIndex(c.moonRange[0]) === signIndex(c.moonRange[1]),
      }
    : null;
  if (moonRange)
    notes.push(
      moonRange.sign_certain
        ? "The Moon moves about 13° a day; without a birth time its degree is uncertain but its sign is not."
        : `The Moon moves about 13° a day and changed sign that day (${moonRange.from.sign} → ${moonRange.to.sign}); its sign depends on the birth time.`,
    );
  return {
    birth: birthEcho(cc),
    time_known: c.known,
    house_system: c.system,
    planets: c.planets.map((p) => ({
      body: p.id,
      ...lonInfo(p.lon),
      house: p.house ?? null,
      retrograde: p.retro,
      speed_deg_per_day: round(cc.speeds[p.id], 4),
    })),
    angles: cc.angles
      ? { ascendant: lonInfo(c.asc!), midheaven: lonInfo(c.mc!) }
      : null,
    houses: c.cusps ? c.cusps.map((cusp, i) => ({ house: i + 1, ...lonInfo(cusp) })) : null,
    aspects: c.aspects
      .map((x) => ({
        a: x.a,
        b: x.b,
        aspect: x.type.name,
        angle: x.type.angle,
        orb: round(x.orb, 2),
        applying: applying(
          c.planets.find((p) => p.id === x.a)!.lon,
          cc.speeds[x.a],
          c.planets.find((p) => p.id === x.b)!.lon,
          cc.speeds[x.b],
          x.type.angle,
        ),
      }))
      .sort((x, y) => x.orb - y.orb),
    balance: balance(c),
    moon_range: moonRange,
    notes,
  };
}

export function placeLine(cc: CastChart): string {
  const b = cc.birth;
  const time = b.time ? `${b.time} ` : "(time unknown) ";
  const place =
    b.lat !== null && b.lon !== null
      ? ` · ${b.city ? b.city.name + " " : ""}${coord(b.lat, b.lon)}`
      : " · no place";
  return `${b.date} ${time}${b.zone} (UTC${offsetLabel(cc.chart.offsetMin)})${place}`;
}

export function natalText(cc: CastChart, j = natalJson(cc)): string {
  const lines = [`Natal chart: ${placeLine(cc)}${j.house_system ? ` · ${j.house_system} houses` : ""}`];
  lines.push(
    j.planets
      .map(
        (p) =>
          `${p.body} ${p.position}${p.house ? ` (H${p.house})` : ""}${p.retrograde ? " R" : ""}`,
      )
      .join("; "),
  );
  if (j.angles) lines.push(`ASC ${j.angles.ascendant.position} · MC ${j.angles.midheaven.position}`);
  if (j.houses)
    lines.push("Cusps: " + j.houses.map((h) => `${h.house} ${position(h.longitude)}`).join(", "));
  if (j.aspects.length)
    lines.push(
      "Aspects: " +
        j.aspects
          .map((x) => `${x.a} ${x.aspect} ${x.b} ${x.orb.toFixed(1)}°${x.applying ? " a" : " s"}`)
          .join("; ") +
        " (a = applying, s = separating)",
    );
  const bal = j.balance;
  lines.push(
    `Balance: ${Object.entries(bal.elements)
      .map(([k, v]) => `${k} ${v}%`)
      .join(", ")} → ${bal.dominant_element}; ${Object.entries(bal.modes)
      .map(([k, v]) => `${k} ${v}%`)
      .join(", ")} → ${bal.dominant_mode}`,
  );
  for (const n of j.notes) lines.push(`Note: ${n}`);
  return lines.join("\n");
}

export const sunSign = (c: Chart) => signOf(c.planets[0].lon);
