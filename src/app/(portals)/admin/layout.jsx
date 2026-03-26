import AdminTopNav from '@/components/admin/AdminTopNav'
import AdminGuard from '@/components/admin/AdminGuard'

export const metadata = {
    title: 'Tagdeer Admin Portal',
    description: 'Administration portal for Tagdeer platform',
}

export default function AdminLayout({ children }) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <AdminGuard>
                <AdminTopNav />
                <main className="p-4 md:p-8 max-w-7xl mx-auto">
                    {children}
                </main>
            </AdminGuard>
        </div>
    )
}
