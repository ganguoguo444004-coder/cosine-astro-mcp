/*
 * Annual profections (Hellenistic time-lord technique): each year of life the Ascendant
 * "advances" one sign. At age n the profected sign is the n-th sign after the Ascendant's
 * (whole-sign houses, counting from 0 at birth), and that sign's traditional ruler is the
 * "lord of the year". Without a birth time, the Sun's sign stands in for the Ascendant.
 */
import { houseOf } from "./core.js";
import { placeLine, type CastChart } from "./chart.js";
import { lonInfo, MODERN_RULER, SIGNS, signIndex, TRADITIONAL_RULER } from "./format.js";

const pad = (n: number) => (n < 10 ? "0" : "") + n;

/** a birthday in a given year; 29 February falls on 1 March in common years */
function birthday(y: number, m: number, d: number): string {
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** completed years on a local calendar date */
export function ageOn(cc: CastChart, on: { y: number; m: number; d: number }): number {
  const b = cc.birth;
  let age = on.y - b.y;
  if (on.m < b.m || (on.m === b.m && on.d < b.d)) age--;
  return age;
}

export function profectionJson(cc: CastChart, age: number) {
  const c = cc.chart;
  const b = cc.birth;
  const solar = !cc.angles;
  const base = signIndex(solar ? c.planets[0].lon : c.asc!);
  const step = age % 12;
  const sign = (base + step) % 12;
  const lord = TRADITIONAL_RULER[sign];
  const modern = MODERN_RULER[sign] ?? null;
  const lordPlanet = c.planets.find((p) => p.id === lord)!;
  const whole = (lon: number) => ((signIndex(lon) - base + 12) % 12) + 1;
  const inSign = c.planets.filter((p) => signIndex(p.lon) === sign).map((p) => p.id);
  const notes = [
    "Profections count whole signs from the Ascendant regardless of the house system used for the chart.",
  ];
  if (solar)
    notes.push(
      "No birth time (or place): counted from the Sun's sign instead of the Ascendant (a 'solar' profection), so the houses are solar houses.",
    );
  return {
    birth: placeLine(cc),
    age,
    basis: solar ? "Sun sign (birth time unknown)" : "Ascendant sign",
    start_sign: SIGNS[base],
    profected_house: step + 1,
    profected_sign: SIGNS[sign],
    lord_of_year: lord,
    modern_co_ruler: modern,
    lord_natal: {
      ...lonInfo(lordPlanet.lon),
      whole_sign_house: whole(lordPlanet.lon),
      house: c.cusps ? houseOf(lordPlanet.lon, c.cusps) : null,
      house_system: c.system,
      retrograde: lordPlanet.retro,
    },
    natal_planets_in_profected_sign: inSign,
    period: { from: birthday(b.y + age, b.m, b.d), to: birthday(b.y + age + 1, b.m, b.d) },
    same_house_ages: Array.from({ length: 9 }, (_, k) => step + 12 * k),
    notes,
  };
}

export function profectionText(j: ReturnType<typeof profectionJson>): string {
  const ln = j.lord_natal;
  return [
    `Annual profection: ${j.birth}`,
    `Age ${j.age} (${j.period.from} to ${j.period.to}): house ${j.profected_house} from the ${j.basis}, ${j.profected_sign}. ` +
      `Lord of the year: ${j.lord_of_year}${j.modern_co_ruler ? ` (modern co-ruler ${j.modern_co_ruler})` : ""}, natally at ${ln.position}, ` +
      `whole-sign house ${ln.whole_sign_house}${ln.house && ln.house !== ln.whole_sign_house ? ` (${ln.house_system} house ${ln.house})` : ""}${ln.retrograde ? ", retrograde" : ""}.`,
    `Natal planets in ${j.profected_sign}: ${j.natal_planets_in_profected_sign.join(", ") || "none"}. Same house again at ages ${j.same_house_ages.slice(0, 7).join(", ")}…`,
    ...j.notes.map((n) => `Note: ${n}`),
  ].join("\n");
}
