# Terminal Keyboard Simulation and Focus Flow

This note documents how the web terminal simulates keyboard input (Tab and others) while keeping the terminal focused, so the behavior matches pressing keys on a physical keyboard.

## Problem & Goal
- Clicking UI buttons can steal focus from the terminal, so the shell no longer receives input.
- We want the “Tab” helper button (and others) to behave exactly like the keyboard key while ensuring the xterm instance remains focused.

## UX/Focus Pattern
- Prevent the helper button from taking focus using `onMouseDown={(e) => e.preventDefault()}`.
- Immediately after the click cycle, refocus xterm with `requestAnimationFrame(() => term.focus())`.
- Send the correct byte sequence for the intended key to the PTY over WebSocket.

## Client Implementation (Tab example)
```tsx
// src/app/terminal/page.tsx (excerpt)
const sendTab = () => {
  // Return focus to xterm after the click cycle
  requestAnimationFrame(() => {
    try { termRef.current?.focus?.(); } catch {}
  });
  // Send a literal tab character to the PTY
  try { wsRef.current?.send(JSON.stringify({ type: 'input', data: '\t' })); } catch {}
};

<button
  type="button"
  className="px-3 py-1 rounded-md border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
  onMouseDown={(e) => e.preventDefault()} // avoid stealing focus
  onClick={sendTab}
  aria-label="Send Tab to terminal"
  title="Send Tab"
>
  Tab
</button>
```

Why this works:
- `onMouseDown` prevents the button from taking focus.
- `requestAnimationFrame` ensures we refocus xterm on the next frame, after the click.
- `\t` is the Tab byte sent to the PTY, which most shells interpret as completion.

## Server Behavior
- The server simply writes the received bytes to the interactive SSH shell stream:
```js
// server/index.js (excerpt)
} else if (msg.type === 'input') {
  if (shellStream) shellStream.write(msg.data);
}
```
- No special handling is required for Tab or other keys as long as the client sends the correct byte sequences.

## Common Key Sequences (xterm-compatible)
- Tab: `\t`
- Shift+Tab: `\x1b[Z`
- Enter: `\r` (carriage return; shells typically expect CR)
- Backspace: `\x7f` (DEL) — some apps may accept `\b` (\x08)
- Escape: `\x1b`
- Ctrl+C: `\x03`
- Ctrl+D (EOF): `\x04`
- Ctrl+L (clear): `\x0c`
- Arrow Up: `\x1b[A`
- Arrow Down: `\x1b[B`
- Arrow Right: `\x1b[C`
- Arrow Left: `\x1b[D`

Function/Home/End/Page keys (common sequences):
- Home: `\x1b[H` or `\x1bOH`
- End: `\x1b[F` or `\x1bOF`
- PageUp: `\x1b[5~`
- PageDown: `\x1b[6~`
- F1..F4: `\x1bOP` `\x1bOQ` `\x1bOR` `\x1bOS`
- F5..F12: `\x1b[15~` `\x1b[17~` `\x1b[18~` `\x1b[19~` `\x1b[20~` `\x1b[21~` `\x1b[23~` `\x1b[24~`

Note: Actual sequences can vary with terminal modes and apps, but these are standard for xterm-256color.

## Reusable Utilities
```ts
// Generic sender
const sendSeq = (seq: string) => {
  try { wsRef.current?.send(JSON.stringify({ type: 'input', data: seq })); } catch {}
};

// Focus helper to keep xterm active after UI interactions
const focusXtermSoon = () => {
  requestAnimationFrame(() => {
    try { termRef.current?.focus?.(); } catch {}
  });
};

// Key map for common helpers
const KEY_SEQ = {
  Tab: '\t',
  ShiftTab: '\x1b[Z',
  Enter: '\r',
  Backspace: '\x7f',
  Escape: '\x1b',
  CtrlC: '\x03',
  CtrlD: '\x04',
  CtrlL: '\x0c',
  Up: '\x1b[A',
  Down: '\x1b[B',
  Right: '\x1b[C',
  Left: '\x1b[D',
} as const;

type KeyName = keyof typeof KEY_SEQ;

const sendKey = (name: KeyName) => {
  focusXtermSoon();
  sendSeq(KEY_SEQ[name]);
};
```

Example usage in a button:
```tsx
<button
  type="button"
  onMouseDown={(e) => e.preventDefault()}
  onClick={() => sendKey('CtrlC')}
  aria-label="Send Ctrl+C to terminal"
  title="Ctrl+C"
>
  Ctrl+C
</button>
```

## Notes & Edge Cases
- If the browser tab/window is fully inactive (user focused a different app), a user click is required to re-activate it; after that, the focus helper restores xterm focus.
- Guard sends with connection readiness if needed (e.g., `wsRef.current?.readyState === WebSocket.OPEN`).
- Consider `onPointerDown` alongside `onMouseDown` if you need broader input-device coverage.

## Test Checklist
- Click the helper button while typing; verify the cursor stays in xterm.
- Confirm the shell receives the intended key (e.g., Tab completion appears).
- Try other helpers (Enter, Ctrl+C) to validate sequences and focus behavior.
```
