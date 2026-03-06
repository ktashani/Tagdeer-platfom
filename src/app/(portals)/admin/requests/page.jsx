'use client';
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, FileImage, Search, Filter } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function RequestsPage() {
    const { businesses, supabase, showToast } = useTagdeer()
    const [requests, setRequests] = useState([])
    const [selectedRequest, setSelectedRequest] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!supabase) {
            setIsLoading(false)
            return
        }

        const loadClaims = async () => {
            try {
                // Use the admin API route which bypasses RLS with the service role key
                // (The admin portal uses cookie-based auth, so auth.uid() is NULL and RLS blocks direct Supabase queries)
                const resp = await fetch('/api/admin/claims');
                if (!resp.ok) {
                    console.error('Error fetching claims:', resp.status);
                    setIsLoading(false);
                    return;
                }

                const { claims, profiles: profilesList } = await resp.json();

                if (claims && claims.length > 0) {
                    const profilesMap = Object.fromEntries(
                        (profilesList || []).map(p => [p.id, p])
                    );

                    const mapped = claims.map(c => {
                        const business = businesses.find(b => b.id === c.business_id)
                        const profile = profilesMap[c.user_id]
                        return {
                            id: c.id,
                            businessName: business?.name || c.business_name || 'Unknown Business',
                            requester: profile?.full_name || 'Anonymous',
                            phone: profile?.phone || 'No Phone',
                            email: profile?.email || 'No Email',
                            status: c.status || c.claim_status || 'pending',
                            date: new Date(c.created_at).toLocaleDateString(),
                            documentUrl: c.document_url || null,
                            mimeType: c.mime_type || '',
                            notes: (c.status === 'missing_docs' || c.claim_status === 'missing_docs') ? 'License is unreadable' : ''
                        }
                    })
                    setRequests(mapped)
                }
            } catch (err) {
                console.error('Error loading claims:', err);
            }
            setIsLoading(false)
        }
        loadClaims()
    }, [supabase, businesses])

    const filteredRequests = requests.filter(r =>
        r.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.requester.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const pending = filteredRequests.filter(r => r.status === 'pending')
    const missingDocs = filteredRequests.filter(r => r.status === 'missing_docs')
    const approved = filteredRequests.filter(r => r.status === 'approved')

    const updateStatus = async (id, newStatus) => {
        try {
            const res = await fetch('/api/admin/claims/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimId: id, status: newStatus })
            });

            if (!res.ok) {
                const data = await res.json();
                console.error("Update failed:", data.error);
                showToast(data.error || "Failed to update status. Migrations needed?", "error");
                return;
            }

            setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus } : r));
            if (selectedRequest?.id === id) setSelectedRequest(null);
            showToast(`Claim marked as ${newStatus}`);

        } catch (err) {
            console.error(err);
            showToast("An unexpected error occurred.", "error");
        }
    }

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading Business Claims...</div>
    }

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Business Requests</h1>
                    <p className="text-slate-400 mt-1">Verify and onboard new merchants to the Tagdeer platform.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search requests..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0 overflow-hidden">
                {/* Kanban Board */}
                <div className={`flex gap-6 overflow-x-auto pb-4 transition-all duration-300 ${selectedRequest ? 'w-1/2' : 'w-full'}`}>

                    {/* Pending Column */}
                    <div className="flex-1 min-w-[320px] bg-slate-800/20 border border-slate-700/50 rounded-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                Pending Review
                            </h2>
                            <span className="bg-slate-800 text-slate-300 text-xs py-1 px-2.5 rounded-full font-medium">{pending.length}</span>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            {pending.map(req => (
                                <RequestCard key={req.id} req={req} onClick={() => setSelectedRequest(req)} isSelected={selectedRequest?.id === req.id} />
                            ))}
                            {pending.length === 0 && <div className="text-center text-slate-500 text-sm mt-8">No pending requests</div>}
                        </div>
                    </div>

                    {/* Missing Docs Column */}
                    <div className="flex-1 min-w-[320px] bg-slate-800/20 border border-slate-700/50 rounded-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                Missing Docs
                            </h2>
                            <span className="bg-slate-800 text-slate-300 text-xs py-1 px-2.5 rounded-full font-medium">{missingDocs.length}</span>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            {missingDocs.map(req => (
                                <RequestCard key={req.id} req={req} onClick={() => setSelectedRequest(req)} isSelected={selectedRequest?.id === req.id} />
                            ))}
                            {missingDocs.length === 0 && <div className="text-center text-slate-500 text-sm mt-8">No missing docs</div>}
                        </div>
                    </div>

                    {/* Approved Column */}
                    <div className="flex-1 min-w-[320px] bg-slate-800/20 border border-slate-700/50 rounded-2xl flex flex-col opacity-60 hover:opacity-100 transition-opacity">
                        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between shrink-0">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                Approved
                            </h2>
                            <span className="bg-slate-800 text-slate-300 text-xs py-1 px-2.5 rounded-full font-medium">{approved.length}</span>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            {approved.map(req => (
                                <RequestCard key={req.id} req={req} onClick={() => setSelectedRequest(req)} isSelected={selectedRequest?.id === req.id} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Verification Tool Sidebar */}
                {selectedRequest && (
                    <div className="w-1/2 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 shrink-0">
                            <h3 className="font-semibold text-white">Verification Tool</h3>
                            <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-white transition-colors">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">{selectedRequest.businessName}</h2>
                                <div className="flex flex-col gap-1 text-sm text-slate-400">
                                    <p>Requested by: <span className="text-slate-300">{selectedRequest.requester}</span></p>
                                    <p>Email: <span className="text-slate-300">{selectedRequest.email}</span></p>
                                    <p>Phone: <span className="text-slate-300">{selectedRequest.phone}</span></p>
                                    <p>Submitted: <span className="text-slate-300">{selectedRequest.date}</span></p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                    <FileImage className="w-4 h-4" /> Commercial License
                                </h4>
                                {selectedRequest.documentUrl ? (
                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 overflow-hidden">
                                        {selectedRequest.mimeType?.startsWith('image/') || selectedRequest.documentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                            <a href={selectedRequest.documentUrl} target="_blank" rel="noopener noreferrer">
                                                <img
                                                    src={selectedRequest.documentUrl}
                                                    alt="Commercial License"
                                                    className="w-full rounded-md object-contain max-h-[400px] hover:opacity-90 transition-opacity cursor-zoom-in"
                                                />
                                            </a>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8">
                                                <FileImage className="w-12 h-12 text-slate-500 mb-3" />
                                                <p className="text-sm text-slate-400 mb-3">Document uploaded</p>
                                                <a
                                                    href={selectedRequest.documentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md text-xs font-medium text-white transition-colors"
                                                >
                                                    View / Download Document
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                                        <FileImage className="w-12 h-12 text-slate-600 mb-2" />
                                        <span className="text-sm text-slate-500">No document uploaded</span>
                                    </div>
                                )}
                            </div>

                            {selectedRequest.status === 'missing_docs' && (
                                <div className="mb-8 bg-red-950/30 border border-red-900/50 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-red-400 mb-1">Rejection Reason</h4>
                                    <p className="text-sm text-red-300/80">{selectedRequest.notes}</p>
                                </div>
                            )}

                        </div>

                        {/* Verdict Actions */}
                        {selectedRequest.status !== 'approved' && (
                            <div className="p-6 border-t border-slate-700 bg-slate-800/80 shrink-0">
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => updateStatus(selectedRequest.id, 'approved')}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 flex items-center justify-center gap-2 rounded-lg transition-colors"
                                    >
                                        <CheckCircle2 className="w-5 h-5" /> Approve & Verify
                                    </button>
                                    <button
                                        onClick={() => updateStatus(selectedRequest.id, 'missing_docs')}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 flex items-center justify-center gap-2 rounded-lg transition-colors border border-slate-600"
                                    >
                                        <XCircle className="w-5 h-5" /> Request Docs
                                    </button>
                                </div>
                                <p className="text-xs text-center text-slate-500 mt-3">An automated email will be sent to the requester based on your decision.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function RequestCard({ req, onClick, isSelected }) {
    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${isSelected
                ? 'bg-slate-700 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'
                }`}
        >
            <h3 className="font-medium text-slate-200 mb-1 line-clamp-1">{req.businessName}</h3>
            <p className="text-xs text-slate-400 mb-3">{req.requester}</p>
            <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className={`w-3 h-3 ${req.status === 'approved' ? 'text-emerald-500' : 'text-slate-600'}`} />
                    {req.date}
                </span>
                {req.status === 'missing_docs' && (
                    <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded text-[10px] font-medium border border-red-500/20">Missing Docs</span>
                )}
            </div>
        </div>
    )
}
