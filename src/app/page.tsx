"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { translate, type DetectedLanguage } from "@/lib/woof";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════
   Types
══════════════════════════════════════════════ */
type WinId = "welcome" | "woofing" | "community" | "about" | "farm-points";

interface WinState {
  id: WinId;
  x: number;
  y: number;
  z: number;
  open: boolean;
  minimized: boolean;
  maximized?: boolean;
}

/* ══════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════ */
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return { copied, copy };
}

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false); // false on server → matches SSR
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check(); // runs immediately after mount, switches to mobile layout
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/* ══════════════════════════════════════════════
   Win98 Draggable Window
══════════════════════════════════════════════ */
function DraggableWindow({
  id, icon, title, win, onFocus, onClose, onMinimize, children,
}: {
  id: WinId;
  icon: string;
  title: string;
  win: WinState;
  onFocus: (id: WinId) => void;
  onClose: (id: WinId) => void;
  onMinimize: (id: WinId) => void;
  children: React.ReactNode;
}) {
  const posRef = useRef({ sx: 0, sy: 0, wx: 0, wy: 0 });
  const [pos, setPos] = useState({ x: win.x, y: win.y });
  const dragging = useRef(false);

  const onTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".w98-titlebar-btn")) return;
    e.preventDefault();
    dragging.current = true;
    posRef.current = { sx: e.clientX, sy: e.clientY, wx: pos.x, wy: pos.y };
    onFocus(id);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, posRef.current.wx + e.clientX - posRef.current.sx),
        y: Math.max(0, posRef.current.wy + e.clientY - posRef.current.sy),
      });
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  if (!win.open || win.minimized) return null;

  return (
    <div
      className="w98-window absolute"
      style={{ left: pos.x, top: pos.y, zIndex: win.z, minWidth: 320 }}
      onMouseDown={() => onFocus(id)}
    >
      <div
        className="w98-titlebar"
        style={{ cursor: "move", userSelect: "none" }}
        onMouseDown={onTitleMouseDown}
      >
        <span style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "10px" }}>
          {icon} {title}
        </span>
        <div className="flex gap-1">
          <div className="w98-titlebar-btn" onClick={() => onMinimize(id)}>_</div>
          <div className="w98-titlebar-btn">□</div>
          <div className="w98-titlebar-btn" onClick={() => onClose(id)}>✕</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Modern Glassmorphism Draggable Window
══════════════════════════════════════════════ */
function ModernDraggableWindow({
  id, title, win, onFocus, onClose, onMinimize, onMaximize, children,
  defaultWidth = 700, defaultHeight = 620,
}: {
  id: WinId;
  title: string;
  win: WinState;
  onFocus: (id: WinId) => void;
  onClose: (id: WinId) => void;
  onMinimize: (id: WinId) => void;
  onMaximize: (id: WinId) => void;
  children: React.ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
}) {
  const posRef = useRef({ sx: 0, sy: 0, wx: 0, wy: 0 });
  const [pos, setPos] = useState({ x: win.x, y: win.y });
  const dragging = useRef(false);
  const isMobile = useIsMobile();

  const onTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".farm-titlebar-btn")) return;
    if (win.maximized || isMobile) return;
    e.preventDefault();
    dragging.current = true;
    posRef.current = { sx: e.clientX, sy: e.clientY, wx: pos.x, wy: pos.y };
    onFocus(id);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, posRef.current.wx + e.clientX - posRef.current.sx),
        y: Math.max(0, posRef.current.wy + e.clientY - posRef.current.sy),
      });
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  if (!win.open || win.minimized) return null;

  const isFullscreen = isMobile || win.maximized;

  const windowStyle: React.CSSProperties = isFullscreen
    ? { position: isMobile ? "fixed" : "absolute", inset: 0, zIndex: win.z, width: "100%", height: "100%", borderRadius: 0 }
    : { position: "absolute", left: pos.x, top: pos.y, zIndex: win.z, width: defaultWidth, height: defaultHeight };

  return (
    <div
      className={cn("w98-window farm-window", isMobile && "farm-window-mobile")}
      style={windowStyle}
      onMouseDown={() => onFocus(id)}
    >
      {/* Title bar */}
      <div
        className="w98-titlebar"
        style={{ cursor: isFullscreen ? "default" : "move", userSelect: "none" }}
        onMouseDown={onTitleMouseDown}
      >
        <span style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "10px" }}>
          🌾 {title}
        </span>
        <div className="flex gap-1">
          <div className="w98-titlebar-btn" onClick={() => onMinimize(id)}>_</div>
          <div className="w98-titlebar-btn" onClick={() => onMaximize(id)}>{win.maximized ? "⤢" : "□"}</div>
          <div className="w98-titlebar-btn" onClick={() => onClose(id)}>✕</div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Win98 Window contents (unchanged)
