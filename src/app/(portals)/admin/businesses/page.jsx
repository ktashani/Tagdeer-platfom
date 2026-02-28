'use client'

import { useState } from 'react'
import { Search, Filter, Shield, ShieldAlert, Combine, SearchCheck, Check, Info, Trash2 } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function BusinessRegistry() {
    const { businesses, supabase, showToast } = useTagdeer()
    const [searchTerm, setSearchTerm] = useState('')
    const [isMergeMode, setIsMergeMode] = useState(false)
    const [selectedForMerge, setSelectedForMerge] = useState([])
    const [mergeStep, setMergeStep] = useState(1) // 1: Select both, 2: Choose master, 3: Confirm
    const [masterId, setMasterId] = useState(null)

    // Handle Merge Selection
    const toggleMergeSelection = (id) => {
        if (selectedForMerge.includes(id)) {
            setSelectedForMerge(selectedForMerge.filter(bid => bid !== id))
        } else {
            if (selectedForMerge.length < 2) {
                setSelectedForMerge([...selectedForMerge, id])
            }
        }
    }

    const startMergeProcess = () => {
        setIsMergeMode(true)
        setSelectedForMerge([])
        setMergeStep(1)
        setMasterId(null)
    }

    const cancelMergeProcess = () => {
        setIsMergeMode(false)
        setSelectedForMerge([])
        setMergeStep(1)
        setMasterId(null)
    }

    const completeMerge = async () => {
        if (selectedForMerge.length !== 2 || !masterId || !supabase) return;

        const duplicateId = selectedForMerge.find(id => id !== masterId);

        try {
            // Optimistic deletion from context handles automatically when DB syncs via WebSockets
            const { error } = await supabase.rpc('admin_merge_businesses', {
                master_uuid: masterId,
                duplicate_uuid: duplicateId
            });

            if (error) {
                console.error("Merge error:", error);
                showToast("Merge failed: Ensure you have admin privileges and migrations are applied.");
                return;
            }

            showToast('Merge successful! Logs transferred and duplicate deleted.');
            cancelMergeProcess();
        } catch (err) {
            console.error(err);
            showToast("An unexpected error occurred during merge.");
        }
    }

    const dynamicBusinesses = businesses.map(b => ({
        id: b.id,
        name: b.name,
        category: b.category || 'Unknown',
        city: b.region || 'Unknown',
        healthScore: b.display_score || b.shadow_score || 0,
        shieldStatus: b.shield_level === 2 ? 'Active' : (b.shield_level === 1 ? 'Warning' : 'Inactive'),
        claimed: b.isClaimed
    }));

    const filteredBusinesses = dynamicBusinesses.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()))

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Business Registry</h1>
                    <p className="text-slate-400 mt-1">Manage the live database of businesses and data integrity.</p>
                </div>

                <div className="flex gap-3 items-center">
                    {!isMergeMode ? (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search businesses..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors w-64"
                                />
                            </div>
                            <button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
                                <Filter className="w-4 h-4" /> Filters
                            </button>
                            <button
                                onClick={startMergeProcess}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                            >
                                <Combine className="w-4 h-4" /> Merge Tool
                            </button>
                        </>
                    ) : (
                        <div className="flex bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 items-center gap-4">
                            <span className="text-sm font-medium text-amber-500 flex items-center gap-2">
                                <Combine className="w-4 h-4" /> Merge Mode Active
                            </span>
                            <button onClick={cancelMergeProcess} className="text-sm text-slate-400 hover:text-white transition-colors">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-6 relative">

                {/* Main Table Area */}
                <div className={`transition-all duration-300 ${isMergeMode ? 'w-2/3' : 'w-full'}`}>
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
                                <tr>
                                    {isMergeMode && <th scope="col" className="px-6 py-4 font-medium text-slate-300 w-16">Select</th>}
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300">Business Profile</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300">Category & Location</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-center">Health Score</th>
                                    <th scope="col" className="px-6 py-4 font-medium text-slate-300">Shield Status</th>
                                    {!isMergeMode && <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBusinesses.map((business) => {
                                    const isSelected = selectedForMerge.includes(business.id)
                                    const isMaster = masterId === business.id

                                    return (
                                        <tr
                                            key={business.id}
                                            className={`border-b border-slate-700/50 transition-colors ${isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/50'
                                                }`}
                                        >
                                            {isMergeMode && (
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleMergeSelection(business.id)}
                                                        disabled={mergeStep > 1 && !isSelected}
                                                        className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isSelected
                                                            ? 'bg-amber-500 border-amber-500 text-white'
                                                            : 'bg-slate-900 border-slate-600 hover:border-amber-500 disabled:opacity-50 disabled:hover:border-slate-600'
                                                            }`}
                                                    >
                                                        {isSelected && <Check className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-white flex items-center gap-2">
                                                    {business.name}
                                                    {business.claimed && (
                                                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Claimed</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">ID: #{business.id.substring(0, 8)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-slate-300">{business.category}</div>
                                                <div className="text-xs text-slate-500 mt-1">{business.city}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${business.healthScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    business.healthScore >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    }`}>
                                                    {business.healthScore}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {business.shieldStatus === 'Active' ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                                                        <Shield className="w-4 h-4" /> Active
                                                    </span>
                                                ) : business.shieldStatus === 'Warning' ? (
                                                    <span className="flex items-center gap-1.5 text-amber-400 text-sm font-medium">
                                                        <ShieldAlert className="w-4 h-4" /> Warning
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
                                                        <Shield className="w-4 h-4" /> Inactive
                                                    </span>
                                                )}
                                            </td>
                                            {!isMergeMode && (
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-slate-400 hover:text-white font-medium transition-colors">Edit</button>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Merge Tool Sidebar */}
                {isMergeMode && (
                    <div className="w-1/3 bg-slate-800/80 border border-amber-500/30 rounded-2xl p-6 shadow-2xl animate-in slide-in-from-right-8 duration-300 sticky top-24 h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-amber-500/20 rounded-xl">
                                <Combine className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Merge Tool</h2>
                                <p className="text-sm text-slate-400">Consolidate duplicate profiles.</p>
                            </div>
                        </div>

                        {/* Step 1: Selection */}
                        <div className={`mb-6 relative pb-6 border-b border-slate-700/50 ${mergeStep > 1 ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
                                <span className="bg-slate-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                                Select two profiles to merge
                            </div>

                            <div className="flex justify-between items-center text-sm px-2">
                                <span className={selectedForMerge.length > 0 ? "text-amber-400" : "text-slate-500"}>Profile A</span>
                                <span className="text-slate-600">vs</span>
                                <span className={selectedForMerge.length > 1 ? "text-amber-400" : "text-slate-500"}>Profile B</span>
                            </div>

                            {selectedForMerge.length === 2 && mergeStep === 1 && (
                                <button
                                    onClick={() => setMergeStep(2)}
                                    className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Continue
                                </button>
                            )}
                        </div>

                        {/* Step 2: Choose Master */}
                        {mergeStep >= 2 && (
                            <div className={`mb-6 relative pb-6 border-b border-slate-700/50 ${mergeStep > 2 ? 'opacity-50' : ''}`}>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-4">
                                    <span className="bg-amber-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                                    Which is the Master Profile?
                                </div>

                                <div className="space-y-3">
                                    {selectedForMerge.map(id => {
                                        const b = dynamicBusinesses.find(x => x.id === id)
                                        const isMaster = masterId === id
                                        return (
                                            <div
                                                key={'master-' + id}
                                                onClick={() => {
                                                    if (mergeStep === 2) {
                                                        setMasterId(id)
                                                        setMergeStep(3)
                                                    }
                                                }}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all ${isMaster
                                                    ? 'border-amber-500 bg-amber-500/10'
                                                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
                                                    }`}
                                            >
                                                <div className="font-medium text-white text-sm">{b.name}</div>
                                                <div className="text-xs text-slate-500 flex justify-between mt-1">
                                                    <span>Health: {b.healthScore}</span>
                                                    <span>{b.claimed ? 'Claimed' : 'Unclaimed'}</span>
                                                </div>
                                                {isMaster && (
                                                    <div className="mt-2 text-[10px] text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                                        <SearchCheck className="w-3 h-3" /> Master Selected
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Confirmation */}
                        {mergeStep === 3 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                                    <div className="flex gap-3">
                                        <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div className="text-sm text-red-200">
                                            <p className="font-semibold text-red-400 mb-1">Warning: Irreversible Action</p>
                                            <p>All logs, interactions, and photos from the duplicate will be transferred to the Master. The duplicate profile will be <strong>permanently deleted</strong> to prevent metric gaming.</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={completeMerge}
                                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Combine className="w-5 h-5" /> Execute Merge & Purge
                                </button>
                                <button
                                    onClick={cancelMergeProcess}
                                    className="w-full mt-3 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                                >
                                    Start Over
                                </button>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    )
}
