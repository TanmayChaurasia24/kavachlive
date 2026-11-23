"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useInspectionStream } from "../../hooks/useInspectionStream";
import { ApprovalCard } from "../../components/ApprovalCard";
import type { Site } from "../../types/inspection";
import {
  Camera,
  Mic,
  Shield,
  Radio,
  StopCircle,
  Play,
  Volume2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";

export default function InspectPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("SITE-KNP-01");
  const [supervisorName, setSupervisorName] = useState<string>("Er. Arjun Mehta");
  const [language, setLanguage] = useState<"hinglish" | "hindi" | "english">("hinglish");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    isConnected,
    isInspecting,
    inspectionId,
    activeTicket,
    transcripts,
    audioLevel,
    lastCommittedId,
    error,
    videoElementRef,
    startInspection,
    endInspection,
    approveTicket,
    rejectTicket,
  } = useInspectionStream();

  // Fetch registered sites from backend
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    fetch(`${apiUrl}/api/sites`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sites && data.sites.length > 0) {
          setSites(data.sites);
          setSelectedSiteId(data.sites[0].id);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch sites from backend, using default:", err);
        setSites([
          {
            id: "SITE-KNP-01",
            name: "Metro Phase-2 Pier 14, Kanpur",
            code: "SITE-KNP-01",
            projectManager: "Er. Vikram Singh",
            contractors: ["Ramesh Infra Pvt Ltd", "Shakti Electricals"],
            riskScore: 24,
            createdAt: new Date().toISOString(),
          },
        ]);
      });
  }, []);

  // Show toast when ticket is committed
  useEffect(() => {
    if (lastCommittedId) {
      setToastMessage(`Ticket #${lastCommittedId.slice(-6)} committed to Firestore!`);
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastCommittedId]);

  const handleStart = () => {
    startInspection(selectedSiteId, supervisorName, language);
  };

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col relative pb-10">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                KavachLive
                <span className="text-[10px] bg-red-600/30 text-red-400 border border-red-500/40 px-1.5 py-0.2 rounded font-mono uppercase">
                  PWA
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">Field Safety Inspector</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 font-medium transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
            Command Center
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col gap-3">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 text-xs p-3 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Inspection Stream Error</p>
              <p className="text-[11px] text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Session Config Card (Visible when idle) */}
        {!isInspecting && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              New Inspection Setup
            </h2>

            {/* Site Selection */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Active Job Site
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Supervisor Name */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Lead Supervisor
              </label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                placeholder="e.g. Er. Arjun Mehta"
              />
            </div>

            {/* Preferred Voice Language */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Voice Assistant Language
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["hinglish", "hindi", "english"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`py-2 rounded-xl font-medium capitalize border transition ${
                      language === lang
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStart}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-98"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              Start Live Inspection
            </button>
          </div>
        )}

        {/* Live Camera Viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-[4/3] flex items-center justify-center shadow-xl">
          <video
            ref={videoElementRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${!isInspecting ? "hidden" : ""}`}
          />

          {!isInspecting && (
            <div className="text-center p-6 space-y-2">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-xs font-semibold text-slate-300">Camera Inactive</p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Tap &ldquo;Start Live Inspection&rdquo; to stream 1 FPS camera frames &amp; 16kHz audio to Gemini Live.
              </p>
            </div>
          )}

          {/* Active Stream Overlays */}
          {isInspecting && (
            <>
              {/* Status Header Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-red-400 border border-red-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span>LIVE 1 FPS</span>
                </div>
                {isConnected && (
                  <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                    Bidi Audio 16kHz
                  </div>
                )}
              </div>

              {/* Audio Visualizer Pill */}
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-slate-700">
                <Mic className="w-3 h-3 text-amber-400" />
                <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden flex items-center">
                  <div
                    className="h-full bg-amber-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, audioLevel)}%` }}
                  />
                </div>
              </div>

              {/* Live Transcript Subtitles at Bottom */}
              {transcripts.length > 0 && (
                <div className="absolute inset-x-3 bottom-3 bg-black/80 backdrop-blur-md border border-slate-700/80 p-2.5 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                    <Volume2 className="w-3 h-3" />
                    <span>Gemini Live Agent:</span>
                  </div>
                  <p className="text-slate-100 text-[11px] leading-snug line-clamp-2">
                    {transcripts[transcripts.length - 1]?.text}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Active Inspection Controls */}
        {isInspecting && (
          <div className="flex items-center gap-2">
            <button
              onClick={endInspection}
              className="flex-1 py-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-red-900/30"
            >
              <StopCircle className="w-4 h-4" />
              End Inspection Session
            </button>
          </div>
        )}
      </div>

      {/* Sliding Human Approval Card */}
      {activeTicket && (
        <ApprovalCard
          ticket={activeTicket}
          supervisorName={supervisorName}
          onApprove={approveTicket}
          onReject={rejectTicket}
        />
      )}
    </main>
  );
}
