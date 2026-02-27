import { redirect } from 'next/navigation'
// Change to your actual Supabase server client import if different
// import { createClient } from '@/utils/supabase/server' 

export const metadata = {
    title: 'Tagdeer Admin Portal',
    description: 'Administration portal for Tagdeer platform',
}

export default async function AdminLayout({ children }) {
    // Foundational RBAC logic placeholder
    // const supabase = createClient()
    // const { data: { session } } = await supabase.auth.getSession()

    // if (!session) {
    //   redirect('/login')
    // }

    // // Check for admin role
    // const { data: profile } = await supabase
    //   .from('profiles')
    //   .select('role')
    //   .eq('id', session.user.id)
    //   .single()

    // if (profile?.role !== 'admin') {
    //   // Redirect unauthorized users
    //   redirect('http://localhost:3000/') // Redirect to consumer app
    // }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <nav className="border-b border-slate-800 bg-slate-950 p-4 shadow-sm flex justify-between items-center">
                <div className="font-bold text-xl tracking-tight text-emerald-400">Tagdeer <span className="text-white">Admin</span></div>
                <div className="flex gap-4 text-sm font-medium">
                    <a href="#" className="hover:text-emerald-400 transition-colors">Dashboard</a>
                    <a href="#" className="hover:text-emerald-400 transition-colors">Users</a>
                    <a href="#" className="hover:text-emerald-400 transition-colors">Campaigns</a>
                </div>
            </nav>
            <main className="p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    )
}
