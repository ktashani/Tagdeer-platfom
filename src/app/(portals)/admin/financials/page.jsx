'use client';
'use client'

import { useState, useEffect } from 'react'
import { Wallet, CreditCard, Image as ImageIcon, CheckCircle2, TrendingUp, DollarSign, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTagdeer } from '@/context/TagdeerContext'

export default function FinancialsPage() {
    const { supabase, showToast } = useTagdeer()
    const [transfers, setTransfers] = useState([])
    const [subscriptions, setSubscriptions] = useState([])
    const [businesses, setBusinesses] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    const [showTrialModal, setShowTrialModal] = useState(false)
    const [trialForm, setTrialForm] = useState({ businessId: '', tier: 'Pro', months: 1 })
    const [isGrantingTrial, setIsGrantingTrial] = useState(false)

    const [selectedTxn, setSelectedTxn] = useState(null)
    const [activeTab, setActiveTab] = useState('queue') // queue, subs, reports
    const [isConfirming, setIsConfirming] = useState(false)

    useEffect(() => {
        if (!supabase) return;

        const fetchData = async () => {
            setIsLoading(true)
            const [txnData, subData, bizData] = await Promise.all([
                supabase.from('transactions').select('*, businesses(name), profiles(email)').eq('status', 'pending').order('created_at', { ascending: false }),
                supabase.from('subscriptions').select('*, businesses(name)').order('expires_at', { ascending: true }),
                supabase.from('businesses').select('id, name').order('name', { ascending: true })
            ])

            if (txnData.data) {
                setTransfers(txnData.data.map(t => ({
                    id: t.id,
                    business: t.businesses?.name || 'Unknown',
                    ownerEmail: t.profiles?.email || 'Unknown',
                    requestedTier: t.requested_tier,
                    amount: `${t.amount} LYD`,
                    duration: t.duration,
                    paymentMethod: t.payment_method,
                    date: new Date(t.created_at).toLocaleDateString(),
                    screenshotUrl: t.screenshot_url || "https://placehold.co/400x600?text=No+Receipt",
                    status: t.status
                })))
            }
            if (subData.data) {
                setSubscriptions(subData.data.map(s => ({
                    id: s.id,
                    business: s.businesses?.name || 'Unknown',
                    tier: s.tier === 'Tier 1' ? 'Pro' : s.tier === 'Tier 2' ? 'Enterprise' : s.tier,
                    expires: new Date(s.expires_at).toLocaleDateString(),
                    status: s.status,
                    isTrial: s.is_trial,
                    trialMonths: s.trial_months,
                    autoRenew: s.auto_renew
                })))
            }
            if (bizData.data) {
                setBusinesses(bizData.data)
            }
            setIsLoading(false)
        }
        fetchData()
    }, [supabase])

    const handleConfirmPayment = async (id) => {
        setIsConfirming(true);
        const { error } = await supabase.rpc('admin_confirm_payment', { p_txn_id: id });

        if (error) {
            console.error(error);
            showToast("Failed to confirm payment.", "error");
        } else {
            showToast("Payment Confirmed. Business upgraded to requested tier.");
            setTransfers(transfers.filter(t => t.id !== id));
            setSelectedTxn(null);
        }
        setIsConfirming(false);
    }

    const handleGrantTrial = async () => {
        if (!trialForm.businessId) return showToast("Select a business", "error")
        setIsGrantingTrial(true)
        const { data, error } = await supabase.rpc('admin_grant_free_trial', {
            p_business_id: trialForm.businessId,
            p_tier: trialForm.tier,
            p_months: parseInt(trialForm.months)
        })

        if (error || !data?.success) {
            showToast(error?.message || data?.error || "Failed to grant trial", "error")
        } else {
            showToast(`Granted ${trialForm.tier} Trial successfully!`)
            setShowTrialModal(false)
            setTrialForm({ businessId: '', tier: 'Pro', months: 1 })
            // Optional: refresh data inline
            window.location.reload()
        }
        setIsGrantingTrial(false)
    }


    return (
        <div className="animate-in fade-in duration-500 min-h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">The Libyan Treasury</h1>
                    <p className="text-slate-400 mt-1">Manage manual payments, upgrades, and revenue generation.</p>
                </div>

                <div className="bg-slate-800/50 p-1 rounded-lg border border-slate-700/50 flex text-sm font-medium">
                    <button
                        onClick={() => { setActiveTab('queue'); setSelectedTxn(null) }}
                        className={`px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'queue' ? 'bg-amber-500/20 text-amber-500 shadow-sm border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Wallet className="w-4 h-4" /> Transfer Queue
                        {transfers.length > 0 && <span className="bg-amber-500 text-slate-900 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{transfers.length}</span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('subs')}
                        className={`px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'subs' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <ShieldCheck className="w-4 h-4" /> Active Subscriptions
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${activeTab === 'reports' ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> Revenue Reports
                    </button>
                </div>
            </div>

            {/* Content Switcher */}
            <div className="flex-1 min-h-0 flex gap-6">

                {/* 1. Bank Transfer Queue */}
                {activeTab === 'queue' && (
                    <>
                        <div className={`transition-all duration-300 flex flex-col bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden ${selectedTxn ? 'w-1/2' : 'w-full'}`}>
                            <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 shrink-0">
                                <h3 className="font-semibold text-white">Pending Upgrade Requests</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {isLoading ? (
                                    <div className="text-center p-8 text-slate-500 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
                                ) : transfers.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">No pending transfers.</div>
                                ) : transfers.map(txn => (
                                    <div
                                        key={txn.id}
                                        onClick={() => setSelectedTxn(txn)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${selectedTxn?.id === txn.id
                                            ? 'bg-slate-700 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                            : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-white">{txn.business}</h3>
                                            <span className="text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded text-xs">{txn.amount}</span>
                                        </div>
                                        <p className="text-sm text-slate-400 mb-2">Requesting <strong className="text-emerald-400">{txn.requestedTier}</strong> for {txn.duration}</p>
                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                            <span className="bg-slate-800 px-2 py-1 rounded">{txn.paymentMethod}</span>
                                            <span>{txn.date}</span>
                                        </div>
                                        <span className="text-xs text-slate-500 mt-2 block">{txn.id}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedTxn && (
                            <div className="w-1/2 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
                                <div className="p-4 border-b border-slate-700/50 bg-slate-800 shrink-0">
                                    <h3 className="font-semibold text-white">Verification: {selectedTxn.id}</h3>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">

                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <div className="text-slate-500 mb-1 font-medium">Business</div>
                                                <div className="text-white font-semibold">{selectedTxn.business}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 mb-1 font-medium">Owner Email</div>
                                                <div className="text-white">{selectedTxn.ownerEmail}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 mb-1 font-medium">Requested Upgrade</div>
                                                <div className="text-emerald-400 font-bold">{selectedTxn.requestedTier}</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 mb-1 font-medium">Duration</div>
                                                <div className="text-slate-300">{selectedTxn.duration}</div>
                                            </div>
                                            <div className="col-span-2 pt-3 border-t border-slate-800 mt-2">
                                                <div className="text-slate-500 mb-1 font-medium text-xs uppercase tracking-wider">Payment Details</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white font-medium">{selectedTxn.paymentMethod}</span>
                                                    <span className="text-xl font-bold text-emerald-400">{selectedTxn.amount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4" /> Transaction Evidence
                                        </h4>
                                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 aspect-[3/4] max-h-80 mx-auto flex flex-col items-center justify-center relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center opacity-70">
                                                <ImageIcon className="w-12 h-12 text-slate-600 mb-2 z-10" />
                                                <span className="text-sm text-slate-400 z-10">Transaction Screenshot</span>
                                            </div>
                                            <img src={selectedTxn.screenshotUrl} alt="Receipt" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay" />
                                        </div>
                                    </div>

                                </div>
                                <div className="p-6 border-t border-slate-700 bg-slate-800 shrink-0">
                                    <button
                                        onClick={() => handleConfirmPayment(selectedTxn.id)}
                                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                    >
                                        <CheckCircle2 className="w-5 h-5" /> Confirm Payment & Upgrade Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* 2. Subscription Status List */}
                {activeTab === 'subs' && (
                    <div className="w-full bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center shrink-0">
                            <h3 className="font-semibold text-white">Active Premium Subscriptions</h3>
                            <div>
                                <button onClick={() => setShowTrialModal(true)} className="text-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium mr-2">Grant Trial</button>
                                <button className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium">Export CSV</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm text-slate-400 min-w-[600px]">
                                <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">Business Name</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">Tier</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">Expires</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300">Status</th>
                                        <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
                                    ) : subscriptions.map(sub => (
                                        <tr key={sub.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{sub.business}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-emerald-400">{sub.tier}</span>
                                                    {sub.isTrial && <span className="text-[10px] text-amber-500 font-medium">Trial: {sub.trialMonths}m</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{sub.expires}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${sub.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="text-slate-400 hover:text-white font-medium transition-colors">Manual Extend</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!isLoading && subscriptions.length === 0 && (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No active subscriptions.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. Revenue Reports */}
                {activeTab === 'reports' && (
                    <div className="w-full space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-800/50 border border-emerald-500/30 p-6 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                <h3 className="text-sm font-medium text-slate-400 mb-2">Total MRR (Monthly Recurring Revenue)</h3>
                                <div className="text-4xl font-bold text-white mb-2">24,500 <span className="text-xl text-slate-500">LYD</span></div>
                                <div className="text-emerald-400 text-sm font-medium flex items-center gap-1"><TrendingUp className="w-4 h-4" /> +15% vs last month</div>
                            </div>
                            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                                <h3 className="text-sm font-medium text-slate-400 mb-2">Active Paid Accounts</h3>
                                <div className="text-4xl font-bold text-white mb-2">342</div>
                                <div className="text-slate-400 text-sm font-medium">Accounts on Pro or Enterprise</div>
                            </div>
                            <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
                                <h3 className="text-sm font-medium text-slate-400 mb-2">ARPU (Avg Rev Per User)</h3>
                                <div className="text-4xl font-bold text-white mb-2">71.6 <span className="text-xl text-slate-500">LYD</span></div>
                                <div className="text-slate-400 text-sm font-medium">Across all paid accounts</div>
                            </div>
                        </div>

                        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 h-64 flex flex-col items-center justify-center text-slate-500">
                            <TrendingUp className="w-12 h-12 text-slate-600 mb-3" />
                            <p className="font-medium text-slate-400">Revenue Chart Placeholder</p>
                            <p className="text-sm mt-1">Monthly collection visualization goes here.</p>
                        </div>
                    </div>
                )}

            </div>

            {/* Trial Modal */}
            {showTrialModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-2">Grant Free Trial</h2>
                        <p className="text-sm text-slate-400 mb-6">Provide a business with temporary premium access.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Select Business</label>
                                <select value={trialForm.businessId} onChange={e => setTrialForm({ ...trialForm, businessId: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 appearance-none">
                                    <option value="">-- Choose a Business --</option>
                                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Tier</label>
                                <select value={trialForm.tier} onChange={e => setTrialForm({ ...trialForm, tier: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 appearance-none">
                                    <option value="Pro">Pro</option>
                                    <option value="Enterprise">Enterprise</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Duration (Months)</label>
                                <input type="number" min="1" max="12" value={trialForm.months} onChange={e => setTrialForm({ ...trialForm, months: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500" />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setShowTrialModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition-colors border border-slate-700">Cancel</button>
                            <button disabled={isGrantingTrial} onClick={handleGrantTrial} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50">
                                {isGrantingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Grant Trial</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
