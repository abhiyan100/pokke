# Xtractor — spec

Snip anything on screen, add a note, and your own AI model files it into a pocket with a prompt that is ready to paste next time.

## What it must do

1. Clone, `npm install`, `npm start`. No other toolchain.
2. Double-tap Right ⌘ (Right Ctrl on Windows) anywhere: the screen freezes under a crosshair, you drag a region.
3. A note field appears under the selection. Enter saves, Esc discards.
4. The snip is saved locally straight away and a small thumbnail sits in the corner (like the macOS screenshot preview) while the AI works in the background.
5. The AI looks at the image and the note, then picks a pocket, a title, tags, and writes a reusable prompt.
6. The library shows pockets that open into the snips. Each snip offers: copy prompt, copy image, copy both.
7. The user chooses the model: Claude, OpenAI, Gemini, a local Ollama model, or any OpenAI-compatible endpoint, with their own key. Saving works with no model configured; analysis runs later.
8. Everything stays on disk. Nothing is uploaded except the image and note sent to the model the user picked.

Not in this version: source URL capture, multi-display selection spanning screens, sync, sharing, video.

## Approaches considered

| | Electron (chosen) | Tauri | Browser extension |
|---|---|---|---|
| Clone and run | Node only | needs Rust toolchain | manual load, per browser |
| Capture anywhere on screen | yes | yes | only inside the browser |
| Global double-tap hotkey | yes (native key hook) | yes | no |
| Windows | same code | same code | same code |

Electron wins on "clone and run" and on capturing outside the browser. Cost: a larger install.

## Architecture

```
src/main      Electron main: hotkey, capture, windows, tray, library store, AI queue
src/preload   contextBridge API (the only surface the UI can call)
src/shared    types, pocket definitions — imported by main and renderer
src/renderer  three pages: overlay (capture), toast (corner thumbnail), library
site          landing page (static, Vercel-ready)
tests         vitest (logic) + Playwright (UI in headless Chromium, mock bridge)
```

- Library on disk: `<userData>/library/index.json` + `images/<id>.png` + `thumbs/<id>.jpg`. Writes are atomic (temp file then rename).
- Images reach the UI through an `xtractor://` protocol, not `file://`.
- API keys are encrypted with Electron `safeStorage` (OS keychain).
- The renderer talks to `window.xtractor`. In a plain browser that object is absent and a mock with sample data takes its place, which is how the UI is tested without opening a window.
- Hotkey: `uiohook-napi` for the modifier double-tap (needs Accessibility permission on macOS); a regular shortcut (⌘⇧2 / Ctrl+Shift+2) always works as the fallback.

## Pockets

Design, Prompts, Ideas, Code, Reads, Tools, Loose. The AI must choose one of these.

## Design

Concept: indigo textile. The marching-ants selection of every snipping tool already looks like a sashiko running stitch, so the whole product is stitched cloth: you stitch around what you want, the patch is cut out, and it is tucked into a pocket of an indigo cloth roll.

- Colour (the indigo dip scale plus one plant-dye accent): kachi `#181B39`, kon `#223A70`, ai `#165E83`, hanada `#2792C3`, kamenozoki `#A2D7DD`, kinari `#FBFAF5`, akane (madder red, the only accent) `#E0454E`.
- Type: Zen Maru Gothic only. Rounded strokes read as laid thread.
- Structure: stitched hems (dashed kinari lines) mark things that hold other things: pockets, patches, the selection. Nothing else gets a border.
- Each pocket is identified by a sashiko pattern, not an icon: asanoha, yabane, shippo, igeta, shima, seigaiha, juji (in pocket order).
- Motion answers actions: the stitch sews while dragging, the patch flies to the corner on save, a red thread runs round a patch while the AI works, pockets open with springs. Reduced motion is respected.
- Words: as few as possible. Verbs stay the same through a flow (Save → Saved, Copy prompt → Copied).

## Acceptance

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:ui`, `npm run build`, `npm run site:build` pass.
- Headless UI tests cover: drag-select → note → save in the overlay; pocket open → snip detail → copy actions; search; settings.
- A hidden Electron smoke run proves the main process boots, the store saves a snip, and the pages load.
- Needs the user's hands (cannot be verified headlessly): granting Screen Recording and Accessibility, the real hotkey, a live model call with a real key.
