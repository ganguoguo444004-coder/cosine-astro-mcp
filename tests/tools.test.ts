/* The six tools, called through a real MCP client over an in-memory transport. */
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, VERSION } from "../src/server.js";
import { norm } from "../src/engine/core.js";
import reference from "./fixtures/reference-charts.json" with { type: "json" };

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;

const client = new Client({ name: "test", version: "0.0.0" });
const ARCMIN = 1 / 60;
const gap = (a: number, b: number) => Math.abs(norm(a - b + 180) - 180);
const pad = (n: number) => String(n).padStart(2, "0");

beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([createServer().connect(a), client.connect(b)]);
});
afterAll(() => client.close());

async function call(name: string, args: Record<string, unknown>) {
  const r = (await client.callTool({ name, arguments: args })) as J;
  return r;
}
async function ok(name: string, args: Record<string, unknown>) {
  const r = await call(name, args);
  expect(r.isError, r.content?.[0]?.text).toBeFalsy();
  expect(r.content[0].type).toBe("text");
  expect(r.content[0].text).toContain("not as prediction");
  // the second block is the structured result, serialised
  expect(JSON.parse(r.content[1].text)).toEqual(r.structuredContent);
  return { text: r.content[0].text as string, json: r.structuredContent as J };
}

const toArgs = (inp: J) => ({
  date: `${inp.y}-${pad(inp.m)}-${pad(inp.d)}`,
  ...(inp.hh === null ? {} : { time: `${pad(inp.hh)}:${pad(inp.mm)}` }),
  timezone: inp.zone,
  latitude: inp.lat,
  longitude: inp.lon,
});

const SAMPLE = { date: "1995-05-12", time: "08:30", timezone: "Asia/Shanghai", latitude: 31.23, longitude: 121.47 };

describe("server", () => {
  it("lists six tools with input schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["annual_profection", "mercury_retrograde", "moon_phase", "natal_chart", "synastry", "transits"],
    );
    for (const t of tools) {
      expect(t.description!.length).toBeGreaterThan(50);
      expect(t.inputSchema.type).toBe("object");
      expect(t.annotations?.readOnlyHint).toBe(true);
    }
    const natal = tools.find((t) => t.name === "natal_chart")!;
    expect(natal.inputSchema.required).toEqual(["date"]);
  });

  it("version matches package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
    expect(client.getServerVersion()?.version).toBe(pkg.version);
  });
});

describe("natal_chart", () => {
  for (const ref of reference.cases) {
    it(`${ref.id}: within 1′ of Swiss Ephemeris through the tool`, async () => {
      const { json } = await ok("natal_chart", toArgs(ref.input));
      expect(json.birth.utc).toBe(ref.utc);
      for (const p of json.planets) {
        const r = (ref.planets as J)[p.body];
        expect(gap(p.longitude, r.lon), p.body).toBeLessThan(ARCMIN);
      }
      if (ref.asc !== null) {
        expect(gap(json.angles.ascendant.longitude, ref.asc)).toBeLessThan(ARCMIN);
        expect(gap(json.angles.midheaven.longitude, ref.mc!)).toBeLessThan(ARCMIN);
      } else expect(json.angles).toBeNull();
      if (ref.placidus) {
        expect(json.house_system).toBe("Placidus");
        json.houses.forEach((h: J, i: number) => expect(gap(h.longitude, ref.placidus![i])).toBeLessThan(ARCMIN));
      }
    });
  }

  it("text summary, aspects and balance", async () => {
    const { text, json } = await ok("natal_chart", SAMPLE);
    expect(text).toMatch(/^Natal chart: 1995-05-12 08:30 Asia\/Shanghai \(UTC\+08:00\)/);
    expect(text).toContain("Sun 20°51′ Taurus (H11)");
    expect(json.aspects.length).toBeGreaterThan(0);
    for (let i = 1; i < json.aspects.length; i++) expect(json.aspects[i].orb).toBeGreaterThanOrEqual(json.aspects[i - 1].orb);
    const el = json.balance.elements;
    expect(el.fire + el.earth + el.air + el.water).toBeGreaterThanOrEqual(99);
    expect(["fire", "earth", "air", "water"]).toContain(json.balance.dominant_element);
    expect(["cardinal", "fixed", "mutable"]).toContain(json.balance.dominant_mode);
    expect(json.planets.every((p: J) => p.house >= 1 && p.house <= 12)).toBe(true);
  });

  it("unknown birth time: no angles or houses, Moon range given", async () => {
    const { text, json } = await ok("natal_chart", { date: "1995-05-20", timezone: "Asia/Shanghai" });
    expect(json.time_known).toBe(false);
    expect(json.angles).toBeNull();
    expect(json.houses).toBeNull();
    expect(json.moon_range).not.toBeNull();
    expect(text).toContain("time unknown");
  });

  it("city shortcut (English or Chinese) and explicit whole-sign houses", async () => {
    const a = await ok("natal_chart", { ...SAMPLE, latitude: undefined, longitude: undefined, timezone: undefined, city: "Shanghai" });
    const b = await ok("natal_chart", { date: SAMPLE.date, time: SAMPLE.time, city: "上海" });
    expect(a.json.birth.latitude).toBe(31.2304);
    expect(b.json.angles.ascendant.longitude).toBe(a.json.angles.ascendant.longitude);
    const tw = await ok("natal_chart", { date: SAMPLE.date, time: SAMPLE.time, city: "臺北" });
    expect(tw.json.birth.timezone).toBe("Asia/Taipei");
    const w = await ok("natal_chart", { ...SAMPLE, house_system: "whole_sign" });
    expect(w.json.house_system).toBe("Whole Sign");
    expect(w.json.houses[0].degree_in_sign).toBe(0);
  });

  it("Placidus falls back to whole-sign inside the polar circle, with a note", async () => {
    const { json } = await ok("natal_chart", { date: "1990-06-21", time: "12:00", timezone: "Europe/Oslo", latitude: 69.65, longitude: 18.96 });
    expect(json.house_system).toBe("Whole Sign");
    expect(json.notes.join(" ")).toContain("polar circle");
  });

  it("time without a place: planets only", async () => {
    const { json } = await ok("natal_chart", { date: "2000-01-01", time: "12:00", timezone: "UTC" });
    expect(json.angles).toBeNull();
    expect(json.planets[0].position).toBe("10°22′ Capricorn");
  });

  it("rejects bad input with a readable error", async () => {
    for (const args of [
      { date: "1995-02-30", timezone: "UTC" },
      { date: "1995-05-12" },
      { date: "1995-05-12", timezone: "Mars/Olympus" },
      { date: "1995-05-12", time: "25:00", timezone: "UTC" },
      { date: "1995-05-12", timezone: "UTC", latitude: 10 },
      { date: "1995-05-12", city: "Atlantis" },
    ]) {
      const r = await call("natal_chart", args);
      expect(r.isError, JSON.stringify(args)).toBe(true);
      expect(r.content[0].text).toMatch(/Invalid|date|time|zone|latitude|city/i);
    }
  });
});

