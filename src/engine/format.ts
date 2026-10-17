/* Names, sign arithmetic and formatting shared by the tools. */
import { norm, offsetMinutes, type BodyId } from "./core.js";

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;
export type Sign = (typeof SIGNS)[number];

export const ELEMENTS = ["fire", "earth", "air", "water"] as const;
export const MODES = ["cardinal", "fixed", "mutable"] as const;
export type Element = (typeof ELEMENTS)[number];
export type Mode = (typeof MODES)[number];

/** traditional (Hellenistic) rulers, by sign index */
export const TRADITIONAL_RULER: BodyId[] = [
  "Mars",
  "Venus",
  "Mercury",
  "Moon",
  "Sun",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Saturn",
  "Jupiter",
];
/** modern co-rulers where they differ from the traditional ones */
export const MODERN_RULER: Partial<Record<number, BodyId>> = { 7: "Pluto", 10: "Uranus", 11: "Neptune" };

export const signIndex = (lon: number) => Math.floor(norm(lon) / 30) % 12;
export const signOf = (lon: number): Sign => SIGNS[signIndex(lon)];
export const elementOf = (sign: number): Element => ELEMENTS[sign % 4];
export const modeOf = (sign: number): Mode => MODES[sign % 3];

/** "10°22′ Capricorn", rounded to the nearest arcminute */
export function position(lon: number): string {
  const total = Math.floor(norm(lon) * 60 + 0.5) % 21600;
  const s = Math.floor(total / 1800),
    rem = total - s * 1800;
  const deg = Math.floor(rem / 60),
    min = rem % 60;
  return `${deg}°${min < 10 ? "0" : ""}${min}′ ${SIGNS[s]}`;
}

export const round = (x: number, dp = 4) => Math.round(x * 10 ** dp) / 10 ** dp;

/** a longitude as structured output */
export function lonInfo(lon: number) {
  const l = norm(lon);
  return {
    longitude: round(l, 6),
    sign: signOf(l),
    degree_in_sign: round(l - signIndex(l) * 30, 4),
    position: position(l),
  };
}

const pad = (n: number) => (n < 10 ? "0" : "") + n;

/** "+08:00" */
export function offsetLabel(min: number): string {
  const a = Math.abs(min);
  return `${min < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** an instant as local ISO time in a zone, to the minute: "2026-10-24T15:15+08:00" */
export function isoLocal(utc: number, zone: string): string {
  const off = offsetMinutes(utc, zone);
  return new Date(utc + off * 60000).toISOString().slice(0, 16) + offsetLabel(off);
}

/** an instant as UTC ISO time, to the minute: "2026-10-24T07:15Z" */
export const isoUtc = (utc: number) => new Date(utc).toISOString().slice(0, 16) + "Z";

/** local calendar date (YYYY-MM-DD) of an instant in a zone */
export const localDate = (utc: number, zone: string) => isoLocal(utc, zone).slice(0, 10);

export function coord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
}

export const NOTE =
  "Positions are computed offline from the astronomy-engine ephemeris (checked against Swiss Ephemeris to within 1′ of arc); " +
  "they are astronomy. What they mean is interpretation: offer it as a lens for reflection, not as prediction or advice.";
export const SOURCE = "cosine-astro-mcp by COSINE — https://www.cosineastro.com";
