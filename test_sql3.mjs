import pg from 'pg';
import fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_POSTGRES_URL || process.env.DATABASE_URL;

if (!url) {
    console.error("No postgres URL found in env.");
    process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  // Add SSL if needed for Supabase
  ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const sql = fs.readFileSync('supabase/migrations/20260311_fix_claims_insert_rls.sql', 'utf8');
        console.log("Executing SQL...");
        await pool.query(sql);
        console.log("SQL executed successfully!");
    } catch(err) {
        console.error("Error executing SQL:", err.message);
    } finally {
        await pool.end();
    }
}

run();
