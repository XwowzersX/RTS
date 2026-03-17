import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Lock, ChevronRight, Volume2, VolumeX } from "lucide-react";

// === CINEMATIC SCRIPT ===
const SCRIPT = [
  { text: "CLASSIFIED TRANSMISSION\nEARTH DEFENSE COALITION", duration: 3200, style: "mono", planet: null },
  { text: "YEAR 2157", duration: 2500, style: "year", planet: null },
  { text: "Three planets beyond the outer rim\nhave fallen silent.", duration: 3800, style: "narration", planet: "kepler" },
  { text: "Our scouts discovered why...", duration: 3000, style: "narration", planet: "kepler" },
  { text: "THE VETH", duration: 3200, style: "villain", planet: "alien" },
  { text: "An ancient alien hive consciousness.\nUnstoppable. Relentless. Hungry.", duration: 4000, style: "narration", planet: "alien" },
  { text: "They have consumed dozens of worlds.\nHarvesting. Expanding. Preparing.", duration: 4000, style: "narration", planet: "alien" },
  { text: "Now they turn their eyes\nto Earth.", duration: 3500, style: "narration", planet: "earth" },
  { text: "You are Commander.\nLeader of the Earth Defense Coalition.", duration: 3800, style: "narration", planet: "earth" },
  { text: "Establish forward bases.\nCripple their war machine.\nProtect Earth. At any cost.", duration: 4200, style: "narration", planet: "earth" },
  { text: "THE VETH WAR\nBEGINS NOW", duration: 3500, style: "title", planet: null },
];

const VOICE_LINES = [
  "Classified transmission. Earth Defense Coalition.",
  "Year 2157.",
  "Three planets beyond the outer rim have fallen silent.",
  "Our scouts discovered why.",
  "The Veth.",
  "An ancient alien hive consciousness. Unstoppable. Relentless. Hungry.",
  "They have consumed dozens of worlds. Harvesting. Expanding. Preparing.",
  "Now they turn their eyes to Earth.",
  "You are Commander. Leader of the Earth Defense Coalition.",
  "Establish forward bases. Cripple their war machine. Protect Earth. At any cost.",
  "The Veth War begins now.",
];

const MISSIONS = [
  {
    id: 1,
    title: "BEACHHEAD",
    planet: "Kepler-442b",
    description: "Alien forces have overwhelmed our scouts. Establish the first human foothold on this hostile world. Build a base. Hold the line.",
    locked: false,
    color: "#22c55e",
  },
  {
    id: 2,
    title: "THE HIVE",
    planet: "GJ 667Cc",
    description: "Intelligence confirms a Veth command nexus on the second planet. Destroy it before they summon reinforcements.",
    locked: true,
    color: "#f59e0b",
  },
  {
    id: 3,
    title: "HEART OF DARKNESS",
    planet: "Proxima Centauri d",
    description: "The Veth Queen resides here. End the war. End it all. Earth is counting on you.",
    locked: true,
    color: "#ef4444",
  },
];

