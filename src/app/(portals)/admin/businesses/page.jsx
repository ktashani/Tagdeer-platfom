'use client';

import { useState } from 'react'
import { Search, Filter, Shield, ShieldAlert, Combine, SearchCheck, Check, Info, Trash2, Eye, Edit2, Save, X, Ban, Globe, Clock } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function BusinessRegistry() {
    const { businesses, supabase, showToast } = useTagdeer()
    const [searchTerm, setSearchTerm] = useState('')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [filters, setFilters] = useState({
        category: 'All',
        status: 'All',
        city: 'All',
        claimed: 'All'
    })
    const [isMergeMode, setIsMergeMode] = useState(false)
    const [selectedForMerge, setSelectedForMerge] = useState([])
    const [mergeStep, setMergeStep] = useState(1) // 1: Select both, 2: Choose master, 3: Confirm
    const [masterId, setMasterId] = useState(null)

    // Modal State
    const [selectedBusiness, setSelectedBusiness] = useState(null)
    const [isEditMode, setIsEditMode] = useState(false)
    const [editForm, setEditForm] = useState({ name: '', category: '', region: '' })
    const [isSaving, setIsSaving] = useState(false)
    const [claimerProfile, setClaimerProfile] = useState(null)
    const [storefrontData, setStorefrontData] = useState(null)
    const [isFetchingClaimer, setIsFetchingClaimer] = useState(false)

    // Restrict Reason Modal State
    const [isRestrictModalOpen, setIsRestrictModalOpen] = useState(false)
    const [restrictionReason, setRestrictionReason] = useState('')

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
        claimed: b.isClaimed,
        status: b.status || 'published'
    }));

    const uniqueCategories = ['All', ...[...new Set(dynamicBusinesses.map(b => b.category))].filter(Boolean).sort()]
    const uniqueCities = ['All', ...[...new Set(dynamicBusinesses.map(b => b.city))].filter(Boolean).sort()]

    const filteredBusinesses = dynamicBusinesses.filter(b => {
        const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = filters.category === 'All' || b.category === filters.category
        const matchesStatus = filters.status === 'All' || b.status === filters.status
        const matchesCity = filters.city === 'All' || b.city === filters.city
        const matchesClaimed = filters.claimed === 'All' || (filters.claimed === 'Claimed' ? b.claimed : !b.claimed)

        return matchesSearch && matchesCategory && matchesStatus && matchesCity && matchesClaimed
    })

    const activeFilterCount = Object.values(filters).filter(v => v !== 'All').length

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
                            <div className="relative z-30">
                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={`border px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${activeFilterCount > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
                                >
                                    <Filter className="w-4 h-4" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span className="bg-emerald-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>

                                {isFilterOpen && (
                                    <div className="absolute top-12 right-0 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-white">Filters</h3>
                                            {activeFilterCount > 0 && (
                                                <button
                                                    onClick={() => setFilters({ category: 'All', status: 'All', city: 'All', claimed: 'All' })}
                                                    className="text-xs text-slate-400 hover:text-white transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <Label className="text-xs text-slate-400 mb-1.5 block">Category</Label>
                                                <select
                                                    value={filters.category}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-emerald-500"
                                                >
                                                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <Label className="text-xs text-slate-400 mb-1.5 block">Status</Label>
                                                <select
                                                    value={filters.status}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-emerald-500"
                                                >
                                                    <option value="All">All Statuses</option>
                                                    <option value="published">Published</option>
                                                    <option value="pending_review">Pending Review</option>
                                                    <option value="restricted">Restricted</option>
                                                    <option value="hidden">Hidden</option>
                                                </select>
                                            </div>

                                            <div>
                                                <Label className="text-xs text-slate-400 mb-1.5 block">City</Label>
                                                <select
                                                    value={filters.city}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-emerald-500"
                                                >
                                                    {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <Label className="text-xs text-slate-400 mb-1.5 block">Claim Status</Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button
                                                        onClick={() => setFilters(prev => ({ ...prev, claimed: 'All' }))}
                                                        className={`py-1.5 text-xs rounded-md transition-colors ${filters.claimed === 'All' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700/50'}`}
                                                    >All</button>
                                                    <button
                                                        onClick={() => setFilters(prev => ({ ...prev, claimed: 'Claimed' }))}
                                                        className={`py-1.5 text-xs rounded-md transition-colors ${filters.claimed === 'Claimed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700/50 border border-transparent'}`}
                                                    >Claimed</button>
                                                    <button
                                                        onClick={() => setFilters(prev => ({ ...prev, claimed: 'Unclaimed' }))}
                                                        className={`py-1.5 text-xs rounded-md transition-colors ${filters.claimed === 'Unclaimed' ? 'bg-slate-700 text-white border border-slate-600' : 'bg-slate-800 text-slate-400 hover:bg-slate-700/50 border border-transparent'}`}
                                                    >Unclaimed</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
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
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400 min-w-[700px]">
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
                                                    {business.status === 'restricted' && (
                                                        <span className="bg-red-500/10 text-red-500 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Restricted</span>
                                                    )}
                                                    {business.status === 'pending_review' && (
                                                        <span className="bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Pending Review</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">ID: #{String(business.id).substring(0, 8)}</div>
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
                                                    <button
                                                        onClick={async () => {
                                                            setSelectedBusiness(business);
                                                            setEditForm({ name: business.name, category: business.category, region: business.city });
                                                            setIsEditMode(false);
                                                            setClaimerProfile(null);
                                                            setStorefrontData(null);

                                                            setIsFetchingClaimer(true);
                                                            try {
                                                                const promises = [];

                                                                if (business.claimed && business.owner_id) {
                                                                    promises.push(
                                                                        supabase
                                                                            .from('profiles')
                                                                            .select('*')
                                                                            .eq('id', business.owner_id)
                                                                            .single()
                                                                            .then(({ data, error }) => {
                                                                                if (error && error.code !== 'PGRST116') throw error;
                                                                                if (data) setClaimerProfile(data);
                                                                            })
                                                                    );
                                                                }

                                                                promises.push(
                                                                    supabase
                                                                        .from('storefronts')
                                                                        .select('*')
                                                                        .eq('business_id', business.id)
                                                                        .maybeSingle()
                                                                        .then(({ data }) => {
                                                                            if (data) setStorefrontData(data);
                                                                        })
                                                                );

                                                                await Promise.all(promises);
                                                            } catch (err) {
                                                                console.error("Error fetching related records:", err);
                                                            } finally {
                                                                setIsFetchingClaimer(false);
                                                            }
                                                        }}
                                                        className="text-slate-400 hover:text-emerald-400 font-medium transition-colors flex items-center gap-1.5 justify-end w-full"
                                                    >
                                                        <Eye className="w-4 h-4" /> View
                                                    </button>
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

            <Dialog open={!!selectedBusiness} onOpenChange={(open) => {
                if (!open) {
                    setSelectedBusiness(null);
                    setIsEditMode(false);
                    setClaimerProfile(null);
                    setStorefrontData(null);
                }
            }}>
                <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl flex justify-between items-center pb-2 border-b border-slate-800">
                            Business Details
                            {selectedBusiness?.claimed && (
                                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded uppercase tracking-wider font-bold">Claimed</span>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 pt-2">
                            Manage the business profile details and visibility.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedBusiness && (
                        <div className="space-y-6 pt-4">
                            {/* Profile Info Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Profile Information</h3>

                                {selectedBusiness.claimed && (
                                    <div className="space-y-3 mb-4">
                                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-3 rounded-lg flex gap-3 text-sm">
                                            <Info className="w-5 h-5 shrink-0 mt-0.5" />
                                            <p>This business has been claimed by an owner. Name, category, and region can only be modified by the owner to maintain data integrity.</p>
                                        </div>

                                        {/* Claimer Profile Section */}
                                        <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg p-4">
                                            <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                                                <Shield className="w-4 h-4" /> Claimer Details
                                            </h4>
                                            {isFetchingClaimer ? (
                                                <div className="space-y-2 animate-pulse">
                                                    <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                                                    <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                                                    <div className="h-4 bg-slate-700 rounded w-1/4"></div>
                                                </div>
                                            ) : claimerProfile ? (
                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-slate-300">
                                                    <div>
                                                        <span className="block text-xs text-slate-500 mb-0.5">Full Name</span>
                                                        <span className="font-medium text-white">{claimerProfile.full_name || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs text-slate-500 mb-0.5">Role</span>
                                                        <span className="capitalize">{claimerProfile.role || 'Consumer'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs text-slate-500 mb-0.5">Phone</span>
                                                        <span>{claimerProfile.phone || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs text-slate-500 mb-0.5">Email</span>
                                                        <span>{claimerProfile.email || 'N/A'}</span>
                                                    </div>
                                                    {claimerProfile.business_name && (
                                                        <div className="col-span-2 mt-1">
                                                            <span className="block text-xs text-slate-500 mb-0.5">Registered Business Name (Pre-reg)</span>
                                                            <span className="text-amber-400">{claimerProfile.business_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-slate-500 italic">No exact claimer profile found.</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <Label className="text-slate-400 mb-1 block">Business Name</Label>
                                    <Input
                                        value={isEditMode ? editForm.name : selectedBusiness.name}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        disabled={!isEditMode || selectedBusiness.claimed}
                                        className="bg-slate-800 border-slate-700 disabled:opacity-75 disabled:cursor-not-allowed"
                                        placeholder="e.g. Al-Madina Tech"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-slate-400 mb-1 block">Category</Label>
                                        <Input
                                            value={isEditMode ? editForm.category : selectedBusiness.category}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                                            disabled={!isEditMode || selectedBusiness.claimed}
                                            className="bg-slate-800 border-slate-700 disabled:opacity-75"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-slate-400 mb-1 block">Region</Label>
                                        <Input
                                            value={isEditMode ? editForm.region : selectedBusiness.city}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
                                            disabled={!isEditMode || selectedBusiness.claimed}
                                            className="bg-slate-800 border-slate-700 disabled:opacity-75"
                                        />
                                    </div>
                                </div>

                                {/* Edit Controls for Unclaimed */}
                                {!selectedBusiness.claimed && (
                                    <div className="flex justify-end mt-2">
                                        {!isEditMode ? (
                                            <Button
                                                variant="outline"
                                                className="border-slate-700 hover:bg-slate-800 text-slate-300 h-9"
                                                onClick={() => setIsEditMode(true)}
                                            >
                                                <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setIsEditMode(false)}
                                                    className="h-9 hover:bg-slate-800"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white h-9"
                                                    onClick={async () => {
                                                        if (!editForm.name) return;
                                                        setIsSaving(true);
                                                        try {
                                                            const { error } = await supabase
                                                                .from('businesses')
                                                                .update({
                                                                    name: editForm.name,
                                                                    category: editForm.category,
                                                                    region: editForm.region
                                                                })
                                                                .eq('id', selectedBusiness.id);

                                                            if (error) throw error;
                                                            showToast("Business updated successfully.");
                                                            setIsEditMode(false);
                                                            setSelectedBusiness(prev => ({ ...prev, name: editForm.name, category: editForm.category, city: editForm.region }));
                                                        } catch (err) {
                                                            console.error("Update error:", err);
                                                            showToast("Failed to update business details.", "error");
                                                        } finally {
                                                            setIsSaving(false);
                                                        }
                                                    }}
                                                    disabled={isSaving}
                                                >
                                                    {isSaving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Visibility Section */}
                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Platform Visibility</h3>

                                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-white flex items-center gap-2">
                                            {selectedBusiness.status === 'published' ? (
                                                <><Globe className="w-4 h-4 text-emerald-400" /> Published</>
                                            ) : selectedBusiness.status === 'pending_review' ? (
                                                <><Clock className="w-4 h-4 text-amber-400" /> Pending Review</>
                                            ) : (
                                                <><Ban className="w-4 h-4 text-red-400" /> Restricted</>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {selectedBusiness.status === 'published'
                                                ? "Visible to all consumers on the Discover page."
                                                : selectedBusiness.status === 'pending_review'
                                                    ? "Merchant has resubmitted profile for review."
                                                    : "Hidden from consumer search. Data remains intact."}
                                        </p>
                                    </div>
                                    <Button
                                        variant={selectedBusiness.status === 'published' ? 'destructive' : 'default'}
                                        className={selectedBusiness.status === 'published' ? 'bg-red-900/50 hover:bg-red-900 text-red-300 border border-red-800 h-9' : 'bg-emerald-600 hover:bg-emerald-500 text-white h-9'}
                                        onClick={async () => {
                                            if (selectedBusiness.status === 'published') {
                                                // Open reason modal instead of immediate restriction
                                                setRestrictionReason('');
                                                setIsRestrictModalOpen(true);
                                                return;
                                            }

                                            // When unrestricting, set back to published and clear reason
                                            setIsSaving(true);
                                            try {
                                                const { error } = await supabase
                                                    .from('businesses')
                                                    .update({ status: 'published', restriction_reason: null })
                                                    .eq('id', selectedBusiness.id);

                                                if (error) throw error;
                                                showToast(`Business is now published.`);
                                                setSelectedBusiness(prev => ({ ...prev, status: 'published', restriction_reason: null }));
                                            } catch (err) {
                                                console.error("Status error:", err);
                                                showToast("Failed to update status.", "error");
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        }}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Updating..." : selectedBusiness.status === 'published' ? "Restrict Profile" : "Un-Restrict Profile"}
                                    </Button>
                                </div>

                                {/* Storefront Moderation */}
                                {storefrontData && (
                                    <div className="bg-slate-800/50 border border-purple-500/30 rounded-lg p-4 flex items-center justify-between mt-3">
                                        <div>
                                            <div className="font-medium text-white flex items-center gap-2">
                                                Public Microsite
                                                {storefrontData.status === 'published' ? (
                                                    <span className="bg-purple-500/10 text-purple-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Live</span>
                                                ) : (
                                                    <span className="bg-slate-500/10 text-slate-400 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">{storefrontData.status}</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">
                                                /b/{storefrontData.slug}
                                            </p>
                                        </div>
                                        {storefrontData.status === 'published' && (
                                            <Button
                                                variant="outline"
                                                className="bg-slate-900 hover:bg-red-900/50 text-red-400 hover:text-red-300 border-red-900/50 h-9"
                                                onClick={async () => {
                                                    if (!confirm('Are you sure you want to force unpublish this microsite? The merchant will be notified.')) return;
                                                    setIsSaving(true);
                                                    try {
                                                        const { error } = await supabase
                                                            .from('storefronts')
                                                            .update({ status: 'archived' })
                                                            .eq('id', storefrontData.id);

                                                        if (error) throw error;
                                                        showToast('Microsite forcefully unpublished.');
                                                        setStorefrontData(prev => ({ ...prev, status: 'archived' }));
                                                    } catch (err) {
                                                        console.error(err);
                                                        showToast('Failed to unpublish microsite.', 'error');
                                                    } finally {
                                                        setIsSaving(false);
                                                    }
                                                }}
                                                disabled={isSaving}
                                            >
                                                Force Unpublish
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Restrict Reason Modal */}
            <Dialog open={isRestrictModalOpen} onOpenChange={setIsRestrictModalOpen}>
                <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-red-400">Restrict Business Profile</DialogTitle>
                        <DialogDescription className="text-slate-400 pt-2">
                            Please provide a reason for restricting this business. The owner will see this message and be prompted to fix the issue before resubmitting.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-4">
                        <div>
                            <Label className="text-slate-400 mb-1 block">Reason for Restriction</Label>
                            <textarea
                                value={restrictionReason}
                                onChange={(e) => setRestrictionReason(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-500 min-h-[100px] resize-none"
                                placeholder="e.g. Please update your business category to match your actual services."
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => setIsRestrictModalOpen(false)}
                                className="h-9 hover:bg-slate-800 text-slate-300"
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-500 text-white h-9"
                                disabled={!restrictionReason.trim() || isSaving}
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        const { error } = await supabase
                                            .from('businesses')
                                            .update({
                                                status: 'restricted',
                                                restriction_reason: restrictionReason.trim()
                                            })
                                            .eq('id', selectedBusiness.id);

                                        if (error) throw error;
                                        showToast(`Business restricted successfully.`);
                                        setSelectedBusiness(prev => ({
                                            ...prev,
                                            status: 'restricted',
                                            restriction_reason: restrictionReason.trim()
                                        }));
                                        setIsRestrictModalOpen(false);
                                    } catch (err) {
                                        console.error("Status error:", err, err.message, err.details, err.hint);
                                        showToast(err.message || "Failed to restrict business.", "error");
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                            >
                                {isSaving ? "Restricting..." : "Enforce Restriction"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    )
}
