# cosine-astro-mcp

An [MCP](https://modelcontextprotocol.io) server for Western (tropical) astrology calculations: natal charts, transits, synastry, Mercury retrograde, annual profections and moon phases.

Language models are poor at working out where the planets were on a given date; they tend to guess. This server computes the positions instead, offline, from the [astronomy-engine](https://github.com/cosinekitty/astronomy) ephemeris, and hands the model both a compact text summary and the full data as JSON. No API keys, no network calls, no accounts.

Made by **COSINE 余弦** — [cosineastro.com](https://www.cosineastro.com), a birth-chart site with AI readings. This is the same chart engine the site runs, published as an MCP server.

[繁體中文說明](#繁體中文)

## Install

Requires Node.js 20 or later.

**Claude Code**

```sh
claude mcp add cosine-astro -- npx -y cosine-astro-mcp
```

Add `--scope user` to make it available in every project.

**Claude Desktop** — edit `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "cosine-astro": {
      "command": "npx",
      "args": ["-y", "cosine-astro-mcp"]
    }
  }
}
```

**Cursor** — `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "cosine-astro": {
      "command": "npx",
      "args": ["-y", "cosine-astro-mcp"]
    }
  }
}
```

Any other MCP client that speaks stdio works the same way: the command is `npx -y cosine-astro-mcp`.

## Tools

All tools are read-only and deterministic for a given input (except where a date defaults to "now").

| Tool | What it returns |
| --- | --- |
| `natal_chart` | The ten planets (sign, degree, house, retrograde, daily motion), Ascendant and Midheaven, twelve house cusps, major aspects with orbs and applying/separating, and the element and modality balance with the dominant of each. |
| `transits` | Planet positions for a date and time (default: now) and, given a natal chart, the aspects they make to the natal planets, Ascendant and Midheaven within an orb (default 2°), and the natal house each transiting planet is in. |
| `synastry` | Cross aspects between two charts (planets and Ascendant), each person's planets in the other's houses, and a plain tally of conjunctions, harmonious and challenging aspects. |
| `mercury_retrograde` | Mercury retrograde periods overlapping a date range: pre-shadow start, station retrograde, station direct, post-shadow end (to about a minute), with the degrees of both stations. |
| `annual_profection` | For an age or a date: the profected house and sign (whole-sign from the Ascendant), the lord of the year and where it sits natally, and the dates the profection year runs. |
| `moon_phase` | Phase name, illuminated fraction, Sun–Moon angle, days since new moon, Moon and Sun signs, and the next new, first-quarter, full and last-quarter moons. |

### Birth data

`natal_chart`, `annual_profection`, and the `natal` / `person_a` / `person_b` objects of `transits` and `synastry` take:

| Field | Type | Notes |
| --- | --- | --- |
| `date` | `"YYYY-MM-DD"` | Required. Local calendar date. Years 1800–2200. |
| `time` | `"HH:MM"` | Local clock time, 24-hour. Omit if unknown: planets are then cast for local noon, with no Ascendant, Midheaven or houses, and the Moon's range for the day is reported. |
| `timezone` | IANA zone | e.g. `"Asia/Shanghai"`, `"America/New_York"`. Historical daylight saving time is applied (China's 1986–1991 summer time included). |
| `latitude`, `longitude` | degrees | North and east positive. Needed for the Ascendant, Midheaven and houses. |
| `city` | string | Optional shortcut from a built-in table of about 110 large cities (English or Chinese names). Explicit coordinates and zone win. There is no geocoding service: for anywhere else, pass coordinates. |
| `house_system` | `"placidus"` \| `"whole_sign"` | Default Placidus. Inside the polar circles, where Placidus has no solution, whole-sign houses are used and the output says so. |

Other parameters: `transits` takes `date`, `time`, `timezone`, `natal`, `max_orb`; `mercury_retrograde` takes `start_date`, `end_date`, `timezone`; `annual_profection` takes `age` or `on_date`; `moon_phase` takes `date`, `time`, `timezone`. Every tool's JSON schema carries a description of each field.

### Output

Each call returns two text blocks and `structuredContent`:

1. a compact summary written for a model to read, ending with a short note that the positions are computed and that interpretation should be offered as reflection, not prediction;
2. the same data as JSON (also in `structuredContent`).

Example (`natal_chart`, 1995-05-12 08:30, Shanghai):

```
Natal chart: 1995-05-12 08:30 Asia/Shanghai (UTC+08:00) · 31.23°N 121.47°E · Placidus houses
Sun 20°51′ Taurus (H11); Moon 11°41′ Libra (H4); Mercury 12°17′ Gemini (H12); Venus 24°00′ Aries (H10); Mars 24°13′ Leo (H2); Jupiter 13°00′ Sagittarius (H6) R; ...
ASC 12°04′ Cancer · MC 28°08′ Pisces
Aspects: Venus trine Mars 0.2° a; Moon trine Mercury 0.6° a; Mercury opposition Jupiter 0.7° a; ...
Balance: fire 20%, earth 20%, air 27%, water 33% → water; cardinal 40%, fixed 33%, mutable 27% → cardinal
```

### Conventions

- Positions are geocentric, apparent, tropical ecliptic longitudes of date.
- Aspects within a chart: conjunction and opposition 8°, square and trine 6°, sextile 4°. Between two charts (synastry): 6°, 5°, 5°, 3°. Transits: one orb for all, default 2°.
- Element/modality balance: Sun, Moon and Ascendant count 2 points; Mercury to Pluto and the Midheaven 1 point each. Ties go to the Sun's element, then the Moon's, then the Ascendant's.
- Profections count whole signs from the Ascendant (from the Sun's sign when the birth time is unknown); the lord of the year is the traditional ruler, with the modern co-ruler (Pluto, Uranus, Neptune) noted where it differs.
- Shadow periods: the pre-shadow starts when Mercury first reaches the degree where it will later station direct; the post-shadow ends when it moves back past the degree where it stationed retrograde.

Not included: asteroids, lunar nodes, Lilith, Chiron, sidereal zodiacs, house systems other than Placidus and whole-sign, and interpretation text.

## Accuracy

The test suite compares the engine with **Swiss Ephemeris** (2.10.03, via pyswisseph) on 15 reference charts from 1905 to 2001 — northern and southern hemispheres, east and west longitudes, the equator, Helsinki, a chart inside the Arctic Circle, historical daylight saving time, and an unknown birth time. Every planet longitude, Ascendant, Midheaven and Placidus cusp is within **1′ of arc** of the reference, and every UTC conversion matches. Only the reference numbers are included in this repository (`tests/fixtures/reference-charts.json`); no Swiss Ephemeris code is used or distributed.

Things to know:

- Time zones come from the IANA database built into Node.js. For dates before a region adopted standard time, the database uses local mean time; if your source used a different rule, pass the zone you mean (for example `"Etc/GMT-8"` for a fixed UTC+8).
- The Ascendant moves about a degree every four minutes: the chart is only as accurate as the birth time.
- The built-in city coordinates are city centres to about 0.01°.
- Retrograde stations are located to about a minute.

COSINE's methodology and accuracy notes: [cosineastro.com/en/accuracy](https://www.cosineastro.com/en/accuracy).

## About interpretation

The positions are astronomy. What they mean is a tradition of interpretation, not a measurement. The server says so in every result and suggests that a model present readings as prompts for reflection rather than predictions or advice.

## Development

```sh
npm install
npm test          # reference charts + every tool through an MCP client
npm run build
npm run smoke     # starts dist/index.js over stdio and calls each tool
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list
```

## Credits and license

MIT. The chart engine is ported from [COSINE](https://www.cosineastro.com) and uses [astronomy-engine](https://github.com/cosinekitty/astronomy) by Don Cross (MIT). Reference values for the tests were generated with Swiss Ephemeris by Astrodienst (used only to produce the numbers; not part of this package).

Made by COSINE — https://www.cosineastro.com · [Free birth chart](https://www.cosineastro.com/en/birth) · [Accuracy](https://www.cosineastro.com/en/accuracy)

---

## 繁體中文

**cosine-astro-mcp** 是一個 [MCP](https://modelcontextprotocol.io) 伺服器，提供西洋占星（回歸黃道）計算：本命盤、行運、合盤、水星逆行、年度小限、月相。

大型語言模型自己推算行星位置往往不準。這個伺服器改用 [astronomy-engine](https://github.com/cosinekitty/astronomy) 星曆在本機離線計算，回傳一段給模型讀的精簡文字摘要，以及完整的 JSON 資料。不需要 API 金鑰，不連網。

由 **COSINE 余弦**（[cosineastro.com](https://www.cosineastro.com)）製作，和網站使用同一套星盤引擎。

### 安裝

需要 Node.js 20 以上。

- Claude Code：`claude mcp add cosine-astro -- npx -y cosine-astro-mcp`
- Claude Desktop／Cursor：在設定檔的 `mcpServers` 加入 `"cosine-astro": { "command": "npx", "args": ["-y", "cosine-astro-mcp"] }`（完整範例見上方英文說明）

### 工具

| 工具 | 內容 |
| --- | --- |
| `natal_chart` | 本命盤：十顆行星的星座、度數、宮位、逆行；上升、天頂；十二宮頭（預設 Placidus，極圈內改用整宮制並註明）；主要相位與容許度、入相／出相；元素與模式的分布及主導。 |
| `transits` | 指定時刻（預設現在）的行星位置；若提供本命盤，列出行運行星對本命行星、上升、天頂的相位（預設容許度 2°）及所落本命宮位。 |
| `synastry` | 合盤：雙方行星（含上升）之間的相位、各自行星落入對方的宮位，以及簡單的相位統計（不是配對分數）。 |
| `mercury_retrograde` | 日期範圍內的水星逆行：前影期開始、停滯轉逆、停滯轉順、後影期結束（精確到約一分鐘），以及兩次停滯的度數。 |
| `annual_profection` | 依年齡或日期計算年度小限：小限宮位與星座（從上升星座以整宮計；不知出生時間則從太陽星座起算）、年主星及其本命位置、該小限年的起訖日期。 |
| `moon_phase` | 月相名稱、照亮比例、日月角距、月齡，以及下一次新月、上弦、滿月、下弦。 |

出生資料：`date`（YYYY-MM-DD，必填）、`time`（HH:MM，不知道就省略：不給上升、天頂與宮位）、`timezone`（IANA 時區，如 `Asia/Taipei`，自動套用歷史夏令時間）、`latitude`／`longitude`（北緯、東經為正），或用 `city` 從內建約 110 個大城市（中英文名皆可，繁簡皆可）中選取。不呼叫任何地理編碼服務；其他地點請直接給經緯度。

### 準確度

測試以 **Swiss Ephemeris**（2.10.03，pyswisseph）計算的 15 張參考星盤（1905–2001 年，涵蓋南北半球、東西經、赤道、高緯度、北極圈內、歷史夏令時間、出生時間不詳）比對：所有行星黃經、上升、天頂與 Placidus 宮頭誤差都在 **1 角分**以內，UTC 換算全部一致。本專案只收錄參考數值，不含也不散布任何 Swiss Ephemeris 程式碼。準確度說明見 [cosineastro.com/en/accuracy](https://www.cosineastro.com/en/accuracy)。

### 關於解讀

行星位置是天文計算；它們代表什麼，屬於占星的詮釋傳統，而非測量結果。每次回傳都附上提示：請把解讀當作自我反思的參考，而不是預言或建議。

### 授權

MIT。星盤引擎移植自 [COSINE](https://www.cosineastro.com)，使用 Don Cross 的 [astronomy-engine](https://github.com/cosinekitty/astronomy)（MIT）。

由 COSINE 製作 — https://www.cosineastro.com · [免費排本命盤](https://www.cosineastro.com/zh-hant/birth)
