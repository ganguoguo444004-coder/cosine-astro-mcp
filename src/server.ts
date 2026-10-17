/*
 * The MCP server: six read-only tools over the chart engine. Every tool returns a compact text
 * summary (first content block, written for an LLM to read), the same data as JSON (second
 * block) and as structuredContent. Nothing here touches the network.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";
import {
  cast,
  InputError,
  natalJson,
  natalText,
  parseDate,
  parseTime,
  resolveBirth,
  resolveZone,
  type BirthArgs,
} from "./engine/chart.js";
import { localToUtc } from "./engine/core.js";
import { localDate, NOTE, SOURCE } from "./engine/format.js";
import { moonPhaseJson, moonPhaseText } from "./engine/moon.js";
import { ageOn, profectionJson, profectionText } from "./engine/profection.js";
import { mercuryRetrogradeJson, mercuryRetrogradeText } from "./engine/retrograde.js";
import { synastryJson, synastryText } from "./engine/synastry.js";
import { transitsJson, transitsText } from "./engine/transits.js";

export const NAME = "cosine-astro-mcp";
export const VERSION = "0.1.0";

const DAY = 864e5;

/* ---------- schemas ---------- */

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .describe("Local calendar date, YYYY-MM-DD (years 1800–2200)");

const birthShape = {
  date: dateField.describe("Birth date (local calendar date), YYYY-MM-DD"),
  time: z
    .string()
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "HH:MM")
    .optional()
    .describe(
      "Local clock time of birth, 24-hour HH:MM. Omit if unknown: planets are then cast for local noon and there are no Ascendant, Midheaven or houses.",
    ),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA time zone of the birthplace, e.g. "Asia/Shanghai", "America/New_York". Historical daylight saving time is applied automatically. Required unless `city` is given.',
    ),
  latitude: z.number().min(-90).max(90).optional().describe("Birthplace latitude in degrees, north positive"),
  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe("Birthplace longitude in degrees, east positive (New York is about -74.0)"),
  city: z
    .string()
    .optional()
    .describe(
      'Optional shortcut: a city from the built-in offline table (about 110 large cities, English or Chinese name, e.g. "Beijing", "上海", "London", "New York"). Explicit latitude/longitude/timezone override it. For anywhere else, pass coordinates.',
    ),
  house_system: z
    .enum(["placidus", "whole_sign"])
    .default("placidus")
    .describe("House system. Placidus (default) falls back to whole-sign inside the polar circles, where it has no solution."),
};
const birthObject = z.object(birthShape);

const transitShape = {
  date: dateField.optional().describe("Date of the transits, YYYY-MM-DD. Omit for the current moment."),
  time: z
    .string()
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "HH:MM")
    .optional()
    .describe("Local time of the transits, HH:MM (default 12:00 when a date is given)"),
  timezone: z
    .string()
    .optional()
    .describe("IANA time zone for the transit date and output times (default: the natal chart's zone, else UTC)"),
  natal: birthObject.optional().describe("The natal chart to compare against. Omit to get only the planets' positions."),
  max_orb: z
    .number()
    .min(0.1)
    .max(10)
    .default(2)
    .describe("Largest orb in degrees for transit-to-natal aspects (default 2)"),
};

const retroShape = {
  start_date: dateField.optional().describe("Start of the range, YYYY-MM-DD (default: today)"),
  end_date: dateField.optional().describe("End of the range, inclusive, YYYY-MM-DD (default: one year after the start). At most 30 years."),
  timezone: z.string().default("UTC").describe("IANA time zone for the range and the local times in the output (default UTC)"),
};

const profectionShape = {
  ...birthShape,
  age: z.number().int().min(0).max(120).optional().describe("Age in completed years. Takes precedence over `on_date`."),
  on_date: dateField
    .optional()
    .describe("Date to find the profection year for, YYYY-MM-DD (default: today in the birth time zone)"),
};

const moonShape = {
  date: dateField.optional().describe("Date, YYYY-MM-DD. Omit for the current moment."),
  time: z
    .string()
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "HH:MM")
    .optional()
    .describe("Local time, HH:MM (default 12:00 when a date is given)"),
  timezone: z.string().default("UTC").describe("IANA time zone (default UTC)"),
};

/* ---------- helpers ---------- */

function result(text: string, json: Record<string, unknown>): CallToolResult {
  const structured = { ...json, note: NOTE, source: SOURCE };
  return {
    content: [
      { type: "text", text: `${text}\n${NOTE}\n(${SOURCE})` },
      { type: "text", text: JSON.stringify(structured) },
    ],
    structuredContent: structured,
  };
}

function guard(f: () => CallToolResult): CallToolResult {
  try {
    return f();
  } catch (e) {
    if (e instanceof InputError) return { isError: true, content: [{ type: "text", text: `Invalid input: ${e.message}` }] };
    throw e;
  }
}

