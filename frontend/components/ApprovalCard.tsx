"use client";

import React from "react";
import type { ComplianceTicket } from "../types/inspection";
import { AlertTriangle, ShieldAlert, CheckCircle, XCircle, FileText, UserCheck, HardHat } from "lucide-react";

interface ApprovalCardProps {
  ticket: ComplianceTicket;
  supervisorName: string;
  onApprove: (ticketId: string, approvedBy: string) => void;
  onReject: (ticketId: string, reason?: string) => void;
}

export function ApprovalCard({
  ticket,
  supervisorName,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const isCritical = ticket.severity === "CRITICAL";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="card-title"
      className="fixed inset-x-0 bottom-0 z-50 p-4 max-w-lg mx-auto animate-slide-up"
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 border-2 border-amber-500/80 shadow-2xl shadow-black/80 backdrop-blur-xl">
        {/* Top Severity Ribbon */}
        <div
          className={`flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider ${
            isCritical
              ? "bg-red-600 text-white animate-pulse"
              : ticket.severity === "HIGH"
              ? "bg-amber-600 text-white"
              : "bg-blue-600 text-white"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            <span>
              {isCritical ? "PERMIT HOLD: WORK STOP REQUIRED" : `${ticket.severity} SEVERITY VIOLATION`}
            </span>
          </div>
          <span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">
            AI Conf: {Math.round((ticket.aiConfidence || 0.9) * 100)}%
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* Title & Description */}
          <div>
            <h3 id="card-title" className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              {ticket.hazardTitle}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {ticket.hazardDescription}
            </p>
          </div>

          {/* Evidence Image Snapshot (if available) */}
          {ticket.snapshotUrl && (
            <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-black/40 h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ticket.snapshotUrl}
                alt="Hazard Snapshot Evidence"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 right-2 bg-black/70 text-[10px] text-amber-400 px-1.5 py-0.5 rounded font-mono">
                LIVE CAMERA SNAPSHOT
              </span>
            </div>
          )}

          {/* Statutory Grounding & Contractor */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
            <div>
              <span className="text-slate-400 flex items-center gap-1">
                <FileText className="w-3 h-3 text-amber-400" /> Statutory SOP:
              </span>
              <span className="font-semibold text-slate-200 block truncate" title={ticket.sopClause}>
                {ticket.sopClause}
              </span>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1">
                <HardHat className="w-3 h-3 text-amber-400" /> Contractor:
              </span>
              <span className="font-semibold text-slate-200 block truncate">
                {ticket.assignedContractor || "Ramesh Infra Pvt Ltd"}
              </span>
            </div>
          </div>

          {/* Human-in-the-Loop Governance Notice */}
          <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-emerald-400" /> Human confirmation required
            </span>
            <span className="italic">Reviewing as: {supervisorName}</span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onReject(ticket.id, "Rejected by field supervisor")}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition active:scale-95"
            >
              <XCircle className="w-4 h-4 text-red-400" />
              Reject Draft
            </button>
            <button
              onClick={() => onApprove(ticket.id, supervisorName)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/50 transition active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              Approve & Commit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
