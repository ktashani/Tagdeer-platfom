import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const sql = fs.readFileSync('supabase/migrations/20260303_fix_claims_insert_rls.sql', 'utf8');
    
    // Quick hack to run SQL using the REST API if we don't have psql
    // This uses a generic query endpoint if available, or we might need to use a specific RPC we created earlier
    
    // Check if we have an RPC for raw queries
    try {
        const { data, error } = await supabase.rpc('execute_sql', { query: sql });
        if (error) throw error;
        console.log("SQL Executed via RPC successfully.");
    } catch(err) {
        console.log("RPC execute_sql failed, attempting a different approach...", err.message);
        
        // Let's create an RPC specifically to add the policy
        const createRpcSql = `
        CREATE OR REPLACE FUNCTION admin_add_claims_policy()
        RETURNS void AS $$
        BEGIN
            DROP POLICY IF EXISTS "Users can insert their own claims" ON public.business_claims;
            CREATE POLICY "Users can insert their own claims"
                ON public.business_claims FOR INSERT
                WITH CHECK (auth.uid() = user_id);
            
            DROP POLICY IF EXISTS "Admins can view all claims" ON public.business_claims;
            CREATE POLICY "Admins can view all claims"
                ON public.business_claims FOR SELECT
                USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                    )
                );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        `;
        
        // Well, we can't create an RPC without running SQL. 
        // Let's print out the connection string so we can use psql properly if the user has it.
        console.log("Please run the migration manually using Supabase CLI:");
        console.log("supabase db push");
    }
}
run();
