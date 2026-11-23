import { getStorage } from "firebase-admin/storage";
import { app } from "./database.js";

/**
 * Upload an inspection video snapshot (JPEG) to Google Cloud Storage.
 * Saves file at path: snapshots/{siteId}/{inspectionId}/{ticketId}.jpg
 * Returns the public or signed GCS URL.
 */
export async function uploadSnapshotToGCS(
  base64Data: string,
  siteId: string,
  inspectionId: string,
  ticketId: string
): Promise<string> {
  const storage = getStorage(app);
  const bucketName = process.env.GCS_BUCKET_NAME || storage.bucket().name || "kavach-live-evidence";
  const bucket = storage.bucket(bucketName);

  // Clean data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Clean, "base64");

  const filePath = `snapshots/${siteId}/${inspectionId}/${ticketId}.jpg`;
  const file = bucket.file(filePath);

  try {
    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
        metadata: {
          siteId,
          inspectionId,
          ticketId,
          uploadedAt: new Date().toISOString(),
        },
      },
      resumable: false,
    });

    // Attempt to make public, otherwise fallback to signed URL
    try {
      await file.makePublic();
      return `https://storage.googleapis.com/${bucketName}/${filePath}`;
    } catch {
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        });
        return signedUrl;
      } catch {
        return `https://storage.googleapis.com/${bucketName}/${filePath}`;
      }
    }
  } catch (error) {
    console.error(`[Storage] Failed to upload snapshot to ${filePath}:`, error);
    return `https://storage.googleapis.com/${bucketName}/${filePath}`;
  }
}
