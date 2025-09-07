"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

type Props = {
  onSendSeq: (seq: string) => void;
  onFocusXterm?: () => void;
};

const KEY_SEQ = {
  Tab: "\t",
  ShiftTab: "\x1b[Z",
  Enter: "\r",
  Backspace: "\x7f",
  Escape: "\x1b",
  CtrlC: "\x03",
  CtrlD: "\x04",
  CtrlL: "\x0c",
  Up: "\x1b[A",
  Down: "\x1b[B",
  Right: "\x1b[C",
  Left: "\x1b[D",
} as const;

export default function AssistiveTouch({ onSendSeq, onFocusXterm }: Props) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [top, setTop] = useState<number>(160);

  // Live drag position
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const startRef = useRef<{
    id: number;
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Clamp value helper
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const pointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const target = btnRef.current;
    if (!target) return;
    target.setPointerCapture(e.pointerId);
    const rect = target.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const dx = startX - rect.left;
    const dy = startY - rect.top;
    startRef.current = {
      id: e.pointerId,
      dx,
      dy,
      startX,
      startY,
      moved: false,
    };
    setDragging(true);
    setX(rect.left);
    setY(rect.top);
  };

  const pointerMove = (e: React.PointerEvent) => {
    if (!dragging || !startRef.current) return;
    const { dx, dy, startX, startY } = startRef.current;
    const nx = e.clientX - dx;
    const ny = e.clientY - dy;
    if (
      !startRef.current.moved &&
      (Math.abs(e.clientX - startX) > 3 || Math.abs(e.clientY - startY) > 3)
    ) {
      startRef.current.moved = true;
    }
    const btn = btnRef.current;
    const w = btn ? btn.offsetWidth : 56;
    const h = btn ? btn.offsetHeight : 56;
    const maxX = window.innerWidth - w - 4;
    const maxY = window.innerHeight - h - 4;
    setX(clamp(nx, 4, maxX));
    setY(clamp(ny, 4, maxY));
  };

  const pointerUp = (e: React.PointerEvent) => {
    const sr = startRef.current;
    startRef.current = null;
    setDragging(false);
    const btn = btnRef.current;
    const w = btn ? btn.offsetWidth : 56;
    const h = btn ? btn.offsetHeight : 56;
    const maxY = window.innerHeight - h - 8;
    const finalTop = clamp(y, 8, maxY);
    setTop(finalTop);
    const isRight = x + w / 2 > window.innerWidth / 2;
    setSide(isRight ? "right" : "left");
    // If it was a tap (no real movement), toggle panel
    if (sr && !sr.moved) {
      setOpen((v) => !v);
    }
  };

  const style = dragging
    ? { top: y, left: x, right: "auto" as const }
    : side === "left"
    ? { top, left: 8, right: "auto" as const }
    : { top, right: 8, left: "auto" as const };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // Return focus to xterm when closing the panel
      try {
        onFocusXterm?.();
      } catch {}
    }
  };

  const sendKey = useCallback(
    (seq: string) => {
      try {
        onFocusXterm?.();
      } catch {}
      try {
        onSendSeq(seq);
      } catch {}
    },
    [onFocusXterm, onSendSeq]
  );

  useEffect(() => {
    try {
      localStorage.setItem("assistive.side", side);
    } catch {}
  }, [side]);
  useEffect(() => {
    try {
      localStorage.setItem("assistive.top", String(top));
    } catch {}
  }, [top]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSide = localStorage.getItem("assistive.side") as
          | "left"
          | "right";
        if (storedSide === "left" || storedSide === "right")
          setSide(storedSide);
      } catch {}
      try {
        const v = Number(localStorage.getItem("assistive.top"));
        if (Number.isFinite(v)) setTop(v);
      } catch {}
    }
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Open terminal key helpers"
        title="Terminal helpers"
        className="fixed z-50 w-12 h-12 rounded-full bg-cyan-500 text-neutral-900 shadow-lg active:scale-[0.98] grid place-items-center border border-cyan-300/60 select-none"
        style={{
          ...style,
          touchAction: "none",
          cursor: dragging ? "grabbing" : "grab",
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* Simple icon */}
        <span className="text-xl font-bold">⋮</span>
      </button>

      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,calc(100vw-2rem))] max-h-[min(80vh,700px)] overflow-auto rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-50 p-4 shadow-xl">
            <Dialog.Title className="font-bold mb-2">
              Terminal Helpers
            </Dialog.Title>
            <Dialog.Description className="opacity-90 mb-3">
              Quick-access keys for the active SSH session.
            </Dialog.Description>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <KeyButton label="Tab" onClick={() => sendKey(KEY_SEQ.Tab)} />
              <KeyButton
                label="Shift+Tab"
                onClick={() => sendKey(KEY_SEQ.ShiftTab)}
              />
              <KeyButton label="Enter" onClick={() => sendKey(KEY_SEQ.Enter)} />
              <KeyButton label="Esc" onClick={() => sendKey(KEY_SEQ.Escape)} />
              <KeyButton
                label="Backspace"
                onClick={() => sendKey(KEY_SEQ.Backspace)}
              />
              <KeyButton
                label="Ctrl+C"
                onClick={() => sendKey(KEY_SEQ.CtrlC)}
              />
              <KeyButton
                label="Ctrl+D"
                onClick={() => sendKey(KEY_SEQ.CtrlD)}
              />
              <KeyButton
                label="Ctrl+L"
                onClick={() => sendKey(KEY_SEQ.CtrlL)}
              />
              <KeyButton label="↑" onClick={() => sendKey(KEY_SEQ.Up)} />
              <KeyButton label="↓" onClick={() => sendKey(KEY_SEQ.Down)} />
              <KeyButton label="←" onClick={() => sendKey(KEY_SEQ.Left)} />
              <KeyButton label="→" onClick={() => sendKey(KEY_SEQ.Right)} />
            </div>

            <div className="flex justify-end mt-4">
              <button
                className="px-3 py-2 rounded-md border border-neutral-700 bg-transparent hover:bg-neutral-800"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function KeyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="px-3 py-2 rounded-md border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
