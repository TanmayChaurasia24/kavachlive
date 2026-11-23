import Link from "next/link";
import {
  Camera,
  LayoutDashboard,
  Shield,
  Radio,
  FileCheck2,
  Lock,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Shield className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              KavachLive
              <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
                ENTERPRISE
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Multimodal Field Safety &amp; Statutory Compliance Agent
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-700 transition"
          >
            Dashboard
          </Link>
          <Link
            href="/inspect"
            className="text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 px-4 py-2 rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            Open Inspector
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center space-y-10">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Google Gemini Live API &amp; BOCW Enterprise Grounding
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Hands-Free Safety Compliance for Indian Job Sites.
          </h2>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Eliminate unrecorded safety violations and clunky mobile forms. Point your phone camera, speak casually in Hinglish, and let Gemini visually detect hazards, cite BOCW &amp; IS 14489 clauses, and draft tickets with human-in-the-loop governance.
          </p>
        </div>

        {/* 2 Primary Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Mobile Inspector PWA */}
          <Link
            href="/inspect"
            className="group relative rounded-3xl p-6 bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 hover:border-amber-500/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition duration-300">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition">
                Mobile Field Inspector (PWA)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Live 1 FPS camera streaming &amp; 16kHz bidirectional voice reasoning. Point at active hot-work, scaffolding, or excavation, and approve sliding hazard tickets on-screen.
              </p>
            </div>
            <div className="pt-6 flex items-center justify-between text-xs font-bold text-amber-400">
              <span>Start Inspection Walk</span>
              <span className="group-hover:translate-x-1 transition">→</span>
            </div>
          </Link>

          {/* Card 2: Desktop Command Center */}
          <Link
            href="/dashboard"
            className="group relative rounded-3xl p-6 bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 hover:border-blue-500/60 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition duration-300">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition">
                Supervisor Command Center
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Live compliance radar and ticket table for site managers. Monitor critical permit holds, statutory clause citations, contractor assignments, and evidence snapshots in real time.
              </p>
            </div>
            <div className="pt-6 flex items-center justify-between text-xs font-bold text-blue-400">
              <span>Open Dashboard</span>
              <span className="group-hover:translate-x-1 transition">→</span>
            </div>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-1.5">
            <Radio className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-white">1 FPS Bandwidth Guard</h4>
            <p className="text-[11px] text-slate-400">
              Compressed 640x480 JPEG at 0.6 quality for ultra-low mobile data usage.
            </p>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-1.5">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white">Human-in-the-Loop</h4>
            <p className="text-[11px] text-slate-400">
              Zero auto-commits to Firestore without physical supervisor confirmation.
            </p>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-1.5">
            <FileCheck2 className="w-4 h-4 text-blue-400" />
            <h4 className="text-xs font-bold text-white">Indian Safety Grounding</h4>
            <p className="text-[11px] text-slate-400">
              Exact clause references from BOCW Central Rules, IS 14489, &amp; NBC 2016.
            </p>
          </div>

          <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/60 space-y-1.5">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-white">In-Memory Buffering</h4>
            <p className="text-[11px] text-slate-400">
              Snapshots saved to Cloud Storage only when a hazard is spotted.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        KavachLive • Enterprise Multimodal Construction Safety Compliance Platform
      </footer>
    </div>
  );
}