// === CANVAS DRAWING ===
function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stars: { x: number; y: number; size: number; speed: number; brightness: number }[],
  t: number,
  planetType: string | null,
  flash: number
) {
  ctx.clearRect(0, 0, w, h);

  // Deep space background
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
  if (planetType === "alien") {
    grad.addColorStop(0, "#0d0010");
    grad.addColorStop(1, "#000000");
  } else if (planetType === "earth") {
    grad.addColorStop(0, "#000a1a");
    grad.addColorStop(1, "#000000");
  } else {
    grad.addColorStop(0, "#050005");
    grad.addColorStop(1, "#000000");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stars with parallax drift
  stars.forEach(star => {
    const x = ((star.x + t * star.speed * 0.3) % w + w) % w;
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.001 * star.speed + star.x);
    ctx.beginPath();
    ctx.arc(x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${star.brightness * pulse})`;
    ctx.fill();
  });

  // Planet rendering
  if (planetType === "kepler") {
    const cx = w * 0.72, cy = h * 0.45, r = Math.min(w, h) * 0.22;
    const tilt = Math.sin(t * 0.0003) * 0.02;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    const pg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    pg.addColorStop(0, "#c2410c");
    pg.addColorStop(0.4, "#7f1d1d");
    pg.addColorStop(0.7, "#450a0a");
    pg.addColorStop(1, "#000");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    // Surface detail lines
    for (let i = 0; i < 5; i++) {
      const ly = -r * 0.6 + i * r * 0.3;
      const lw = Math.sqrt(Math.max(0, r * r - ly * ly)) * 0.9;
      ctx.beginPath();
      ctx.moveTo(-lw, ly);
      ctx.lineTo(lw, ly);
      ctx.strokeStyle = `rgba(255,100,50,0.07)`;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    // Glow
    const glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.5);
    glow.addColorStop(0, "rgba(185,60,10,0.25)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.restore();
  }

  if (planetType === "alien") {
    const cx = w * 0.3, cy = h * 0.45, r = Math.min(w, h) * 0.25;
    ctx.save();
    ctx.translate(cx, cy);
    const pg = ctx.createRadialGradient(-r * 0.2, -r * 0.4, r * 0.05, 0, 0, r);
    pg.addColorStop(0, "#4c1d95");
    pg.addColorStop(0.3, "#2d1b69");
    pg.addColorStop(0.7, "#1a0a3d");
    pg.addColorStop(1, "#000");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    // Veins
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 0.0001;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.strokeStyle = `rgba(167,139,250,0.12)`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Pulsing red eye
    const eyePulse = 0.6 + 0.4 * Math.sin(t * 0.003);
    const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.25);
    eg.addColorStop(0, `rgba(239,68,68,${eyePulse})`);
    eg.addColorStop(0.5, `rgba(127,29,29,${eyePulse * 0.5})`);
    eg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = eg;
    ctx.fill();
    // Outer glow
    const glow = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.8);
    glow.addColorStop(0, `rgba(139,92,246,0.3)`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.restore();
  }

  if (planetType === "earth") {
    const cx = w * 0.65, cy = h * 0.4, r = Math.min(w, h) * 0.23;
    ctx.save();
    ctx.translate(cx, cy);
    const pg = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.05, 0, 0, r);
    pg.addColorStop(0, "#3b82f6");
    pg.addColorStop(0.35, "#1d4ed8");
    pg.addColorStop(0.6, "#1e3a5f");
    pg.addColorStop(0.85, "#1e2d40");
    pg.addColorStop(1, "#000");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    // Continent patches
    const continents = [
      { x: -r * 0.2, y: -r * 0.1, w: r * 0.35, h: r * 0.25 },
      { x: r * 0.1, y: r * 0.1, w: r * 0.2, h: r * 0.3 },
      { x: -r * 0.5, y: r * 0.2, w: r * 0.25, h: r * 0.2 },
    ];
    continents.forEach(c => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,197,94,0.35)";
      ctx.fill();
    });
    // Atmosphere glow
    const atm = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.3);
    atm.addColorStop(0, "rgba(59,130,246,0.4)");
    atm.addColorStop(0.5, "rgba(29,78,216,0.15)");
    atm.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = atm;
    ctx.fill();
    // Warning red tint overlay (planet in danger)
    const danger = 0.15 + 0.1 * Math.sin(t * 0.002);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239,68,68,${danger})`;
    ctx.fill();
    ctx.restore();
  }

  // Flash effect
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Cinematic letterbox bars
  const barH = h * 0.1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, barH);
  ctx.fillRect(0, h - barH, w, barH);
}

