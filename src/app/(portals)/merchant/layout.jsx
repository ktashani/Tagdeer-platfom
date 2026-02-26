export const metadata = {
    title: 'Tagdeer Merchant Portal',
    description: 'Merchant dashboard for Tagdeer platform',
}

export default async function MerchantLayout({ children }) {
    // Foundational RBAC logic placeholder
    // const supabase = createClient()
    // const { data: { session } } = await supabase.auth.getSession()

    // if (!session) {
    //   redirect('/login')
    // }

    // // Check for merchant role
    // const { data: profile } = await supabase
    //   .from('profiles')
    //   .select('role')
    //   .eq('id', session.user.id)
    //   .single()

    // if (profile?.role !== 'merchant' && profile?.role !== 'admin') {
    //   // Redirect unauthorized users
    //   redirect('http://localhost:3000/') // Redirect to consumer app
    // }

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
            <nav className="border-b border-neutral-200 bg-white p-4 shadow-sm flex justify-between items-center">
                <div className="font-bold text-xl tracking-tight text-blue-600">Tagdeer <span className="text-neutral-800">For Business</span></div>
                <div className="flex gap-4 text-sm font-medium text-neutral-600">
                    <a href="#" className="hover:text-blue-600 transition-colors">Dashboard</a>
                    <a href="#" className="hover:text-blue-600 transition-colors">My Stores</a>
                    <a href="#" className="hover:text-blue-600 transition-colors">Analytics</a>
                </div>
            </nav>
            <main className="p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    )
}
