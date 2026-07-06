"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type Link = {
  id: number;
  name: string;
  url: string;
  description: string;
  created_at: string;
};

export default function PublicLinksPage() {
  const { username } = useParams<{ username: string }>();
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 1200, h: 800 });
  const [beamLine, setBeamLine] = useState<{ x: number; y: number } | null>(null);
  const activeId = lockedId ?? hoveredId;
  const stageRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/public/${username}/links`);
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setLinks(data.links ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    const updateSize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const sectionH = viewportSize.h - 80;
  const cx = viewportSize.w * 0.5;
  const cy = sectionH * 0.5;

  const planetConfigs = useMemo(() => {
    const count = links.length;
    if (count === 0) return [];
    const maxR = Math.min(cx, cy, viewportSize.w - cx, sectionH - cy) - 50;
    const minR = 80;
    return links.map((_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const radius = minR + t * (maxR - minR);
      const startAngle = (i * 2.399963) * Math.PI * 2;
      const speed = 22 + (i * 7.3) % 32;
      return { radius, startAngle, speed };
    });
  }, [links, cx, cy, viewportSize, sectionH]);

  // Track active node position for beam line
  useEffect(() => {
    if (!activeId || !stageRef.current) {
      setBeamLine(null);
      return;
    }
    const track = () => {
      const el = document.querySelector(`[data-link-id="${activeId}"]`);
      if (!el || !stageRef.current) return;
      const r = el.getBoundingClientRect();
      const sx = stageRef.current.getBoundingClientRect().left;
      const sy = stageRef.current.getBoundingClientRect().top;
      setBeamLine({ x: r.left + r.width / 2 - sx, y: r.top + r.height / 2 - sy });
      rafRef.current = requestAnimationFrame(track);
    };
    rafRef.current = requestAnimationFrame(track);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeId]);

  const starField = useMemo(() => {
    const stars: Array<{ x: number; y: number; r: number; delay: number; duration: number }> = [];
    for (let i = 0; i < 60; i++) {
      const phi = (i * 137.508) % 360;
      const radius = 120 + (i * 17) % 600;
      stars.push({ x: 50 + (Math.cos(phi * Math.PI / 180) * radius * viewportSize.w) / 1000,
        y: 50 + (Math.sin(phi * Math.PI / 180) * radius * sectionH) / 1000,
        r: 0.5 + (i % 3) * 0.5, delay: (i * 0.37) % 4, duration: 2 + (i % 3) * 1.5 });
    }
    return stars;
  }, [viewportSize, sectionH]);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <PublicHeader active="友链" username={username} isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} />

      <section ref={stageRef} className="orbital-stage relative z-10" style={{ height: sectionH, minHeight: 600 }}
        onClick={(e) => { if (e.target === e.currentTarget) setLockedId(null); }}>
        {/* Stars */}
        <svg viewBox={`0 0 ${viewportSize.w} ${sectionH}`} preserveAspectRatio="xMidYMid slice" suppressHydrationWarning
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {starField.map((star, i) => (
            <circle key={i} cx={`${star.x}%`} cy={`${star.y}%`} r={star.r} suppressHydrationWarning
              fill={isNight ? "rgb(148 163 184 / 0.45)" : "rgb(100 116 139 / 0.25)"}
              style={{ animation: `constellationTwinkle ${star.duration}s ease-in-out ${star.delay}s infinite` }} />
          ))}
        </svg>

        {/* Orbit dashed circles */}
        <svg viewBox={`0 0 ${viewportSize.w} ${sectionH}`} preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {planetConfigs.map((cfg, i) => (
            <circle key={i} cx={cx} cy={cy} r={cfg.radius}
              fill="none" stroke={isNight ? "rgb(148 163 184 / 0.1)" : "rgb(148 163 184 / 0.15)"}
              strokeWidth={1} strokeDasharray="5 7" />
          ))}
        </svg>

        {/* Beam line from center to hovered node */}
        {beamLine && (
          <svg viewBox={`0 0 ${viewportSize.w} ${sectionH}`} preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 8 }}>
            <defs>
              <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(16 185 129 / 0.9)" />
                <stop offset="100%" stopColor="rgb(14 165 233 / 0.5)" />
              </linearGradient>
            </defs>
            <line x1={cx} y1={cy} x2={beamLine.x} y2={beamLine.y}
              stroke="url(#beamGrad)" strokeWidth={2} strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px rgb(16 185 129 / 0.5))" }} />
          </svg>
        )}

        {/* Planets */}
        {links.map((link, i) => {
          const cfg = planetConfigs[i];
          if (!cfg) return null;
          const { radius, startAngle, speed } = cfg;
          const isActive = activeId === link.id;

          return (
            <div key={link.id} className="orbital-ring"
              style={{
                position: "absolute", left: cx, top: cy,
                width: radius * 2, height: radius * 2,
                transform: "translate(-50%, -50%)",
                animationName: "orbitSpin",
                animationDuration: `${speed}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationPlayState: activeId !== null ? "paused" : "running",
              }}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" data-link-id={link.id}
                className={`orbital-node ${isActive ? "orbital-node-active" : ""}`}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${radius * Math.cos(startAngle)}px)`,
                  top: `calc(50% + ${radius * Math.sin(startAngle)}px)`,
                  transform: "translate(-50%, -50%)",
                  animationName: "orbitCounterSpin",
                  animationDuration: `${speed}s`,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  animationPlayState: activeId !== null ? "paused" : "running",
                }}
                onMouseEnter={() => setHoveredId(link.id)}
                onMouseLeave={() => setHoveredId(null)}>
                <div className="orbital-node-dot">
                  <span className="orbital-node-initial">{link.name.charAt(0).toUpperCase()}</span>
                </div>
              </a>
            </div>
          );
        })}

        {/* Left side collapsible overview */}
        <div className="link-overview-panel link-overview-open">
          <button
            className="link-overview-capsule"
            onClick={(e) => {
              const panel = e.currentTarget.parentElement;
              const wasOpen = panel?.classList.contains("link-overview-open");
              panel?.classList.toggle("link-overview-open");
              if (wasOpen) setLockedId(null);
            }}
          >
            <span className="link-overview-capsule-text"><span className="link-overview-label-short">总览</span><span className="link-overview-label-full">友链总览</span></span>
            <span className="link-overview-count">{links.length}</span>
          </button>
          <div className="link-overview-blinds">
            {links.map((link, i) => (
              <button
                key={link.id}
                className={`link-overview-item ${activeId === link.id ? "link-overview-item-active" : ""}`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => setLockedId(lockedId === link.id ? null : link.id)}
                onMouseEnter={() => setHoveredId(link.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <span className="link-overview-dot" />
                <span className="link-overview-name">{link.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right side detail card */}
        <div className={`link-detail-panel ${activeId ? "link-detail-panel-visible" : "link-detail-panel-hidden"}`}>
          {(() => {
            const link = links.find(l => l.id === activeId);
            return (
              <div className="link-detail-card" key={activeId ?? "none"}>
                {link ? (
                  <>
                    <div className="link-detail-avatar">{link.name.charAt(0).toUpperCase()}</div>
                    <div className="link-detail-info">
                      <h3>{link.name}</h3>
                      <p className="link-detail-url">{link.url}</p>
                      <p className="link-detail-desc">{link.description || "这个站点暂时没有描述。"}</p>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-detail-visit">
                        访问站点 →
                      </a>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1 }} />
                )}
              </div>
            );
          })()}
        </div>

        {/* Center */}
        <div className="orbital-center" style={{ left: cx, top: cy, transform: "translate(-50%, -50%)" }}>
          <div className="orbital-center-glow" />
          <div className="orbital-center-core"><span>{username.charAt(0).toUpperCase()}</span></div>
        </div>

        {loading && (
          <div className="orbital-message" style={{ left: "50%", top: "60%", transform: "translate(-50%, -50%)" }}>
            <span className="constellation-loading-ring" /><p>正在加载友链...</p>
          </div>
        )}
        {message && (
          <div className="orbital-message" style={{ left: "50%", top: "60%", transform: "translate(-50%, -50%)" }}>
            <p>{message}</p>
          </div>
        )}
        {!loading && !message && links.length === 0 && (
          <div className="orbital-message" style={{ left: "50%", top: "60%", transform: "translate(-50%, -50%)" }}>
            <p>暂无友链</p>
          </div>
        )}
      </section>
    </main>
  );
}