// === MAIN COMPONENT ===
export default function CampaignPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"cinematic" | "missions">("cinematic");
  const [scriptIdx, setScriptIdx] = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [selectedMission, setSelectedMission] = useState(0);
  const [deploying, setDeploying] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const starsRef = useRef<{ x: number; y: number; size: number; speed: number; brightness: number }[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const flashRef = useRef(0);

  // Generate stars
  useEffect(() => {
    starsRef.current = Array.from({ length: 300 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1200,
      size: Math.random() * 1.8 + 0.2,
      speed: Math.random() * 0.4 + 0.05,
      brightness: Math.random() * 0.7 + 0.3,
    }));
  }, []);

  // Atmospheric audio
  const startAudio = useCallback(() => {
    if (muted) return;
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 3);
      master.connect(ctx.destination);
      gainNodeRef.current = master;

      // Low drone oscillators
      const freqs = [40, 60, 80, 120];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        // Slow LFO modulation
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(0.05 + i * 0.03, ctx.currentTime);
        lfoGain.gain.setValueAtTime(freq * 0.02, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        g.gain.setValueAtTime(0.3 / (i + 1), ctx.currentTime);
        osc.connect(g);
        g.connect(master);
        osc.start();
      });

      // Tension pulse
      const pulseOsc = ctx.createOscillator();
      const pulseGain = ctx.createGain();
      pulseOsc.type = "sine";
      pulseOsc.frequency.setValueAtTime(220, ctx.currentTime);
      pulseGain.gain.setValueAtTime(0, ctx.currentTime);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(master);
      pulseOsc.start();

      // Pulse every 2.5 seconds
      let beat = ctx.currentTime + 2;
      const doBeat = () => {
        if (!audioCtxRef.current) return;
        pulseGain.gain.setValueAtTime(0.4, beat);
        pulseGain.gain.exponentialRampToValueAtTime(0.001, beat + 0.8);
        beat += 2.5;
        setTimeout(doBeat, 2500);
      };
      setTimeout(doBeat, 2000);
    } catch (e) {
      // Audio not supported
    }
  }, [muted]);

  const stopAudio = useCallback(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1.5);
      setTimeout(() => {
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
      }, 2000);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.82;
    utt.pitch = 0.75;
    utt.volume = 0.9;
    // Pick a deep voice if available
    const voices = window.speechSynthesis.getVoices();
    const deep = voices.find(v => v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("deep") || v.lang === "en-GB");
    if (deep) utt.voice = deep;
    window.speechSynthesis.speak(utt);
  }, [muted]);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      const t = now - startTimeRef.current;
      const planet = phase === "cinematic" ? (SCRIPT[scriptIdx]?.planet ?? null) : "earth";

      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.04);

      drawScene(ctx, canvas.width, canvas.height, starsRef.current, t, planet, flashRef.current);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [phase, scriptIdx]);

  // Script advancement
  useEffect(() => {
    if (phase !== "cinematic") return;
    const script = SCRIPT[scriptIdx];
    if (!script) {
      setPhase("missions");
      stopAudio();
      return;
    }

    setTextVisible(true);
    speak(VOICE_LINES[scriptIdx] || "");

    const timer = setTimeout(() => {
      setTextVisible(false);
      flashRef.current = 0.4;
      setTimeout(() => {
        setScriptIdx(i => i + 1);
      }, 600);
    }, script.duration);

    return () => clearTimeout(timer);
  }, [scriptIdx, phase, speak, stopAudio]);

  // Start audio on first interaction / load
  useEffect(() => {
    const handler = () => {
      startAudio();
      window.removeEventListener("click", handler);
    };
    window.addEventListener("click", handler);
    startAudio(); // Try immediately
    return () => window.removeEventListener("click", handler);
  }, [startAudio]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      stopAudio();
    };
  }, [stopAudio]);

  const skip = () => {
    window.speechSynthesis?.cancel();
    setPhase("missions");
    stopAudio();
  };

  const toggleMute = () => {
    setMuted(m => {
      if (!m) {
        window.speechSynthesis?.cancel();
        if (gainNodeRef.current && audioCtxRef.current) {
          gainNodeRef.current.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.3);
        }
      } else {
        if (gainNodeRef.current && audioCtxRef.current) {
          gainNodeRef.current.gain.linearRampToValueAtTime(0.12, audioCtxRef.current.currentTime + 0.3);
        }
      }
      return !m;
    });
  };

  const script = SCRIPT[scriptIdx];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none">
      {/* Background canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* UI layer */}
      <div className="absolute inset-0 z-10 flex flex-col">
        {/* Top bar */}
        <div className="flex justify-between items-start p-4 pt-6">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/40 hover:text-white gap-2 font-rajdhani uppercase tracking-widest text-xs"
            onClick={() => { setLocation("/"); stopAudio(); window.speechSynthesis?.cancel(); }}
          >
            <ChevronLeft className="w-4 h-4" /> Main Menu
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/40 hover:text-white"
              onClick={toggleMute}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            {phase === "cinematic" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/30 hover:text-white font-rajdhani uppercase tracking-widest text-xs"
                onClick={skip}
              >
                Skip Intro ›
              </Button>
            )}
          </div>
        </div>

        {/* === CINEMATIC PHASE === */}
        {phase === "cinematic" && script && (
          <div className="flex-1 flex items-center justify-center px-8">
            <div
              className="text-center max-w-3xl transition-all duration-500"
              style={{ opacity: textVisible ? 1 : 0, transform: textVisible ? "translateY(0)" : "translateY(12px)" }}
            >
              {script.style === "mono" && (
                <div className="font-mono text-green-400/80 text-sm tracking-[0.3em] uppercase whitespace-pre-line leading-relaxed animate-pulse">
                  {script.text}
                </div>
              )}
              {script.style === "year" && (
                <div
                  className="font-cinzel font-black text-white tracking-[0.5em]"
                  style={{ fontSize: "clamp(3rem, 10vw, 7rem)", textShadow: "0 0 80px rgba(255,255,255,0.4)" }}
                >
                  {script.text}
                </div>
              )}
              {script.style === "narration" && (
                <div
                  className="font-cinzel text-white/90 leading-relaxed whitespace-pre-line"
                  style={{ fontSize: "clamp(1rem, 2.5vw, 1.6rem)", textShadow: "0 2px 30px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.8)" }}
                >
                  {script.text}
                </div>
              )}
              {script.style === "villain" && (
                <div className="relative">
                  <div
                    className="font-cinzel font-black tracking-[0.4em] text-red-400"
                    style={{ fontSize: "clamp(3rem, 12vw, 8rem)", textShadow: "0 0 120px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.6)" }}
                  >
                    {script.text}
                  </div>
                  <div className="absolute inset-0 font-cinzel font-black tracking-[0.4em] text-red-600/20 blur-xl"
                    style={{ fontSize: "clamp(3rem, 12vw, 8rem)" }}>
                    {script.text}
                  </div>
                </div>
              )}
              {script.style === "title" && (
                <div className="space-y-4">
                  <div
                    className="font-cinzel font-black text-amber-400 tracking-[0.3em] whitespace-pre-line leading-tight"
                    style={{ fontSize: "clamp(2rem, 7vw, 5rem)", textShadow: "0 0 80px rgba(251,191,36,0.6)" }}
                  >
                    {script.text}
                  </div>
                  <div className="text-white/40 font-rajdhani uppercase tracking-[0.5em] text-sm">
                    Iron & Stone Campaign
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === MISSION SELECT PHASE === */}
        {phase === "missions" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8"
            style={{ opacity: 1 }}>
            <div className="text-center space-y-2">
              <div className="text-amber-400/60 font-mono text-xs tracking-[0.5em] uppercase mb-2">Earth Defense Coalition</div>
              <h1 className="font-cinzel font-black text-white tracking-wider"
                style={{ fontSize: "clamp(1.8rem, 5vw, 3.5rem)", textShadow: "0 0 40px rgba(255,255,255,0.2)" }}>
                MISSION SELECT
              </h1>
              <p className="text-white/40 font-rajdhani text-sm uppercase tracking-widest">Choose your theatre of war, Commander</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl">
              {MISSIONS.map((mission, i) => (
                <button
                  key={mission.id}
                  disabled={mission.locked}
                  onClick={() => !mission.locked && setSelectedMission(i)}
                  className={`relative group text-left rounded-lg border transition-all duration-300 overflow-hidden
                    ${mission.locked ? "opacity-40 cursor-not-allowed border-white/5" : "cursor-pointer hover:scale-[1.02]"}
                    ${selectedMission === i && !mission.locked ? "ring-2 border-transparent" : "border-white/10"}
                  `}
                  style={{
                    background: `linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)`,
                    boxShadow: selectedMission === i && !mission.locked ? `0 0 30px ${mission.color}40` : "none",
                    ringColor: mission.color,
                  }}
                >
                  {/* Color accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: mission.locked ? "#333" : mission.color }} />

                  <div className="p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs tracking-widest mb-1" style={{ color: mission.locked ? "#555" : mission.color }}>
                          MISSION {mission.id.toString().padStart(2, "0")}
                        </div>
                        <div className="font-cinzel font-bold text-xl text-white">{mission.title}</div>
                        <div className="text-white/40 text-xs font-mono mt-0.5">{mission.planet}</div>
                      </div>
                      {mission.locked ? (
                        <Lock className="w-5 h-5 text-white/20 mt-1" />
                      ) : (
                        <div className="w-2 h-2 rounded-full mt-2 animate-pulse" style={{ background: mission.color }} />
                      )}
                    </div>
                    <p className="text-white/50 text-sm leading-relaxed font-rajdhani">
                      {mission.description}
                    </p>
                    {!mission.locked && selectedMission === i && (
                      <div className="text-xs font-mono tracking-widest" style={{ color: mission.color }}>
                        ● SELECTED
                      </div>
                    )}
                  </div>

                  {/* Hover shimmer */}
                  {!mission.locked && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: `linear-gradient(135deg, ${mission.color}08, transparent)` }} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-4 mt-2">
              <Button
                variant="outline"
                className="border-white/10 text-white/50 hover:text-white hover:border-white/30 font-rajdhani uppercase tracking-widest gap-2"
                onClick={() => { setPhase("cinematic"); setScriptIdx(0); startAudio(); }}
              >
                <ChevronLeft className="w-4 h-4" /> Watch Intro Again
              </Button>
              <Button
                className="font-cinzel font-bold tracking-widest gap-2 px-8"
                style={{
                  background: MISSIONS[selectedMission].color,
                  color: "#000",
                  boxShadow: `0 0 30px ${MISSIONS[selectedMission].color}60`,
                  opacity: deploying ? 0.6 : 1,
                }}
                disabled={deploying}
                onClick={async () => {
                  if (selectedMission !== 0) return; // Only mission 1 active for now
                  setDeploying(true);
                  try {
                    stopAudio();
                    window.speechSynthesis?.cancel();
                    const res = await fetch('/api/game/create-survival', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                    const data = await res.json();
                    setLocation(`/game/${data.gameId}`);
                  } catch {
                    setDeploying(false);
                  }
                }}
              >
                {deploying ? 'LAUNCHING...' : 'DEPLOY'} <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-white/20 text-xs font-mono tracking-widest">
              Missions 2 & 3 unlock after completing the previous campaign mission
            </div>
          </div>
        )}

        {/* Bottom gradient overlay for letterbox blend */}
        <div className="h-[10vh] bg-black" />
      </div>
    </div>
  );
}
