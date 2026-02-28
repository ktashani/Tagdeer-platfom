'use client';
'use client'

import { useState, useEffect } from 'react'
import { scaleLinear } from 'd3-scale' // Dummy import comment for visual context if doing actual charts later
import { FileText, MessageSquare, AlertTriangle, ShieldCheck, CheckCircle2, XCircle, Search, Clock, ZoomIn, AlertCircle } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function DisputesPage() {
    const { businesses, supabase, showToast } = useTagdeer()
    const [disputes, setDisputes] = useState([])
    const [selectedDispute, setSelectedDispute] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!supabase || businesses.length === 0) {
            if (!supabase) setIsLoading(false)
            return
        }

        const loadDisputes = async () => {
            const { data, error } = await supabase
                .from('disputes')
                .select('*')
                .eq('status', 'pending_admin_review')

            if (data) {
                const mapped = data.map(d => {
                    const business = businesses.find(b => b.id === d.business_id)
                    const log = business?.logs?.find(l => l.id === d.log_id)
                    return {
                        id: d.id,
                        business: business?.name || 'Unknown Business',
                        businessId: d.business_id,
                        user: log?.is_verified ? 'Verified VIP' : 'Anonymous VIP',
                        date: log ? log.date : new Date(d.created_at).toLocaleDateString(),
                        merchantReason: d.reason,
                        userNotes: log?.text || 'No comment provided by user.',
                        receiptUrl: "/placeholder-receipt.jpg",
                        status: d.status,
                        merchantAbuseScore: 0 // Mock score placeholder
                    }
                })
                setDisputes(mapped)
                if (mapped.length > 0) setSelectedDispute(mapped[0])
            }
            setIsLoading(false)
        }
        loadDisputes()
    }, [supabase, businesses])

    const handleVerdict = async (id, verdict) => {
        if (!supabase) return;

        try {
            const { error } = await supabase.rpc('admin_resolve_dispute', {
                p_dispute_id: id,
                p_verdict: verdict
            })

            if (error) {
                console.error(error)
                showToast("Failed to resolve dispute. Ensure RPC is established.")
                return
            }

            const actionText = verdict === 'valid' ? 'Receipt Validated. Merchant dispute rejected.' : 'Fake Receipt Confirmed. User penalized.'
            showToast(actionText)

            const newDisputes = disputes.filter(d => d.id !== id)
            setDisputes(newDisputes)
            setSelectedDispute(newDisputes.length > 0 ? newDisputes[0] : null)
        } catch (err) {
            console.error(err)
            showToast("Unexpected error occurred.")
        }
    }

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading Disputes Queue...</div>
    }

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Dispute Resolution</h1>
                    <p className="text-slate-400 mt-1">The High Court for Receipt Shield disputes.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> {disputes.length} Pending Disputes
                    </div>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">

                {/* List of Disputes */}
                <div className="w-1/3 flex flex-col min-h-0 bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700/50 flex-shrink-0 bg-slate-800/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by Business or User..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 p-4 space-y-3">
                        {disputes.map(dispute => (
                            <div
                                key={dispute.id}
                                onClick={() => setSelectedDispute(dispute)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${selectedDispute?.id === dispute.id
                                    ? 'bg-slate-700 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-white text-sm">{dispute.business}</h3>
                                    <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {dispute.date.split(',')[0]}</span>
                                </div>
                                <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" /> vs {dispute.user}
                                </p>
                                {dispute.merchantAbuseScore > 80 && (
                                    <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider bg-red-400/10 inline-block px-1.5 py-0.5 rounded border border-red-500/20">
                                        High Risk Merchant
                                    </div>
                                )}
                            </div>
                        ))}
                        {disputes.length === 0 && (
                            <div className="text-center text-slate-500 p-8 flex flex-col items-center">
                                <ShieldCheck className="w-12 h-12 text-emerald-500/50 mb-3" />
                                <p className="font-medium text-slate-300">All caught up!</p>
                                <p className="text-sm mt-1">No open disputes in the queue.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Split-Screen Interface */}
                {selectedDispute ? (
                    <div className="w-2/3 flex flex-col bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-300">
                        {/* Split Content Area */}
                        <div className="flex flex-1 min-h-0">

                            {/* Left Side: The Receipt */}
                            <div className="flex-1 border-r border-slate-700/50 bg-slate-900 flex flex-col">
                                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0 bg-slate-800/50">
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-emerald-400" /> User's Uploaded Receipt
                                    </h3>
                                    <button className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                                        <ZoomIn className="w-3 h-3" /> Expand
                                    </button>
                                </div>
                                <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto">
                                    <div className="w-full max-w-sm aspect-[1/2] bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg flex flex-col items-center justify-center text-slate-500 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-50"></div>
                                        <FileText className="w-16 h-16 text-slate-600 mb-4" />
                                        <span className="font-medium">Receipt Image Area</span>
                                        <span className="text-xs mt-2">Pinch to zoom when active</span>
                                    </div>

                                    <div className="w-full mt-6 bg-slate-800/80 rounded-xl p-4 border border-slate-700">
                                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">User Notes</div>
                                        <p className="text-sm text-slate-300 italic">"{selectedDispute.userNotes}"</p>
                                        <div className="mt-4 flex justify-between items-center text-xs">
                                            <span className="text-slate-400">User: <strong className="text-emerald-400">{selectedDispute.user}</strong></span>
                                            <span className="text-slate-500">Trust Points: 450</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Merchant's Reason */}
                            <div className="flex-1 bg-slate-800/30 flex flex-col">
                                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0 bg-slate-800/50">
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-500" /> Merchant's Dispute
                                    </h3>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto">

                                    {/* Merchant Monitor Box */}
                                    <div className={`mb-6 p-4 rounded-xl border ${selectedDispute.merchantAbuseScore > 80
                                        ? 'bg-red-500/10 border-red-500/30'
                                        : 'bg-slate-900 border-slate-700'
                                        }`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-medium text-white">{selectedDispute.business}</span>
                                            <span className="text-xs text-slate-500">Business ID: #{selectedDispute.businessId?.substring(0, 8) || selectedDispute.id.substring(0, 8)}</span>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className="text-xs text-slate-500 mb-1">Dispute Abuse Monitor</div>
                                                {selectedDispute.merchantAbuseScore > 80 ? (
                                                    <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                                                        <AlertTriangle className="w-4 h-4" /> High Risk (Lost 90% of disputes)
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                                                        <ShieldCheck className="w-4 h-4" /> Good Standing
                                                    </div>
                                                )}
                                            </div>
                                            {selectedDispute.merchantAbuseScore > 80 && (
                                                <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                                                    Disable Dispute Button
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dispute Reason */}
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 relative">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <MessageSquare className="w-24 h-24 text-amber-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <h4 className="text-sm font-semibold text-amber-500 mb-3 uppercase tracking-wider">Reason provided</h4>
                                            <p className="text-slate-300 leading-relaxed">
                                                "{selectedDispute.merchantReason}"
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Bottom Verdict Bar */}
                        <div className="p-6 border-t border-slate-700 bg-slate-900 shrink-0">
                            <h3 className="text-center font-bold text-slate-300 uppercase tracking-widest text-xs mb-4">The Verdict</h3>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleVerdict(selectedDispute.id, 'valid')}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-emerald-500/30 text-emerald-400 font-semibold py-4 flex items-center justify-center gap-2 rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-emerald-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                                    <CheckCircle2 className="w-5 h-5 relative z-10" />
                                    <span className="relative z-10">Valid Receipt (Reject Dispute)</span>
                                </button>

                                <button
                                    onClick={() => handleVerdict(selectedDispute.id, 'fake')}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-red-500/30 text-red-400 font-semibold py-4 flex items-center justify-center gap-2 rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                                    <XCircle className="w-5 h-5 relative z-10" />
                                    <span className="relative z-10">Fake Receipt (Approve Dispute)</span>
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-500 mt-3">
                                Choosing "Valid Receipt" keeps the log public. Choosing "Fake Receipt" deletes the log and applies a massive penalty to the user.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="w-2/3 flex items-center justify-center bg-slate-800/30 border border-slate-700/50 rounded-2xl">
                        <div className="text-center text-slate-500 max-w-sm">
                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-500/20" />
                            <h3 className="text-xl font-medium text-slate-300 mb-2">Queue Empty</h3>
                            <p>Select a dispute from the list (when available) to open the split-screen verification interface.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
