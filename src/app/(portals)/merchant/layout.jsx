
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
        <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
            <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                {children}
            </main>
        </div>
    )
}
