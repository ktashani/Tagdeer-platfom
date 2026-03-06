'use client'

import { useState, useEffect } from 'react'
import { Grid, MapPin, DollarSign, Lock, Plus, Edit2, Check, X, ChevronRight, Save, Trash2, Users, AlertTriangle, ShieldAlert } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function SettingsPage() {
    const {
        categories: configCategories,
        regions: configRegions,
        shieldPricing: configShieldPricing,
        tierPricing: configTierPricing,
        adminRoles: configAdminRoles,
        refreshConfig,
        supabase,
        showToast,
        loading: configLoading,
        error: configError
    } = useTagdeer()

    const [activeTab, setActiveTab] = useState('categories')
    const [isSaving, setIsSaving] = useState(false)

    // Local mutable state for editing
    const [categories, setCategories] = useState([])
    const [regions, setRegions] = useState([])
    const [shieldPricing, setShieldPricing] = useState({ trust: 20, fatora: 50 })
    const [tierPricing, setTierPricing] = useState([])
    const [adminUsers, setAdminUsers] = useState([])

    // Inline edit states
    const [editingCategory, setEditingCategory] = useState(null)
    const [newCategoryName, setNewCategoryName] = useState('')

    // Load initial data from config
    useEffect(() => {
        // The context now provides the raw objects from the DB.
        if (configCategories?.length > 0) setCategories(configCategories)
        if (configRegions?.length > 0) setRegions(configRegions)
        if (configShieldPricing) setShieldPricing(configShieldPricing)
        if (configTierPricing?.length > 0) setTierPricing(configTierPricing)
    }, [configCategories, configRegions, configShieldPricing, configTierPricing])

    // Load Admins from profiles
    const ADMIN_ROLES_FALLBACK = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
    useEffect(() => {
        const fetchAdmins = async () => {
            if (!supabase) return
            const rolesToQuery = configAdminRoles || ADMIN_ROLES_FALLBACK;
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, created_at')
                .in('role', rolesToQuery)

            if (data) setAdminUsers(data)
        }
        if (activeTab === 'admins') fetchAdmins()
    }, [supabase, activeTab, configAdminRoles])

    const saveConfig = async (key, value) => {
        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('platform_config')
                .update({ value })
                .eq('key', key)

            if (error) throw error
            showToast(`${key} updated successfully.`)
            refreshConfig()
        } catch (err) {
            console.error(err)
            showToast(`Failed to update ${key}.`, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    // --- Category Handlers ---
    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return
        const updated = [...categories, {
            name: newCategoryName.trim(),
            isActive: true,
            requiresReceipt: false,
            basePoints: 5
        }]
        setCategories(updated)
        saveConfig('categories', updated)
        setNewCategoryName('')
    }

    const handleDeleteCategory = (idx) => {
        const updated = categories.filter((_, i) => i !== idx)
        setCategories(updated)
        saveConfig('categories', updated)
    }

    // --- Region Handlers ---
    const handleToggleRegion = (idx) => {
        const updated = [...regions]
        // Currently regions is `['Tripoli', 'Benghazi']`
        // We'll just alert that taking down a region is complex
        showToast('Toggling active status for regions requires a DB schema update.', 'error')
    }

    const handleAddRegion = () => {
        const newRegion = prompt("Enter new city name:")
        if (newRegion) {
            const updated = [...regions, newRegion.trim()]
            setRegions(updated)
            saveConfig('regions', updated)
        }
    }

    const handleDeleteRegion = (idx) => {
        if (confirm("Are you sure? Removing a region will break businesses located there.")) {
            const updated = regions.filter((_, i) => i !== idx)
            setRegions(updated)
            saveConfig('regions', updated)
        }
    }

    // --- Pricing Handlers ---
    const handleSaveShieldPricing = () => {
        saveConfig('shield_pricing', shieldPricing)
    }

    const handleTierChange = (id, field, value) => {
        const updated = tierPricing.map(t => {
            if (t.id === id) {
                if (field === 'features') {
                    return { ...t, features: value.split(',').map(f => f.trim()).filter(Boolean) }
                }

                // Handle nested allocations object
                if (field.startsWith('allocations.')) {
                    const allocField = field.split('.')[1]
                    return {
                        ...t,
                        allocations: {
                            ...t.allocations,
                            [allocField]: value
                        }
                    }
                }

                return { ...t, [field]: value }
            }
            return t
        })
        setTierPricing(updated)
    }

    const handleAddTier = () => {
        const newTier = {
            id: `tier_${Date.now()}`,
            name: 'New Tier',
            price: 0,
            duration: 'monthly',
            allocations: {
                max_locations: 1,
                max_shields: 0,
                max_campaigns: 0,
                gader_points: 5
            },
            features: ['New Feature'],
            isActive: true,
            isPopular: false
        }
        setTierPricing([...tierPricing, newTier])
    }

    const handleSaveTierPricing = () => {
        saveConfig('tier_pricing', tierPricing)
    }

    if (configLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        )
    }

    if (configError) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-slate-950">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <p className="text-white text-lg">Failed to load configuration: {configError}</p>
                <button onClick={refreshConfig} className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors">
                    Try Again
                </button>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500 min-h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Platform Control Center</h1>
                    <p className="text-slate-400 mt-1">Live configuration impacting the entire Tagdeer ecosystem.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">

                {/* Vertical Navigation Sidebar */}
                <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'categories' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><Grid className="w-5 h-5" /> Categories</div>
                        {activeTab === 'categories' && <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>

                    <button
                        onClick={() => setActiveTab('locations')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'locations' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><MapPin className="w-5 h-5" /> Regions</div>
                        {activeTab === 'locations' && <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>

                    <button
                        onClick={() => setActiveTab('pricing')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'pricing' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><DollarSign className="w-5 h-5" /> Pricing & Tiers</div>
                        {activeTab === 'pricing' && <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>

                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'admins' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><Lock className="w-5 h-5" /> Admin Access</div>
                        {activeTab === 'admins' && <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-2xl flex flex-col w-full h-[600px] overflow-hidden">

                    {/* Categories Tab */}
                    {activeTab === 'categories' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-800/50 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Business Categories</h2>
                                    <p className="text-sm text-slate-400 mt-1">These propagate to the Add Business and Discover filters.</p>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="New Category Name"
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                                    />
                                    <button
                                        onClick={handleAddCategory}
                                        disabled={isSaving || !newCategoryName.trim()}
                                        className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {categories.map((cat, idx) => {
                                        const name = typeof cat === 'string' ? cat : cat.name;
                                        const isActive = typeof cat === 'string' ? true : cat.isActive;

                                        return (
                                            <div key={idx} className={`bg-slate-900 border ${isActive ? 'border-slate-700' : 'border-red-900/50 opacity-60'} rounded-xl p-4 flex items-center justify-between group`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">{name}</span>
                                                    {!isActive && <span className="text-[10px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded uppercase font-bold">Inactive</span>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...categories];
                                                            if (typeof updated[idx] === 'string') {
                                                                updated[idx] = { name: updated[idx], isActive: false };
                                                            } else {
                                                                updated[idx] = { ...updated[idx], isActive: !updated[idx].isActive };
                                                            }
                                                            setCategories(updated);
                                                            saveConfig('categories', updated);
                                                        }}
                                                        className={`text-[10px] px-2 py-1 rounded border transition-colors ${isActive ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'}`}
                                                    >
                                                        {isActive ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCategory(idx)}
                                                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Locations Tab */}
                    {activeTab === 'locations' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Regions & Cities</h2>
                                    <p className="text-sm text-slate-400 mt-1">Manage active operational zones. Edits here update all dropdowns.</p>
                                </div>
                                <button onClick={handleAddRegion} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold">
                                    <Plus className="w-4 h-4" /> Add City
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {regions.map((loc, idx) => {
                                        const name = typeof loc === 'string' ? loc : loc.name;
                                        const isActive = typeof loc === 'string' ? true : loc.isActive;

                                        return (
                                            <div key={idx} className={`bg-slate-900 border ${isActive ? 'border-slate-700' : 'border-red-900/50 opacity-60'} rounded-xl p-5 flex justify-between items-center`}>
                                                <div className="flex flex-col gap-1">
                                                    <h3 className="font-semibold text-white text-lg">{name}</h3>
                                                    {!isActive && <span className="text-[10px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded uppercase font-bold w-fit">Inactive</span>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...regions];
                                                            if (typeof updated[idx] === 'string') {
                                                                updated[idx] = { name: updated[idx], isActive: false };
                                                            } else {
                                                                updated[idx] = { ...updated[idx], isActive: !updated[idx].isActive };
                                                            }
                                                            setRegions(updated);
                                                            saveConfig('regions', updated);
                                                        }}
                                                        className={`text-xs px-2 py-1 rounded border transition-colors ${isActive ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'}`}
                                                    >
                                                        {isActive ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRegion(idx)}
                                                        className="text-slate-500 hover:text-red-400"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pricing Tab */}
                    {activeTab === 'pricing' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 bg-slate-800/50 shrink-0">
                                <h2 className="text-xl font-bold text-white">Global Pricing Configuration</h2>
                                <p className="text-sm text-slate-400 mt-1">Changes apply immediately to new checkouts. Existing subscriptions are grandfathered.</p>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-8">

                                {/* Shields */}
                                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                                        Shield Upgrades (LYD)
                                        <button onClick={handleSaveShieldPricing} disabled={isSaving} className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                                            <Save className="w-4 h-4" /> Save Shields
                                        </button>
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                            <label className="text-sm text-slate-400 block mb-2">Trust Shield (Level 1)</label>
                                            <input
                                                type="number"
                                                value={shieldPricing.trust}
                                                onChange={e => setShieldPricing({ ...shieldPricing, trust: parseInt(e.target.value) || 0 })}
                                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xl font-bold"
                                            />
                                        </div>
                                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                            <label className="text-sm text-slate-400 block mb-2">Fatora Shield (Level 2)</label>
                                            <input
                                                type="number"
                                                value={shieldPricing.fatora}
                                                onChange={e => setShieldPricing({ ...shieldPricing, fatora: parseInt(e.target.value) || 0 })}
                                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xl font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tiers */}
                                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                                        Subscription Tiers (LYD)
                                        <div className="flex items-center gap-4">
                                            <button onClick={handleAddTier} className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                                                <Plus className="w-4 h-4" /> Add Tier
                                            </button>
                                            <button onClick={handleSaveTierPricing} disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1">
                                                <Save className="w-4 h-4" /> Save Tiers
                                            </button>
                                        </div>
                                    </h3>
                                    <div className="space-y-4">
                                        {tierPricing.map(tier => (
                                            <div key={tier.id} className={`flex flex-col gap-4 bg-slate-800 border ${tier.isActive ? 'border-slate-700' : 'border-red-900/50 opacity-60'} rounded-lg p-5`}>
                                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={tier.name}
                                                                onChange={e => handleTierChange(tier.id, 'name', e.target.value)}
                                                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                placeholder="Tier Name"
                                                            />
                                                            <button
                                                                onClick={() => handleTierChange(tier.id, 'isPopular', !tier.isPopular)}
                                                                className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold transition-colors ${tier.isPopular ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
                                                            >
                                                                {tier.isPopular ? 'Popular' : 'Mark Popular'}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Features (comma separated)</label>
                                                            <textarea
                                                                value={tier.features?.join(', ') || ''}
                                                                onChange={e => handleTierChange(tier.id, 'features', e.target.value)}
                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[60px]"
                                                                placeholder="Feature 1, Feature 2, Feature 3"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/50 p-3 rounded border border-slate-700/50 mt-2">
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block" title="-1 for Unlimited">Max Locations</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.allocations?.max_locations ?? 1}
                                                                    onChange={e => handleTierChange(tier.id, 'allocations.max_locations', parseInt(e.target.value) || 0)}
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block">Included Shields</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.allocations?.max_shields ?? 0}
                                                                    onChange={e => handleTierChange(tier.id, 'allocations.max_shields', parseInt(e.target.value) || 0)}
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block" title="-1 for Unlimited">Campaigns/Branch</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.allocations?.max_campaigns ?? 0}
                                                                    onChange={e => handleTierChange(tier.id, 'allocations.max_campaigns', parseInt(e.target.value) || 0)}
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block">Gader Pts / Scan</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.allocations?.gader_points ?? 5}
                                                                    onChange={e => handleTierChange(tier.id, 'allocations.gader_points', parseInt(e.target.value) || 0)}
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-end gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={tier.price}
                                                                onChange={e => handleTierChange(tier.id, 'price', parseInt(e.target.value) || 0)}
                                                                className="w-24 bg-slate-900 border border-slate-600 rounded p-2 text-white text-xl font-bold text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                            <span className="text-slate-400 font-bold">LYD / mo</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleTierChange(tier.id, 'isActive', !tier.isActive)}
                                                                className={`text-xs px-3 py-1.5 rounded font-bold transition-all ${tier.isActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                                                            >
                                                                {tier.isActive ? 'Disable Tier' : 'Enable Tier'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Admins Tab */}
                    {activeTab === 'admins' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Staff Access Control</h2>
                                    <p className="text-sm text-slate-400 mt-1">Users with elevated platform privileges based on `profiles.role`.</p>
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="text-xs uppercase bg-slate-800/80 border-b border-slate-700/50 sticky top-0">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300">User</th>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300">Role</th>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300">Last Setup</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {adminUsers.map(admin => (
                                            <tr key={admin.id} className="hover:bg-slate-900/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{admin.full_name || 'Unnamed'}</div>
                                                    <div className="text-xs text-slate-500">{admin.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold ${admin.role === 'super_admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                        : admin.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                            : admin.role === 'assistant_admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                                        }`}>
                                                        {admin.role.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">{new Date(admin.updated_at || Date.now()).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                        {adminUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="text-center py-8 text-slate-500">No admin users found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-slate-700/50 bg-slate-900 text-xs text-slate-500 text-center">
                                Use the main Users tab to modify someone's role to Super Admin, Admin, Assistant Admin, or Support Agent.
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
