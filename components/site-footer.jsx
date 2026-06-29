import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-panel">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="font-semibold text-ink">
              Rad<span className="text-primary">AI</span>
            </span>
            <span className="text-faint"> · CheXagent on AWS SageMaker</span>
          </div>
          <Link href="/how-it-works" className="text-sm font-medium text-muted hover:text-primary">
            How it works →
          </Link>
        </div>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-faint">
          RadAI is a research and educational demonstration of medical vision-language modeling.
          It produces AI-generated estimates, not a diagnosis, and must not be used for clinical
          decision-making. Always consult a qualified radiologist or physician.
        </p>
      </div>
    </footer>
  );
}
