"use server";

import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, getR2PublicUrl } from "@/lib/r2";
import crypto from "crypto";

const bucketName = process.env.R2_BUCKET_NAME;

/**
 * Gets a presigned URL to securely upload a file directly from the browser to R2.
 * @param {string} folder - E.g., 'documents', 'avatars'
 * @param {string} filename - Original filename to extract extension
 * @param {string} contentType - Mime type like 'image/jpeg'
 * @returns { uploadUrl, publicUrl, objectKey }
 */
export async function getPresignedUploadUrl({ folder, filename, contentType }) {
    if (!bucketName) throw new Error("Missing R2_BUCKET_NAME configuration");

    try {
        const fileExt = filename.split('.').pop() || 'tmp';
        // Generate a random ID to prevent overwrites
        const uniqueId = crypto.randomUUID();
        const objectKey = `${folder}/${uniqueId}.${fileExt}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            ContentType: contentType, // Ensure correct content type so browsers display it
        });

        // URL expires in 15 minutes
        const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

        const publicDomain = getR2PublicUrl();
        const publicUrl = `${publicDomain}/${objectKey}`;

        return { uploadUrl, publicUrl, objectKey, success: true };
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        throw new Error("Failed to initialize upload");
    }
}

/**
 * Deletes a file from R2 safely.
 * @param {string} publicUrl - The full public URL saved in the database
 */
export async function deleteR2FileAction({ publicUrl }) {
    if (!bucketName) return { success: false, error: "Missing config" };
    if (!publicUrl) return { success: false, error: "No URL provided" };

    try {
        const publicDomain = getR2PublicUrl();
        if (!publicUrl.startsWith(publicDomain)) {
            return { success: false, error: "URL does not belong to bucket" };
        }

        const objectKey = publicUrl.replace(`${publicDomain}/`, "");

        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        });

        await r2Client.send(command);
        return { success: true };
    } catch (error) {
        console.error("Error deleting R2 file:", error);
        return { success: false, error: "Failed to delete from storage" };
    }
}
