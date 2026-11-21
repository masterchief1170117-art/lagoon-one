import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { PHASES, phaseAt, type PhaseId } from "@/lagoon/world";
import type { FilmApi } from "@/lagoon/film";

const filmReady = typeof window === "undefined" ? null : import("@/lagoon/film");

export const Route = createFileRoute("/")({ component: Home });

function formatTime(time: number): string {
  const s = Math.max(0, Math.floor(time));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<FilmApi | null>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const orbit = useRef({ x: 0, y: 0, lx: 0, ly: 0, on: false });
  const flags = useRef({ phase: "approach" as PhaseId, playing: true, ended: false });
  const [phase, setPhase] = useState<PhaseId>("approach");
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true;
    let dispose = () => {};
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      flags.current.playing = false;
      flags.current.phase = "splash";
      setPlaying(false);
      setPhase("splash");
    }
    if (!filmReady) return;
    void filmReady.then(({ mountFilm }) => {
        if (!alive || !canvasRef.current) return;
        try {
          const api = mountFilm(canvasRef.current, {
            reduced,
            onFrame: (frame) => {
              if (barRef.current) barRef.current.style.transform = `scaleX(${frame.time / frame.duration})`;
              if (timeRef.current) timeRef.current.textContent = formatTime(frame.time);
              if (flags.current.phase !== frame.phaseId) {
                flags.current.phase = frame.phaseId;
                setPhase(frame.phaseId);
              }
              if (flags.current.playing !== frame.playing) {
                flags.current.playing = frame.playing;
                setPlaying(frame.playing);
              }
              if (flags.current.ended !== frame.ended) {
                flags.current.ended = frame.ended;
                setEnded(frame.ended);
              }
            },
          });
          apiRef.current = api;
          dispose = () => api.dispose();
          setReady(true);
        } catch (error) {
          setFailed(error instanceof Error ? error.message : "The lagoon could not start.");
        }
      })
      .catch((error: unknown) => {
        setFailed(error instanceof Error ? error.message : "The lagoon could not start.");
      });
    return () => {
      alive = false;
      dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        const api = apiRef.current;
        if (!api) return;
        const next = !flags.current.playing;
        api.setPlaying(next);
      }
      if (event.code === "KeyR") apiRef.current?.replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const line = phaseAt(PHASES.find((item) => item.id === phase)?.t ?? 0).line;
  const active = PHASES.find((item) => item.id === phase) ?? PHASES[0];

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink text-foam">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="Seaplane landing on the lagoon at Bora Bora"
        onPointerDown={(event) => {
          orbit.current.on = true;
          orbit.current.lx = event.clientX;
          orbit.current.ly = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!orbit.current.on) return;
          orbit.current.x += (event.clientX - orbit.current.lx) * 0.005;
          orbit.current.y = Math.max(
            -0.4,
            Math.min(0.65, orbit.current.y + (event.clientY - orbit.current.ly) * 0.003),
          );
          orbit.current.lx = event.clientX;
          orbit.current.ly = event.clientY;
          apiRef.current?.setOrbit(orbit.current.x, orbit.current.y);
        }}
        onPointerUp={() => {
          orbit.current.on = false;
        }}
        onPointerCancel={() => {
          orbit.current.on = false;
        }}
      />
      <div className="veil absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-ink sm:h-14" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-ink sm:h-20" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="scrim-copy">
          <p className="text-xs tracking-widest text-sand uppercase">One take</p>
          <h1 className="font-display text-3xl leading-none sm:text-5xl">Lagoon One</h1>
          <p className="mt-1 text-sm text-muted">{ready ? active.line : line}</p>
        </div>
        <p className="pt-1 text-sm text-sand tabular-nums">
          <span ref={timeRef}>0:00</span>
          <span className="text-muted"> / 0:56</span>
        </p>
      </header>

      <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-3 pb-4 sm:px-6 sm:pb-6">
        <div className="rail">
          <span ref={barRef} />
        </div>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 sm:gap-2">
            {PHASES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip min-h-11 shrink-0 rounded-full px-2.5 text-[13px] sm:px-3 sm:text-sm"
                data-on={phase === item.id ? "true" : "false"}
                onClick={() => {
                  apiRef.current?.seek(item.t);
                  setEnded(false);
                  setPlaying(true);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="chip grid min-h-11 min-w-11 place-items-center rounded-full"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => apiRef.current?.setPlaying(!playing)}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            className="chip grid min-h-11 min-w-11 place-items-center rounded-full"
            data-on={ended ? "true" : "false"}
            aria-label="Replay"
            onClick={() => {
              orbit.current.x = 0;
              orbit.current.y = 0;
              apiRef.current?.replay();
              apiRef.current?.setOrbit(0, 0);
            }}
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        {failed ? <p className="text-sm text-sun">{failed}</p> : null}
      </footer>
    </main>
  );
}
