"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import {
  SECTIONS,
  normalizeSections,
  SAMPLE_REPORT,
  SAMPLE_IMAGE,
} from "@/lib/report";

/* ------------------------------ helpers ------------------------------ */

// Downscale to <=1400px and re-encode as JPEG so uploads stay small/fast.
function resizeImage(file, maxDim = 1400, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const STAGES = [
  { at: 0, text: "Sending your scan to the model…" },
  { at: 15, text: "Analyzing the X-ray, section by section…" },
  {
    at: 80,
    text: "The model is waking up from idle — the first scan after a quiet period can take a few minutes. Hang tight.",
  },
];
function stageMessage(elapsed) {
  let msg = STAGES[0].text;
  for (const s of STAGES) if (elapsed >= s.at) msg = s.text;
  return msg;
}

/* ------------------------------ page ------------------------------ */

export default function Home() {
  const [image, setImage] = useState(null); // data URL or sample path
  const [meta, setMeta] = useState(null); // { name, isSample }
  const [status, setStatus] = useState("idle"); // idle|starting|polling|done|error
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const reset = () => {
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    setStatus("idle");
    setReport(null);
    setError(null);
    setElapsed(0);
  };

  const clearAll = () => {
    reset();
    setImage(null);
    setMeta(null);
  };

  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    reset();
    try {
      const dataUrl = await resizeImage(file);
      setImage(dataUrl);
      setMeta({ name: file.name, isSample: false });
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }, []);

  const loadSample = () => {
    reset();
    setImage(SAMPLE_IMAGE);
    setMeta({ name: "Sample chest X-ray (PA)", isSample: true });
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png"] },
    multiple: false,
    noClick: true,
  });

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(timerRef.current); }, []);

  const analyze = async () => {
    if (!image) return;
    setError(null);
    setReport(null);

    // Instant path: the bundled sample uses a precomputed report (no cost, no wait).
    if (meta?.isSample) {
      setStatus("starting");
      setTimeout(() => {
        setReport(SAMPLE_REPORT);
        setStatus("done");
      }, 450);
      return;
    }

    setStatus("starting");
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start analysis.");

      setStatus("polling");
      const { outputKey, failureKey } = data;
      const qs = new URLSearchParams({ outputKey, ...(failureKey ? { failureKey } : {}) });

      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/report-status?${qs.toString()}`);
          const s = await r.json();
          if (s.status === "done") {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setReport(s.report);
            setStatus("done");
          } else if (s.status === "failed") {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setError(s.error || "The model returned an error.");
            setStatus("error");
          }
        } catch {
          /* transient poll error — keep trying */
        }
      }, 5000);

      // Safety timeout after 12 minutes.
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus((st) => {
            if (st === "polling") {
              setError("This is taking longer than expected. Please try again in a moment.");
              return "error";
            }
            return st;
          });
        }
      }, 12 * 60 * 1000);
    } catch (e) {
      clearInterval(timerRef.current);
      setError(e.message);
      setStatus("error");
    }
  };

  const busy = status === "starting" || status === "polling";
  const sections = report ? normalizeSections(report.section_by_section) : [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      {/* Intro */}
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Stanford CheXagent · vision-language model
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Read a chest X-ray, structured like a radiologist.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Upload a chest radiograph and RadAI returns a section-by-section analysis —
          airway, breathing, cardiac, diaphragm, and everything else — plus a concise
          impression. Inference runs on a GPU model that scales to zero when idle.
        </p>
      </div>

      {/* Workbench */}
      <div className="mt-9 grid gap-6 lg:grid-cols-2">
        {/* Left: input / preview */}
        <section>
          {!image ? (
            <div
              {...getRootProps()}
              className={`group relative flex min-h-[340px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-grid p-8 text-center transition-colors ${
                isDragActive ? "border-primary bg-primary-50" : "border-line hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-primary shadow-card">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </div>
              <p className="mt-4 text-[15px] font-medium text-ink">
                {isDragActive ? "Drop the X-ray here" : "Drag & drop a chest X-ray"}
              </p>
              <p className="mt-1 text-sm text-faint">JPEG or PNG</p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={open}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-600"
                >
                  Choose file
                </button>
                <button
                  type="button"
                  onClick={loadSample}
                  className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Try the sample
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="relative aspect-square w-full bg-[#0b0f17]">
                <Image
                  src={image}
                  alt="Chest X-ray"
                  fill
                  unoptimized
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                {busy && <div className="scanline pointer-events-none absolute inset-0 overflow-hidden" />}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{meta?.name}</p>
                  <p className="text-xs text-faint">{meta?.isSample ? "Bundled demo · instant result" : "Ready to analyze"}</p>
                </div>
                <button
                  onClick={clearAll}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  Replace
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right: action / report */}
        <section className="flex flex-col">
          {!image && (
            <div className="flex h-full min-h-[340px] flex-col justify-center rounded-2xl border border-line bg-panel p-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">What you'll get</h2>
              <ul className="mt-4 space-y-3">
                {SECTIONS.map((s) => (
                  <li key={s.id} className="flex items-start gap-3">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-muted">
                      <span className="font-medium text-ink">{s.label}</span> — {s.blurb}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {image && status !== "done" && (
            <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-card">
              {!busy && status !== "error" && (
                <div className="flex flex-1 flex-col items-start justify-center">
                  <h2 className="text-lg font-semibold text-ink">Ready when you are</h2>
                  <p className="mt-1.5 text-sm text-muted">
                    {meta?.isSample
                      ? "This sample returns a precomputed report instantly."
                      : "Analysis runs on a GPU model. If it's been idle, the first scan can take a few minutes to warm up."}
                  </p>
                  <button
                    onClick={analyze}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21 21-4.3-4.3" /><circle cx="11" cy="11" r="8" />
                    </svg>
                    Analyze X-ray
                  </button>
                </div>
              )}

              {busy && (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 rounded-full border-2 border-primary-50" />
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                    <span className="tabular text-sm font-semibold text-primary">{elapsed}s</span>
                  </div>
                  <p className="mt-5 max-w-xs text-sm text-muted">{stageMessage(elapsed)}</p>
                  <div className="mt-4 flex gap-1.5">
                    {SECTIONS.map((s, i) => (
                      <span
                        key={s.id}
                        className="h-1.5 w-6 rounded-full bg-primary/30 pulse-soft"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-1 flex-col items-start justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warn-50 text-warn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-ink">Couldn't complete the analysis</h2>
                  <p className="mt-1.5 text-sm text-muted">{error}</p>
                  <button onClick={analyze} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "done" && report && (
            <Report sections={sections} summary={report.summary} isSample={meta?.isSample} onReset={clearAll} />
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ report ------------------------------ */

function Report({ sections, summary, isSample, onReset }) {
  return (
    <div className="rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ok-50 text-ok">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <h2 className="text-base font-semibold text-ink">Radiology report</h2>
          {isSample && (
            <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] font-medium text-faint">sample</span>
          )}
        </div>
        <button onClick={onReset} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
          New scan
        </button>
      </div>

      <div className="divide-y divide-line">
        {sections.map((s) => (
          <div key={s.id} className="flex gap-4 px-5 py-4">
            <div className="w-28 shrink-0">
              <p className="text-sm font-semibold text-ink">{s.label}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-faint">{s.blurb}</p>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-muted">
              {s.text || <span className="italic text-faint">No finding reported.</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-line bg-primary-50/60 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Impression</p>
        <p className="mt-1 text-[15px] font-medium leading-relaxed text-ink">{summary}</p>
      </div>

      <div className="px-5 py-3">
        <p className="text-[11px] leading-relaxed text-faint">
          AI-generated estimate for research and educational use only — not a diagnosis. Always consult a qualified radiologist.
        </p>
      </div>
    </div>
  );
}
