// make the CLI entry executable after tsc (npm also does this on install)
import { chmodSync } from "node:fs";
chmodSync(new URL("../dist/index.js", import.meta.url), 0o755);
