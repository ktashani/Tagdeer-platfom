'use client'

import { useState } from 'react'
import { Settings, MapPin, Grid, DollarSign, ShieldAlert, Plus, Edit2, Check, X, Users, Lock, ChevronRight } from 'lucide-react'

// Dummy Data
const initialCategories = [
    { id: 1, name: 'Dining', requiresReceipt: true, basePoints: 10, isActive: true },
    { id: 2, name: 'Medical', requiresReceipt: false, basePoints: 5, isActive: true },
    { id: 3, name: 'Retail', requiresReceipt: true, basePoints: 10, isActive: true }
]

const initialLocations = [
    { id: 1, city: 'Tripoli', neighborhoods: 14, isActive: true },
    { id: 2, city: 'Benghazi', neighborhoods: 8, isActive: true },
    { id: 3, city: 'Misrata', neighborhoods: 5, isActive: false }
]

const initialPricing = [
    { id: 1, tier: 'Tier 1 (Basic Plus)', price: '50 LYD', duration: '30 Days', features: 'Analytics, Basic Shield' },
    { id: 2, tier: 'Tier 2 (Premium)', price: '150 LYD', duration: '90 Days', features: 'Analytics, Advanced Shield, Priority Support' }
]

const initialAdmins = [
    { id: 1, name: 'Super Admin', email: 'admin@tagdeer.co', role: 'Super Admin', lastActive: '2 mins ago' },
    { id: 2, name: 'Support Agent 1', email: 'support1@tagdeer.co', role: 'Support Agent', lastActive: '1 hour ago' }
]

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('categories') // categories, locations, pricing, admins

    return (
        <div className="animate-in fade-in duration-500 min-h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">System Configuration</h1>
                    <p className="text-slate-400 mt-1">Manage global platform behaviors and team access.</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">

                {/* Vertical Navigation Sidebar */}
                <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'categories' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><Grid className="w-5 h-5" /> Categories & Rules</div>
                        {activeTab === 'categories' && <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>

                    <button
                        onClick={() => setActiveTab('locations')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'locations' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><MapPin className="w-5 h-5" /> Regions & Cities</div>
                        {activeTab === 'locations' && <ChevronRight className="w-4 h-4 text-slate-500" />}
                    </button>

                    <button
                        onClick={() => setActiveTab('pricing')}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${activeTab === 'pricing' ? 'bg-slate-800 text-white font-semibold border-l-4 border-emerald-500 shadow-md' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-l-4 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3"><DollarSign className="w-5 h-5" /> Tier Pricing</div>
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
                <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col w-full">

                    {/* Categories Tab */}
                    {activeTab === 'categories' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Business Categories</h2>
                                    <p className="text-sm text-slate-400 mt-1">Configure global rules for specific industry types.</p>
                                </div>
                                <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold">
                                    <Plus className="w-4 h-4" /> Add Category
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto w-full">
                                <div className="space-y-4 max-w-4xl mx-auto w-full">
                                    {initialCategories.map(cat => (
                                        <div key={cat.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div>
                                                <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                                                    {cat.name}
                                                    {!cat.isActive && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Disabled</span>}
                                                </h3>
                                                <div className="flex gap-4 mt-2 text-sm text-slate-400">
                                                    <span className="flex items-center gap-1.5">
                                                        {cat.requiresReceipt ? <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> Reqs. Receipt</span> : <span className="flex items-center gap-1 text-slate-500"><X className="w-3 h-3" /> No Receipt Needed</span>}
                                                    </span>
                                                    <span>Base Award: <strong className="text-white">{cat.basePoints} PTS</strong></span>
                                                </div>
                                            </div>
                                            <button className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors text-sm flex items-center gap-2">
                                                <Edit2 className="w-4 h-4" /> Edit Rules
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Locations Tab */}
                    {activeTab === 'locations' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Regions & Cities</h2>
                                    <p className="text-sm text-slate-400 mt-1">Manage active operational zones.</p>
                                </div>
                                <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold">
                                    <Plus className="w-4 h-4" /> Add City
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto w-full">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
                                    {initialLocations.map(loc => (
                                        <div key={loc.id} className={`bg-slate-900 border rounded-xl p-5 ${loc.isActive ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-semibold text-white text-lg">{loc.city}</h3>
                                                <div className="flex items-center gap-2 cursor-pointer">
                                                    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${loc.isActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${loc.isActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-400">
                                                <span className="font-medium text-slate-300">{loc.neighborhoods}</span> registered neighborhoods
                                            </div>
                                            <button className="mt-4 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors">
                                                Manage Neighborhoods
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pricing Tab */}
                    {activeTab === 'pricing' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Tier Pricing</h2>
                                    <p className="text-sm text-slate-400 mt-1">Global settings for merchant subscription packages.</p>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto w-full">
                                <div className="space-y-4 max-w-4xl mx-auto w-full">
                                    {initialPricing.map(tier => (
                                        <div key={tier.id} className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-2">{tier.tier}</h3>
                                                    <div className="text-sm text-slate-400">Features: {tier.features}</div>
                                                </div>
                                                <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700">
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-emerald-400">{tier.price}</div>
                                                        <div className="text-xs text-slate-500">per {tier.duration}</div>
                                                    </div>
                                                    <button className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-md transition-colors text-slate-300">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 mt-8">
                                        <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                                            <DollarSign className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-blue-400 mb-1">Pricing Changes require restart</h4>
                                            <p className="text-sm text-blue-200/70">Updating global pricing will not affect currently active subscriptions until their next renewal cycle.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Admins Tab */}
                    {activeTab === 'admins' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Staff Access Control</h2>
                                    <p className="text-sm text-slate-400 mt-1">Manage who can access the admin portal and their permissions.</p>
                                </div>
                                <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold">
                                    <Users className="w-4 h-4" /> Invite Admin
                                </button>
                            </div>
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300">User</th>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300">Role</th>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300">Last Active</th>
                                            <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {initialAdmins.map(admin => (
                                            <tr key={admin.id} className="border-b border-slate-700/50 hover:bg-slate-900/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{admin.name}</div>
                                                    <div className="text-xs text-slate-500">{admin.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold ${admin.role === 'Super Admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-700 text-slate-300 border border-slate-600'
                                                        }`}>
                                                        {admin.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">{admin.lastActive}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-slate-400 hover:text-white font-medium transition-colors">Edit</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    )
}