══════════════════════════════════════════════ */
function WoofingContent() {
  const [input, setInput] = useState("");
  const [emptyDir, setEmptyDir] = useState<DetectedLanguage>("english");
  const result   = useMemo(() => translate(input), [input]);
  const dir      = input.trim() ? result.direction : emptyDir;
  const output   = input.trim() ? result.output : "";
  const invalids = input.trim() ? result.invalidTokens : [];
  const { copied, copy } = useCopy();

  const srcLabel = dir === "woof" ? "WOOF" : "ENGLISH";
  const dstLabel = dir === "woof" ? "ENGLISH" : "WOOF";

  const handleSwap = () => {
    if (output) setInput(output);
    else setEmptyDir(d => d === "english" ? "woof" : "english");
  };

  return (
    <>
      <div className="w98-raised flex items-center gap-2 px-2 py-1 border-b border-[#808080]">
        <button className="w98-btn text-sm px-2 py-0.5" onClick={handleSwap}>⟷ Swap</button>
        <div className="w98-sep h-5" />
        <span className="text-xs text-[#000080] font-bold" style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "9px" }}>
          {srcLabel} → {dstLabel}
        </span>
      </div>

      <div className="p-3 pb-1 bg-[#c0c0c0]">
        <div className="text-[9px] mb-1 w98-label inline-block" style={{ fontFamily: "var(--font-pixel-heading)" }}>
          {srcLabel} INPUT:
        </div>
        <div className="w98-sunken">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Type ${srcLabel} here...`}
            className="w-full bg-white text-black font-sans text-base p-2 min-h-28"
            style={{ fontFamily: "var(--font-pixel-body)", fontSize: "1.1rem" }}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
          />
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-[#555]" style={{ fontFamily: "var(--font-pixel-body)" }}>{input.length} chars</span>
          <button className="w98-btn text-sm" onClick={() => setInput("")} disabled={!input}>🗑 Clear</button>
        </div>
      </div>

      <div className="p-3 pt-1 bg-[#c0c0c0]">
        <div className="text-[9px] mb-1 w98-label inline-block" style={{ fontFamily: "var(--font-pixel-heading)" }}>
          {dstLabel} OUTPUT:
        </div>
        <div className="w98-sunken">
          <div
            className="w-full bg-white text-black p-2 min-h-20 whitespace-pre-wrap break-words"
            style={{ fontFamily: dir === "woof" ? "var(--font-pixel-body)" : "monospace", fontSize: "1.1rem" }}
          >
            {output || <span className="text-[#aaa]">Translation will appear here...</span>}
          </div>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-[#555]" style={{ fontFamily: "var(--font-pixel-body)" }}>
            {output.length} chars
            {invalids.length > 0 && (
              <span className="text-[#ff0000] ml-2">⚠ {invalids.length} bad token{invalids.length > 1 ? "s" : ""}</span>
            )}
          </span>
          <button className="w98-btn text-sm" onClick={() => copy(output)} disabled={!output}>
            {copied ? "✔ Copied!" : "📋 Copy"}
          </button>
        </div>
      </div>

      <div className="w98-statusbar text-xs">
        <span className="w98-label">Ready</span>
        <span className="w98-label">Auto-detect: ON</span>
        <span className="w98-label ml-auto">🐾 WOOF.EXE</span>
      </div>
    </>
  );
}

function CommunityContent() {
  return (
    <>
      <div className="p-4 bg-[#c0c0c0] flex flex-col gap-3">
        <div className="w98-sunken p-3 bg-white text-black leading-relaxed" style={{ fontFamily: "var(--font-pixel-body)", fontSize: "1.05rem" }}>
          <p className="text-[#000080] mb-2" style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "9px" }}>📢 WELCOME TO THE WOOF PACK</p>
          <p>Join thousands of dogs and dog-adjacent beings speaking WOOF daily.</p>
          <br />
          <p>🦴 BARK together.</p>
          <p>🐾 WOOF together.</p>
          <p>🌐 BUILD together.</p>
        </div>
        <div className="w98-raised p-3 flex gap-2 justify-center">
          <a href="https://x.com/woof0nbase" target="_blank" rel="noopener noreferrer"><button className="w98-btn">🐦 Twitter</button></a>
          <a href="https://t.me/w00f0nbase" target="_blank" rel="noopener noreferrer"><button className="w98-btn">📱 Telegram</button></a>
        </div>
      </div>
      <div className="w98-statusbar text-xs">
        <span className="w98-label">Members online: many 🐾</span>
      </div>
    </>
  );
}

function AboutContent() {
  return (
    <>
      <div className="flex gap-4 p-4 bg-[#c0c0c0]">
        <img src="/woofhead.png" alt="" className="select-none flex-shrink-0" style={{ height: "56px", width: "auto" }} />
        <div className="text-black leading-relaxed" style={{ fontFamily: "var(--font-pixel-body)", fontSize: "1.05rem" }}>
          <p style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "9px", color: "#000080" }}>WOOF TRANSLATOR</p>
          <p>Version 1.0.0 (Build 1998)</p>
          <br />
          <p>The world's premier English↔Woof engine.</p>
          <br />
          <p>🪙 Token: $WOOF</p>
          <p>🌐 Chain: BASE</p>
          <p>🐾 Supply: TBA</p>
          <p>𝕏 Twitter: <a href="https://x.com/woof0nbase" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", textDecoration: "underline" }}>@woof0nbase</a></p>
          <br />
          <p className="text-[#808080] text-xs">© 1998–2026 WOOF Labs Inc.<br />All woofs reserved.</p>
        </div>
      </div>
      <div className="flex justify-center py-3 bg-[#c0c0c0] border-t border-[#808080]">
        <button className="w98-btn px-8">OK</button>
      </div>
    </>
  );
}

function WelcomeContent({ onOpen }: { onOpen: (id: WinId) => void }) {
  return (
    <>
      <div className="p-5 bg-[#c0c0c0] flex flex-col gap-3 items-center text-center">
        <img src="/mainwoof.png" alt="" style={{ height: "72px", width: "auto" }} />
        <p style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "10px", color: "#000080" }}>WOOF TRANSLATOR v1.0</p>
        <div className="w98-sunken p-3 w-full bg-white text-black leading-relaxed" style={{ fontFamily: "var(--font-pixel-body)", fontSize: "1.05rem" }}>
          The world's first English ↔ Woof translation engine.<br /><br />
          Double-click any icon — or use the menu bar — to get started.
        </div>
        <div className="flex gap-3 mt-1">
          <button className="w98-btn px-4" onClick={() => onOpen("woofing")}>🐾 Open WOOFing.exe</button>
          <button className="w98-btn px-4" onClick={() => onOpen("community")}>🌐 Community</button>
        </div>
      </div>
      <div className="w98-statusbar text-xs">
        <span className="w98-label">🐾 WOOF.EXE loaded successfully</span>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════
   Wallet helpers
══════════════════════════════════════════════ */
function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const BASE_LOGO = (
  <svg width="13" height="13" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 21.9825 0 50.2143H72.7616V59.819H0C2.35281 88.0508 26.0432 110.034 54.921 110.034Z" fill="white"/>
  </svg>
);

function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  // Holds the BaseAccountProvider instance so we can call waitForPopupLoaded()
  // synchronously in the click handler before any async suspension.
  const providerRef = useRef<{ communicator?: { popup?: Window | null; waitForPopupLoaded?: () => Promise<Window> } } | null>(null);

  const connector = connectors[0];

  // Pre-warm the provider on mount: caches the dynamic import + SDK init so
  // getProvider() is synchronous by the time the user taps the button.
  useEffect(() => {
    if (!connector) return;
    (connector as unknown as { getProvider?: () => Promise<unknown> })
      .getProvider?.()
      .then((p) => { providerRef.current = p as typeof providerRef.current; })
      .catch(() => {});
  }, [connector]);

  // Mobile browsers (iOS Safari) block window.open() when called after async
  // suspension (microtask boundaries break the "user gesture" context).  We fix
  // this by calling waitForPopupLoaded() as the very first thing in the click
  // handler.  Because async functions run synchronously until their first await,
  // the openPopup() → window.open() call inside waitForPopupLoaded() fires while
  // we are still in the synchronous user-gesture stack.  When connect() later
  // calls waitForPopupLoaded() again, it finds the popup already open and returns
  // immediately — no second window.open() needed.
  const handleConnect = async () => {
    if (!connector) return;
    const comm = providerRef.current?.communicator;
    if (comm?.waitForPopupLoaded && (!comm.popup || comm.popup.closed)) {
      try {
        await comm.waitForPopupLoaded();
      } catch (err) {
        // Only abort if the browser explicitly blocked the popup.
        const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
        if (msg.includes("popup") || msg.includes("blocked")) return;
      }
    }
    connect({ connector });
  };

  if (isConnected && address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{
          background: "rgba(0,82,255,0.25)", border: "1px solid rgba(0,82,255,0.50)",
          borderRadius: 100, color: "#ffffff", padding: "7px 14px",
          fontSize: 13, fontWeight: 700, fontFamily: "system-ui,sans-serif",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          {BASE_LOGO}
          {shortenAddress(address)}
        </span>
        <button
          onClick={() => disconnect()}
          style={{
            background: "rgba(220,38,38,0.80)", border: "1px solid rgba(220,38,38,0.4)",
            borderRadius: 100, color: "#ffffff", padding: "7px 12px",
            cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "system-ui,sans-serif",
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Map known SDK error messages to friendly labels; show the raw message for
  // anything else so that unrecognised failures are visible and debuggable.
  const rawMsg = String((error as { message?: unknown } | null)?.message ?? "");
  const msgLower = rawMsg.toLowerCase();
  const errorMsg = error
    ? msgLower.includes("popup") || msgLower.includes("blocked")
      ? "Allow popups in your browser, then try again."
      : msgLower.includes("reject") || msgLower.includes("denied") || msgLower.includes("cancel")
        ? "Connection cancelled."
        : rawMsg || "Connection failed. Please try again."
    : null;

  return (
    <div style={{ marginBottom: errorMsg ? 8 : 16 }}>
      <button
        onClick={handleConnect}
        disabled={isPending || !connector}
        style={{
          background: "#0052FF", border: "none", borderRadius: 100,
          color: "#ffffff", padding: "8px 18px", fontWeight: 700,
          fontSize: 13,
          cursor: isPending || !connector ? "default" : "pointer",
          fontFamily: "system-ui,sans-serif",
          opacity: isPending || !connector ? 0.6 : 1,
          display: "inline-flex", alignItems: "center", gap: 7,
          boxShadow: "0 2px 8px rgba(0,82,255,0.30)",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {BASE_LOGO}
        {isPending ? "Connecting…" : "Connect Base Wallet"}
      </button>
      {errorMsg && (
        <p style={{
          margin: "6px 0 10px", fontSize: 11, lineHeight: 1.4,
          color: "rgba(255,100,100,0.95)", fontFamily: "system-ui,sans-serif",
        }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   Farm Points Content
══════════════════════════════════════════════ */
const STREAK_DAYS = [1, 2, 3, 4, 5, 6, 7];

const F: React.CSSProperties = { fontFamily: "system-ui, -apple-system, sans-serif" };

interface Contributor { name: string; points: number; }

/* ── Paw particle system ── */
const PAW_SRCS = ["/paws-animation.svg", "/dog-paw.svg"] as const;

interface PawParticle {
  id: number;
  src: string;
  left: number;     // px — top-left of img
  top: number;      // px
  size: number;     // px width
  opacity: number;
  duration: number; // s
  delay: number;    // s (negative = start mid-cycle)
  rotation: number; // deg
  driftX: number;   // px
  driftY: number;   // px
}

let _pawId = 0;

/** Scale count, size, and gap proportionally to the actual container pixels. */
function pawParams(cw: number, ch: number) {
  const area   = cw * ch;
  const count  = Math.max(4, Math.min(12, Math.round(area / 42000)));
  const gap    = Math.max(20, Math.min(80, Math.round(cw / 5)));
  const sizeMin = Math.min(130, Math.round(cw * 0.30));
  const sizeMax = Math.min(205, Math.round(cw * 0.50));
  return { count, gap, sizeMin, sizeMax: Math.max(sizeMin + 20, sizeMax) };
}

/** Try up to 60 random positions; reject any within (radii + gap) of existing paws. */
function pawFindSpot(
  existing: PawParticle[],
  newSize: number,
  cw: number,
  ch: number,
  gap: number,
): { left: number; top: number } {
  const bleed = newSize * 0.15;
  const minX = -bleed,  maxX = cw - newSize + bleed;
  const minY = -bleed,  maxY = ch - newSize + bleed;

  for (let i = 0; i < 60; i++) {
    const left = minX + Math.random() * (maxX - minX);
    const top  = minY + Math.random() * (maxY - minY);
    const cx   = left + newSize / 2;
    const cy   = top  + newSize / 2;
    const ok   = existing.every(e => {
      const minDist = (newSize + e.size) / 2 + gap;
      return Math.hypot(cx - (e.left + e.size / 2), cy - (e.top + e.size / 2)) >= minDist;
    });
    if (ok) return { left, top };
  }
  // Fallback — place anywhere rather than fail entirely
  return { left: Math.random() * Math.max(1, cw - newSize), top: Math.random() * Math.max(1, ch - newSize) };
}

function makePaw(
  existing: PawParticle[],
  cw: number,
  ch: number,
  id?: number,
  isRespawn = false,
): PawParticle {
  const { gap, sizeMin, sizeMax } = pawParams(cw, ch);
  const size     = Math.round(sizeMin + Math.random() * (sizeMax - sizeMin));
  const duration = parseFloat((12 + Math.random() * 9).toFixed(2));
  const { left, top } = pawFindSpot(existing, size, cw, ch, gap);
  return {
    id:       id ?? _pawId++,
    src:      PAW_SRCS[Math.floor(Math.random() * PAW_SRCS.length)],
    left, top, size,
    opacity:  parseFloat((0.10 + Math.random() * 0.14).toFixed(2)),
    duration,
    delay:    isRespawn ? 0 : parseFloat((-(Math.random() * duration)).toFixed(2)),
    rotation: Math.round(-35 + Math.random() * 70),
    driftX:   Math.round(-22 + Math.random() * 44),
    driftY:   Math.round(-12 - Math.random() * 22),
  };
}

function PawBackground() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const [paws, setPaws] = useState<PawParticle[]>([]);
  const ready = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function init() {
      const { width, height } = el!.getBoundingClientRect();
      // Container is hidden (display:none parent) or not yet laid out — wait
      if (!width || !height || ready.current) return;
      ready.current = true;
      ro.disconnect();

      const { count } = pawParams(width, height);
      const list: PawParticle[] = [];
      for (let i = 0; i < count; i++) list.push(makePaw(list, width, height));
      setPaws(list);
    }

    // ResizeObserver fires when container goes from 0→visible (desktop window open)
    // and immediately on mount when already visible (mobile default tab)
    const ro = new ResizeObserver(init);
    ro.observe(el);
    init(); // synchronous attempt if already visible

    return () => ro.disconnect();
  }, []);

  const respawn = useCallback((id: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!width || !height) return;
    setPaws(prev => {
      const rest = prev.filter(p => p.id !== id);
      return prev.map(p => p.id === id ? makePaw(rest, width, height, id, true) : p);
    });
  }, []);

  return (
    <div ref={containerRef} className="paw-float-bg" aria-hidden="true">
      {paws.map(p => (
        <img
          key={p.id}
          src={p.src}
          alt=""
          onAnimationIteration={() => respawn(p.id)}
          style={{
            left:      p.left,
            top:       p.top,
            width:     p.size,
            animation: `pawOrganic ${p.duration}s ${p.delay}s ease-in-out infinite both`,
            ["--paw-op"  as string]: p.opacity,
            ["--paw-rot" as string]: `${p.rotation}deg`,
            ["--paw-dy"  as string]: `${p.driftY}px`,
            ["--paw-dx"  as string]: `${p.driftX}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function FarmPointsGated() {
  const { isConnected } = useAccount();
  if (isConnected) return <FarmPointsContent />;
  return (
    <div style={{
      minHeight: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#ffffff",
        border: "1px solid #E5E7EB",
        borderRadius: 20,
        padding: "36px 32px 32px",
        width: 320,
        maxWidth: "100%",
        boxShadow: "0 8px 40px rgba(0,40,160,0.22), 0 2px 12px rgba(0,0,0,0.10)",
        textAlign: "center",
        fontFamily: "system-ui,sans-serif",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🦴</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: "#0F172A" }}>
          Connect Your Base Wallet
        </div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 24, lineHeight: 1.6 }}>
          A Base wallet is required to access Farm Points and track your WOOF rewards.
        </div>
        <WalletConnectButton />
      </div>
    </div>
  );
}

