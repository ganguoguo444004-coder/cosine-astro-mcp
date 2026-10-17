/* Mercury retrograde periods (with shadows) overlapping a date range. */
import { retrogrades } from "./events.js";
import { isoLocal, isoUtc, lonInfo, signOf } from "./format.js";

const DAY = 864e5;

export function mercuryRetrogradeJson(startUtc: number, endUtc: number, zone: string) {
  const y0 = new Date(startUtc).getUTCFullYear() - 1,
    y1 = new Date(endUtc).getUTCFullYear();
  const at = (ms: number) => ({ utc: isoUtc(ms), local: isoLocal(ms, zone) });
  const periods = retrogrades("Mercury", y0, y1)
    .filter((r) => r.shadowEnd >= startUtc && r.shadowStart < endUtc)
    .map((r) => ({
      shadow_start: at(r.shadowStart),
      retrograde_start: at(r.station),
      retrograde_end: at(r.direct),
      shadow_end: at(r.shadowEnd),
      retrograde_days: Math.round(((r.direct - r.station) / DAY) * 10) / 10,
      station_retrograde: lonInfo(r.stationLon),
      station_direct: lonInfo(r.directLon),
      signs:
        signOf(r.stationLon) === signOf(r.directLon)
          ? [signOf(r.stationLon)]
          : [signOf(r.stationLon), signOf(r.directLon)],
    }));
  return {
    range: { start: isoLocal(startUtc, zone).slice(0, 10), end: isoLocal(endUtc - 1, zone).slice(0, 10), timezone: zone },
    periods,
    definitions: {
      retrograde_start: "Mercury's station retrograde: its geocentric longitude stops increasing",
      retrograde_end: "station direct: the longitude starts increasing again",
      shadow_start: "pre-shadow begins: Mercury first reaches the degree where it will later station direct",
      shadow_end: "post-shadow ends: Mercury moves back past the degree where it stationed retrograde",
    },
    notes: [
      "Stations are found to about a minute. Mercury barely moves near a station, so its apparent stillness lasts a day or two either side.",
      "A period is listed when any part of it (shadows included) overlaps the range.",
    ],
  };
}

export function mercuryRetrogradeText(j: ReturnType<typeof mercuryRetrogradeJson>): string {
  const lines = [`Mercury retrograde, ${j.range.start} to ${j.range.end} (${j.range.timezone} times):`];
  if (!j.periods.length) lines.push("None in this range.");
  for (const p of j.periods)
    lines.push(
      `- ${p.retrograde_start.local.slice(0, 16)} → ${p.retrograde_end.local.slice(0, 16)} (${p.retrograde_days} d), ` +
        `${p.station_retrograde.position} back to ${p.station_direct.position}; ` +
        `shadow ${p.shadow_start.local.slice(0, 10)} → ${p.shadow_end.local.slice(0, 10)}`,
    );
  for (const n of j.notes) lines.push(`Note: ${n}`);
  return lines.join("\n");
}
