import MerchantGuard from '@/components/merchant/MerchantGuard'

export const metadata = {
    title: 'Tagdeer Merchant Portal',
    description: 'Merchant dashboard for Tagdeer platform',
}

export default function MerchantLayout({ children }) {
    return (
        <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
            <MerchantGuard>
                <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                    {children}
                </main>
            </MerchantGuard>
        </div>
    )
}
