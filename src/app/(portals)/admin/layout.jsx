import AdminTopNav from '@/components/admin/AdminTopNav'

export const metadata = {
    title: 'Tagdeer Admin Portal',
    description: 'Administration portal for Tagdeer platform',
}

export default function AdminLayout({ children }) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <AdminTopNav />
            <main className="p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    )
}
