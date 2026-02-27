import fs from 'fs';

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// User credentials
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const RECIPIENT_PHONE = '905398539275'; // Stripped the + and spaces
const TEMPLATE_NAME = 'tagdeer_otp';

async function testWhatsApp() {
    const code = '123456';

    console.log(`Sending test OTP (${code}) to ${RECIPIENT_PHONE}...`);

    // First attempt: Simple payload with just the body parameter
    const payload = {
        messaging_product: "whatsapp",
        to: RECIPIENT_PHONE,
        type: "template",
        template: {
            name: TEMPLATE_NAME,
            language: { code: "ar" }, // Standard for North Africa / Middle East
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: code }
                    ]
                },
                {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                        { type: "text", text: code }
                    ]
                }
            ]
        }
    };

    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();
        console.log('\nResponse Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ SUCCESS! The WhatsApp message was sent.');
        } else {
            console.log('\n❌ FAILED. Look at the error message above.');
        }

    } catch (e) {
        console.error('Network Error:', e);
    }
}

testWhatsApp();
