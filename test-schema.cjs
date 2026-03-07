const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
    const res = await fetch(`${url}/rest/v1/storefronts?select=*`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    });
    const data = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", data);

    // Attempt to reload the schema via RPC if it exists
    const rpcRes = await fetch(`${url}/rest/v1/rpc/reload_schema`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        }
    });
    console.log("RPC Status:", rpcRes.status);
}

check();
