import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Extracts the authenticated Supabase user from the server-side session cookies.
 *
 * Usage in any API route:
 *   import { getServerUser } from '@/lib/serverAuth';
 *   const user = await getServerUser();
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * @returns {Promise<Object|null>} The user object { id, email, phone, ... } or null.
 */
export async function getServerUser() {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll: () => cookieStore.getAll(),
                },
            }
        );

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch {
        return null;
    }
}
