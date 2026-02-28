'use client'

import { useState } from 'react'
import { Wallet, CreditCard, Image as ImageIcon, CheckCircle2, TrendingUp, DollarSign, ExternalLink, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Dummy Data
const dummyTransfers = [
    {
        id: 'TXN-001',
        business: "Ali's Cafe",
        ownerEmail: "ali@alicafe.ly",
        requestedTier: "Tier 1",
        amount: "50 LYD",
        duration: "30 Days",
        paymentMethod: "SadaPay",
        date: "Today, 10:15 AM",
        screenshotUrl: "/placeholder-receipt.jpg",
        status: "pending"
    },
    {
        id: 'TXN-002',
        business: "Zubaida Medical Clinic",
        ownerEmail: "admin@zubaida.com",
        requestedTier: "Tier 2",
        amount: "150 LYD",
        duration: "90 Days",
        paymentMethod: "Bank Transfer",
        date: "Yesterday, 4:30 PM",
        screenshotUrl: "/placeholder-receipt.jpg",
        status: "pending"
    }
]

const dummySubscriptions = [
    { id: 1, business: "Tripoli Supermarket", tier: "Tier 2", expires: "2026-03-15", status: "Active", autoRenew: false },
    { id: 2, business: "Omar Auto Spare Parts", tier: "Tier 1", expires: "2026-03-01", status: "Expiring Soon", autoRenew: true },
]

export default function FinancialsPage() {
    const [transfers, setTransfers] = useState(dummyTransfers)
    const [selectedTxn, setSelectedTxn] = useState(null)
    const [activeTab, setActiveTab] = useState('queue') // queue, subs, reports

    const handleConfirmPayment = (id) => {
        alert("Payment Confirmed. Business upgraded to requested tier.")
        setTransfers(transfers.filter(t => t.id !== id))
        setSelectedTxn(null)
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
                                {transfers.map(txn => (
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
                                    </div>
                                ))}
                                {transfers.length === 0 && (
                                    <div className="text-center p-8 text-slate-500">No pending transfers.</div>
                                )}
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
                                                <ImageIcon className="w-12 h-12 text-slate-600 mb-2" />
                                                <span className="text-sm text-slate-400">Transaction Screenshot</span>
                                            </div>
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
                            <button className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors font-medium">Export CSV</button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm text-slate-400">
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
                                    {dummySubscriptions.map(sub => (
                                        <tr key={sub.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{sub.business}</td>
                                            <td className="px-6 py-4 font-bold text-emerald-400">{sub.tier}</td>
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
                                <div className="text-slate-400 text-sm font-medium">Accounts on Tier 1 or Tier 2</div>
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
        </div>
    )
}
