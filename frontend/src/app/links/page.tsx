"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  authHeaders,
  clearAuthSession,
  ensureAuthorized,
  redirectToLogin,
  requireAuthToken,
  useAuthUser,
} from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import { useAppSettings } from "@/lib/useAppSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

type FriendLink = {
  id: number;
  name: string;
  url: string;
  description: string;
  created_at: string;
};

export default function LinksPage() {
  const { isNight, showWallpaper, glassAlpha, setGlassAlpha, toggleNight, toggleWallpaper } = useAppSettings();
  const [links, setLinks] = useState<FriendLink[]>([]);
  const [form, setForm] = useState({ name: "", url: "", description: "" });
  const [message, setMessage] = useState("提交友链后会保存到后端列表。");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ linkId: number; x: number; y: number } | null>(null);
  const activeId = lockedId ?? hoveredId;
  const [viewportSize, setViewportSize] = useState({ w: 1200, h: 800 });
  const [beamLine, setBeamLine] = useState<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number>(0);
  const currentUser = useAuthUser();

  const fetchLinks = useCallback(async () => {
    const token = requireAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/links`, { headers: authHeaders(token) });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("友链列表加载失败");
      const data = await res.json();
      setLinks(data.links);
    } catch (e) { setLinks([]); setMessage(e instanceof Error ? e.message : "友链列表加载失败"); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchLinks(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLinks]);

  useEffect(() => {
    const updateSize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const submitLink = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) { setMessage("站点名称和链接地址都需要填写"); return; }
    setIsSubmitting(true); setMessage("正在提交...");
    try {
      const token = requireAuthToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/links`, {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(token) }, body: JSON.stringify(form),
      });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("提交失败");
      const created = await res.json();
      setLinks((c) => [created, ...c]);
      setForm({ name: "", url: "", description: "" });
      setMessage("友链已提交"); setIsComposerOpen(false);
    } catch (e) { setMessage(e instanceof Error ? e.message : "提交失败"); }
    finally { setIsSubmitting(false); }
  }, [form]);

  const deleteLink = useCallback(async (linkId: number) => {
    setContextMenu(null);
    try {
      const token = requireAuthToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/links/${linkId}`, { method: "DELETE", headers: authHeaders(token) });
      ensureAuthorized(res);
      if (!res.ok) throw new Error("删除失败");
      setLinks((c) => c.filter((l) => l.id !== linkId));
      if (lockedId === linkId) setLockedId(null);
    } catch (e) { setMessage(e instanceof Error ? e.message : "删除失败"); }
  }, [lockedId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  const logout = useCallback(() => { clearAuthSession(); redirectToLogin(); }, []);

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

  // Beam line tracking
  useEffect(() => {
    if (!activeId || !stageRef.current) { setBeamLine(null); return; }
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
      stars.push({ x: 50 + (Math.cos(phi * Math.PI / 180) * radius * viewportSize.w) / 1000, y: 50 + (Math.sin(phi * Math.PI / 180) * radius * sectionH) / 1000, r: 0.5 + (i % 3) * 0.5, delay: (i * 0.37) % 4, duration: 2 + (i % 3) * 1.5 });
    }
    return stars;
  }, [viewportSize, sectionH]);

  return (
    <main className={`home-shell min-h-screen ${isNight ? "home-night bg-black text-slate-100" : !showWallpaper ? "bg-white text-slate-900" : "text-slate-900"}`} style={{ "--glass-alpha": glassAlpha } as React.CSSProperties}>
      {showWallpaper && !isNight && <div className="home-global-wallpaper" style={{ filter: "blur(12px) saturate(0.82)" }} />}
      <SiteHeader active="友链" isNight={isNight} showWallpaper={showWallpaper} glassAlpha={glassAlpha} onGlassAlphaChange={setGlassAlpha} onToggleNight={toggleNight} onToggleWallpaper={toggleWallpaper} user={currentUser} onLogout={logout} />

      <section ref={stageRef} className="orbital-stage relative z-10" style={{ height: sectionH, minHeight: 600 }}
        onClick={(e) => { if (e.target === e.currentTarget) setLockedId(null); }}>
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

        {/* Beam line */}
        {beamLine && (
          <svg viewBox={`0 0 ${viewportSize.w} ${sectionH}`} preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 8 }}>
            <defs>
              <linearGradient id="beamGradAdmin" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(16 185 129 / 0.9)" />
                <stop offset="100%" stopColor="rgb(14 165 233 / 0.5)" />
              </linearGradient>
            </defs>
            <line x1={cx} y1={cy} x2={beamLine.x} y2={beamLine.y}
              stroke="url(#beamGradAdmin)" strokeWidth={2} strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px rgb(16 185 129 / 0.5))" }} />
          </svg>
        )}

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
                onMouseLeave={() => setHoveredId(null)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ linkId: link.id, x: e.clientX, y: e.clientY }); }}>
                <div className="orbital-node-dot">
                  <span className="orbital-node-initial">{link.name.charAt(0).toUpperCase()}</span>
                </div>
              </a>
            </div>
          );
        })}

        <button type="button" className="orbital-add-btn orbital-add-btn-top" onClick={() => setIsComposerOpen(true)}>
          + 添加友链
        </button>

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
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ linkId: link.id, x: e.clientX, y: e.clientY }); }}
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

        <div className="orbital-center" style={{ left: cx, top: cy, transform: "translate(-50%, -50%)" }}>
          <div className="orbital-center-glow" />
          <div className="orbital-center-core"><span>{currentUser?.nickname?.charAt(0)?.toUpperCase() || "S"}</span></div>
        </div>

        {contextMenu && (
          <div className="photo-context-menu" style={{ left: contextMenu.x, top: contextMenu.y, position: "fixed", zIndex: 100 }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => void deleteLink(contextMenu.linkId)}>删除友链</button>
          </div>
        )}

      </section>

      {isComposerOpen && (
        <div className="profile-edit-backdrop" onClick={() => setIsComposerOpen(false)}>
          <form className="profile-edit-panel" onClick={(e) => e.stopPropagation()} onSubmit={submitLink}>
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-2xl font-black text-slate-900">添加友链</h2><p className="mt-1 text-sm text-slate-600">提交后会加入轨道网络。</p></div>
              <button type="button" className="home-square-button" onClick={() => setIsComposerOpen(false)}>×</button>
            </div>
            <label className="profile-edit-field mt-5"><span>站点名称</span><input className="home-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="profile-edit-field mt-3"><span>链接地址</span><input className="home-field" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" /></label>
            <label className="profile-edit-field mt-3"><span>描述</span><textarea className="home-field min-h-24 resize-y py-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" className="home-pill-button profile-edit-secondary" onClick={() => setIsComposerOpen(false)}>取消</button>
              <button type="submit" className="home-pill-button" disabled={isSubmitting}>{isSubmitting ? "提交中..." : "提交友链"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
