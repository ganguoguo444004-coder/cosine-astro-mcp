/*
 * The engine against Swiss Ephemeris reference values (tests/fixtures/reference-charts.json,
 * generated with pyswisseph by the COSINE project; only the numbers are included here, no
 * Swiss Ephemeris code). Every longitude, angle and cusp must be within 1′ of arc.
 */
import { describe, expect, it } from "vitest";
import { compute, norm, speeds, wholeSign, type BirthInput, type Chart } from "../src/engine/core.js";
import reference from "./fixtures/reference-charts.json" with { type: "json" };

const ARCMIN = 1 / 60;
const SIGNS = "Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces".split(" ");

/** angular distance between two longitudes, degrees */
const gap = (a: number, b: number) => Math.abs(norm(a - b + 180) - 180);
/** "10°22′ Capricorn", minutes truncated */
const dms = (lon: number) => {
  const s = Math.floor(lon / 30),
    d = lon - s * 30;
  return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, "0")}′ ${SIGNS[s]}`;
};
const planet = (c: Chart, id: string) => c.planets.find((p) => p.id === id)!;

describe("check value: 2000-01-01 12:00 UTC, Greenwich", () => {
  const c = compute({ y: 2000, m: 1, d: 1, hh: 12, mm: 0, lat: 51.4833, lon: 0, zone: "UTC" });
  it("Sun 10°22′ Capricorn", () => expect(dms(planet(c, "Sun").lon)).toBe("10°22′ Capricorn"));
  it("ASC 24°16′ Aries", () => expect(dms(c.asc!)).toBe("24°16′ Aries"));
  it("MC 9°36′ Capricorn", () => expect(dms(c.mc!)).toBe("9°36′ Capricorn"));
});

describe("against Swiss Ephemeris, within 1′", () => {
  for (const ref of reference.cases) {
    describe(`${ref.id}`, () => {
      const c = compute(ref.input as BirthInput);

      it("local time to UTC (historical DST)", () => {
        expect(new Date(c.utc).toISOString().replace(".000", "")).toBe(ref.utc);
        expect(c.offsetMin).toBe(ref.offsetMin);
      });

      it("ten planets: longitude, retrograde flag, daily motion", () => {
        const sp = speeds(c.utc);
        for (const p of c.planets) {
          const r = ref.planets[p.id as keyof typeof ref.planets];
          expect(gap(p.lon, r.lon), p.id).toBeLessThan(ARCMIN);
          expect(Math.abs(sp[p.id] - r.speed), `${p.id} speed`).toBeLessThan(0.01);
          if (p.id !== "Sun" && p.id !== "Moon") expect(p.retro, p.id).toBe(r.speed < 0);
        }
      });

      if (ref.input.hh === null) {
        it("no angles or houses; the Moon's range that day", () => {
          expect(c.known).toBe(false);
          expect([c.asc, c.mc, c.cusps, c.system]).toEqual([null, null, null, null]);
          expect(gap(c.moonRange![0], ref.moonRange![0])).toBeLessThan(ARCMIN);
          expect(gap(c.moonRange![1], ref.moonRange![1])).toBeLessThan(ARCMIN);
        });
        return;
      }

      it("Ascendant and Midheaven", () => {
        expect(gap(c.asc!, ref.asc!)).toBeLessThan(ARCMIN);
        expect(gap(c.mc!, ref.mc!)).toBeLessThan(ARCMIN);
      });

      if (ref.placidus) {
        it("Placidus cusps", () => {
          expect(c.system).toBe("Placidus");
          c.cusps!.forEach((cusp, i) => expect(gap(cusp, ref.placidus![i]), `house ${i + 1}`).toBeLessThan(ARCMIN));
        });
      } else {
        it("whole-sign houses where Placidus has no solution", () => {
          expect(c.system).toBe("Whole Sign");
          expect(c.cusps).toEqual(wholeSign(c.asc!));
        });
      }

      it("every planet lies between its house's two cusps", () => {
        for (const p of c.planets) {
          const from = c.cusps![p.house! - 1],
            to = c.cusps![p.house! % 12];
          expect(norm(p.lon - from)).toBeLessThan(norm(to - from));
        }
      });
    });
  }
});

describe("daylight saving time", () => {
  const offset = (y: number, m: number, d: number, zone = "Asia/Shanghai") =>
    compute({ y, m, d, hh: 12, mm: 0, lat: 31.23, lon: 121.47, zone }).offsetMin;

  it("China kept UTC+9 in the summers of 1986–1991", () => {
    expect(offset(1985, 7, 1)).toBe(480);
    for (let y = 1986; y <= 1991; y++) {
      expect(offset(y, 7, 1), String(y)).toBe(540);
      expect(offset(y, 1, 15), String(y)).toBe(480);
    }
    expect(offset(1992, 7, 1)).toBe(480);
  });

  it("southern-hemisphere DST is in January", () => {
    expect(offset(1980, 1, 15, "Australia/Sydney")).toBe(660);
    expect(offset(1980, 7, 15, "Australia/Sydney")).toBe(600);
  });
});

describe("aspects", () => {
  it("only within orb, with the right orb", () => {
    const c = compute(reference.cases[1].input as BirthInput);
    expect(c.aspects.length).toBeGreaterThan(0);
    for (const a of c.aspects) {
      const sep = gap(planet(c, a.a).lon, planet(c, a.b).lon);
      expect(Math.abs(Math.abs(sep - a.type.angle) - a.orb)).toBeLessThan(1e-9);
      expect(a.orb).toBeLessThanOrEqual(a.type.orb);
    }
  });
});
