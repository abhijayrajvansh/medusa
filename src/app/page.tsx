"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthMethod = "password" | "key";

export default function HomePage() {
  const router = useRouter();
  const [host, setHost] = useState("192.168.29.161");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("abhijayrajvansh");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("sshError");
      if (msg) {
        setErrorMsg(msg);
        sessionStorage.removeItem("sshError");
      }
    } catch {}
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setErrorMsg(null);
    setConnectionStatus("Connecting to WebSocket server...");

    const config = {
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      authMethod,
      password: authMethod === "password" ? password : undefined,
      privateKey: authMethod === "key" ? privateKey : undefined,
      passphrase: authMethod === "key" ? passphrase : undefined,
    };

    try {
      // Build WebSocket URL
      const explicit = process.env.NEXT_PUBLIC_WS_URL;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const wsHost =
        process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT || "3001";
      const path = process.env.NEXT_PUBLIC_WS_PATH || "";
      const wsUrl = explicit || `${proto}://${wsHost}:${wsPort}${path}`;

      const ws = new WebSocket(wsUrl);
      let clientTimeout: NodeJS.Timeout;

      // Timeout after 15 seconds (slightly longer than server timeout)
      clientTimeout = setTimeout(() => {
        if (connecting) {
          setConnecting(false);
          setConnectionStatus("");
          setErrorMsg(
            "Connection timeout - please check your credentials and try again"
          );
          ws.close();
        }
      }, 15000);

      ws.addEventListener("open", () => {
        setConnectionStatus("Connected to server. Testing SSH credentials...");
        ws.send(
          JSON.stringify({
            type: "test-connection",
            config: config,
          })
        );
      });

      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "test-success") {
            clearTimeout(clientTimeout);
            setConnectionStatus("Authentication successful! Redirecting...");
            sessionStorage.setItem("sshConfig", JSON.stringify(config));
            setTimeout(() => {
              router.push("/terminal");
            }, 500);
          } else if (msg.type === "test-error") {
            clearTimeout(clientTimeout);
            setConnecting(false);
            setConnectionStatus("");
            setErrorMsg(msg.error || "Authentication failed");
            ws.close();
          } else if (msg.type === "test-progress") {
            setConnectionStatus(msg.message || "Testing connection...");
          }
        } catch (error) {
          clearTimeout(clientTimeout);
          setConnecting(false);
          setConnectionStatus("");
          setErrorMsg("Failed to parse server response");
          ws.close();
        }
      });

      ws.addEventListener("close", () => {
        clearTimeout(clientTimeout);
        if (connecting) {
          setConnecting(false);
          setConnectionStatus("");
          if (!errorMsg) {
            setErrorMsg("Connection closed unexpectedly");
          }
        }
      });

      ws.addEventListener("error", () => {
        clearTimeout(clientTimeout);
        setConnecting(false);
        setConnectionStatus("");
        setErrorMsg("Failed to connect to WebSocket server");
      });
    } catch (error) {
      setConnecting(false);
      setConnectionStatus("");
      setErrorMsg("Failed to initiate connection");
    }
  };

  return (
    <main className="max-w-[720px] mx-auto p-8">
      {errorMsg && (
        <div
          className="relative flex items-center gap-3 p-3 pr-10 rounded-xl mb-4 border border-red-900 bg-red-900 text-red-100 shadow-[0_8px_20px_rgba(153,27,27,0.25)]"
          role="alert"
        >
          <div className="leading-tight">
            <strong>Connection failed:</strong> {errorMsg}
          </div>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg px-1"
            onClick={() => setErrorMsg(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {connecting && connectionStatus && (
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4 border border-blue-600 bg-blue-600/10 text-blue-100">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
          <div className="leading-tight">{connectionStatus}</div>
        </div>
      )}
      <h1 className="text-2xl font-semibold mb-2">SSH Web Terminal</h1>
      <p className="p-3 border border-dashed border-neutral-500/40 rounded-md mb-4 text-sm">
        Demo only. Credentials are sent directly from your browser to the local
        Node WebSocket server. Do not use for production without hardening.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="host" className="block mb-1">
              Host/IP
            </label>
            <input
              id="host"
              placeholder="192.168.1.10"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
            />
          </div>
          <div>
            <label htmlFor="port" className="block mb-1">
              Port
            </label>
            <input
              id="port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="username" className="block mb-1">
            Username
          </label>
          <input
            id="username"
            placeholder="user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
          />
        </div>

        <div>
          <label htmlFor="auth" className="block mb-1">
            Authentication
          </label>
          <select
            id="auth"
            value={authMethod}
            onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
            className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
          >
            <option value="password">Password</option>
            <option value="key">Private Key</option>
          </select>
        </div>

        {authMethod === "password" ? (
          <div>
            <label htmlFor="password" className="block mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="privateKey" className="block mb-1">
                Private Key (PEM/OpenSSH)
              </label>
              <textarea
                id="privateKey"
                rows={8}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
              ></textarea>
            </div>
            <div>
              <label htmlFor="passphrase" className="block mb-1">
                Passphrase (optional)
              </label>
              <input
                id="passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-neutral-500/30 bg-transparent"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={connecting}
          className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white border border-blue-500 disabled:opacity-60"
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </form>
    </main>
  );
}
