import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="group leading-none">
          <span className="block text-lg font-semibold tracking-tight text-ink">
            Rad<span className="text-primary">AI</span>
          </span>
          <span className="block text-[11px] font-medium text-faint">Chest X-ray Analysis</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/how-it-works"
            className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-primary-50 hover:text-primary"
          >
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}
