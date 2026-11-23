import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ComplianceTicket, HazardSeverity } from "./type.js";

export interface DraftComplianceTicketArgs {
  hazardTitle: string;
  hazardDescription: string;
  sopClause: string;
  sopSourceDoc?: string;
  severity: HazardSeverity;
  permitHold?: boolean;
  assignedContractor?: string;
  aiConfidence?: number;
}

export interface GeminiLiveCallbacks {
  onAudioOut: (base64Audio: string) => void;
  onTranscript: (speaker: "user" | "agent", text: string) => void;
  onDraftTicket: (args: DraftComplianceTicketArgs) => Promise<ComplianceTicket | null>;
  onError: (err: any) => void;
  onClose: () => void;
}

const SAFETY_SYSTEM_PROMPT = `
You are "KavachLive", an expert Indian Industrial & Construction Safety Compliance AI Inspector.
You are monitoring a live field inspection stream (video frames + voice audio) of an active job site in India.

ROLE & BEHAVIOR:
- You communicate directly with the site supervisor in natural, conversational Hinglish (Hindi + English).
- Tone: Professional, alert, authoritative yet collaborative (e.g., "Supervisor sir, yahan welding chal rahi hai par paas me fire extinguisher nahi dikh raha hai...").
- Keep verbal responses concise (1 to 2 short sentences) so you don't block the audio channel.

REGULATORY GROUNDING:
- You strictly reference Indian statutory safety standards:
  1. BOCW Act (Building and Other Construction Workers Central Rules, 1998)
  2. IS 14489:2018 (Occupational Health & Safety Audit Code of Practice)
  3. National Building Code of India (NBC) 2016 Part 7 (Construction Management, Practices & Safety)
  4. Central Electricity Authority (Safety Requirements) Regulations

HAZARD DETECTION & ACTION:
- As soon as you observe a safety violation or hazard in the video stream (such as unchained gas cylinders, missing PPE, improper scaffolding, lack of guardrails, excavation without shoring, or hot work without permits):
  1. Alert the supervisor verbally in Hinglish immediately.
  2. Call the tool "draft_compliance_ticket" with the exact hazard details, clause citations, severity, and contractor.
- Severity Guide:
  - "CRITICAL": Imminent danger to life (e.g., work at height >2m without harness, hot-work near combustibles, unbolted gas cylinders). Automatically set permitHold = true.
  - "HIGH": Severe non-compliance with serious injury risk (e.g., damaged electrical cables, missing edge protection).
  - "MEDIUM": Missing secondary safety PPE, untidy walkway.
  - "LOW": Minor housekeeping or signage lapse.

IMPORTANT: Do not commit the ticket directly yourself—always trigger "draft_compliance_ticket" so the supervisor can review and approve it on their mobile card.
`;

export class GeminiLiveSession {
  private session: any = null;
  private isConnected = false;

  constructor(
    private siteName: string,
    private supervisorName: string,
    private language: string,
    private callbacks: GeminiLiveCallbacks
  ) {}

