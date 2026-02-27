"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Gift, QrCode, Sparkles, MessageCircle, MoreVertical, Play, Pause, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

export default function CouponCommandCenter() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newCoupon, setNewCoupon] = useState({
        offerType: 'percentage', // percentage, fixed, free_item
        value: '',
        itemName: '',
        quantity: '50',
        distributionRule: 'quota_pool', // quota_pool, physical_scan, resolution_only
        expiryDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0] // Default to 1 month from now
    });

    // Mock Active Campaigns (Now State)
    const [campaigns, setCampaigns] = useState([
        {
            id: 1,
            type: 'percentage',
            value: '20',
            rule: 'quota_pool',
            total: 100,
            remaining: 42,
            status: 'active',
            expiry: '2026-03-15'
        },
        {
            id: 2,
            type: 'free_item',
            itemName: 'Free Dessert',
            rule: 'resolution_only',
            total: 50,
            remaining: 48,
            status: 'active',
            expiry: '2026-12-31'
        },
        {
            id: 3,
            type: 'fixed',
            value: '10',
            rule: 'physical_scan',
            total: 200,
            remaining: 0,
            status: 'exhausted',
            expiry: '2026-02-28'
        }
    ]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active': return <Badge className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>;
            case 'paused': return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Paused</Badge>;
            case 'exhausted': return <Badge variant="destructive">Exhausted</Badge>;
            case 'expired': return <Badge variant="outline" className="text-slate-500">Expired</Badge>;
            default: return null;
        }
    };

    const getRuleIcon = (rule) => {
        switch (rule) {
            case 'quota_pool': return <Sparkles className="w-4 h-4 text-indigo-500" />;
            case 'physical_scan': return <QrCode className="w-4 h-4 text-blue-500" />;
            case 'resolution_only': return <MessageCircle className="w-4 h-4 text-emerald-500" />;
            default: return <Gift className="w-4 h-4" />;
        }
    };

    const getRuleName = (rule) => {
        switch (rule) {
            case 'quota_pool': return "Platform Quota Pool";
            case 'physical_scan': return "Physical VIP Scan";
            case 'resolution_only': return "Resolution Only (Hidden)";
            default: return rule;
        }
    };

    const formatOfferTitle = (campaign) => {
        if (campaign.type === 'percentage') return `${campaign.value}% OFF`;
        if (campaign.type === 'fixed') return `${campaign.value} LYD OFF`;
        if (campaign.type === 'free_item') return `FREE: ${campaign.itemName}`;
        return 'Offer';
    };

    const handleCreateCoupon = (e) => {
        e.preventDefault();

        // Add new campaign to list (Mocking Backend)
        const newCampaign = {
            id: Date.now(),
            type: newCoupon.offerType,
            value: newCoupon.value,
            itemName: newCoupon.itemName,
            rule: newCoupon.distributionRule,
            total: parseInt(newCoupon.quantity) || 50,
            remaining: parseInt(newCoupon.quantity) || 50,
            status: 'active',
            expiry: newCoupon.expiryDate
        };

        setCampaigns([newCampaign, ...campaigns]);

        setIsCreateOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header Setup */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Campaigns & Coupons
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Create offers to acquire new customers, reward loyalty, or apologize for mistakes.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        {/* Create Coupon Modal */}
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 shadow-md">
                                    <Plus className="w-5 h-5 mr-2" />
                                    Create Campaign
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-950">
                                <DialogHeader>
                                    <DialogTitle>Create New Coupon Campaign</DialogTitle>
                                    <DialogDescription>Define your offer, quantity, and how it gets distributed.</DialogDescription>
                                </DialogHeader>

                                <form onSubmit={handleCreateCoupon} className="space-y-6 mt-4">
                                    {/* Step 1: Offer Type */}
                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold">1. Offer Type</Label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div
                                                onClick={() => setNewCoupon({ ...newCoupon, offerType: 'percentage' })}
                                                className={`p-3 text-center rounded-lg border-2 cursor-pointer transition-all ${newCoupon.offerType === 'percentage' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-800'}`}
                                            >
                                                % Discount
                                            </div>
                                            <div
                                                onClick={() => setNewCoupon({ ...newCoupon, offerType: 'fixed' })}
                                                className={`p-3 text-center rounded-lg border-2 cursor-pointer transition-all ${newCoupon.offerType === 'fixed' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-800'}`}
                                            >
                                                Fixed Amount
                                            </div>
                                            <div
                                                onClick={() => setNewCoupon({ ...newCoupon, offerType: 'free_item' })}
                                                className={`p-3 text-center rounded-lg border-2 cursor-pointer transition-all ${newCoupon.offerType === 'free_item' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-slate-800'}`}
                                            >
                                                Free Item
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dynamic Fields based on Offer Type */}
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                        {newCoupon.offerType === 'percentage' && (
                                            <div className="space-y-2 col-span-2">
                                                <Label>Discount Percentage (%)</Label>
                                                <Input type="number" placeholder="e.g. 20" value={newCoupon.value} onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })} />
                                            </div>
                                        )}
                                        {newCoupon.offerType === 'fixed' && (
                                            <div className="space-y-2 col-span-2">
                                                <Label>Discount Amount (LYD)</Label>
                                                <Input type="number" placeholder="e.g. 15" value={newCoupon.value} onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })} />
                                            </div>
                                        )}
                                        {newCoupon.offerType === 'free_item' && (
                                            <div className="space-y-2 col-span-2">
                                                <Label>Item Name</Label>
                                                <Input placeholder="e.g. Free Dessert" value={newCoupon.itemName} onChange={(e) => setNewCoupon({ ...newCoupon, itemName: e.target.value })} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2: Quantity & Expiry */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Total Quantity</Label>
                                            <Input type="number" placeholder="50" value={newCoupon.quantity} onChange={(e) => setNewCoupon({ ...newCoupon, quantity: e.target.value })} />
                                            <p className="text-xs text-slate-500">How many to give away?</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Expiry Date</Label>
                                            <Input type="date" value={newCoupon.expiryDate} onChange={(e) => setNewCoupon({ ...newCoupon, expiryDate: e.target.value })} />
                                            <p className="text-xs text-slate-500">When does this campaign end?</p>
                                        </div>
                                    </div>

                                    {/* Step 3: Distribution Rule */}
                                    <div className="space-y-3">
                                        <Label className="text-base font-semibold">3. Distribution Rule</Label>
                                        <div className="space-y-3">

                                            <div
                                                onClick={() => setNewCoupon({ ...newCoupon, distributionRule: 'quota_pool' })}
                                                className={`flex gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${newCoupon.distributionRule === 'quota_pool' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'}`}
                                            >
                                                <div className={`p-2 rounded-full shrink-0 ${newCoupon.distributionRule === 'quota_pool' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    <Sparkles className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">Platform Quota Pool</h4>
                                                    <p className="text-sm text-slate-500 mt-1">Donated to Tagdeer Admin. We distribute these to high-tier app users who log places weekly. Great for acquiring new customers.</p>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setNewCoupon({ ...newCoupon, distributionRule: 'physical_scan' })}
                                                className={`flex gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${newCoupon.distributionRule === 'physical_scan' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'}`}
                                            >
                                                <div className={`p-2 rounded-full shrink-0 ${newCoupon.distributionRule === 'physical_scan' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    <QrCode className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">Physical VIP Scan</h4>
                                                    <p className="text-sm text-slate-500 mt-1">Keep these in your pocket. Manually push them to a customer's phone when you scan their VIP passport in-store. Great for loyalty.</p>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setNewCoupon({ ...newCoupon, distributionRule: 'resolution_only' })}
                                                className={`flex gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${newCoupon.distributionRule === 'resolution_only' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}
                                            >
                                                <div className={`p-2 rounded-full shrink-0 ${newCoupon.distributionRule === 'resolution_only' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    <MessageCircle className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">Resolution Only</h4>
                                                    <p className="text-sm text-slate-500 mt-1">Hidden from public view. Can only be attached as an "Apology Gift" when chatting with an angry customer in your Inbox.</p>
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <Button type="submit" className="w-full h-12 text-lg">
                                            Launch Campaign
                                        </Button>
                                    </div>
                                </form>

                            </DialogContent>
                        </Dialog>

                    </div>
                </div>

                {/* Campaign List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map((campaign) => (
                        <Card key={campaign.id} className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col group relative">

                            <div className="absolute top-4 right-4 z-10">
                                {getStatusBadge(campaign.status)}
                            </div>

                            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="w-12 h-12 bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
                                    <Gift className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                                    {formatOfferTitle(campaign)}
                                </h3>
                                <div className="flex items-center text-sm text-slate-500 gap-1.5">
                                    {getRuleIcon(campaign.rule)} {getRuleName(campaign.rule)}
                                </div>
                            </div>

                            <CardContent className="p-0 flex-1 flex flex-col justify-between">
                                <div className="p-6 py-5">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-500">Claimed</span>
                                        <span className="font-bold">{campaign.total - campaign.remaining} / {campaign.total}</span>
                                    </div>

                                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${campaign.status === 'exhausted' ? 'bg-red-500' :
                                                campaign.rule === 'quota_pool' ? 'bg-indigo-500' :
                                                    campaign.rule === 'physical_scan' ? 'bg-blue-500' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${((campaign.total - campaign.remaining) / campaign.total) * 100}%` }}
                                        />
                                    </div>

                                    <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
                                        Expires: {campaign.expiry}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 border-t border-slate-100 dark:border-slate-800">
                                    <button className="flex items-center justify-center py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors border-r border-slate-100 dark:border-slate-800">
                                        {campaign.status === 'paused' ? (
                                            <><Play className="w-4 h-4 mr-2" /> Resume</>
                                        ) : (
                                            <><Pause className="w-4 h-4 mr-2" /> Pause</>
                                        )}
                                    </button>
                                    <button className="flex items-center justify-center py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* Empty State Card (if they need more) */}
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all min-h-[300px]"
                    >
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-inherit">
                            <Plus className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300">Create Campaign</h3>
                        <p className="text-sm mt-2">Add a new offer to your arsenal</p>
                    </button>

                </div>
            </div>
        </div>
    );
}
