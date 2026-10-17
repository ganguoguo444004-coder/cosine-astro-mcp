/*
 * Synastry: two natal charts read against each other — the aspects between one person's
 * planets (and Ascendant) and the other's, and where each person's planets fall in the other's
 * houses. Orbs are kept tighter than within one chart (as in the COSINE engine).
 */
import { applying, ASPECTS, houseOf, separation, type AspectType, type BodyId } from "./core.js";
import { placeLine, type CastChart } from "./chart.js";
import { round } from "./format.js";

export const SYN_ORB: Record<AspectType["key"], number> = {
  conj: 6,
  oppo: 6,
  squa: 5,
  trin: 5,
  sext: 3,
};

type Point = BodyId | "Ascendant";

function points(cc: CastChart) {
  const c = cc.chart;
  const ps: { id: Point; lon: number; speed: number; rough: boolean }[] = c.planets.map((p) => ({
    id: p.id,
    lon: p.lon,
    speed: cc.speeds[p.id],
    rough: !c.known && p.id === "Moon",
  }));
  if (cc.angles) ps.push({ id: "Ascendant", lon: c.asc!, speed: 0, rough: false });
  return ps;
}

/** the pairs astrologers usually look at first: the lights, the love planets, the Ascendant */
const KEY = new Set<Point>(["Sun", "Moon", "Venus", "Mars", "Ascendant"]);

function overlay(planetsOf: CastChart, housesOf: CastChart) {
  const cusps = housesOf.chart.cusps;
  if (!cusps) return null;
  return planetsOf.chart.planets.map((p) => ({
    body: p.id,
    house: houseOf(p.lon, cusps),
    uncertain: !planetsOf.chart.known && p.id === "Moon",
  }));
}

export function synastryJson(A: CastChart, B: CastChart) {
  const aspects: {
    a: Point;
    b: Point;
    aspect: string;
    kind: "conjunction" | "harmonious" | "challenging";
    angle: number;
    orb: number;
    applying: boolean;
    key_pair: boolean;
    uncertain: boolean;
  }[] = [];
  for (const p of points(A))
    for (const q of points(B)) {
      const d = separation(p.lon, q.lon);
      for (const type of ASPECTS) {
        const orb = Math.abs(d - type.angle);
        if (orb <= SYN_ORB[type.key])
          aspects.push({
            a: p.id,
            b: q.id,
            aspect: type.name,
            kind: type.kind === "conj" ? "conjunction" : type.kind === "soft" ? "harmonious" : "challenging",
            angle: type.angle,
            orb: round(orb, 2),
            applying: applying(p.lon, p.speed, q.lon, q.speed, type.angle),
            key_pair: KEY.has(p.id) && KEY.has(q.id),
            uncertain: p.rough || q.rough,
          });
      }
    }
  aspects.sort((x, y) => Number(x.uncertain) - Number(y.uncertain) || x.orb - y.orb);
  const count = (k: string) => aspects.filter((x) => x.kind === k).length;
  const notes = [
    "The tally is descriptive, not a compatibility score: a square can be the most alive contact between two people, and a trine can go unnoticed.",
  ];
  if (!A.chart.known || !B.chart.known)
    notes.push("At least one birth time is unknown: aspects involving that person's Moon are flagged uncertain, and there is no Ascendant or house overlay for them.");
  return {
    person_a: { birth: placeLine(A), house_system: A.chart.system },
    person_b: { birth: placeLine(B), house_system: B.chart.system },
    orbs: { conjunction: 6, opposition: 6, square: 5, trine: 5, sextile: 3 },
    aspects,
    overlays: {
      a_planets_in_b_houses: overlay(A, B),
      b_planets_in_a_houses: overlay(B, A),
    },
    summary: {
      total: aspects.length,
      conjunctions: count("conjunction"),
      harmonious: count("harmonious"),
      challenging: count("challenging"),
      key_pair_aspects: aspects.filter((x) => x.key_pair && !x.uncertain).length,
      tightest: aspects.filter((x) => !x.uncertain).slice(0, 5).map((x) => `A ${x.a} ${x.aspect} B ${x.b} (${x.orb.toFixed(1)}°)`),
    },
    notes,
  };
}

export function synastryText(j: ReturnType<typeof synastryJson>): string {
  const s = j.summary;
  const lines = [
    `Synastry: A = ${j.person_a.birth}; B = ${j.person_b.birth}`,
    `${s.total} cross aspects: ${s.conjunctions} conjunctions, ${s.harmonious} harmonious (trine/sextile), ${s.challenging} challenging (square/opposition); ${s.key_pair_aspects} between Sun/Moon/Venus/Mars/Ascendant.`,
  ];
  if (j.aspects.length)
    lines.push(
      "Aspects: " +
        j.aspects
          .map((x) => `A ${x.a} ${x.aspect} B ${x.b} ${x.orb.toFixed(1)}°${x.key_pair ? " *" : ""}${x.uncertain ? " (uncertain)" : ""}`)
          .join("; ") +
        " (* = key pair)",
    );
  const ov = (label: string, xs: { body: string; house: number }[] | null) =>
    xs && lines.push(`${label}: ` + xs.map((x) => `${x.body} H${x.house}`).join(", "));
  ov("A's planets in B's houses", j.overlays.a_planets_in_b_houses);
  ov("B's planets in A's houses", j.overlays.b_planets_in_a_houses);
  for (const n of j.notes) lines.push(`Note: ${n}`);
  return lines.join("\n");
}
