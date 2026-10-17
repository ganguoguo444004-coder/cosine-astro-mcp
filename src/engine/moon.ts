/* The Moon's phase at a moment, and the next new and full moons. */
import * as Astronomy from "astronomy-engine";
import { lonOf } from "./core.js";
import { isoLocal, isoUtc, lonInfo, round } from "./format.js";

const PRINCIPAL = ["New Moon", "First Quarter", "Full Moon", "Last Quarter"];
const BETWEEN = ["Waxing Crescent", "Waxing Gibbous", "Waning Gibbous", "Waning Crescent"];
/** the Moon gains about 12.2° a day on the Sun: a principal phase is named within a day of exact */
const WINDOW = 12.2;

function phaseName(angle: number): string {
  const q = Math.round(angle / 90) % 4;
  const off = Math.abs(angle - Math.round(angle / 90) * 90);
  return off <= WINDOW ? PRINCIPAL[q] : BETWEEN[Math.floor(angle / 90)];
}

export function moonPhaseJson(utc: number, zone: string) {
  const time = Astronomy.MakeTime(new Date(utc));
  // elongation of the Moon from the Sun in ecliptic longitude: 0 new, 90 first quarter, 180 full
  const angle = Astronomy.MoonPhase(time);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, time).phase_fraction;
  const name = phaseName(angle);
  const at = (t: Astronomy.AstroTime | null) =>
    t ? { utc: isoUtc(t.date.getTime()), local: isoLocal(t.date.getTime(), zone) } : null;
  const prevNew = Astronomy.SearchMoonPhase(0, time.AddDays(-30), 30);
  const next = (deg: number) => {
    const t = Astronomy.SearchMoonPhase(deg, time, 40);
    return t ? { ...at(t)!, moon: lonInfo(lonOf("Moon", t)).position } : null;
  };
  return {
    moment: { local: isoLocal(utc, zone), utc: isoUtc(utc), timezone: zone },
    phase: name,
    phase_angle: round(angle, 2),
    illumination: round(illum, 4),
    waxing: angle < 180,
    age_days: prevNew ? round((utc - prevNew.date.getTime()) / 864e5, 2) : null,
    moon: lonInfo(lonOf("Moon", time)),
    sun: lonInfo(lonOf("Sun", time)),
    next_new_moon: next(0),
    next_first_quarter: next(90),
    next_full_moon: next(180),
    next_last_quarter: next(270),
    notes: [
      "New, First Quarter, Full and Last Quarter are named within about a day (12.2° of Sun–Moon angle) of the exact phase; otherwise crescent or gibbous. Exact phase moments are in the next_* fields.",
    ],
  };
}

export function moonPhaseText(j: ReturnType<typeof moonPhaseJson>): string {
  return [
    `Moon at ${j.moment.local} (${j.moment.timezone}): ${j.phase}, ${Math.round(j.illumination * 100)}% lit, ${j.phase_angle}° from the Sun, ${j.age_days} days since new; Moon ${j.moon.position}, Sun ${j.sun.position}.`,
    `Next new moon ${j.next_new_moon?.local} (${j.next_new_moon?.moon}); next full moon ${j.next_full_moon?.local} (${j.next_full_moon?.moon}).`,
  ].join("\n");
}
