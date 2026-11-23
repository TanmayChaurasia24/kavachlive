import dotenv from "dotenv";
dotenv.config();

import { db } from "./services/database.js";
import type { Site } from "./type.js";

async function seed() {
  console.log("Seeding initial sites into Cloud Firestore...");

  const testSite: Site = {
    id: "SITE-KNP-01",
    name: "Metro Phase-2 Pier 14, Kanpur",
    code: "SITE-KNP-01",
    projectManager: "Er. Vikram Singh",
    contractors: [
      "Ramesh Infra Pvt Ltd",
      "Shakti Electricals",
      "Apex Scaffolding Services",
    ],
    riskScore: 24,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.collection("sites").doc(testSite.id).set(testSite);
    console.log(`✅ Successfully seeded site [${testSite.id}]: "${testSite.name}"`);

    // Verify read
    const doc = await db.collection("sites").doc(testSite.id).get();
    if (doc.exists) {
      console.log("Verified Firestore Read:", doc.data());
    }
  } catch (err) {
    console.error("❌ Failed to seed site:", err);
  } finally {
    process.exit(0);
  }
}

seed();
