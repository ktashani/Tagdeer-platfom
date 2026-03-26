'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Admin Platform Settings — manage platform_config key-value pairs.
 * Supports text, number, boolean, and JSON values.
 */

const CONFIG_SCHEMA = [
    { key: 'payment_gateway_config', label: 'Payment Gateway', type: 'json', description: 'Payment gateway configuration (enabled, default_gateway, gateways)' },
    { key: 'platform_name', label: 'Platform Name', type: 'text', description: 'Display name of the platform' },
    { key: 'support_email', label: 'Support Email', type: 'text', description: 'Email for customer support' },
    { key: 'max_anon_votes_per_day', label: 'Max Anonymous Votes/Day', type: 'number', description: 'Maximum anonymous votes per device per 24 hours' },
    { key: 'require_proof_for_upgrade', label: 'Require Payment Proof', type: 'boolean', description: 'Require merchants to attach proof when requesting upgrade' },
    { key: 'auto_approve_free_claims', label: 'Auto-Approve Free Claims', type: 'boolean', description: 'Automatically approve business claims for free tier' },
    { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'boolean', description: 'Put platform in maintenance mode' },
];

export default function PlatformSettings() {
    const [configs, setConfigs] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const { data, error } = await supabase
                .from('platform_config')
                .select('key, value');
            if (!error && data) {
                const map = {};
                data.forEach(row => { map[row.key] = row.value; });
                setConfigs(map);
            }
            setLoading(false);
        };
        fetch();
    }, []);

    const handleSave = useCallback(async (key, value) => {
        setSaving(key);
        try {
            const { error } = await supabase
                .from('platform_config')
                .upsert({ key, value }, { onConflict: 'key' });
            if (error) throw error;
            setConfigs(prev => ({ ...prev, [key]: value }));
        } catch (err) {
            alert('Failed: ' + err.message);
        }
        setSaving(null);
    }, []);

    const handleAddCustom = async () => {
        if (!newKey.trim()) return;
        let parsedValue = newValue;
        try { parsedValue = JSON.parse(newValue); } catch { /* keep as string */ }
        await handleSave(newKey.trim(), parsedValue);
        setNewKey('');
        setNewValue('');
        setShowAdd(false);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Platform Settings</h3>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    + Add Key
                </button>
            </div>

            {/* Config Items */}
            <div className="space-y-3">
                {CONFIG_SCHEMA.map(schema => {
                    const val = configs[schema.key];
                    return (
                        <div key={schema.key} className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{schema.key}</span>
                                        <span className="text-xs text-slate-400">{schema.type}</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">{schema.label}</p>
                                    <p className="text-xs text-slate-400">{schema.description}</p>
                                </div>
                                <div className="shrink-0">
                                    {schema.type === 'boolean' ? (
                                        <button
                                            onClick={() => handleSave(schema.key, !val)}
                                            disabled={saving === schema.key}
                                            className={`w-12 h-7 rounded-full transition-colors relative ${
                                                val ? 'bg-emerald-600' : 'bg-slate-300'
                                            } disabled:opacity-50`}
                                        >
                                            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                                val ? 'translate-x-5' : 'translate-x-0.5'
                                            }`} />
                                        </button>
                                    ) : schema.type === 'number' ? (
                                        <input
                                            type="number"
                                            value={val ?? ''}
                                            onChange={(e) => setConfigs(prev => ({ ...prev, [schema.key]: Number(e.target.value) }))}
                                            onBlur={(e) => handleSave(schema.key, Number(e.target.value))}
                                            className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-right outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : schema.type === 'json' ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 font-mono max-w-[200px] truncate">
                                                {val ? JSON.stringify(val).slice(0, 40) + '…' : 'null'}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    const newVal = prompt('Enter JSON value:', JSON.stringify(val || {}, null, 2));
                                                    if (newVal !== null) {
                                                        try {
                                                            handleSave(schema.key, JSON.parse(newVal));
                                                        } catch {
                                                            alert('Invalid JSON');
                                                        }
                                                    }
                                                }}
                                                className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={val ?? ''}
                                            onChange={(e) => setConfigs(prev => ({ ...prev, [schema.key]: e.target.value }))}
                                            onBlur={(e) => handleSave(schema.key, e.target.value)}
                                            className="w-48 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Not set"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Custom keys from DB not in schema */}
                {Object.entries(configs)
                    .filter(([k]) => !CONFIG_SCHEMA.find(s => s.key === k))
                    .map(([key, val]) => (
                        <div key={key} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded">{key}</span>
                                    <span className="text-xs text-slate-400 ml-2">custom</span>
                                </div>
                                <span className="text-xs text-slate-500 font-mono max-w-[200px] truncate">
                                    {typeof val === 'object' ? JSON.stringify(val).slice(0, 50) : String(val)}
                                </span>
                            </div>
                        </div>
                    ))
                }
            </div>

            {/* Add Custom Key */}
            {showAdd && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                            placeholder="Key name"
                            className="px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="text"
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            placeholder="Value (text or JSON)"
                            className="px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={handleAddCustom}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                    >
                        Save Key
                    </button>
                </div>
            )}
        </div>
    );
}
