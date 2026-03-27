# QR Terminal

> A cinematic, full-featured QR code generator that lives entirely in your terminal.

Built on a custom **High-Density Half-Block Rendering Engine** that uses Unicode symbols (`▀`, `▄`, `█`) to compress two vertical pixels into one character row — so even large QR codes fit on a standard 24-line terminal without scrolling.

---

## Features at a Glance

| Feature | Description |
|---|---|
| **Half-Block Engine** | Custom bitmasking parser: 2 QR pixels → 1 Unicode char (50% vertical compression) |
| **Braille Renderer** | 2×4 dot grid per cell for 4× the resolution of standard ASCII renderers |
| **Particle Fly-In** | Characters scatter from random positions and snap into formation with cubic ease-out |
| **Matrix Rain** | Animated green cascade sweeps down columns before settling to your chosen gradient |
| **2D Gradients** | Per-character color — diagonal, sine-wave, radial bloom, 4-corner bilinear blend |
| **Device Handshake** | Scan QR → phone connects via WebSocket → type on phone, text appears in terminal |
| **Luma Detection** | OSC 11 escape sequence queries your terminal's real background color — auto-adapts |
| **Self-Destruct QR** | Share a file via public tunnel; tunnel closes with an ASCII explosion after one download |
| **Live Preview** | WYSIWYG input — QR regenerates on every keypress with a live version badge |
| **10 Color Themes** | Classic · Retro · Ocean · Neon · Sunset · Galaxy · Cherry · Matrix · Fire · Vaporwave |

---

## Installation

**Requirements:** Node.js ≥ 18

```bash
git clone https://github.com/your-username/qr-terminal
cd qr-terminal
npm install
```

### Run once (from project folder)

```bash
npm start
# or
node index.js
```

### Install globally (run from anywhere)

```bash
npm link
qr-terminal
```

---

## Usage

Launch the interactive TUI:

```bash
qr-terminal
```

You will be guided through four prompts:

```
? What do you want to encode?     → URL / WiFi / vCard / Secret Text
? Error correction level?          → L / M / Q / H
? Color theme?                     → 10 gradient presets
? Render engine?                   → Half-Block / Braille / Particle / Matrix Rain / Device Link
```

After the QR renders, a final menu lets you copy, export, or share the code.

---

## Input Types

### URL
Encodes any web address. While you type, the QR code updates in real time in a live preview panel — including a badge showing the current QR version and character count.

```
› URL: https://github.com/anthropics█
```

Optional: shorten long URLs via **TinyURL** before encoding to produce a smaller, lower-version QR matrix.

### WiFi Credentials
Generates a tap-to-join QR code following the official `WIFI:` URI standard, compatible with iOS 11+ and Android 10+ camera apps.

```
WIFI:T:WPA;S:MyNetwork;P:MyPassword;H:false;;
```

Supports WPA/WPA2/WPA3, WEP, and open networks. Hidden network toggle included.

### vCard Contact
Produces a standards-compliant vCard v3.0 payload. Scan with any phone camera to import the contact directly into the address book.

Fields: first/last name, phone, email, organisation, website.

### Secret Text
Encodes any arbitrary payload — API keys, tokens, passwords, notes. Input is masked during typing.

---

## Render Engines

### Half-Block (default)

The core engine. Uses a 2-bit bitmask on each pair of vertical QR pixels to select the correct Unicode glyph:

```
top=1 bot=1  →  █   (FULL BLOCK)
top=1 bot=0  →  ▀   (UPPER HALF)
top=0 bot=1  →  ▄   (LOWER HALF)
top=0 bot=0  →  (space)
```

A **scanline animation** sweeps down on first render, followed by a brief brightness pulse (lock-on effect). Quiet zone is 2 cells wide on all sides.

### Braille (⣿ Retina Mode)

Maps 2×4 blocks of QR modules onto Unicode Braille patterns (U+2800–U+28FF). Each terminal cell encodes **8 dots** across a 2-column × 4-row grid, giving **4× the vertical resolution** of the half-block renderer.

```
Dot layout per cell:
  col+0  col+1
  ●      ●      ← row+0  (dot1, dot4)
  ●      ●      ← row+1  (dot2, dot5)
  ●      ●      ← row+2  (dot3, dot6)
  ●      ●      ← row+3  (dot7, dot8)
```

Produces a finer-grained, more detailed visual at the same character cell dimensions.

### Particle Fly-In (✦ Transformer Effect)

Each dark QR module becomes an individual particle:

1. All particles start at **random scatter positions** within the framebuffer
2. They simultaneously converge to their correct positions using **cubic ease-out** easing
3. A per-particle **stagger delay** (0–30% of total duration) creates organic, non-simultaneous arrival
4. Total animation: ~1.1 seconds at 30 fps

The effect looks like the QR code assembles itself out of chaos — highly shareable.

### Matrix Rain (░)

Inspired by the classic matrix screensaver:

1. The fully-formed QR code is shown immediately
2. Bright green `#00FF41` droplets cascade down each column with per-column phase offsets
3. Over ~2.2 seconds, the rain fades out and the QR settles to your chosen gradient
4. Each droplet's brightness is computed from the wrapped distance between the column phase and the current row position

### Device Link (📡 Phone Handshake)

The most interactive mode:

1. A local HTTP + WebSocket server starts on your machine (port 3847–3946)
2. A QR code encodes the server's LAN address (`http://192.168.x.x:PORT`)
3. Scanning with a phone opens a minimal mobile web UI served directly from the terminal process
4. The moment the phone connects, the terminal shows **`DEVICE CONNECTED ✓`**
5. Text typed and transmitted on the phone appears instantly in the terminal session

The mobile page is self-contained HTML/CSS/JS — no internet required, no external service.