function HowToEarnModal({ onClose }: { onClose: () => void }) {
  // Close on backdrop click
  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.18s ease",
      }}
    >
      <div style={{
        background: "linear-gradient(135deg,rgba(255,255,255,0.96) 0%,rgba(235,245,255,0.96) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderRadius: 24,
        border: "1px solid rgba(0,82,255,0.18)",
        boxShadow: "0 8px 48px rgba(0,40,160,0.22), 0 2px 12px rgba(0,0,0,0.10)",
        width: "100%",
        maxWidth: 480,
        maxHeight: "85vh",
        overflowY: "auto",
        padding: "28px 28px 24px",
        position: "relative",
        animation: "modalIn 0.2s ease",
        fontFamily: "system-ui,sans-serif",
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(0,0,0,0.07)", border: "none", borderRadius: "50%",
            width: 30, height: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#475569", lineHeight: 1,
          }}
        >✕</button>

        {/* Title */}
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 20 }}>
          🦴 How to Earn WOOF Points
        </div>

        {/* Submit Reply */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0052FF", marginBottom: 10 }}>
            💬 Submit Reply (+17 Points)
          </div>
          <ol style={{ margin: "0 0 12px", paddingLeft: 24, fontSize: 13, color: "#334155", lineHeight: 1.75, listStyleType: "decimal", listStylePosition: "outside" }}>
            <li>Use the WOOF Translator to generate a WOOF-style reply.</li>
            <li>Post that WOOF reply under a Base ecosystem post on X.</li>
            <li>Copy your reply URL.</li>
            <li>Paste the link into Submit Reply and submit it for review.</li>
          </ol>
          <div style={{ background: "rgba(0,82,255,0.06)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
            <strong style={{ color: "#0F172A" }}>Note</strong><br />
            • All submissions are manually reviewed.<br />
            • Alt accounts and bots will be rejected.<br />
            • Only X Premium (Twitter Blue) accounts are eligible.
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid rgba(0,82,255,0.12)", margin: "0 0 20px" }} />

        {/* Submit Content */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0052FF", marginBottom: 10 }}>
            📝 Submit Content (+1006 Points)
          </div>
          <ol style={{ margin: "0 0 12px", paddingLeft: 24, fontSize: 13, color: "#334155", lineHeight: 1.75, listStyleType: "decimal", listStylePosition: "outside" }}>
            <li>Submit original, high-quality content related to the Base ecosystem.</li>
            <li>WOOF-related content is also accepted.</li>
            <li>Points are awarded based on the overall quality of the content.</li>
          </ol>
          <div style={{ background: "rgba(0,82,255,0.06)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
            <strong style={{ color: "#0F172A" }}>Note</strong><br />
            • All submissions are manually reviewed.<br />
            • Alt accounts and bots will be rejected.<br />
            • Only X Premium (Twitter Blue) accounts are eligible.
          </div>
        </div>

        {/* Got it */}
        <button
          onClick={onClose}
          style={{
            width: "100%", background: "#0052FF", border: "none", borderRadius: 12,
            color: "#ffffff", padding: "13px 0", fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: "system-ui,sans-serif",
            boxShadow: "0 2px 10px rgba(0,82,255,0.30)",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function FarmPointsContent() {
  const [showHowToEarn, setShowHowToEarn] = useState(false);
  const [twitterUser, setTwitterUser] = useState<string | null>(null);
  const [twitterInput, setTwitterInput] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const [twitterLink, setTwitterLink] = useState("");
  const [submitted, setSubmitted]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError]       = useState("");
  const [rewardPts, setRewardPts] = useState({ submitReply: 10, submitContent: 1000 });
  const [contentTitle, setContentTitle]     = useState("");
  const [contentLink, setContentLink]       = useState("");
  const [contentSubmitted, setContentSubmitted] = useState(false);
  const [contentError, setContentError]     = useState("");

  // Real data from Supabase via API
  const [approvedPoints, setApprovedPoints] = useState(0);
  const [pendingCount, setPendingCount]     = useState(0);
  const [streakDay, setStreakDay]           = useState(0);
  const [todayCount, setTodayCount]         = useState(0);
  const [topContributors, setTopContributors] = useState<Contributor[]>([]);

  useEffect(() => {
    fetch("/api/rewards")
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return;
        const map = Object.fromEntries((json.data as { key: string; pts: number }[]).map(r => [r.key, r.pts]));
        setRewardPts(prev => ({
          submitReply:   map.submitReply   ?? prev.submitReply,
          submitContent: map.submitContent ?? prev.submitContent,
        }));
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async (handle: string | null) => {
    try {
      // Top contributors (all approved, grouped server-side)
      const lbRes = await fetch("/api/submissions/leaderboard");
      if (lbRes.ok) {
        const { data } = await lbRes.json();
        setTopContributors(data ?? []);
      }

      if (!handle) {
        setApprovedPoints(0);
        setPendingCount(0);
        setStreakDay(0);
        setTodayCount(0);
        return;
      }

      // All submissions for this user
      const res = await fetch(`/api/submissions?x_username=${encodeURIComponent(handle.toLowerCase())}`);
      if (!res.ok) return;
      const { data: subs } = await res.json();
      if (!Array.isArray(subs)) return;

      // Points from approved reply submissions (Supabase)
      const replyPts = subs
        .filter((s: { status: string; points: number }) => s.status === "approved")
        .reduce((sum: number, s: { points: number }) => sum + s.points, 0);

      // Pending count for reply submissions
      const replyPend = subs.filter((s: { status: string }) => s.status === "pending").length;

      // Content submissions from API
      let contentPts = 0;
      let contentPend = 0;
      let approvedContent: { submittedAt: string }[] = [];
      try {
        const cRes = await fetch(`/api/content-submissions?x_handle=${encodeURIComponent(handle.toLowerCase())}`);
        if (cRes.ok) {
          const { data: cData } = await cRes.json();
          if (Array.isArray(cData)) {
            const approved = cData.filter((s: { status: string }) => s.status === "approved");
            contentPts     = approved.reduce((sum: number, s: { points: number }) => sum + s.points, 0);
            contentPend    = cData.filter((s: { status: string }) => s.status === "pending").length;
            approvedContent = approved;
          }
        }
      } catch {}

      setApprovedPoints(replyPts + contentPts);
      setPendingCount(replyPend + contentPend);

      // Streak: count approved per calendar day (reply submissions + content submissions)
      const approvedByDate: Record<string, number> = {};
      subs
        .filter((s: { status: string }) => s.status === "approved")
        .forEach((s: { submittedAt: string }) => {
          const d = s.submittedAt.slice(0, 10);
          approvedByDate[d] = (approvedByDate[d] ?? 0) + 1;
        });
      approvedContent.forEach(s => {
        const d = s.submittedAt.slice(0, 10);
        approvedByDate[d] = (approvedByDate[d] ?? 0) + 1;
      });

      // Consecutive days ending today where approved ≥ 30
      let streakDays = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        if ((approvedByDate[d] ?? 0) >= 30) streakDays++;
        else break;
      }
      setStreakDay(streakDays);

      const today = new Date().toISOString().slice(0, 10);
      setTodayCount(approvedByDate[today] ?? 0);
    } catch { /* network errors are silent */ }
  }, []);

  useEffect(() => {
    loadData(twitterUser);
  }, [twitterUser, loadData]);

  const handleConnect = () => {
    const handle = twitterInput.trim().replace(/^@/, "");
    if (!handle) return;
    setTwitterUser(handle);
    setTwitterInput("");
    setShowConnect(false);
  };

  const handleSubmitReply = async () => {
    const link = twitterLink.trim();
    if (!link || submitting) return;
    if (!twitterUser) { setSubmitError("Connect your X account first."); return; }

    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_username: twitterUser.toLowerCase(), tweet_url: link, points: rewardPts.submitReply }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Submission failed. Please try again.");
        return;
      }
      setTwitterLink("");
      setPendingCount(p => p + 1);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitContent = async () => {
    const title = contentTitle.trim();
    const link  = contentLink.trim();
    if (!title || !link) return;
    if (!twitterUser) { setContentError("Connect your X account first."); return; }
    if (!/^https?:\/\/(www\.|mobile\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i.test(link)) {
      setContentError("Please enter a valid Twitter/X post link (e.g. https://x.com/i/status/...).");
      return;
    }
    setContentError("");
    try {
      const res = await fetch("/api/content-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_handle: twitterUser.toLowerCase(), title, content_url: link, points: rewardPts.submitContent }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        setContentError(error ?? "Failed to submit. Please try again.");
        return;
      }
      setContentTitle("");
      setContentLink("");
      setContentSubmitted(true);
      setTimeout(() => setContentSubmitted(false), 2500);
    } catch {
      setContentError("Failed to save. Please try again.");
    }
  };

  return (
    <div style={{ ...F, background: "radial-gradient(ellipse 62% 48% at -6% -4%, #0038CC 0%, transparent 100%), radial-gradient(ellipse 58% 44% at 106% -4%, #0046D4 0%, transparent 100%), linear-gradient(180deg, #1578B4 0%, #1A8EC8 55%, #1E96CC 100%)", color: "#e8f6ff", padding: "20px 22px", position: "relative", minHeight: "100%" }}>

      {/* Floating paw background — particle system */}
      <PawBackground />

      <div className="farm-tab-appear" style={{ position: "relative", zIndex: 1 }}>

      {/* ─── How to Earn modal ─── */}
      {showHowToEarn && <HowToEarnModal onClose={() => setShowHowToEarn(false)} />}

      {/* ─── Twitter connect modal ─── */}
      {showConnect && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(60,130,190,0.5)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#ffffff",
            border: "1px solid #E5E7EB",
            borderRadius: 16, padding: "28px 28px 24px", width: 320,
            boxShadow: "0 8px 40px rgba(0,40,160,0.22), 0 2px 12px rgba(0,0,0,0.10)",
          }}>
            <div style={{ fontSize: 22, marginBottom: 8, textAlign: "center", color: "#0F172A" }}>𝕏</div>
            <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 4, color: "#0F172A" }}>Connect X Account</div>
            <div style={{ fontSize: 12, color: "#475569", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              Enter your X (Twitter) username so we can verify your submissions.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, background: "rgba(0,0,0,0.05)", border: "1px solid #D1D5DB", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
              <span style={{ padding: "0 10px", color: "#64748B", fontSize: 15 }}>@</span>
              <input
                autoFocus
                value={twitterInput}
                onChange={e => setTwitterInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleConnect()}
                placeholder="yourhandle"
                style={{ flex: 1, background: "none", border: "none", color: "#0F172A", padding: "10px 12px 10px 0", fontSize: 14, outline: "none", fontFamily: "system-ui,sans-serif" }}
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={!twitterInput.trim()}
              style={{ width: "100%", background: "#0052FF", border: "none", borderRadius: 10, color: "#ffffff", padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "system-ui,sans-serif", marginBottom: 8 }}
            >
              Connect 𝕏
            </button>
            <button
              onClick={() => { setShowConnect(false); setTwitterInput(""); }}
              style={{ width: "100%", background: "none", border: "none", color: "#64748B", padding: "6px 0", cursor: "pointer", fontSize: 13, fontFamily: "system-ui,sans-serif" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Base Wallet ─── */}
      <WalletConnectButton />

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="/woofhead.png"
            alt=""
            style={{
              height: 26,
              width: "auto",
              display: "block",
              imageRendering: "auto",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.25))",
            }}
          />
          <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-0.5px", color: "#ffffff" }}>WOOF</span>
        </div>
        {twitterUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.55)",
              borderRadius: 100, color: "#ffffff", padding: "7px 14px", fontSize: 13, fontWeight: 700,
            }}>𝕏 @{twitterUser}</span>
            <button
              onClick={() => setTwitterUser(null)}
              style={{ background: "rgba(220,38,38,0.80)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 100, color: "#ffffff", padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "system-ui,sans-serif" }}
            >Disconnect</button>
          </div>
        ) : (
          <button
            onClick={() => setShowConnect(true)}
            style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 100, color: "#ffffff", padding: "7px 16px",
              cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "system-ui,sans-serif",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>𝕏</span> Connect X
          </button>
        )}
      </div>

      {/* ─── Hero ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: 44,
            fontWeight: 900,
            lineHeight: 1.05,
            margin: "0 0 12px",
            paddingBottom: "0.15em",
            background: "linear-gradient(135deg,#ffffff 0%,#7dd3fc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-1px",
          }}>
            The WOOF Era<br />Has Begun
          </h1>
          <p style={{ color: "#ffffff", fontSize: 14, margin: "0 0 20px", lineHeight: 1.55 }}>
            It's time to bring the meme meta back to Base.
          </p>
        </div>
        {/* Mascot group */}
        <div className="farm-hero-mascot">
          <img
            src="/welcome.png"
            alt=""
            className="farm-hero-mascot-img"
            style={{ filter: "drop-shadow(0 4px 16px rgba(0,82,255,0.22))" }}
          />
        </div>
      </div>

      {/* ─── Section 1 + 2: Points & Streak ─── */}
      <div className="farm-points-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Your Points */}
        <div className="glass-card farm-points-card">
          <div className="farm-pts-label" style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1.2px" }}>
            Your Points
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div className="farm-pts-number" style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, color: "#0F172A" }}>
                {twitterUser ? approvedPoints.toLocaleString() : "—"}
              </div>
              {twitterUser && pendingCount > 0 && (
                <div className="farm-pts-pending" style={{ fontSize: 11, color: "#D97706", marginTop: 5, fontWeight: 700 }}>
                  {pendingCount} pending
                </div>
              )}
              {!twitterUser && (
                <div className="farm-pts-hint" style={{ fontSize: 11, color: "#64748B", marginTop: 5 }}>
                  Connect X to see your points
                </div>
              )}
            </div>
            <img
              src="/pointbone.png"
              alt=""
              className="farm-pts-emoji"
              style={{ fontSize: 72, width: "1em", height: "1em", flexShrink: 0, objectFit: "contain" }}
            />
          </div>
        </div>

        {/* Daily Streak */}
        <div className="glass-card farm-streak-card" style={{ overflow: "hidden", minWidth: 0 }}>
          <div className="farm-streak-label" style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "1.2px" }}>
            Daily Streak 🔥
          </div>

          {/* 7-day circles */}
          <div className="streak-circles-row" style={{ display: "flex", gap: 5, justifyContent: "space-between", marginBottom: 14 }}>
            {STREAK_DAYS.map((day) => {
              const filled = day <= streakDay;
              const current = day === streakDay + 1;
              return (
                <div key={day} className="streak-circle-item" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div className="streak-circle-dot" style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: filled ? "#7dd3fc" : current ? "rgba(0,82,255,0.08)" : "rgba(31,41,55,0.06)",
                    border: current ? "2px solid #0052FF" : filled ? "2px solid transparent" : "2px solid #D1D5DB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: filled ? 13 : 10, fontWeight: 700,
                    color: filled ? "#0077b6" : current ? "#0052FF" : "#9CA3AF",
                  }}>
                    {filled ? "✓" : day}
                  </div>
                  <span className="streak-day-label" style={{ fontSize: 9, color: "#64748B" }}>D{day}</span>
                </div>
              );
            })}
          </div>

          {/* Today's approved progress toward 30 */}
          {twitterUser ? (
            todayCount >= 30 ? (
              <div className="streak-status-text" style={{ fontSize: 11, color: "#059669", fontWeight: 700, textAlign: "center" }}>
                🎉 Day {streakDay} earned! Back tomorrow.
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: "#475569" }}>Today</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: todayCount >= 25 ? "#D97706" : "#0F172A" }}>
                    {todayCount} / 30
                  </span>
                </div>
                <div style={{ height: 4, background: "rgba(31,41,55,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    width: `${Math.min((todayCount / 30) * 100, 100)}%`,
                    background: todayCount >= 25 ? "#F59E0B" : "#0052FF",
                    transition: "width 0.3s",
                  }} />
                </div>
                <div className="streak-hint-text" style={{ fontSize: 10, color: "#64748B", marginTop: 5, textAlign: "center" }}>
                  {30 - todayCount} more needed · pending don&apos;t count
                </div>
              </div>
            )
          ) : (
            <div style={{ fontSize: 10, color: "#64748B", textAlign: "center" }}>
              Connect X to track streak
            </div>
          )}
        </div>
      </div>

      {/* ─── Section 3: What is WOOF? ─── */}
      <div className="glass-card" style={{ marginBottom: 14, overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 14, bottom: -16, fontSize: 88, opacity: 0.04, lineHeight: 1 }}>🐾</div>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1.2px" }}>
          What is WOOF?
        </div>
        <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
          WOOF is a B20 token built for the Base community.
          <br /><br />
          We're building for Base creators, Base builders, reply guys, and everyone who helps keep the ecosystem alive. With the WOOF Translator and a community points system, we're making it fun to engage with the Base ecosystem while bringing the Base meme culture back.
          <br /><br />
          The more you contribute to Base, the more WOOF Points you earn.
        </p>
      </div>

      {/* ─── Section 4: Top Contributors ─── */}
      <div className="glass-card" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: "1.2px" }}>
          Top Contributors
        </div>
        {topContributors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "18px 0", color: "#64748B", fontSize: 13 }}>
            No contributors yet — be the first! 🐾
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {topContributors.map((c, i) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11, color: "#475569", width: 18, textAlign: "right", fontWeight: 700 }}>#{i + 1}</span>
                <span style={{ fontSize: 20, lineHeight: 1, color: "#0F172A" }}>𝕏</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#0F172A" }}>@{c.name}</span>
                <span style={{ fontSize: 14, color: "#0052FF", fontWeight: 800 }}>{c.points.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 5: Earn Points ─── */}
      <div style={{ fontSize: 10, color: "#ffffff", fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "1.2px" }}>
        Earn Points
      </div>

      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 22 }}>📮</span>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>Submit Reply</div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
          Submit your X reply link — must match your connected @handle
        </div>
        <div style={{ color: "#0052FF", fontWeight: 800, fontSize: 17 }}>+{rewardPts.submitReply} pts</div>

        {!twitterUser ? (
          <button
            className="farm-btn-secondary"
            style={{ width: "100%", padding: "9px 0", color: "#0F172A" }}
            onClick={() => setShowConnect(true)}
          >
            𝕏 Connect X to submit
          </button>
        ) : (
          <>
            <input
              className="farm-input"
              value={twitterLink}
              onChange={e => { setTwitterLink(e.target.value); setSubmitError(""); }}
              placeholder="https://x.com/username/status/..."
              style={{ fontSize: 12, marginBottom: 2 }}
            />
            {submitError && (
              <div style={{ fontSize: 11, color: "#DC2626", lineHeight: 1.4, padding: "6px 10px", background: "rgba(220,38,38,0.08)", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)" }}>
                ⚠ {submitError}
              </div>
            )}
            <button
              className="farm-btn-primary"
              style={{ width: "100%", padding: "9px 0", opacity: (twitterLink.trim() && !submitting) ? 1 : 0.45 }}
              onClick={handleSubmitReply}
              disabled={submitting || !twitterLink.trim()}
            >
              {submitting ? "Submitting…" : submitted ? "✓ Submitted!" : "Submit"}
            </button>
          </>
        )}
      </div>

      <div style={{ height: 14 }} />

      {/* Submit Content */}
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 22 }}>📝</span>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A" }}>Submit Content</div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
          Share meme content, articles, or WOOF-related creative work
        </div>
        <div style={{ color: "#0052FF", fontWeight: 800, fontSize: 17 }}>+{rewardPts.submitContent} pts</div>

        {!twitterUser ? (
          <button
            className="farm-btn-secondary"
            style={{ width: "100%", padding: "9px 0", color: "#0F172A" }}
            onClick={() => setShowConnect(true)}
          >
            𝕏 Connect X to submit
          </button>
        ) : (
          <>
            <input
              className="farm-input"
              value={contentTitle}
              onChange={e => { setContentTitle(e.target.value); setContentError(""); }}
              placeholder="Content title or description"
              style={{ fontSize: 12, marginBottom: 2 }}
            />
            <input
              className="farm-input"
              value={contentLink}
              onChange={e => { setContentLink(e.target.value); setContentError(""); }}
              placeholder="https://x.com/i/status/... or https://x.com/user/status/..."
              style={{ fontSize: 12, marginBottom: 2 }}
            />
            {contentError && (
              <div style={{ fontSize: 11, color: "#DC2626", lineHeight: 1.4, padding: "6px 10px", background: "rgba(220,38,38,0.08)", borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)" }}>
                ⚠ {contentError}
              </div>
            )}
            <button
              className="farm-btn-primary"
              style={{ width: "100%", padding: "9px 0", opacity: (contentTitle.trim() && contentLink.trim()) ? 1 : 0.45 }}
              onClick={handleSubmitContent}
              disabled={!contentTitle.trim() || !contentLink.trim()}
            >
              {contentSubmitted ? "✓ Submitted!" : "Submit"}
            </button>
          </>
        )}
      </div>

      <div style={{ height: 24 }} />
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   Desktop icon
══════════════════════════════════════════════ */
function DesktopIcon({ icon, label, onDoubleClick }: { icon: string; label: string; onDoubleClick: () => void }) {
  return (
    <button
      onDoubleClick={onDoubleClick}
      className="flex flex-col items-center gap-1 p-2 hover:bg-[#000080]/30 active:bg-[#000080]/50 w-20 select-none"
    >
      <span className="text-4xl">{icon}</span>
      <span
        className="text-white text-center leading-tight px-0.5 text-sm"
        style={{
          fontFamily: "var(--font-pixel-body)",
          textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════
   Window metadata & initial state
══════════════════════════════════════════════ */
const WIN_META: Record<WinId, { icon: string; title: string; label: string }> = {
  welcome:      { icon: "🐾", title: "Welcome to WOOF.EXE",                label: "🏠 Welcome"      },
  woofing:      { icon: "🐾", title: "WOOFing",                             label: "🐾 WOOFing"      },
  community:    { icon: "🌐", title: "Community.exe — WOOF Social Hub",    label: "🌐 Community"    },
  about:        { icon: "ℹ️",  title: "About WOOF.EXE",                     label: "ℹ️ About"        },
  "farm-points":{ icon: "🦴", title: "Farm Points.exe",                    label: "🦴 Farm Points"  },
};

const INITIAL_WINS: WinState[] = [
  { id: "welcome",      x: 120, y: 60,  z: 10, open: true,  minimized: false },
  { id: "woofing",      x: 340, y: 80,  z: 9,  open: false, minimized: false },
  { id: "community",    x: 80,  y: 200, z: 8,  open: false, minimized: false },
  { id: "about",        x: 500, y: 120, z: 7,  open: false, minimized: false },
  { id: "farm-points",  x: 60,  y: 50,  z: 11, open: true,  minimized: false, maximized: false },
];

let zCounter = 20;

/* ══════════════════════════════════════════════
   Root — Windows 98 Desktop
══════════════════════════════════════════════ */
export default function Home() {
  const [wins, setWins] = useState<WinState[]>(INITIAL_WINS);
  const [mobileTab, setMobileTab] = useState<"farm" | "translate" | "community" | "about">("farm");
  const time = useClock();

  const focus = useCallback((id: WinId) => {
    zCounter++;
    const z = zCounter;
    setWins(ws => ws.map(w => w.id === id ? { ...w, z, minimized: false } : w));
  }, []);

  const open = useCallback((id: WinId) => {
    zCounter++;
    const z = zCounter;
    setWins(ws => ws.map(w => w.id === id ? { ...w, open: true, minimized: false, z } : w));
  }, []);

  const close = useCallback((id: WinId) => {
    setWins(ws => ws.map(w => w.id === id ? { ...w, open: false } : w));
  }, []);

  const minimize = useCallback((id: WinId) => {
    setWins(ws => ws.map(w => w.id === id ? { ...w, minimized: true } : w));
  }, []);

  const maximize = useCallback((id: WinId) => {
    zCounter++;
    const z = zCounter;
    setWins(ws => ws.map(w => w.id === id ? { ...w, maximized: !w.maximized, z } : w));
  }, []);

  const toggle = useCallback((id: WinId) => {
    setWins(ws => {
      const w = ws.find(x => x.id === id)!;
      if (!w.open) { zCounter++; return ws.map(x => x.id === id ? { ...x, open: true, minimized: false, z: zCounter } : x); }
      if (w.minimized) { zCounter++; return ws.map(x => x.id === id ? { ...x, minimized: false, z: zCounter } : x); }
      return ws.map(x => x.id === id ? { ...x, minimized: true } : x);
    });
  }, []);

  const win98Ids: WinId[] = ["welcome", "woofing", "community", "about"];

  const MOBILE_NAV = [
    { key: "farm"      as const, icon: "🦴", label: "Farm"      },
    { key: "translate" as const, icon: "🐾", label: "Translate" },
    { key: "community" as const, icon: "🌐", label: "Community" },
    { key: "about"     as const, icon: "ℹ️",  label: "About"     },
  ];

  return (
    <>
      {/* ── Mobile layout — CSS shows this on <768px ── */}
      <div className="mobile-shell">
        <div className="mobile-header">
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <img src="/woofhead.png" alt="" style={{ height: "15px", width: "auto", display: "inline-block" }} />
            WOOFonBASE
          </span>
        </div>
        <div className="mobile-content">
          <div style={{ display: mobileTab === "farm"      ? "block" : "none", minHeight: "100%", background: "radial-gradient(ellipse 62% 48% at -6% -4%, #0038CC 0%, transparent 100%), radial-gradient(ellipse 58% 44% at 106% -4%, #0046D4 0%, transparent 100%), linear-gradient(180deg, #1578B4 0%, #1A8EC8 55%, #1E96CC 100%)" }}><FarmPointsGated /></div>
          <div style={{ display: mobileTab === "translate" ? "block" : "none", minHeight: "100%", background: "#c0c0c0" }}><WoofingContent /></div>
          <div style={{ display: mobileTab === "community" ? "block" : "none", minHeight: "100%", background: "#c0c0c0" }}><CommunityContent /></div>
          <div style={{ display: mobileTab === "about"     ? "block" : "none", minHeight: "100%", background: "#c0c0c0" }}><AboutContent /></div>
        </div>
        <nav className="mobile-nav">
          {MOBILE_NAV.map(t => (
            <button
              key={t.key}
              className={`mobile-nav-btn${mobileTab === t.key ? " active" : ""}`}
              onClick={() => setMobileTab(t.key)}
            >
              <span className="mobile-nav-btn-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Desktop layout — CSS hides this on <768px ── */}
      <div className="desktop-layout flex flex-1 flex-col min-h-screen overflow-hidden select-none"
        style={{ fontFamily: "var(--font-pixel-body)" }}>

      {/* ── App title bar ── */}
      <div className="w98-titlebar flex-shrink-0 px-3 py-1">
        <span style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "10px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "4px" }}>
          <img src="/woofhead.png" alt="" style={{ height: "14px", width: "auto", display: "inline-block" }} />
          WOOFonBASE
        </span>
        <div className="flex gap-1">
          <div className="w98-titlebar-btn">_</div>
          <div className="w98-titlebar-btn">□</div>
          <div className="w98-titlebar-btn">✕</div>
        </div>
      </div>

      {/* ── Menu bar ── */}
      <div className="w98-menubar flex-shrink-0">
        {(["welcome", "community", "woofing", "about"] as WinId[]).map(id => (
          <span
            key={id}
            className={cn("w98-menuitem", wins.find(w => w.id === id)?.open && !wins.find(w => w.id === id)?.minimized && "active")}
            onClick={() => open(id)}
          >
            {WIN_META[id].label}
          </span>
        ))}
        <span
          className={cn("w98-menuitem", wins.find(w => w.id === "farm-points")?.open && !wins.find(w => w.id === "farm-points")?.minimized && "active")}
          onClick={() => open("farm-points")}
        >
          {WIN_META["farm-points"].label}
        </span>
        <div className="ml-auto flex items-center pr-1">
          <button className="w98-buy-btn">💰 $WOOF BUY NOW!!!</button>
        </div>
      </div>

      {/* ── Marquee ── */}
      <div className="bg-[#000080] text-[#ffff00] py-0.5 flex-shrink-0 overflow-hidden">
        <marquee scrollamount={4} style={{ fontFamily: "var(--font-pixel-body)", fontSize: "0.9rem" }}>
          🐾 WOOF WOOF WOOF &nbsp;|&nbsp; 🪙 $WOOF TO THE MOON &nbsp;|&nbsp; 🦴 1,000,000,000 SUPPLY &nbsp;|&nbsp;
          🌐 JOIN THE WOOF PACK &nbsp;|&nbsp; 📈 WOOF IS PUMPING &nbsp;|&nbsp; 🐕 NO RUG, ONLY WOOF &nbsp;|&nbsp;
          🎉 DRAG THE WINDOWS AROUND! &nbsp;|&nbsp; 🌾 FARM POINTS NOW! &nbsp;|&nbsp; 🐾 WOOF WOOF WOOF
        </marquee>
      </div>

      {/* ── Desktop (draggable window container) ── */}
      <div className="relative flex-1 overflow-hidden">

        {/* Desktop icons — top-left */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-0">
          <DesktopIcon icon="🐾" label="WOOFing.exe"    onDoubleClick={() => open("woofing")} />
          <DesktopIcon icon="🌐" label="Community"       onDoubleClick={() => open("community")} />
          <DesktopIcon icon="ℹ️" label="About.txt"       onDoubleClick={() => open("about")} />
          <DesktopIcon icon="🦴" label="Farm Points"     onDoubleClick={() => open("farm-points")} />
          <DesktopIcon icon="🪙" label="$WOOF Token"    onDoubleClick={() => {}} />
          <DesktopIcon icon="🗑️" label="Recycle Bin"    onDoubleClick={() => {}} />
        </div>

        {/* Win98 floating windows */}
        {win98Ids.map(id => {
          const w = wins.find(x => x.id === id)!;
          return (
            <DraggableWindow key={id} id={id} icon={WIN_META[id].icon} title={WIN_META[id].title}
              win={w} onFocus={focus} onClose={close} onMinimize={minimize}>
              {id === "welcome"   && <WelcomeContent onOpen={open} />}
              {id === "woofing"   && <WoofingContent />}
              {id === "community" && <CommunityContent />}
              {id === "about"     && <AboutContent />}
            </DraggableWindow>
          );
        })}

        {/* Modern glassmorphism windows */}
        <ModernDraggableWindow
          id="farm-points"
          title={WIN_META["farm-points"].title}
          win={wins.find(w => w.id === "farm-points")!}
          onFocus={focus} onClose={close} onMinimize={minimize} onMaximize={maximize}
          defaultWidth={700} defaultHeight={620}
        >
          <FarmPointsGated />
        </ModernDraggableWindow>

      </div>

      {/* ── Taskbar ── */}
      <div className="w98-taskbar flex-shrink-0">
        <button
          className="w98-raised flex items-center gap-1 px-3 py-1 font-bold cursor-pointer hover:bg-[#d4d0c8]"
          style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "10px" }}
        >
          🐾 Start
        </button>

        <div className="w98-sep h-6" />

        {wins.map(w => (
          <button
            key={w.id}
            className={cn("w98-task text-sm", w.open && !w.minimized && "active")}
            onClick={() => toggle(w.id)}
            style={{ display: w.open ? undefined : "none" }}
          >
            {WIN_META[w.id].label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button className="w98-buy-btn text-xs">💰 $WOOF</button>
          <div className="w98-sunken px-3 py-0.5" style={{ fontFamily: "var(--font-pixel-heading)", fontSize: "9px" }}>
            {time}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
