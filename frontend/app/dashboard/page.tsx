"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { ComplianceTicket, Site } from "../../types/inspection";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Camera,
  ExternalLink,
  HardHat,
  FileText,
  UserCheck,
  Building,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function DashboardPage() {
  const [tickets, setTickets] = useState<ComplianceTicket[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTicket, setSelectedTicket] = useState<ComplianceTicket | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  // Fetch sites for filtering
  useEffect(() => {
    fetch(`${apiUrl}/api/sites`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sites) setSites(data.sites);
      })
      .catch((err) => console.warn("Failed to fetch sites:", err));
  }, [apiUrl]);

  // Fetch compliance tickets
  const fetchTickets = useCallback(() => {
    setIsLoading(true);
    const query = selectedSiteId !== "ALL" ? `?siteId=${selectedSiteId}` : "";
    fetch(`${apiUrl}/api/tickets${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.tickets) {
          setTickets(data.tickets);
        }
        setLastUpdated(new Date().toLocaleTimeString());
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch tickets:", err);
        setIsLoading(false);
      });
  }, [apiUrl, selectedSiteId]);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 6000); // Poll every 6 seconds
    return () => clearInterval(interval);
  }, [fetchTickets]);

  // Approve ticket directly from command center if pending
  const handleApprove = async (ticketId: string) => {
    try {
      const wsUrl =
        process.env.NEXT_PUBLIC_WS_URL ||
        (typeof window !== "undefined"
          ? `ws://${window.location.hostname}:8080`
          : "ws://localhost:8080");

      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "approve_ticket",
            ticketId,
            approvedBy: "Command Center Admin",
          })
        );
        setTimeout(() => {
          ws.close();
          fetchTickets();
        }, 500);
      };
    } catch (err) {
      console.error("Failed to approve ticket:", err);
    }
  };

  // Metrics
  const totalIncidents = tickets.length;
  const criticalPermitHolds = tickets.filter(
    (t) => t.severity === "CRITICAL" && t.permitHold
  ).length;
  const pendingApprovals = tickets.filter(
    (t) => t.approvalStatus === "DRAFT_PENDING_HUMAN"
  ).length;
  const resolvedCount = tickets.filter(
    (t) => t.approvalStatus === "APPROVED_BY_HUMAN"
  ).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                KavachLive
                <span className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                  Command Center
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Statutory Compliance &amp; Hazard Radar (BOCW / IS 14489)
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Site Selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <Building className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Active Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchTickets}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
            title={`Last updated: ${lastUpdated}`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
          </button>

          {/* Link to Mobile Inspection */}
          <Link
            href="/inspect"
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <Camera className="w-3.5 h-3.5" />
            Launch Mobile Inspector
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Violations Spotted</p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalIncidents}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-red-300 font-medium">Critical Permit Holds</p>
              <h3 className="text-2xl font-bold text-red-400 mt-1">{criticalPermitHolds}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-300 font-medium">Pending Human Approval</p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">{pendingApprovals}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-300 font-medium">Approved by Supervisor</p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{resolvedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Live Tickets Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Live Compliance Tickets
              </h2>
              <p className="text-xs text-slate-400">
                Grounding observations from Gemini Live stream with BOCW / IS 14489 clauses.
              </p>
            </div>
            <span className="text-[11px] text-slate-400">
              Auto-refreshing every 6s • Last: {lastUpdated}
            </span>
          </div>

          {tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <HardHat className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-medium">No compliance violations recorded yet.</p>
              <p className="text-xs text-slate-600">
                Start a session on the mobile inspector to stream live hazard observations.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Snapshot</th>
                    <th className="px-4 py-3">Hazard &amp; Description</th>
                    <th className="px-4 py-3">Severity &amp; Permit Hold</th>
                    <th className="px-4 py-3">Statutory Citation</th>
                    <th className="px-4 py-3">Assigned Subcontractor</th>
                    <th className="px-4 py-3">Governance Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition">
                      {/* Evidence Snapshot */}
                      <td className="px-4 py-3">
                        {t.snapshotUrl ? (
                          <button
                            onClick={() => setSelectedTicket(t)}
                            className="relative group w-14 h-11 rounded-lg overflow-hidden border border-slate-700 bg-black block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={t.snapshotUrl}
                              alt={t.hazardTitle}
                              className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <ExternalLink className="w-3 h-3 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-14 h-11 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600">
                            <Camera className="w-4 h-4" />
                          </div>
                        )}
                      </td>

                      {/* Hazard Info */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-bold text-white text-xs">{t.hazardTitle}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {t.hazardDescription}
                        </p>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Site: {t.siteName}
                        </span>
                      </td>

                      {/* Severity & Permit Hold */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            t.severity === "CRITICAL"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : t.severity === "HIGH"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {t.severity}
                        </span>
                        {t.permitHold && (
                          <span className="block mt-1 text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                            ● WORK STOP HOLD
                          </span>
                        )}
                      </td>

                      {/* Statutory Citation */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="font-mono text-amber-300 font-semibold block truncate">
                          {t.sopClause}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {t.sopSourceDoc}
                        </span>
                      </td>

                      {/* Contractor */}
                      <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">
                        {t.assignedContractor || "Ramesh Infra Pvt Ltd"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.approvalStatus === "DRAFT_PENDING_HUMAN" ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold animate-pulse">
                            <Clock className="w-3 h-3" />
                            Pending Supervisor
                          </span>
                        ) : t.approvalStatus === "APPROVED_BY_HUMAN" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {t.approvalStatus === "DRAFT_PENDING_HUMAN" && (
                          <button
                            onClick={() => handleApprove(t.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition shadow-md shadow-emerald-900/30"
                          >
                            Approve
                          </button>
                        )}
                        {t.approvalStatus === "APPROVED_BY_HUMAN" && (
                          <span className="text-[10px] text-slate-500 italic">
                            By {t.approvedBy || "Supervisor"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Snapshot Preview Modal */}
      {selectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                {selectedTicket.hazardTitle}
              </h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>

            {selectedTicket.snapshotUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedTicket.snapshotUrl}
                  alt={selectedTicket.hazardTitle}
                  className="w-full max-h-80 object-contain mx-auto"
                />
              </div>
            )}

            <div className="text-xs space-y-1.5 text-slate-300">
              <p>
                <strong className="text-white">Observation:</strong>{" "}
                {selectedTicket.hazardDescription}
              </p>
              <p>
                <strong className="text-white">Statutory Citation:</strong>{" "}
                <span className="font-mono text-amber-300">
                  {selectedTicket.sopClause}
                </span>{" "}
                ({selectedTicket.sopSourceDoc})
              </p>
              <p>
                <strong className="text-white">Responsible Contractor:</strong>{" "}
                {selectedTicket.assignedContractor}
              </p>
              <p>
                <strong className="text-white">Approval Status:</strong>{" "}
                <span className="font-semibold text-emerald-400">
                  {selectedTicket.approvalStatus}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
