# QR Terminal

A cinematic, interactive QR code generator that runs entirely in your terminal.

Generate QR codes for URLs, WiFi networks, contacts, and secrets — with live preview, animated rendering, gradient colors, history recall, PDF/GIF export, shareable links, and phone handshake.

---

## Quick Start

```bash
npx qr-terminal
```

Or install globally so you can run it from anywhere:

```bash
npm install -g qr-terminal
qr
```

**Requires:** Node.js 18 or higher

---

## What It Does

Launch it and follow the prompts. You'll pick:

1. **What to encode** — URL, WiFi, contact card, secret text, or recall from history
2. **Error correction** — how much damage the QR can survive
3. **Color theme** — 10 gradient options
4. **Render engine** — how the QR appears on screen

After it renders, export it, share it, or go straight back to the main menu.

---

## Input Types

### URL
Type any web address and watch the QR code build itself in real time as you type. Optionally shorten long URLs via TinyURL to keep the QR small and clean.

### WiFi
Generates a tap-to-join QR code. Point your phone camera at it — no app needed — and it connects automatically.

Supports WPA/WPA2, WEP, and open networks.

### vCard Contact
Share your contact info as a QR code. Anyone who scans it gets a prompt to save you directly to their address book.

Fields: name, phone, email, organisation, website.

### Secret Text
Encode anything sensitive — API keys, passwords, tokens. Input is masked while you type. Secrets are never saved to history.

---

## Render Engines

### Half-Block (default)
Uses Unicode characters (`▀`, `▄`, `█`) to fit a full QR code in half the usual vertical space. Renders with a cyan scanline sweep animation followed by a brightness pulse.

### Braille — Retina Mode
Each terminal character cell encodes a 2×4 dot grid, giving 4× the visual resolution of standard terminal QR tools. The QR looks noticeably sharper.

### Particle — Transformer Effect
Every block in the QR starts at a random position on screen and flies into its correct place simultaneously. The code assembles itself out of chaos over about one second.

### Matrix Rain
A cascade of green characters rains down the columns of the QR code before fading out to reveal your chosen color theme underneath.

### Device Link — Phone Handshake
The most interactive mode:

1. Scan the QR with your phone
2. A page opens in your phone's browser
3. The terminal instantly shows **DEVICE CONNECTED ✓**
4. Type on your phone and hit transmit — the text appears in your terminal

Everything runs over your local network. No internet required, no account needed.

---

## Color Themes

| Theme | Style |
|---|---|
| Classic | Crisp white — maximum scanner reliability |
| Retro | Coral red fading to warm amber |
| Ocean | Deep navy sweeping to electric cyan |
| Neon | Sine-wave ripple: green · cyan · magenta |
| Sunset | Hot red through orange to gold |
| Galaxy | 4-corner blend: purple · blue · pink · teal |
| Cherry | Radial bloom: soft white centre to deep rose |
| Matrix | Dark green cascading to electric green |
| Fire | Blood red through ember to gold |
| Vaporwave | 4-corner: magenta · cyan · purple · blue |

All themes use 24-bit TrueColor applied per character — not per row — so gradients wash diagonally, radially, or in waves across the entire code.

---

## Export Options

After any QR renders, pick from the export menu (you can run multiple actions before going back):

| Option | What you get |
|---|---|
| Copy to clipboard | Plain Unicode characters — paste into Slack, a README, or any terminal |
| Save as PNG | High-resolution image file (600px) |
| Save as SVG | Scalable vector — perfect for print or presentations |
| Save as PDF | A4 print-ready document with the QR centered and labelled |
| Save as GIF | Animated particle fly-in GIF if using Particle/Matrix engine, static colored GIF otherwise |
| Save as TXT | Plain text half-block file |
| Get shareable link | A URL that opens the QR as an image in any browser — copy and paste anywhere |
| Self-destruct share | One-time public link for a file (see below) |

---

## History

Every QR you generate is automatically saved to `~/.qr-history.json` (last 20, newest first).

Select **View History** from the main menu to browse and re-render any past code instantly — same gradient, error correction, and render engine as before. Secrets are never stored.

---

## Shareable Link

After generating any non-secret QR, choose **Get shareable link** from the export menu. You'll get a URL like:

```
https://quickchart.io/qr?text=...
```

Paste it into a chat, email, or browser — anyone who opens it sees the QR code as an image, no app or terminal needed.

---

## Self-Destructing File Share

Pick **Self-destruct share** from the export menu and point it at any file on your machine:

- The file is loaded into memory and hosted via a public tunnel
- A QR code is generated for the public URL
- The first person to scan and download it triggers the shutdown
- The tunnel closes, the server stops, and an ASCII explosion plays in the terminal
- Anyone who tries the link afterwards gets a `410 Gone` response

The file is never written anywhere — it lives in RAM only.

---

## Plain / No-Color Mode

For CI pipelines, SSH sessions, or terminals without color support:

```bash
qr --plain
# or
qr --no-color
```

Outputs a raw ASCII QR code (`█▀▄`) with no animations or ANSI color codes — safe to pipe, log, or redirect.

---

## Auto Theme Detection

When the tool starts, it silently queries your terminal's actual background color using the OSC 11 escape sequence. If you're on a light-background theme (Solarized Light, GitHub Light, etc.) it detects this automatically and warns you so you can choose a high-contrast color theme.

Works with: iTerm2, Windows Terminal, Terminal.app, Kitty, Alacritty, xterm-compatible emulators.

---

## Navigation

Every menu has a **← Back** option — you never need to restart the terminal to change your mind. The app stays open between QR generations until you pick **Exit** from the main menu or press `Ctrl+C`.

---

## Requirements

- Node.js 18+
- A terminal with 24-bit TrueColor support
  - Windows Terminal ✓
  - iTerm2 ✓
  - Kitty ✓
  - Alacritty ✓
  - VS Code integrated terminal ✓
- Phone on the same WiFi network (Device Link mode only)
- Internet connection (TinyURL shortening, shareable links, and self-destruct tunnel only)

---

## License

MIT
