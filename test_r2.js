import { getPresignedUploadUrl } from './src/app/actions/storage.js';

async function test() {
    try {
        const result = await getPresignedUploadUrl({ folder: 'merchant_documents', filename: 'test.pdf', contentType: 'application/pdf' });
        console.log("Result:", result);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
