#!/usr/bin/env node
/* CLI entry: an MCP server over stdio. */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, NAME, VERSION } from "./server.js";

const arg = process.argv[2];
if (arg === "--version" || arg === "-v") {
  console.log(VERSION);
  process.exit(0);
}
if (arg === "--help" || arg === "-h") {
  console.log(
    `${NAME} ${VERSION}: an astrology MCP server over stdio (natal_chart, transits, synastry, mercury_retrograde, annual_profection, moon_phase).\n` +
      "Run it from an MCP client, e.g.  claude mcp add cosine-astro -- npx -y cosine-astro-mcp\n" +
      "https://www.cosineastro.com",
  );
  process.exit(0);
}

const server = createServer();
await server.connect(new StdioServerTransport());
console.error(`${NAME} ${VERSION} running on stdio`);