/** a local date and time in a zone as a UTC instant; no date means now */
function moment(date: string | undefined, time: string | undefined, zone: string, field: string) {
  if (!date) {
    const utc = Math.floor(Date.now() / 6e4) * 6e4;
    return { utc, date: localDate(utc, zone), time: new Date(utc).toISOString().slice(11, 16) + "Z" };
  }
  const { y, m, d } = parseDate(date, `${field}date`);
  const t = time ? parseTime(time, `${field}time`) : { hh: 12, mm: 0 };
  return { utc: localToUtc(y, m, d, t.hh, t.mm, zone).utc, date, time: time ?? "12:00" };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const INSTRUCTIONS =
  "Western (tropical) astrology calculations, computed offline: natal_chart, transits, synastry, mercury_retrograde, annual_profection, moon_phase. " +
  "Give birth data as date + optional local time + IANA timezone + latitude/longitude (or a city from the small built-in table); never guess a birth time. " +
  "Each tool returns a compact text summary followed by the same data as JSON. The positions are astronomy; any interpretation is yours — present it as reflection, not prediction.";

/* ---------- server ---------- */

export function createServer(): McpServer {
  const server = new McpServer({ name: NAME, version: VERSION }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "natal_chart",
    {
      title: "Natal chart",
      description:
        "Cast a tropical natal (birth) chart: the ten planets with sign, degree, house and retrograde flag; Ascendant and Midheaven; twelve house cusps (Placidus by default); major aspects with orbs and applying/separating; and the dominant element and modality. Works without a birth time (no angles or houses then).",
      inputSchema: birthShape,
      annotations: { title: "Natal chart", ...READ_ONLY },
    },
    async (args) =>
      guard(() => {
        const cc = cast(resolveBirth(args as BirthArgs));
        const j = natalJson(cc);
        return result(natalText(cc, j), j);
      }),
  );

  server.registerTool(
    "transits",
    {
      title: "Transits",
      description:
        "Planet positions for a date and time (default: now), and, given a natal chart, the major aspects the transiting planets make to the natal planets, Ascendant and Midheaven within an orb (default 2°), with the natal house each transiting planet is passing through.",
      inputSchema: transitShape,
      annotations: { title: "Transits", ...READ_ONLY },
    },
    async (args) =>
      guard(() => {
        const natal = args.natal ? cast(resolveBirth(args.natal as BirthArgs, "natal")) : null;
        const zone = resolveZone(args.timezone, natal?.birth.zone ?? "UTC", "timezone");
        const at = moment(args.date, args.time, zone, "");
        const j = transitsJson({ ...at, zone }, natal, args.max_orb ?? 2);
        return result(transitsText(j), j);
      }),
  );

  server.registerTool(
    "synastry",
    {
      title: "Synastry",
      description:
        "Compare two natal charts: the major aspects between person A's planets (and Ascendant) and person B's, with orbs (conjunction/opposition 6°, square/trine 5°, sextile 3°), where each person's planets fall in the other's houses, and a simple descriptive tally (not a compatibility score).",
      inputSchema: { person_a: birthObject.describe("First person's birth data"), person_b: birthObject.describe("Second person's birth data") },
      annotations: { title: "Synastry", ...READ_ONLY },
    },
    async (args) =>
      guard(() => {
        const A = cast(resolveBirth(args.person_a as BirthArgs, "person_a"));
        const B = cast(resolveBirth(args.person_b as BirthArgs, "person_b"));
        const j = synastryJson(A, B);
        return result(synastryText(j), j);
      }),
  );

  server.registerTool(
    "mercury_retrograde",
    {
      title: "Mercury retrograde",
      description:
        "Mercury retrograde periods overlapping a date range (default: the next 12 months): pre-shadow start, station retrograde, station direct and post-shadow end (to about a minute, in UTC and a chosen time zone), with the degrees and signs of the two stations.",
      inputSchema: retroShape,
      annotations: { title: "Mercury retrograde", ...READ_ONLY },
    },
    async (args) =>
      guard(() => {
        const zone = resolveZone(args.timezone, "UTC", "timezone");
        const start = args.start_date
          ? moment(args.start_date, "00:00", zone, "start_").utc
          : localToUtc(...ymd(localDate(Date.now(), zone)), 0, 0, zone).utc;
        const end = args.end_date
          ? moment(args.end_date, "00:00", zone, "end_").utc + DAY
          : start + 365 * DAY;
        if (end <= start) throw new InputError("end_date must not be before start_date");
        if (end - start > 30.5 * 365.25 * DAY) throw new InputError("the range can be at most 30 years");
        const j = mercuryRetrogradeJson(start, end, zone);
        return result(mercuryRetrogradeText(j), j);
      }),
  );

  server.registerTool(
    "annual_profection",
    {
      title: "Annual profection",
      description:
        "Hellenistic annual profection for an age or a date: the profected house (whole-sign, counted from the Ascendant; from the Sun's sign if the birth time is unknown), its sign, the lord of the year (traditional ruler, with the modern co-ruler) and where that lord sits in the natal chart, plus the dates the profection year runs.",
      inputSchema: profectionShape,
      annotations: { title: "Annual profection", ...READ_ONLY },
    },
    async (args) =>
      guard(() => {
        const cc = cast(resolveBirth(args as BirthArgs));
        let age = args.age;
        if (age === undefined) {
          const on = parseDate(args.on_date ?? localDate(Date.now(), cc.birth.zone), "on_date");
          age = ageOn(cc, on);
          if (age < 0) throw new InputError("on_date is before the birth date");
        }
        const j = profectionJson(cc, age);
        return result(profectionText(j), j);
      }),
  );

  server.registerTool(
    "moon_phase",
    {
      title: "Moon phase",
      description:
        "The Moon's phase at a moment (default: now): phase name, illuminated fraction, Sun–Moon angle, days since new moon, the Moon's and Sun's signs, and the next new, first-quarter, full and last-quarter moons.",
      inputSchema: moonShape,
      annotations: { title: "Moon phase", ...READ_ONLY },
    },
    async (args) =>
      guard(() => {
        const zone = resolveZone(args.timezone, "UTC", "timezone");
        const at = moment(args.date, args.time, zone, "");
        const j = moonPhaseJson(at.utc, zone);
        return result(moonPhaseText(j), j);
      }),
  );

  return server;
}

function ymd(s: string): [number, number, number] {
  const { y, m, d } = parseDate(s);
  return [y, m, d];
}
