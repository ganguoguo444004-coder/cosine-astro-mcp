// End-to-end check: start the built server over stdio (as an MCP client would) and call every
// tool once, printing each text summary. Usage: npm run build && npm run smoke [-- <command...>]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [command, ...args] = process.argv.length > 2 ? process.argv.slice(2) : ["node", ["dist/index.js"]].flat();
const transport = new StdioClientTransport({ command, args, stderr: "inherit" });
const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(transport);

const birth = { date: "1995-05-12", time: "08:30", timezone: "Asia/Shanghai", latitude: 31.23, longitude: 121.47 };
const calls = [
  ["natal_chart", birth],
  ["natal_chart", { date: "1969-07-20", time: "22:56", city: "New York" }],
  ["transits", { date: "2026-10-24", timezone: "Asia/Shanghai", natal: birth }],
  ["synastry", { person_a: birth, person_b: { date: "1993-11-02", time: "19:05", city: "Taipei" } }],
  ["mercury_retrograde", { start_date: "2026-01-01", end_date: "2026-12-31", timezone: "Asia/Shanghai" }],
  ["annual_profection", { ...birth, on_date: "2026-10-17" }],
  ["moon_phase", { date: "2026-10-17", time: "21:00", timezone: "Asia/Shanghai" }],
];

const { tools } = await client.listTools();
console.log(`server ${client.getServerVersion()?.name} ${client.getServerVersion()?.version}: ${tools.map((t) => t.name).join(", ")}\n`);
let failed = 0;
for (const [name, a] of calls) {
  const r = await client.callTool({ name, arguments: a });
  if (r.isError || !r.structuredContent) failed++;
  console.log(`=== ${name} ${r.isError ? "ERROR" : "ok"} (${r.content[1]?.text.length ?? 0} bytes JSON)\n${r.content[0].text}\n`);
}
await client.close();
if (failed) {
  console.error(`${failed} call(s) failed`);
  process.exit(1);
}
