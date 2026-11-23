import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import type {
  ClientWsMessage,
  ServerWsMessage,
  Site,
  ComplianceTicket,
} from "./type.js";
import {
  db,
  getSite,
  createInspectionSession,
  endInspectionSession,
  draftTicketInFirestore,
  commitTicketApproval,
  commitTicketRejection,
  type Query,
} from "./services/database.js";
import { uploadSnapshotToGCS } from "./services/storage.js";
import { GeminiLiveSession, type DraftComplianceTicketArgs } from "./geminiLive.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Basic Health & Diagnostic Endpoints
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "kavach-live-backend",
    timestamp: new Date().toISOString(),
  });
});

// Sites API for frontend dropdowns & verification
app.get("/api/sites", async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection("sites").get();
    const sites: Site[] = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...(doc.data() as Omit<Site, "id">),
    }));
    res.json({ sites });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sites/:siteId", async (req: Request, res: Response) => {
  try {
    const site = await getSite(req.params["siteId"] as string);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    return res.json({ site });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Live Tickets API for desktop command center
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const siteId = req.query["siteId"] as string | undefined;
    let query: Query = db
      .collection("compliance_tickets")
      .orderBy("createdAt", "desc")
      .limit(50);

    if (siteId) {
      query = query.where("siteId", "==", siteId);
    }

    const snap = await query.get();
    const tickets = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return res.json({ tickets });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ClientSession {
  inspectionId?: string | undefined;
  siteId?: string | undefined;
  siteName?: string | undefined;
  supervisorName?: string | undefined;
  language?: ("hinglish" | "hindi" | "english") | undefined;
  geminiSession?: GeminiLiveSession | undefined;
  latestFrameBase64?: string | undefined; // In-memory frame buffer (Zero DB writes!)
}

const activeSessions = new Map<WebSocket, ClientSession>();

function sendToClient(ws: WebSocket, message: ServerWsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

wss.on("connection", (ws: WebSocket) => {
  console.log("[WebSocket] Client connected from mobile/web.");
  const session: ClientSession = {};
  activeSessions.set(ws, session);

  ws.on("message", async (rawMessage: string | Buffer) => {
    try {
      const messageStr = rawMessage.toString();
      const payload: ClientWsMessage = JSON.parse(messageStr);

      switch (payload.type) {
        // 1. Start Inspection Session
        case "start_inspection": {
          const { siteId, supervisorName, language } = payload;
          console.log(
            `[WebSocket] Starting inspection for site: ${siteId}, supervisor: ${supervisorName}`
          );

          // Create session record in Firestore
          const inspection = await createInspectionSession(
            siteId,
            supervisorName,
            language
          );

          session.inspectionId = inspection.id;
          session.siteId = siteId;
          session.siteName = inspection.siteName;
          session.supervisorName = supervisorName;
          session.language = language;

          // Initialize Gemini Live Session
          const geminiSession = new GeminiLiveSession(
            inspection.siteName,
            supervisorName,
            language,
            {
              onAudioOut: (base64Audio: string) => {
                sendToClient(ws, {
                  type: "audio_out",
                  data: base64Audio,
                });
              },
              onTranscript: (speaker: "user" | "agent", text: string) => {
                sendToClient(ws, {
                  type: "transcript",
                  speaker,
                  text,
                });
              },
              onDraftTicket: async (
                args: DraftComplianceTicketArgs
              ): Promise<ComplianceTicket | null> => {
                try {
                  const currentInspectionId = session.inspectionId || "adhoc";
                  const currentSiteId = session.siteId || siteId;
                  const currentSiteName = session.siteName || "Active Site";
                  const tempTicketId = `TKT-${Date.now()}`;

                  // Upload the in-memory buffered frame to GCS
                  let snapshotUrl = "";
                  if (session.latestFrameBase64) {
                    snapshotUrl = await uploadSnapshotToGCS(
                      session.latestFrameBase64,
                      currentSiteId,
                      currentInspectionId,
                      tempTicketId
                    );
                  }

                  // Draft ticket in Firestore with DRAFT_PENDING_HUMAN status
                  const ticket = await draftTicketInFirestore({
                    inspectionId: currentInspectionId,
                    siteId: currentSiteId,
                    siteName: currentSiteName,
                    hazardTitle: args.hazardTitle,
                    hazardDescription: args.hazardDescription,
                    sopClause: args.sopClause,
                    sopSourceDoc:
                      args.sopSourceDoc || "BOCW_Central_Rules_1998.pdf",
                    severity: args.severity,
                    permitHold:
                      args.permitHold ?? (args.severity === "CRITICAL"),
                    assignedContractor:
                      args.assignedContractor || "Ramesh Infra Pvt Ltd",
                    aiConfidence: args.aiConfidence ?? 0.92,
                    snapshotUrl,
                    voiceTranscript: "",
                  });

                  // Trigger the sliding Human Approval Card on mobile client
                  sendToClient(ws, {
                    type: "hazard_drafted",
                    ticket,
                  });

                  return ticket;
                } catch (err: any) {
                  console.error("[WebSocket] Error drafting ticket:", err);
                  return null;
                }
              },
              onError: (err: any) => {
                sendToClient(ws, {
                  type: "error",
                  message: err?.message || "Gemini Live error",
                });
              },
              onClose: () => {
                console.log("[WebSocket] Gemini Live session ended.");
              },
            }
          );

          try {
            await geminiSession.start();
            session.geminiSession = geminiSession;

            sendToClient(ws, {
              type: "inspection_started",
              inspectionId: inspection.id,
              siteName: inspection.siteName,
            });
          } catch (geminiError: any) {
            console.warn(
              "[WebSocket] Gemini Live could not connect (check GEMINI_API_KEY):",
              geminiError?.message
            );
            sendToClient(ws, {
              type: "inspection_started",
              inspectionId: inspection.id,
              siteName: inspection.siteName,
            });
            sendToClient(ws, {
              type: "error",
              message: `Gemini Live connection warning: ${geminiError?.message}`,
            });
          }
          break;
        }

        // 2. Ingest Video Frame (1 FPS JPEG) -> In-Memory Cache (No DB writes!)
        case "frame": {
          session.latestFrameBase64 = payload.data;
          if (session.geminiSession) {
            session.geminiSession.sendFrame(payload.data);
          }
          break;
        }

        // 3. Ingest Audio Chunks (16kHz PCM)
        case "audio": {
          if (session.geminiSession) {
            session.geminiSession.sendAudio(payload.data);
          }
          break;
        }

        // 4. Human-in-the-Loop: Supervisor Approves Ticket
        case "approve_ticket": {
          const { ticketId, approvedBy } = payload;
          console.log(`[WebSocket] Human approved ticket ${ticketId} by ${approvedBy}`);
          const updated = await commitTicketApproval(ticketId, approvedBy);

          if (updated) {
            sendToClient(ws, {
              type: "ticket_committed",
              ticketId,
              status: "APPROVED",
            });
          } else {
            sendToClient(ws, {
              type: "error",
              message: `Ticket ${ticketId} could not be approved.`,
            });
          }
          break;
        }

        // 5. Human-in-the-Loop: Supervisor Rejects Ticket
        case "reject_ticket": {
          const { ticketId, reason } = payload;
          console.log(`[WebSocket] Human rejected ticket ${ticketId}, reason: ${reason}`);
          const updated = await commitTicketRejection(ticketId, reason);

          if (updated) {
            sendToClient(ws, {
              type: "ticket_committed",
              ticketId,
              status: "REJECTED",
            });
          } else {
            sendToClient(ws, {
              type: "error",
              message: `Ticket ${ticketId} could not be rejected.`,
            });
          }
          break;
        }

        // 6. End Inspection Session
        case "end_inspection": {
          const { inspectionId } = payload;
          console.log(`[WebSocket] Ending inspection ${inspectionId}`);
          await endInspectionSession(inspectionId);
          if (session.geminiSession) {
            session.geminiSession.close();
            session.geminiSession = undefined;
          }
          break;
        }

        default:
          console.warn("[WebSocket] Unrecognized payload type:", (payload as any).type);
      }
    } catch (error: any) {
      console.error("[WebSocket] Error processing message:", error);
      sendToClient(ws, {
        type: "error",
        message: error?.message || "Failed to process message.",
      });
    }
  });

  ws.on("close", () => {
    console.log("[WebSocket] Client disconnected.");
    if (session.inspectionId) {
      endInspectionSession(session.inspectionId).catch(() => {});
    }
    if (session.geminiSession) {
      session.geminiSession.close();
    }
    activeSessions.delete(ws);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 KavachLive Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server listening on ws://localhost:${PORT}`);
});