  async start(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const tools = [
      {
        functionDeclarations: [
          {
            name: "draft_compliance_ticket",
            description:
              "Drafts a formal safety violation ticket based on visual and audio evidence from the inspection stream. Grounded in Indian safety standards (BOCW, NBC, IS). Triggers a mandatory Human-in-the-Loop approval card on the supervisor's mobile app.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                hazardTitle: {
                  type: Type.STRING,
                  description:
                    "Concise summary title of the observed hazard in English (e.g., 'Unsecured Oxygen Cylinder Near Hot-Work')",
                },
                hazardDescription: {
                  type: Type.STRING,
                  description: "Detailed observation of the hazard condition and context in English.",
                },
                sopClause: {
                  type: Type.STRING,
                  description:
                    "Relevant regulation clause citation (e.g., 'BOCW Central Rule 35(1) / IS 14489 Clause 4.2')",
                },
                sopSourceDoc: {
                  type: Type.STRING,
                  description:
                    "Source standard document (e.g., 'BOCW_Central_Rules_1998.pdf', 'NBC_2016_Part7.pdf')",
                },
                severity: {
                  type: Type.STRING,
                  enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                  description: "Hazard severity level. Use CRITICAL for life-safety threats.",
                },
                permitHold: {
                  type: Type.BOOLEAN,
                  description: "Set to true if severity is CRITICAL or immediate work-stop is required.",
                },
                assignedContractor: {
                  type: Type.STRING,
                  description: "Responsible subcontractor name if known or mentioned.",
                },
                aiConfidence: {
                  type: Type.NUMBER,
                  description: "Model confidence score between 0.0 and 1.0.",
                },
              },
              required: ["hazardTitle", "hazardDescription", "sopClause", "severity"],
            },
          },
        ],
      },
    ];

    try {
      const liveSession = await ai.live.connect({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [
              {
                text: `${SAFETY_SYSTEM_PROMPT}\nActive Site: ${this.siteName}\nSupervisor On Site: ${this.supervisorName}\nPreferred Language: ${this.language}`,
              },
            ],
          },
          tools: tools as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log(`[GeminiLive] Connected session for site: ${this.siteName}`);
            this.isConnected = true;
          },
          onmessage: async (event: any) => {
            try {
              if (event.serverContent?.modelTurn?.parts) {
                for (const part of event.serverContent.modelTurn.parts) {
                  if (part.inlineData && part.inlineData.data) {
                    this.callbacks.onAudioOut(part.inlineData.data);
                  }
                  if (part.text) {
                    this.callbacks.onTranscript("agent", part.text);
                  }
                }
              }

              if (event.toolCall?.functionCalls) {
                for (const call of event.toolCall.functionCalls) {
                  if (call.name === "draft_compliance_ticket") {
                    console.log("[GeminiLive] Model invoked draft_compliance_ticket:", call.args);
                    const ticket = await this.callbacks.onDraftTicket(
                      call.args as DraftComplianceTicketArgs
                    );

                    if (this.session) {
                      this.session.sendToolResponse({
                        functionResponses: [
                          {
                            id: call.id,
                            response: {
                              output: {
                                status: "DRAFT_PRESENTED_TO_SUPERVISOR",
                                ticketId: ticket?.id || "unknown",
                                message:
                                  "Ticket draft has been displayed on the supervisor's mobile screen as an approval card. Awaiting human confirmation.",
                              },
                            },
                          },
                        ],
                      });
                    }
                  }
                }
              }
            } catch (err) {
              console.error("[GeminiLive] Error handling message event:", err);
            }
          },
          onerror: (err: any) => {
            console.error("[GeminiLive] Session error:", err);
            this.callbacks.onError(err);
          },
          onclose: () => {
            console.log("[GeminiLive] Session closed.");
            this.isConnected = false;
            this.callbacks.onClose();
          },
        },
      });

      this.session = liveSession;
      this.isConnected = true;
    } catch (error) {
      console.error("[GeminiLive] Failed to initiate connection:", error);
      throw error;
    }
  }

  sendFrame(base64Jpeg: string): void {
    if (!this.isConnected || !this.session) return;
    try {
      const cleanData = base64Jpeg.replace(/^data:image\/\w+;base64,/, "");
      this.session.sendRealtimeInput({
        media: {
          mimeType: "image/jpeg",
          data: cleanData,
        },
      });
    } catch (err) {
      console.warn("[GeminiLive] Error streaming frame:", err);
    }
  }

  sendAudio(base64Pcm: string): void {
    if (!this.isConnected || !this.session) return;
    try {
      const cleanData = base64Pcm.replace(/^data:audio\/\w+;base64,/, "");
      this.session.sendRealtimeInput({
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: cleanData,
        },
      });
    } catch (err) {
      console.warn("[GeminiLive] Error streaming audio:", err);
    }
  }

  close(): void {
    if (this.session) {
      try {
        this.session.close();
      } catch (err) {
        console.warn("[GeminiLive] Error while closing session:", err);
      }
      this.session = null;
      this.isConnected = false;
    }
  }
}
