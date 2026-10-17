/* Transits: the planets at a moment, and the aspects they make to a natal chart. */
import { applying, ASPECTS, compute, houseOf, separation, speeds, type BodyId } from "./core.js";
import { placeLine, type CastChart } from "./chart.js";
import { isoLocal, isoUtc, lonInfo, round } from "./format.js";

export interface Moment {
  utc: number;
  zone: string;
  /** echo of the request */
  date: string;
  time: string;
}

type NatalPoint = BodyId | "Ascendant" | "Midheaven";

export function natalPoints(cc: CastChart): { id: NatalPoint; lon: number; uncertain: boolean }[] {
  const c = cc.chart;
  const pts: { id: NatalPoint; lon: number; uncertain: boolean }[] = c.planets.map((p) => ({
    id: p.id,
    lon: p.lon,
    // without a birth time the Moon's degree is uncertain by up to ±7°
    uncertain: !c.known && p.id === "Moon",
  }));
  if (cc.angles) {
    pts.push({ id: "Ascendant", lon: c.asc!, uncertain: false });
    pts.push({ id: "Midheaven", lon: c.mc!, uncertain: false });
  }
  return pts;
}

export function transitsJson(at: Moment, natal: CastChart | null, maxOrb: number) {
  const d = new Date(at.utc);
  const sky = compute({
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    lat: 0,
    lon: 0,
    zone: "UTC",
  });
  const sp = speeds(sky.utc);
  const cusps = natal?.chart.cusps ?? null;
  const planets = sky.planets.map((p) => ({
    body: p.id,
    ...lonInfo(p.lon),
    retrograde: p.retro,
    speed_deg_per_day: round(sp[p.id], 4),
    natal_house: cusps ? houseOf(p.lon, cusps) : null,
  }));
  const aspects: {
    transiting: BodyId;
    natal: NatalPoint;
    aspect: string;
    angle: number;
    orb: number;
    applying: boolean;
    natal_uncertain: boolean;
  }[] = [];
  if (natal)
    for (const p of sky.planets)
      for (const q of natalPoints(natal)) {
        const sep = separation(p.lon, q.lon);
        for (const type of ASPECTS) {
          const orb = Math.abs(sep - type.angle);
          if (orb <= maxOrb)
            aspects.push({
              transiting: p.id,
              natal: q.id,
              aspect: type.name,
              angle: type.angle,
              orb: round(orb, 2),
              applying: applying(p.lon, sp[p.id], q.lon, 0, type.angle),
              natal_uncertain: q.uncertain,
            });
        }
      }
  aspects.sort((x, y) => Number(x.natal_uncertain) - Number(y.natal_uncertain) || x.orb - y.orb);
  const notes: string[] = [];
  if (natal && !natal.chart.known)
    notes.push("Natal birth time unknown: no natal angles or houses; aspects to the natal Moon are flagged uncertain.");
  else if (natal && !natal.angles) notes.push("No natal birth place: no natal angles or houses.");
  notes.push(
    "The transiting Moon moves about 13° a day, so its aspects last hours; the outer planets' last weeks to months.",
  );
  return {
    moment: { date: at.date, time: at.time, timezone: at.zone, local: isoLocal(at.utc, at.zone), utc: isoUtc(at.utc) },
    natal: natal ? { birth: placeLine(natal), house_system: natal.chart.system } : null,
    max_orb: maxOrb,
    planets,
    aspects,
    notes,
  };
}

export function transitsText(j: ReturnType<typeof transitsJson>): string {
  const lines = [`Transits for ${j.moment.local} (${j.moment.timezone})${j.natal ? ` to natal chart ${j.natal.birth}` : ""}`];
  lines.push(
    j.planets
      .map(
        (p) =>
          `${p.body} ${p.position}${p.retrograde ? " R" : ""}${p.natal_house ? ` (natal H${p.natal_house})` : ""}`,
      )
      .join("; "),
  );
  if (j.natal)
    lines.push(
      j.aspects.length
        ? `Aspects to natal within ${j.max_orb}°: ` +
            j.aspects
              .map(
                (x) =>
                  `t.${x.transiting} ${x.aspect} n.${x.natal} ${x.orb.toFixed(1)}°${x.applying ? " a" : " s"}${x.natal_uncertain ? " (uncertain)" : ""}`,
              )
              .join("; ") +
            " (a = applying, s = separating)"
        : `No aspects to the natal chart within ${j.max_orb}°.`,
    );
  for (const n of j.notes) lines.push(`Note: ${n}`);
  return lines.join("\n");
}