describe("transits", () => {
  it("planets on 2026-10-15 and their aspects to a natal chart", async () => {
    const { text, json } = await ok("transits", { date: "2026-10-15", time: "12:00", timezone: "Asia/Shanghai", natal: SAMPLE });
    expect(json.moment.utc).toBe("2026-10-15T04:00Z");
    expect(text).toContain("Mercury 16°");
    expect(json.planets.find((p: J) => p.body === "Mercury").sign).toBe("Scorpio");
    expect(json.planets.every((p: J) => p.natal_house >= 1)).toBe(true);
    for (const a of json.aspects) expect(a.orb).toBeLessThanOrEqual(2);
    expect(json.aspects.some((a: J) => a.natal === "Ascendant" || a.natal === "Midheaven" || a.natal)).toBe(true);
  });

  it("without a natal chart: positions only; default is now", async () => {
    const { json } = await ok("transits", {});
    expect(json.natal).toBeNull();
    expect(json.aspects).toEqual([]);
    expect(json.planets).toHaveLength(10);
  });

  it("wider orbs find more aspects", async () => {
    const narrow = await ok("transits", { date: "2026-10-15", natal: SAMPLE, max_orb: 1 });
    const wide = await ok("transits", { date: "2026-10-15", natal: SAMPLE, max_orb: 5 });
    expect(wide.json.aspects.length).toBeGreaterThan(narrow.json.aspects.length);
  });
});

describe("synastry", () => {
  it("cross aspects within the synastry orbs, overlays both ways, summary", async () => {
    const B = toArgs(reference.cases[8].input);
    const { text, json } = await ok("synastry", { person_a: SAMPLE, person_b: B });
    const orbs: Record<string, number> = json.orbs;
    expect(json.aspects.length).toBeGreaterThan(0);
    for (const a of json.aspects) expect(a.orb).toBeLessThanOrEqual(orbs[a.aspect]);
    expect(json.overlays.a_planets_in_b_houses).toHaveLength(10);
    expect(json.overlays.b_planets_in_a_houses).toHaveLength(10);
    const s = json.summary;
    expect(s.conjunctions + s.harmonious + s.challenging).toBe(s.total);
    expect(text).toContain("not a compatibility score");
  });

  it("swapping the two people mirrors the aspects", async () => {
    const B = toArgs(reference.cases[8].input);
    const ab = await ok("synastry", { person_a: SAMPLE, person_b: B });
    const ba = await ok("synastry", { person_a: B, person_b: SAMPLE });
    const key = (x: J, flip: boolean) => (flip ? `${x.b}|${x.a}` : `${x.a}|${x.b}`) + `|${x.aspect}|${x.orb}`;
    expect(ab.json.aspects.map((x: J) => key(x, false)).sort()).toEqual(ba.json.aspects.map((x: J) => key(x, true)).sort());
  });

  it("an unknown birth time drops that person's Ascendant and house overlay", async () => {
    const { json } = await ok("synastry", { person_a: SAMPLE, person_b: { date: "1990-03-03", timezone: "Europe/London" } });
    expect(json.overlays.b_planets_in_a_houses).toHaveLength(10);
    expect(json.overlays.a_planets_in_b_houses).toBeNull();
    expect(json.aspects.some((a: J) => a.b === "Ascendant")).toBe(false);
  });
});

