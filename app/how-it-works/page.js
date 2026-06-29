import Link from "next/link";

export const metadata = {
  title: "How RadAI works — architecture & model",
  description:
    "The model, the pipeline, and the scale-to-zero GPU serving architecture behind RadAI.",
};

function Stat({ value, label }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="tabular text-2xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-faint">{label}</div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="relative pl-11">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-sm font-semibold text-primary">
        {n}
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/" className="text-sm font-medium text-muted hover:text-primary">
        ← Back to the tool
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        How RadAI works
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        RadAI turns a single chest radiograph into a structured, section-by-section report.
        It pairs Stanford's CheXagent vision-language model with a cost-aware GPU serving
        setup on AWS that runs only when someone actually uses it.
      </p>

      {/* Model */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-ink">The model</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">CheXagent-2 (3B)</span> is a multimodal
          vision-language model from Stanford AIMI, trained to read chest X-rays and describe
          findings in natural clinical language. RadAI prompts it once per anatomical region,
          then asks it to condense those findings into a single impression — mirroring how a
          radiologist structures a read.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value="3B" label="Parameters" />
          <Stat value="5" label="Anatomical sections" />
          <Stat value="VLM" label="Vision-language" />
          <Stat value="GPU" label="T4 inference" />
        </div>
      </section>

      {/* Pipeline */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-ink">The request pipeline</h2>
        <ol className="mt-6 space-y-7">
          <Step n="1" title="Upload, in the browser">
            Your X-ray is downscaled client-side and sent to a Next.js API route. AWS
            credentials live only on the server — they never reach the browser.
          </Step>
          <Step n="2" title="Asynchronous invocation">
            The server stores the image in S3 and calls SageMaker Asynchronous Inference.
            Async (rather than real-time) suits a model whose full report takes a minute or
            more, and it's what makes scale-to-zero possible.
          </Step>
          <Step n="3" title="Section-by-section inference">
            On the GPU, CheXagent standardizes the image and generates a finding for each of
            the five regions, then summarizes them into an impression.
          </Step>
          <Step n="4" title="Poll & render">
            The browser polls for the result in S3 and renders the structured report. The
            bundled sample skips all of this with a precomputed result, so the demo is instant.
          </Step>
        </ol>
      </section>

      {/* Serving */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-ink">Serving that scales to zero</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A 3-billion-parameter model needs a GPU, and GPUs are expensive to leave running.
          So the endpoint is configured to <span className="font-medium text-ink">scale to
          zero instances when idle</span>: there is no cost when no one is using it. When a
          request arrives, autoscaling spins up a GPU, runs the analysis, and scales back down
          afterward.
        </p>
        <div className="mt-5 rounded-xl border border-line bg-panel p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">Idle cost</p>
              <p className="mt-1 text-sm font-medium text-ink">$0 — no running instances</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">Warm scan</p>
              <p className="mt-1 text-sm font-medium text-ink">~45–60 seconds</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-faint">Cold start</p>
              <p className="mt-1 text-sm font-medium text-ink">a few minutes to wake</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The trade-off is the cold start: the first scan after a quiet period waits while a
          GPU boots and the model loads. For a portfolio-scale tool, that's a worthwhile price
          for near-zero idle cost.
        </p>
      </section>

      {/* Stack */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold text-ink">Stack</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "Next.js 15", "React 19", "Tailwind CSS",
            "AWS SageMaker", "Async Inference", "Auto Scaling",
            "Amazon S3", "CheXagent-2 (3B)", "PyTorch",
          ].map((t) => (
            <span key={t} className="rounded-full border border-line bg-white px-3 py-1 text-sm text-muted">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mt-12 rounded-xl border border-warn/20 bg-warn-50 p-5">
        <h2 className="text-sm font-semibold text-ink">A clear limitation</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          RadAI is a research and educational demonstration. Its output is an AI-generated
          estimate, not a medical diagnosis, and it can be wrong. It is not a medical device
          and must never be used for clinical decisions. Always consult a qualified radiologist
          or physician.
        </p>
      </section>

      <div className="mt-12">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-primary-600">
          Try RadAI →
        </Link>
      </div>
    </div>
  );
}
