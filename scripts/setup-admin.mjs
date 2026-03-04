/**
 * One-time script to create the admin user in Supabase Auth
 * and set their profile role to 'admin'.
 * 
 * Usage: node scripts/setup-admin.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const ADMIN_EMAIL = 'admin@tagdeer.app'
const ADMIN_PASSWORD = 'admin1' // Supabase requires ≥6 chars

async function setupAdmin() {
    console.log('Setting up admin account...')

    // 1. Check if user already exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
        console.error('Failed to list users:', listError)
        process.exit(1)
    }

    let userId
    const existingUser = users?.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())

    if (existingUser) {
        console.log(`User ${ADMIN_EMAIL} already exists (ID: ${existingUser.id}). Updating password...`)
        userId = existingUser.id

        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
            password: ADMIN_PASSWORD,
            email_confirm: true,
        })

        if (updateError) {
            console.error('Failed to update password:', updateError)
            process.exit(1)
        }
        console.log('Password updated.')
    } else {
        console.log(`Creating new user: ${ADMIN_EMAIL}...`)
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
        })

        if (createError) {
            console.error('Failed to create user:', createError)
            process.exit(1)
        }
        userId = newUser.user.id
        console.log(`User created (ID: ${userId}).`)
    }

    // 2. Upsert profile with role='admin'
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            user_id: userId,
            email: ADMIN_EMAIL,
            phone: '0000000000',
            role: 'admin',
            full_name: 'Tagdeer Admin',
        }, { onConflict: 'id' })

    if (profileError) {
        console.error('Failed to update profile:', profileError)
        process.exit(1)
    }

    console.log('')
    console.log('✅ Admin account ready!')
    console.log(`   Email: ${ADMIN_EMAIL}`)
    console.log(`   Password: ${ADMIN_PASSWORD}`)
    console.log(`   Role: admin`)
    console.log(`   User ID: ${userId}`)
    console.log('')
    console.log('You can now log in at /admin/login')
}

setupAdmin()
