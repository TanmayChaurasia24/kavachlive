import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore, type Query } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import type { Site, Inspection, ComplianceTicket, AuditLog } from "../type.js";

let app: App;

if (getApps().length === 0) {
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(process.cwd(), "serviceAccountKey.json") ||
    path.resolve(process.cwd(), "backend/serviceAccountKey.json");

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    const storageBucket =
      process.env.GCS_BUCKET_NAME || `${serviceAccount.project_id}.firebasestorage.app`;

    app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket,
    });
  } else {
    app = initializeApp(
      process.env.GCS_BUCKET_NAME
        ? { storageBucket: process.env.GCS_BUCKET_NAME }
        : {}
    );
  }
} else {
  app = getApps()[0]!;
}

export { app };
export const db: Firestore = getFirestore(app);

// Collection References
const SITES_COLLECTION = "sites";
const INSPECTIONS_COLLECTION = "inspections";
const TICKETS_COLLECTION = "compliance_tickets";
const AUDIT_LOGS_COLLECTION = "audit_logs";

/**
 * Fetch a site by its unique siteId or code.
 */
export async function getSite(siteId: string): Promise<Site | null> {
  try {
    const docRef = db.collection(SITES_COLLECTION).doc(siteId);
    const snap = await docRef.get();
    if (snap.exists) {
      return { id: snap.id, ...(snap.data() as Omit<Site, "id">) };
    }

    // Try finding by site code (e.g. SITE-KNP-01)
    const querySnap = await db
      .collection(SITES_COLLECTION)
      .where("code", "==", siteId)
      .limit(1)
      .get();

    if (!querySnap.empty && querySnap.docs[0]) {
      const doc = querySnap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<Site, "id">) };
    }

    return null;
  } catch (error) {
    console.error(`[Firestore] Error fetching site ${siteId}:`, error);
    return null;
  }
}

/**
 * Create a new live inspection session.
 */
export async function createInspectionSession(
  siteId: string,
  supervisorName: string,
  language: "hinglish" | "hindi" | "english" = "hinglish"
): Promise<Inspection> {
  const site = await getSite(siteId);
  const siteName = site?.name || siteId;

  const inspectionRef = db.collection(INSPECTIONS_COLLECTION).doc();
  const inspectionData: Omit<Inspection, "id"> = {
    siteId,
    siteName,
    supervisorName,
    language,
    status: "ACTIVE",
    startedAt: new Date().toISOString(),
    ticketsDraftedCount: 0,
  };

  await inspectionRef.set(inspectionData);

  return {
    id: inspectionRef.id,
    ...inspectionData,
  };
}

/**
 * End an active inspection session.
 */
export async function endInspectionSession(inspectionId: string): Promise<void> {
  try {
    await db.collection(INSPECTIONS_COLLECTION).doc(inspectionId).update({
      status: "COMPLETED",
      endedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[Firestore] Error ending inspection ${inspectionId}:`, error);
  }
}

/**
 * Draft a compliance ticket with DRAFT_PENDING_HUMAN status.
 * NEVER auto-approved without human confirmation.
 */
export async function draftTicketInFirestore(
  ticketData: Omit<ComplianceTicket, "id" | "createdAt" | "approvalStatus" | "resolutionStatus">
): Promise<ComplianceTicket> {
  const ticketRef = db.collection(TICKETS_COLLECTION).doc();
  const now = new Date().toISOString();

  const ticket: ComplianceTicket = {
    id: ticketRef.id,
    ...ticketData,
    approvalStatus: "DRAFT_PENDING_HUMAN",
    resolutionStatus: "OPEN",
    createdAt: now,
  };

  await ticketRef.set(ticket);

  // Increment inspection ticket count atomically
  if (ticket.inspectionId) {
    await db
      .collection(INSPECTIONS_COLLECTION)
      .doc(ticket.inspectionId)
      .update({
        ticketsDraftedCount: FieldValue.increment(1),
      })
      .catch((err: any) =>
        console.warn("[Firestore] Failed to increment ticket counter:", err?.message)
      );
  }

  // Create immutable audit log entry
  await createAuditLog({
    ticketId: ticket.id,
    siteId: ticket.siteId,
    action: "TICKET_DRAFTED_BY_AI",
    actor: "GeminiLive-Agent",
    metadata: {
      hazardTitle: ticket.hazardTitle,
      severity: ticket.severity,
      sopClause: ticket.sopClause,
    },
  });

  return ticket;
}

/**
 * Commit a ticket approval following Human-in-the-Loop confirmation.
 */
export async function commitTicketApproval(
  ticketId: string,
  approvedBy: string
): Promise<ComplianceTicket | null> {
  const ticketRef = db.collection(TICKETS_COLLECTION).doc(ticketId);
  const snap = await ticketRef.get();

  if (!snap.exists) {
    console.error(`[Firestore] Ticket ${ticketId} not found for approval.`);
    return null;
  }

  const existing = snap.data() as ComplianceTicket;
  const now = new Date().toISOString();

  const updates: Partial<ComplianceTicket> = {
    approvalStatus: "APPROVED_BY_HUMAN",
    approvedBy,
    approvedAt: now,
    resolutionStatus: "OPEN",
  };

  await ticketRef.update(updates);

  // Log action in audit trail
  const action = existing.permitHold ? "PERMIT_HOLD_APPROVED" : "TICKET_APPROVED_BY_HUMAN";
  await createAuditLog({
    ticketId,
    siteId: existing.siteId,
    action,
    actor: approvedBy,
    metadata: {
      approvedAt: now,
      permitHold: existing.permitHold,
      severity: existing.severity,
    },
  });

  return {
    ...existing,
    ...updates,
    id: ticketId,
  };
}

/**
 * Reject a drafted ticket.
 */
export async function commitTicketRejection(
  ticketId: string,
  reason: string = "Rejected by supervisor"
): Promise<ComplianceTicket | null> {
  const ticketRef = db.collection(TICKETS_COLLECTION).doc(ticketId);
  const snap = await ticketRef.get();

  if (!snap.exists) {
    console.error(`[Firestore] Ticket ${ticketId} not found for rejection.`);
    return null;
  }

  const existing = snap.data() as ComplianceTicket;
  const updates: Partial<ComplianceTicket> = {
    approvalStatus: "REJECTED",
    rejectionReason: reason,
  };

  await ticketRef.update(updates);

  await createAuditLog({
    ticketId,
    siteId: existing.siteId,
    action: "TICKET_REJECTED",
    actor: existing.approvedBy || "Supervisor",
    metadata: { reason },
  });

  return {
    ...existing,
    ...updates,
    id: ticketId,
  };
}

/**
 * Create an immutable audit log entry.
 */
export async function createAuditLog(
  entry: Omit<AuditLog, "id" | "timestamp">
): Promise<AuditLog> {
  const logRef = db.collection(AUDIT_LOGS_COLLECTION).doc();
  const logData: AuditLog = {
    id: logRef.id,
    ...entry,
    timestamp: new Date().toISOString(),
  };

  await logRef.set(logData).catch((err: any) => {
    console.error("[Firestore] Failed to write audit log:", err);
  });

  return logData;
}

export type { Query };
