import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';

// Re-implement basic logic purely for testing external connection outside of Next.js context
// to ensure credentials and network paths are correct.
const accountId = "02ca071c14b59d50400b56958f401e68";
const accessKeyId = "9df5d55ea858ebbab8cbe7425754ba02";
const secretAccessKey = "b18c8165cac1c1506d6608feb7f27cb5dfa669042a140680ba0c5f247c5b74f9";
const bucketName = "tagdeer";
const publicDomain = "https://pub-02ca071c14b59d50400b56958f401e68.r2.dev";

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

async function runTest() {
    console.log("1. Generating presigned URL...");
    try {
        const uniqueId = crypto.randomUUID();
        const objectKey = `test/${uniqueId}.txt`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            ContentType: 'text/plain',
        });

        const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
        const publicUrl = `${publicDomain}/${objectKey}`;
        console.log("   ✅ Presigned URL generated successfully.");
        console.log(`   Public URL will be: ${publicUrl}`);

        console.log("\n2. Simulating browser PUT request...");
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: 'This is a test file from the Tagdeer Platform verification script.',
            headers: {
                'Content-Type': 'text/plain'
            }
        });

        if (response.ok) {
            console.log("   ✅ File successfully uploaded to Cloudflare R2!");

            console.log("\n3. Verifying public access...");
            const getResponse = await fetch(publicUrl);
            if (getResponse.ok) {
                const text = await getResponse.text();
                console.log(`   ✅ Read successful. Contents: "${text}"`);
                console.log("\n🎉 ALL R2 TESTS PASSED! The mechanism is working perfectly.");
            } else {
                console.error(`   ❌ Failed to read from public URL. Status: ${getResponse.status}`);
                console.error("   Note: The bucket might not be fully public yet, or the domain is incorrect.");
            }

        } else {
            const errorText = await response.text();
            console.error("   ❌ Upload failed!", response.status, response.statusText);
            console.error("   Details:", errorText);
        }

    } catch (error) {
        console.error("❌ Test failed with exception:", error);
    }
}

runTest();
