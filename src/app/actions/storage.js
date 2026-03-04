"use server";

import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2";
import crypto from "crypto";

const bucketName = process.env.R2_BUCKET_NAME;

/**
 * Gets a presigned URL to securely upload a file directly from the browser to R2.
 * @param {string} folder - E.g., 'documents', 'avatars'
 * @param {string} filename - Original filename to extract extension
 * @param {string} contentType - Mime type like 'image/jpeg'
 * @returns { uploadUrl, objectKey }
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

        // URL expires in 15 minutes. unhoistableHeaders prevents AWS from requiring headers that 
        // the browser fetch API won't send by default (like x-amz-content-sha256).
        const uploadUrl = await getSignedUrl(r2Client, command, {
            expiresIn: 900
        });

        return { uploadUrl, objectKey, success: true };
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        throw new Error("Failed to initialize upload");
    }
}

/**
 * Gets a presigned URL to securely view a private file.
 * @param {string} objectKey - The R2 object key (e.g., 'folder/file.pdf')
 * @returns { viewUrl }
 */
export async function getPresignedViewUrl({ objectKey }) {
    if (!bucketName) throw new Error("Missing R2_BUCKET_NAME configuration");
    if (!objectKey) throw new Error("No object key provided");

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        });

        // URL expires in 15 minutes
        const viewUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

        return { viewUrl, success: true };
    } catch (error) {
        console.error("Error generating presigned view URL:", error);
        throw new Error("Failed to initialize view");
    }
}

/**
 * Deletes a file from R2 safely.
 * @param {string} objectKey - The R2 object key saved in the database
 */
export async function deleteR2FileAction({ objectKey }) {
    if (!bucketName) return { success: false, error: "Missing config" };
    if (!objectKey) return { success: false, error: "No object key provided" };

    try {
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