describe("mercury_retrograde", () => {
  it("2026: three retrogrades; October's turns at 07:15 UTC on the 24th, 21° Scorpio", async () => {
    const { text, json } = await ok("mercury_retrograde", { start_date: "2026-01-01", end_date: "2026-12-31" });
    const starts = json.periods.map((p: J) => p.retrograde_start.utc.slice(0, 10));
    expect(starts).toEqual(["2026-02-26", "2026-06-29", "2026-10-24"]);
    const oct = json.periods[2];
    expect(oct.retrograde_start.utc).toBe("2026-10-24T07:15Z");
    expect(oct.station_retrograde.sign).toBe("Scorpio");
    expect(Math.round(oct.station_retrograde.degree_in_sign)).toBe(21);
    expect(oct.retrograde_end.utc.slice(0, 10)).toBe("2026-11-13");
    for (const p of json.periods) {
      expect(p.shadow_start.utc < p.retrograde_start.utc).toBe(true);
      expect(p.retrograde_end.utc < p.shadow_end.utc).toBe(true);
    }
    expect(text).toContain("2026-10-24");
  });

  it("local times follow the requested zone", async () => {
    const { json } = await ok("mercury_retrograde", { start_date: "2026-10-01", end_date: "2026-10-31", timezone: "Asia/Shanghai" });
    expect(json.periods).toHaveLength(1);
    expect(json.periods[0].retrograde_start.local).toBe("2026-10-24T15:15+08:00");
  });

  it("rejects reversed and over-long ranges", async () => {
    expect((await call("mercury_retrograde", { start_date: "2026-10-01", end_date: "2026-01-01" })).isError).toBe(true);
    expect((await call("mercury_retrograde", { start_date: "1900-01-01", end_date: "2100-01-01" })).isError).toBe(true);
  });
});

describe("annual_profection", () => {
  it("age 30 → 7th whole-sign house from the Ascendant, with its lord", async () => {
    const natal = await ok("natal_chart", SAMPLE);
    const signs = "Aries Taurus Gemini Cancer Leo Virgo Libra Scorpio Sagittarius Capricorn Aquarius Pisces".split(" ");
    const asc = signs.indexOf(natal.json.angles.ascendant.sign);
    const { text, json } = await ok("annual_profection", { ...SAMPLE, age: 30 });
    expect(json.profected_house).toBe(7);
    expect(json.profected_sign).toBe(signs[(asc + 6) % 12]);
    expect(json.basis).toBe("Ascendant sign");
    expect(json.period).toEqual({ from: "2025-05-12", to: "2026-05-12" });
    expect(text).toContain("Lord of the year");
  });

  it("from a date: the age in completed years", async () => {
    const before = await ok("annual_profection", { ...SAMPLE, on_date: "2026-05-11" });
    const after = await ok("annual_profection", { ...SAMPLE, on_date: "2026-05-12" });
    expect(before.json.age).toBe(30);
    expect(after.json.age).toBe(31);
  });

  it("no birth time: counted from the Sun's sign", async () => {
    const { json } = await ok("annual_profection", { date: "1995-05-12", timezone: "Asia/Shanghai", age: 0 });
    expect(json.basis).toMatch(/Sun/);
    expect(json.profected_sign).toBe("Taurus");
    expect(json.lord_of_year).toBe("Venus");
  });
});

describe("moon_phase", () => {
  it("full at the lunar eclipse of 2025-09-07", async () => {
    const { json } = await ok("moon_phase", { date: "2025-09-07", time: "18:11", timezone: "UTC" });
    expect(json.phase).toBe("Full Moon");
    expect(json.illumination).toBeGreaterThan(0.99);
  });

  it("new at the solar eclipse of 2024-04-08, next full moon two weeks later", async () => {
    const { json } = await ok("moon_phase", { date: "2024-04-08", time: "18:00", timezone: "UTC" });
    expect(json.phase).toBe("New Moon");
    expect(json.illumination).toBeLessThan(0.01);
    expect(json.next_full_moon.utc.slice(0, 10)).toBe("2024-04-23");
  });

  it("defaults to now", async () => {
    const { json } = await ok("moon_phase", {});
    expect(json.moon.sign).toBeTruthy();
  });
});

describe("moon_phase names", () => {
  it("crescent and gibbous between the principal phases", async () => {
    const { json } = await ok("moon_phase", { date: "2026-10-17", time: "21:00", timezone: "Asia/Shanghai" });
    expect(json.phase_angle).toBeGreaterThan(70);
    expect(json.phase).toBe("Waxing Crescent");
    const q = await ok("moon_phase", { date: json.next_first_quarter.utc.slice(0, 10), time: json.next_first_quarter.utc.slice(11, 16), timezone: "UTC" });
    expect(q.json.phase).toBe("First Quarter");
  });
});
