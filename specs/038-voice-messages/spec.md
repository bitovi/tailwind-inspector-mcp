# Spec 038 — Voice Messages (Browser Speech Recognition)

## Problem

The overlay's message row lets users type context for the AI agent, but typing on-screen while looking at a live app is slow and breaks flow. Users should be able to speak their instructions hands-free — "make the heading bigger", "add a border to this card" — and have the transcript appear in the message input, ready to stage.

---

## Goal

Add a microphone button to the overlay's message row that:
1. Uses the browser's built-in Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — **no server-side transcription, no API keys**
2. Shows interim results live in the textarea as the user speaks
3. Appends the final transcript to any existing text
4. Works in Chrome, Edge, and Safari (the browsers that support the Web Speech API)

---

## Prior Art

This feature previously existed in the panel's `MessageTab` component (removed during the panel-ux-redesign). It used Chrome's `webkitSpeechRecognition` with `interimResults: true`. See v0.11.7 tag for the original implementation.

The message input has since moved from the panel to the **overlay's element toolbar** as an inline message row (`msg-row` in `overlay/src/element-toolbar.ts`).

---

## Architecture

```
Overlay (Shadow DOM)
  msg-row
    ├── textarea        (existing)
    ├── mic-btn         (NEW — toggle button)
    └── msg-send btn    (existing)

  On mic-btn click:
    ├── Check SpeechRecognition API availability
    ├── Create SpeechRecognition instance
    │     continuous: false
    │     interimResults: true
    │     lang: navigator.language || 'en-US'
    ├── onresult → append transcript to textarea
    ├── onend → reset mic button state
    └── onerror → show toast if mic blocked
```

No server changes. No new dependencies. The Web Speech API is built into the browser.

---

## UI Design

### Message Row Layout

Current:
```
[ textarea                          ] [ ▶ send ]
```

Proposed:
```
[ textarea                    ] [ 🎤 ] [ ▶ send ]
```

### Mic Button States

| State | Visual | Behavior |
|-------|--------|----------|
| **idle** | Microphone icon, muted color (`#888`) | Click to start listening |
| **listening** | Pulsing red dot + red background | Click to stop; interim text streams into textarea |
| **error** | Orange microphone icon | Hover shows tooltip with error; click retries |
| **unavailable** | Hidden (no button rendered) | Browser doesn't support SpeechRecognition |

### Interaction Flow

1. User clicks mic button → recognition starts, button shows pulsing red dot
2. User speaks → interim transcript appears in textarea in real-time
3. User stops speaking → recognition ends automatically (or user clicks mic to stop early)
4. Final transcript is appended to any existing text in the textarea
5. User reviews text, optionally edits, then clicks send (or presses Enter)

### Toast Messages

- **"Microphone blocked"** — shown on `not-allowed` error, with hint: "Allow access in your browser's address bar"
- **"Speech recognition not supported"** — only if somehow triggered in an unsupported browser (defensive)

---

## Implementation

### Overlay Changes (`overlay/src/element-toolbar.ts`)

1. **Detect API availability** at module level:
   ```typescript
   const SpeechRecognitionAPI =
     typeof window !== 'undefined'
       ? (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
       : null;
   ```

2. **Create mic button** in `showDrawButton()`, between textarea and send button:
   - Only rendered if `SpeechRecognitionAPI` is non-null
   - Uses inline SVG microphone icon (same style as existing send button)

3. **Toggle handler**:
   - If listening → `recognition.stop()`, return
   - Save current textarea text as `baseText`
   - Create new `SpeechRecognition` instance with `continuous: false`, `interimResults: true`
   - `onresult`: build transcript from all results, set textarea value to `baseText + transcript`
   - `onend`: reset button state
   - `onerror`: show toast, reset button state
   - Call `recognition.start()`, set listening state

### Style Changes (`overlay/src/styles.ts`)

Add styles for `.mic-btn` in the `msg-row`:
- Same dimensions as `.msg-send` (24×24, border-radius 5px)
- Idle: transparent background, muted icon color
- Listening: orange/red background, white icon, pulsing animation
- Transition on all states

### SVG Icon (`overlay/src/svg-icons.ts`)

Add `MIC_SVG` constant — standard microphone path (same one used in the v0.11.7 `MessageTab`):
```
M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 4v7a1.5 1.5 0 0 0 3 0V5a1.5 1.5 0 0 0-3 0zM6 11a1 1 0 0 1 1 1 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 12a1 1 0 0 1 1-1z
```

---

## Browser Support

| Browser | `SpeechRecognition` | Notes |
|---------|---------------------|-------|
| Chrome 33+ | ✅ `webkitSpeechRecognition` | Best support, most users |
| Edge 79+ | ✅ `webkitSpeechRecognition` | Chromium-based |
| Safari 14.1+ | ✅ `SpeechRecognition` | Works on macOS and iOS |
| Firefox | ❌ | Flag-only (`media.webspeech.recognition.enable`), not shipped by default |

When the API is unavailable, the mic button simply doesn't render. No fallback needed — the typing experience remains unchanged.

---

## Scope & Non-Goals

**In scope:**
- Mic button in the overlay message row
- Browser SpeechRecognition for transcription
- Visual feedback (pulsing animation, toast errors)
- Append-to-existing-text behavior

**Not in scope (future):**
- Server-side Whisper transcription (spec 017)
- Voice Activity Detection with AudioContext
- Continuous/multi-chunk recording
- Language picker UI
- Panel-side mic button (overlay-only for now)

---

## Files Changed

| File | Change |
|------|--------|
| `overlay/src/element-toolbar.ts` | Add mic button creation, SpeechRecognition toggle logic |
| `overlay/src/styles.ts` | Add `.mic-btn` styles with pulse animation |
| `overlay/src/svg-icons.ts` | Add `MIC_SVG` export |

---

## Testing

- **Manual:** Click mic, speak, verify transcript appears in textarea. Click send. Verify message is staged.
- **Error case:** Block microphone permission, click mic, verify toast appears.
- **Unsupported browser:** Open in Firefox, verify mic button is not rendered.
- **Existing text:** Type some text, click mic, speak — verify speech is appended after existing text.
