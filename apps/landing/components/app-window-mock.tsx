import {
  Eye,
  FilePenLine,
  Link2,
  List,
  PanelRightOpen,
  Search,
  TerminalSquare,
  WandSparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppWindowMockProps {
  className?: string;
  mode?: "reader" | "capture" | "writer";
}

const noteItems = [
  "2026-02-03 NASA's Orion Spacec...",
  "2026-02-04 Full Moon over Artemi...",
  "2026-02-05 NASA Heat Shield Tec...",
  "2026-02-09 Icy Hudson River",
  "2025-09-19 A Beacon to Space"
];

export function AppWindowMock({ className, mode = "reader" }: AppWindowMockProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.75rem] bg-[#1a1a1b] text-white",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-white/50">Zhiyuan Desktop</div>
        <div className="flex items-center gap-3 text-white/55">
          <Eye className="size-4" />
          <PanelRightOpen className="size-4" />
          <List className="size-4" />
          <TerminalSquare className="size-4" />
        </div>
      </div>

      {mode === "reader" ? <ReaderLayout /> : null}
      {mode === "capture" ? <CaptureLayout /> : null}
      {mode === "writer" ? <WriterLayout /> : null}
    </div>
  );
}

function ReaderLayout() {
  return (
    <div className="grid min-h-136 grid-cols-[280px_1fr]">
      <aside className="bg-[#1d1d1e] px-4 py-5">
        <div className="mb-5 flex items-center justify-between text-white/65">
          <div className="flex items-center gap-3">
            <FilePenLine className="size-4" />
            <Link2 className="size-4" />
            <Search className="size-4" />
          </div>
          <div className="text-[11px] tracking-[0.18em] uppercase">Notes</div>
        </div>
        <div className="space-y-2">
          {noteItems.map((item, index) => (
            <div
              key={item}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm text-white/58 transition-colors",
                index === noteItems.length - 1 ? "bg-white/5 text-white" : "hover:bg-white/3"
              )}
            >
              <div className="truncate">{item}</div>
              <div className="mt-1 text-xs text-white/36">2026/02/18 20:19</div>
            </div>
          ))}
        </div>
      </aside>
      <main className="bg-[#1a1a1b] px-7 py-6">
        <div className="flex items-center justify-between text-white/60">
          <div className="text-[11px] font-medium tracking-[0.18em] uppercase">Preview</div>
          <div className="flex items-center gap-3">
            <Eye className="size-4" />
            <PanelRightOpen className="size-4" />
            <WandSparkles className="size-4" />
          </div>
        </div>
        <div className="mt-6 text-[clamp(2rem,4vw,3.6rem)] leading-none font-semibold tracking-tight text-white/92">
          A Beacon to Space
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl bg-[#202022]">
          <div className="aspect-16/10 bg-[#202022]">
            <div className="flex h-full items-end justify-between px-8 pb-8">
              <div className="h-40 w-24 rounded-full bg-black/20 blur-2xl" />
              <div className="h-28 w-28 rounded-full bg-white/4" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CaptureLayout() {
  return (
    <div className="grid min-h-88 grid-cols-[220px_1fr]">
      <aside className="bg-[#1d1d1e] px-4 py-5">
        <div className="text-[11px] tracking-[0.18em] uppercase text-white/45">Sources</div>
        <div className="mt-4 space-y-2 text-sm text-white/65">
          <div className="rounded-xl bg-white/5 px-3 py-2.5">RSS / design feeds</div>
          <div className="rounded-xl bg-white/3 px-3 py-2.5">Saved URL</div>
          <div className="rounded-xl bg-white/3 px-3 py-2.5">Draft article</div>
        </div>
      </aside>
      <main className="bg-[#1a1a1b] px-5 py-5">
        <div className="grid h-full gap-3 md:grid-cols-3">
          {[
            ["Gather", "Monitor feeds and collect content"],
            ["Convert", "Clean web pages into Markdown drafts"],
            ["Export", "Publish or archive when ready"]
          ].map(([title, desc]) => (
            <div key={title} className="rounded-2xl bg-white/2 p-4">
              <div className="text-sm font-medium text-white/90">{title}</div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-3/4 rounded bg-white/7" />
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-[86%] rounded bg-white/5" />
              </div>
              <div className="mt-4 text-xs leading-6 text-white/45">{desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function WriterLayout() {
  return (
    <div className="grid min-h-88 grid-cols-[1.25fr_0.75fr]">
      <main className="bg-[#1a1a1b] px-5 py-5">
        <div className="text-[11px] tracking-[0.18em] uppercase text-white/45">Editor</div>
        <div className="mt-4 h-6 w-2/3 rounded bg-white/14" />
        <div className="mt-5 space-y-3">
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-[94%] rounded bg-white/10" />
          <div className="h-3 w-[88%] rounded bg-white/10" />
          <div className="h-3 w-[82%] rounded bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/4" />
        </div>
      </main>
      <aside className="bg-[#1d1d1e] px-5 py-5">
        <div className="text-[11px] tracking-[0.18em] uppercase text-white/45">Panels</div>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-white/2 p-4">
            <div className="text-sm font-medium text-white/88">Live Preview</div>
            <div className="mt-3 h-20 rounded-xl bg-white/5" />
          </div>
          <div className="rounded-2xl bg-white/2 p-4">
            <div className="text-sm font-medium text-white/88">Export</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/55">
              <span className="rounded-full bg-white/4 px-2 py-1">PDF</span>
              <span className="rounded-full bg-white/4 px-2 py-1">HTML</span>
              <span className="rounded-full bg-white/4 px-2 py-1">Image</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}