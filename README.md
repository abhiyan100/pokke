# Xtractor

Snip anything on your screen, add a note, and your own AI model files it into a pocket with a prompt that is ready to paste next time.

You see a design, a prompt, or an idea while browsing. Double-tap Right ⌘, drag around it, say why you want it. Later, open the pocket and copy the prompt and the image straight into Claude or any assistant.

## Run it

```sh
git clone https://github.com/abhiyan100/xtractor.git
cd xtractor
npm install
npm start
```

Needs Node 22.12 or newer. The first start downloads the Electron binary, so it takes a little longer.

On macOS the app asks for two permissions the first time:

- **Screen Recording**, so a snip can see the screen.
- **Accessibility**, so it can notice the Right ⌘ double-tap.

macOS attributes both to the program that launched the app. When you run `npm start` from a terminal, that is your terminal (or editor), so that is the name to allow in System Settings. Without Accessibility the regular shortcut still works.

## Use it

| | macOS | Windows |
|---|---|---|
| Start a snip | double-tap Right ⌘ (or Right ⌥ / Right ⌃, in Settings) | double-tap Right Ctrl (or Right Alt) |
| Start a snip (always works) | ⌘⇧2 | Ctrl+Shift+2 |
| Move the selection while dragging | hold Space | hold Space |
| Nudge the selection | arrow keys (Shift for 10 px) | same |
| Save | Enter | Enter |
| Cancel | Esc | Esc |
| Search the library | ⌘K | Ctrl+K |
| Copy prompt / copy image in a snip | ⌘C / ⌘⇧C | Ctrl+C / Ctrl+Shift+C |

After you save, a thumbnail sits in the corner of the screen while the model files the snip. Click it to open the snip.

If double-tapping Right ⌘ also opens Siri, that is the macOS "Press Either Command Key Twice" shortcut for Type to Siri. Either pick Right ⌥ or Right ⌃ as the double-tap key in Xtractor's settings, or change Siri's shortcut under System Settings › Siri.

Copy the prompt and the image separately: chat apps differ in what they take from a clipboard holding both, so the app copies one at a time and marks the other as the next step.

## Choose a model

Open Settings (the sliders icon) and pick one:

- **Claude**: an Anthropic API key. Defaults to `claude-opus-5-5`; choose any model your key offers.
- **OpenAI**: an OpenAI API key.
- **Gemini**: a Google AI Studio key.
- **Ollama**: a model running on this computer, no key. Use one that can read images; `gemma3:4b` is the one this was tested with. Small local models file correctly but write plainer prompts than the hosted ones.
- **Other**: any OpenAI-compatible address, such as LM Studio or OpenRouter, with a key if the server needs one.

The model list is read live from the service. Keys are encrypted with the operating system keychain and stay on this computer. A key is tied to the address it was entered for: point a provider somewhere else and the app asks for the key again instead of sending the old one there.

Snips save without a model. They wait, and are filed as soon as you choose one.

## Where things are kept

Everything is plain files in the app's data folder:

- macOS: `~/Library/Application Support/xtractor/`
- Windows: `%APPDATA%\xtractor\`

`library/index.json` lists the snips, `library/images/` holds the full-size PNGs, `library/thumbs/` the previews. Nothing is uploaded except the image and note sent to the model you chose.

## Develop

```sh
npm run dev        # the app with hot reload
npm run ui:dev     # the three pages in a browser with sample data (http://localhost:5199/library.html)
npm run site:dev   # the landing page (http://localhost:5300)
```

Checks:

```sh
npm run typecheck
npm run lint
npm test           # logic (vitest)
npm run test:ui    # pages in headless Chromium against a mock bridge
npm run test:site  # the landing page in headless Chromium
npm run test:app   # the real app, built, in test mode
```

`test:app` runs Electron with `XTRACTOR_TEST=1`: no window is shown, there is no tray icon, shortcut, permission prompt or keychain access, data goes to a temp folder, the "screen" is `tests/fixtures/screen.png`, and the model is a local stand-in.

Two parts of it are opt-in because they touch the real machine:

- `XTRACTOR_TEST_CLIPBOARD=1` checks copying. It replaces the clipboard contents and puts them back.
- `XTRACTOR_TEST_OLLAMA_MODEL=<model>` makes one real model call through a local Ollama model that can read images, and saves what it wrote under `test-results/`.
- `XTRACTOR_TEST_LIVE=1` captures the real screen (still hidden, into a temp folder that is deleted), starts the real key hook, and sends a Right ⌥ double-tap through the system to check that it starts a snip. It waits for a pause in typing before sending, and is skipped unless the terminal already has Screen Recording and Accessibility.

`.github/workflows/ci.yml` runs every check on macOS and Windows on each push.

How the code is laid out:

```
src/main      Electron main process: hotkey, capture, windows, tray, library, model queue
src/preload   the bridge the pages are allowed to call
src/shared    types and constants used on both sides
src/renderer  overlay (capture), toast (corner thumbnail), library
site          landing page
tests         unit, ui, app
```

`docs/SPEC.md` has the design decisions.

## Landing page

`site/` is a static page that shares the app's design system. `npm run site:build` writes it to `site/dist`, and `vercel.json` is already set up to deploy that.

## Not verified yet

These need a person, a key, or hardware that was not available:

- Right ⌘ pressed by hand. The double-tap is tested end to end with Right ⌥ sent through the system (Right ⌘ would open Siri on the test machine); Right ⌘ differs only in which key the hook watches.
- The macOS permission prompts on a machine that has not granted them yet.
- A second display.
- Claude and Gemini with a real key. A real local model has filed snips end to end over both the Ollama protocol and the OpenAI-compatible one (the code OpenAI and "Other" share); Claude is covered through the official SDK against a local stand-in, Gemini by request tests.
- Windows. The code paths are there, the Windows look is tested in a browser, and CI is set up to run the app test on Windows, but the app itself has not run there yet.
