import express from "express"
import dotenv from "dotenv"
import { WebSocketServer, WebSocket } from "ws"
import cors from "cors"
import * as admin from "firebase-admin"
import http from "http"

dotenv.config();

admin.initializeApp();
const db: any = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected");

    ws.on("message", async (message: string) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'audio') {

            } else if (data.type === 'frame') {

            } else if (data.type === 'approve_ticket') {
                const ticketRef = db.collection("compliance_tickets").doc();
                await ticketRef.set({
                    ...data.data,
                    createdAt: new Date().toISOString(),
                    approvalStatus: "APPROVED_BY_HUMANS"
                })
                ws.send(JSON.stringify({ status: "ticket_commited", id: ticketRef.id }))
            }

        } catch (error) {
            console.error("error processing websocket message: ", error);

        }
    })

    ws.on("close", () => {
        console.log("client disconnected");
    })
})

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log("backend is running on port: ", PORT);

})

