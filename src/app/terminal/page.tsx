"use client";

import { useEffect, useRef, useState } from "react";
import type { Terminal as TerminalType } from "xterm";
import type { FitAddon as FitAddonType } from "xterm-addon-fit";
import { useRouter } from "next/navigation";
import ConfirmReloadDialog from "@/components/ConfirmReloadDialog";
import AssistiveTouch from "@/components/AssistiveTouch";

export default function TerminalPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<TerminalType | null>(null);
  const fitRef = useRef<FitAddonType | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState("Connecting…");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const allowUnloadRef = useRef(false);
  const readyRef = useRef(false);

  const focusXtermSoon = () => {
    try {
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          try {
            termRef.current?.focus?.();
          } catch {}
        });
      }
    } catch {}
  };

  const sendSeq = (seq: string) => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "input", data: seq }));
    } catch {}
  };

  const sendTab = () => {
    focusXtermSoon();
    sendSeq("\t");
  };

  const bounceHomeWithError = (message: string) => {
    try {
      sessionStorage.setItem("sshError", message);
    } catch {}
    try {
      sessionStorage.removeItem("sshConfig");
    } catch {}
    try {
      wsRef.current?.close();
    } catch {}
    router.replace("/");
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("sshConfig");
    if (!raw) {
      router.replace("/");
      return;
    }
    const cfg = JSON.parse(raw);
    let term: any;
    let fit: any;
    let ro: ResizeObserver | null = null;

    const init = async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");
      await import("xterm/css/xterm.css");

      term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 12,
        fontWeight: 600,
        scrollback: 1000,
        theme: {
          background: "#0a0a0a",
          foreground: "#f5f5f5",
          cursor: "#22d3ee",
          cursorAccent: "#0a0a0a",
          selectionBackground: "#2563eb55",
          black: "#1e1e1e",
          red: "#ff4d4f",
          green: "#22c55e",
          yellow: "#facc15",
          blue: "#3b82f6",
          magenta: "#d946ef",
          cyan: "#06b6d4",
          white: "#e5e7eb",
          brightBlack: "#737373",
          brightRed: "#ff6b6b",
          brightGreen: "#34d399",
          brightYellow: "#fde047",
          brightBlue: "#60a5fa",
          brightMagenta: "#e879f9",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        },
      });
      fit = new FitAddon();
      term.loadAddon(fit);
      termRef.current = term;
      fitRef.current = fit;
      if (containerRef.current) {
        term.open(containerRef.current);
        // Use setTimeout to ensure DOM is ready before fitting
        setTimeout(() => {
          try {
            fit.fit();
          } catch {}
        }, 100);
        if ("ResizeObserver" in window) {
          ro = new ResizeObserver(() => {
            try {
              fit.fit();
            } catch {}
            try {
              wsRef.current?.send(
                JSON.stringify({
                  type: "resize",
                  cols: term.cols,
                  rows: term.rows,
                })
              );
            } catch {}
          });
          ro.observe(containerRef.current);
        }
      }

      // Build WS URL that works across LAN and cloud deployments.
      const explicit = process.env.NEXT_PUBLIC_WS_URL;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
      const port = process.env.NEXT_PUBLIC_WS_PORT || "3001";
      const path = process.env.NEXT_PUBLIC_WS_PATH || "";
      const wsUrl = explicit || `${proto}://${host}:${port}${path}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        setStatus("Connected. Starting SSH…");
        ws.send(
          JSON.stringify({
            type: "connect",
            config: cfg,
            cols: term.cols,
            rows: term.rows,
          })
        );
      });

      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === "data") {
            term.write(msg.data);
          } else if (msg.type === "close") {
            setStatus("Session closed");
            // Clean up session and redirect to home
            try {
              sessionStorage.removeItem("sshConfig");
            } catch {}
            setTimeout(() => {
              router.replace("/");
            }, 1000); // Give user a moment to see the "Session closed" message
          } else if (msg.type === "error") {
            const errMsg = String(msg.error || "unknown error");
            setStatus("Error: " + errMsg);
            if (!readyRef.current) {
              bounceHomeWithError(errMsg);
            }
          } else if (msg.type === "ready") {
            readyRef.current = true;
            setStatus("SSH session ready.");
          }
        } catch {
          term.write(ev.data as string);
        }
      });

      ws.addEventListener("close", () => {
        if (!readyRef.current) {
          bounceHomeWithError(
            "Connection closed before authentication completed"
          );
        } else {
          setStatus("Disconnected");
          // Clean up session and redirect to home after disconnection
          try {
            sessionStorage.removeItem("sshConfig");
          } catch {}
          setTimeout(() => {
            router.replace("/");
          }, 1500); // Give user time to see the disconnected message
        }
      });
      ws.addEventListener("error", () => {
        if (!readyRef.current)
          bounceHomeWithError("WebSocket error during connection");
        else setStatus("WebSocket error");
      });

      const onData = term.onData((data: string) => {
        ws.send(JSON.stringify({ type: "input", data }));
      });

      const onResize = term.onResize(({ cols, rows }: any) => {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      });

      const handleResize = () => {
        try {
          fit.fit();
        } catch {}
        try {
          ws.send(
            JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })
          );
        } catch {}
      };
      window.addEventListener("resize", handleResize);

      // Prevent accidental reload/close: intercept common reload shortcuts.
      const onKeyDown = (e: KeyboardEvent) => {
        const keyLower = typeof e.key === "string" ? e.key.toLowerCase() : "";
        const isR = e.code === "KeyR" || keyLower === "r";
        const isW = e.code === "KeyW" || keyLower === "w";
        const isReloadKey = e.key === "F5" || (isR && (e.metaKey || e.ctrlKey));
        const isCloseKey = isW && e.metaKey;
        if (isReloadKey || isCloseKey) {
          e.preventDefault();
          e.stopPropagation();
          setConfirmOpen(true);
        }
      };
      window.addEventListener("keydown", onKeyDown, { capture: true });

      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        if (allowUnloadRef.current) return;
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", onBeforeUnload);

      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("keydown", onKeyDown, {
          capture: true,
        } as any);
        window.removeEventListener("beforeunload", onBeforeUnload);
        if (ro)
          try {
            ro.disconnect();
          } catch {}
        onData.dispose();
        onResize.dispose();
      };
    };

    let cleanupFns: any;
    init()
      .then((cleanup) => {
        cleanupFns = cleanup;
      })
      .catch((e) => setStatus("Init error: " + String(e)));

    return () => {
      if (cleanupFns)
        try {
          cleanupFns();
        } catch {}
      if (wsRef.current)
        try {
          wsRef.current.close();
        } catch {}
      if (termRef.current)
        try {
          termRef.current.dispose();
        } catch {}
    };
  }, [router]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 border-b border-neutral-700/60 bg-neutral-900">
        <span className="grow" />
        <button
          type="button"
          className="px-3 py-1 rounded-md border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
          onClick={sendTab}
          onMouseDown={(e) => {
            // Prevent the button from taking focus; keep focus on terminal
            e.preventDefault();
          }}
          aria-label="Send Tab to terminal"
          title="Send Tab"
        >
          Tab
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded-md border border-red-600 bg-red-500 text-white hover:bg-red-400"
          onClick={() => setConfirmDisconnectOpen(true)}
        >
          Disconnect
        </button>
      </div>
      <div className="flex-1 overflow-hidden bg-[#0a0a0a]" ref={containerRef} />
      <div className="sticky bottom-0 z-10 flex items-center gap-2 px-4 py-3 border-t border-neutral-700/60 bg-neutral-900">
        <div>
          <strong>Status:</strong> {status}
        </div>
      </div>
      <AssistiveTouch onSendSeq={sendSeq} onFocusXterm={focusXtermSoon} />
      <ConfirmReloadDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          allowUnloadRef.current = true;
          setConfirmOpen(false);
          window.location.reload();
        }}
        title="Leave session?"
        description="Reloading or closing will terminate the active SSH session. Are you sure you want to continue?"
        confirmLabel="Reload"
      />
      <ConfirmReloadDialog
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        onConfirm={() => {
          try {
            wsRef.current?.send(JSON.stringify({ type: "disconnect" }));
          } catch {}
          setStatus("Disconnecting…");
          sessionStorage.removeItem("sshConfig");
          setConfirmDisconnectOpen(false);
          setTimeout(() => {
            try {
              wsRef.current?.close();
            } catch {}
            router.replace("/");
          }, 150);
        }}
        title="End session?"
        description="This will close the SSH session and return you to the home screen."
        confirmLabel="Disconnect"
      />
    </div>
  );
}