---

## Color Themes

All themes use **24-bit TrueColor** (`\x1b[38;2;R;G;Bm`) applied **per character**, not per row. Adjacent characters with similar colors are grouped into a single ANSI sequence to minimise output size.

| Theme | Algorithm | Colors |
|---|---|---|
| **Classic** | Solid | `rgb(220,220,220)` — crisp white |
| **Retro** | Diagonal | Coral red → warm amber |
| **Ocean** | Diagonal | Deep navy → electric cyan |
| **Neon** | Sine-wave | Green · cyan · magenta ripple |
| **Sunset** | Diagonal | Hot red → orange → gold |
| **Galaxy** | 4-corner bilinear | Purple · blue · pink · teal |
| **Cherry** | Radial bloom | Soft white centre → deep rose |
| **Matrix** | Vertical | Dark green → electric green |
| **Fire** | Diagonal | Blood red → ember → gold |
| **Vaporwave** | 4-corner bilinear | Magenta · cyan · purple · blue |

**Gradient algorithms:**
- `diagonal` — `t = (tx + ty) / 2` across the full matrix
- `wave` — `t = (sin(tx·3.5π + ty·2.5π) + 1) / 2` creates interference patterns
- `radial` — distance from centre, blooms outward
- `4corner` — bilinear interpolation between four independently-set corner colours

---

## Luma Detection (Auto-Inversion)

At startup, the tool sends an **OSC 11** escape sequence (`\x1b]11;?\x07`) to query the terminal's real background colour. The response is parsed as a 16-bit RGB triplet and its WCAG relative luminance is computed:

```
L = 0.2126·R + 0.7152·G + 0.0722·B
```

If `L > 127` (light background — Solarized Light, GitHub Light, etc.), a warning is shown and `process.env._QR_LIGHT_BG` is set for downstream use. Supported by iTerm2, Terminal.app, xterm, Windows Terminal, and most modern emulators. Times out silently after 400ms on unsupported terminals.

---

## Self-Destructing File Share (☠)

Available in the post-render export menu:

1. You provide a file path
2. A local HTTP server loads the file into memory
3. **localtunnel** creates a public HTTPS URL tunneled to your machine
4. A QR code is generated for that URL — in the **Fire** gradient
5. The first person to scan and download the file triggers shutdown:
   - The server closes
   - The tunnel closes
   - An ASCII **explosion animation** plays in the terminal
6. Any subsequent requests to the URL receive a `410 Gone` response

```
  ☠
 ✦☠✦
✦✦☠✦✦
 ✧✦✧
  ✧
```

The file is served from RAM — nothing is written to disk.

---

## Export Options

After any QR render, a checkbox menu offers:

| Option | Output |
|---|---|
| **Copy ASCII to clipboard** | Plain Unicode half-block string (no ANSI), ready to paste into Slack, README, or any terminal |
| **Save as PNG** | High-resolution raster image (600px default) via qrcode's canvas renderer |
| **Save as SVG** | Scalable vector — ideal for print, presentations, and web |
| **Save as TXT** | Plain Unicode half-block text file |
| **Self-destruct share** | One-time public file tunnel (see above) |

---

## Architecture

```
qr-terminal/
├── index.js                 Entry point, luma detection, header
└── src/
    ├── engine.js            Half-block renderer, 2D gradient engine, buildParticleData()
    ├── braille.js           Braille-block hybrid renderer (4× resolution)
    ├── particle.js          Particle fly-in animation system (framebuffer + easing)
    ├── matrix-rain.js       Matrix rain animation (per-column phase cascade)
    ├── live-preview.js      WYSIWYG live input with real-time QR update
    ├── luma.js              OSC 11 terminal background colour detection
    ├── handshake.js         HTTP + WebSocket device link server + mobile page
    ├── destruct.js          Self-destructing file tunnel + ASCII explosion
    ├── prompts.js           Main interactive flow (inquirer orchestration)
    ├── ui.js                Header, scanline reveal animation, display helpers
    ├── formatters.js        WiFi / vCard / error-level / gradient metadata
    ├── export.js            PNG / SVG / TXT file export
    └── shortlink.js         TinyURL API integration
```

### Rendering pipeline

```
Text input
    │
    ▼
createMatrix()          — qrcode.create() → raw Uint8ClampedArray modules
    │
    ▼
buildParticleData()     — extract (row, col, char, color) tuples
    │
    ├──► renderHalfBlock()    — chalk.rgb() per grouped character run
    ├──► renderBraille()      — U+2800 + 8-bit bitmask per 2×4 block
    ├──► animateParticleFlyIn() — framebuffer, cubic ease, 30fps
    └──► matrixRainQR()       — per-column phase, green compositing, 24fps
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `qrcode` | QR matrix generation (modules only — rendering is custom) |
| `@inquirer/prompts` | Interactive CLI prompts |
| `chalk` | 24-bit TrueColor ANSI sequences |
| `gradient-string` | Header ASCII art gradient |
| `figlet` | Figlet ASCII art for the header |
| `boxen` | Rounded-corner box around the header |
| `ora` | Spinner animations |
| `clipboardy` | System clipboard access |
| `axios` | TinyURL API requests |
| `ws` | WebSocket server for device handshake |
| `localtunnel` | Public HTTPS tunnel for self-destruct file share |

---

## Requirements

- **Node.js** ≥ 18.0.0
- **Terminal** with 24-bit TrueColor support (Windows Terminal, iTerm2, Kitty, Alacritty, or any xterm-compatible emulator)
- **Network access** (optional — required only for TinyURL shortening and self-destruct tunnel)
- **Phone on same LAN** (optional — required only for Device Link mode)

---

## License

MIT
