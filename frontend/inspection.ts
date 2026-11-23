// --- Cloud Firestore Collections ---

export interface Site {
    id: string;
    name: string;               // e.g., "Metro Phase-2 Pier 14, Kanpur"
    code: string;               // e.g., "SITE-KNP-01"
    projectManager: string;
    contractors: string[];      // e.g., ["Ramesh Infra Pvt Ltd", "Shakti Electricals"]
    riskScore: number;          // 0 - 100
    createdAt: string;          // ISO 8601
}

export interface Inspection {
    id: string;
    siteId: string;
    siteName: string;
    supervisorName: string;
    language: "hinglish" | "hindi" | "english";
    status: "ACTIVE" | "COMPLETED";
    startedAt: string;
    endedAt?: string;
    ticketsDraftedCount: number;
}

export type HazardSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ComplianceTicket {
    id: string;
    inspectionId: string;
    siteId: string;
    siteName: string;

    // AI Grounding & Hazard Observation
    hazardTitle: string;
    hazardDescription: string;
    sopClause: string;          // e.g., "BOCW Central Rule 35 / IS 14489:2018 Sec 4.2"
    sopSourceDoc: string;       // e.g., "BOCW_Safety_Manual_2026.pdf"
    severity: HazardSeverity;
    permitHold: boolean;        // true if severity === "CRITICAL"
    assignedContractor: string;
    aiConfidence: number;       // 0.0 - 1.0

    // Evidence URLs (Cloud Storage, NEVER base64 in Firestore)
    snapshotUrl: string;
    audioClipUrl?: string;
    voiceTranscript: string;

    // HITL Governance Lifecycle
    approvalStatus: "DRAFT_PENDING_HUMAN" | "APPROVED_BY_HUMAN" | "REJECTED";
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    resolutionStatus: "OPEN" | "RESOLVED";
    createdAt: string;
}

export interface AuditLog {
    id: string;
    ticketId: string;
    siteId: string;
    action:
    | "TICKET_DRAFTED_BY_AI"
    | "TICKET_APPROVED_BY_HUMAN"
    | "PERMIT_HOLD_APPROVED"
    | "TICKET_REJECTED"
    | "TICKET_RESOLVED";
    actor: string;              // "GeminiLive-Agent" or Supervisor Name
    timestamp: string;
    metadata?: Record<string, any>;
}

// --- WebSocket Message Contracts ---

export type ClientWsMessage =
    | {
        type: "start_inspection";
        siteId: string;
        supervisorName: string;
        language: "hinglish" | "hindi" | "english";
    }
    | { type: "audio"; data: string } // 16kHz mono PCM (base64)
    | { type: "frame"; data: string } // JPEG 640x480 @ 0.6 quality (base64)
    | { type: "approve_ticket"; ticketId: string; approvedBy: string }
    | { type: "reject_ticket"; ticketId: string; reason?: string }
    | { type: "end_inspection"; inspectionId: string };

export type ServerWsMessage =
    | { type: "inspection_started"; inspectionId: string; siteName: string }
    | { type: "audio_out"; data: string } // 24kHz/16kHz PCM from Gemini (base64)
    | { type: "transcript"; speaker: "user" | "agent"; text: string }
    | { type: "hazard_drafted"; ticket: ComplianceTicket } // Triggers sliding card on mobile
    | { type: "ticket_committed"; ticketId: string; status: "APPROVED" | "REJECTED" }
    | { type: "error"; message: string };