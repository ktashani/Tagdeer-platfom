"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, ShieldCheck, Link as LinkIcon, Lock, Image as ImageIcon, MapPin, Building, Globe, Zap, Crown } from "lucide-react";
import { ProShieldToggle } from "@/components/merchant/LockedFeatureOverlay";

export default function MerchantSettings() {
    // Mock Data for a Free Tier Merchant
    const [isPro, setIsPro] = useState(false);
    const [shieldLevel, setShieldLevel] = useState(0); // 0 = None, 1 = Trust, 2 = Fatora

    const [profileData, setProfileData] = useState({
        name: 'Al-Saha Clinic Tripoli',
        category: 'Healthcare',
        address: 'Noufleen, Tripoli',
        website: 'https://alsaha.ly',
        social: '@alsahaclinic',
    });

    const [features, setFeatures] = useState({
        fastResolver: true,
        couponKing: false
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                            Settings & Security
                            {!isPro && <Badge variant="secondary" className="bg-amber-100 text-amber-800 border border-amber-200">Free Tier</Badge>}
                            {isPro && <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600"><Crown className="w-3 h-3 mr-1" /> PRO</Badge>}
                        </h1>
                        <p className="text-slate-500 mt-1">Manage your public profile and review security.</p>
                    </div>

                    {!isPro && (
                        <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/20 w-full sm:w-auto" onClick={() => setIsPro(true)}>
                            Upgrade to Pro
                        </Button>
                    )}
                    {isPro && (
                        <Button variant="outline" className="w-full sm:w-auto text-slate-500" onClick={() => setIsPro(false)}>
                            Downgrade to Free
                        </Button>
                    )}
                </div>

                <Tabs defaultValue="security" className="w-full">
                    <TabsList className="bg-slate-200/50 dark:bg-slate-900 mb-6 p-1 rounded-xl h-auto">
                        <TabsTrigger value="security" className="py-2.5 px-4 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
                            <ShieldCheck className="w-4 h-4 mr-2" /> Security Shields
                        </TabsTrigger>
                        <TabsTrigger value="profile" className="py-2.5 px-4 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
                            <Building className="w-4 h-4 mr-2" /> Public Profile
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: Security & Shields */}
                    <TabsContent value="security" className="space-y-6 animate-in fade-in duration-300">

                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-900/10 mb-8 border-l-4 border-l-indigo-500">
                            <CardContent className="p-6">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Reputation Engine</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                                            Take control of your Health Score. By activating Shields, you force Tagdeer to filter out low-quality or potentially fake reviews before they reach your public page.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            {!isPro ? (
                                <>
                                    <ProShieldToggle
                                        title="Tagdeer Trust Shield (Level 1)"
                                        description="Force all incoming interactions to be from SMS-verified user accounts."
                                        level={1}
                                    />
                                    <ProShieldToggle
                                        title="Tagdeer Fatora Shield (Level 2)"
                                        description="Force all incoming complaints to include a scanned receipt. Enables the Dispute Manager."
                                        level={2}
                                    />
                                </>
                            ) : (
                                <>
                                    {/* PRO Activated State */}
                                    <Card className={`border-2 transition-all ${shieldLevel === 1 ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <CardContent className="p-6 flex flex-row items-center justify-between">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${shieldLevel === 1 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    <ShieldCheck className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        Tagdeer Trust Shield
                                                        <Badge variant="outline" className="text-xs">Level 1</Badge>
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1">Requires SMS verification for all logs.</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={shieldLevel >= 1}
                                                onCheckedChange={(c) => setShieldLevel(c ? 1 : 0)}
                                                className="data-[state=checked]:bg-amber-500"
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card className={`border-2 transition-all ${shieldLevel === 2 ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <CardContent className="p-6 flex flex-row items-center justify-between">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${shieldLevel === 2 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    <ShieldAlert className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        Tagdeer Fatora Shield
                                                        <Badge variant="outline" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">Level 2</Badge>
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1 max-w-md">Requires physical receipt uploads for complaints. Unlocks the <strong className="text-slate-700">Dispute Manager</strong> to flag fake reviews.</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={shieldLevel === 2}
                                                onCheckedChange={(c) => setShieldLevel(c ? 2 : 1)}
                                                className="data-[state=checked]:bg-blue-600"
                                                disabled={shieldLevel === 0}
                                            />
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>

                    </TabsContent>

                    {/* TAB 2: Public Profile */}
                    <TabsContent value="profile" className="space-y-6 animate-in fade-in duration-300">

                        <Card>
                            <CardHeader>
                                <CardTitle>Basic Information</CardTitle>
                                <CardDescription>This is how your business looks on the main Tagdeer app.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Business Name</Label>
                                        <Input value={profileData.name} disabled />
                                        <p className="text-xs text-slate-500">Contact support to change legal name.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Input value={profileData.category} disabled />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Physical Address <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <Input className="pl-9" value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Website (Optional)</Label>
                                        <div className="relative">
                                            <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <Input className="pl-9" placeholder="https://" value={profileData.website} onChange={(e) => setProfileData({ ...profileData, website: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Social Handle (Optional)</Label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <Input className="pl-9" placeholder="@username" value={profileData.social} onChange={(e) => setProfileData({ ...profileData, social: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Storefront Gallery</CardTitle>
                                <CardDescription>Upload up to 3 images to show off your location.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-4">
                                    {[1, 2, 3].map((slot) => (
                                        <div key={slot} className="aspect-square border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors relative overflow-hidden group">
                                            <ImageIcon className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                                            <span className="text-xs font-medium">Upload Image</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Generosity Avatars (Gamification)</CardTitle>
                                <CardDescription>Automatically display badges on your profile based on your Tagdeer activity.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm">Fast Resolver Badge</h4>
                                            <p className="text-xs text-slate-500">Displayed if you reply to complaints in under 2 hours.</p>
                                        </div>
                                    </div>
                                    <Switch checked={features.fastResolver} onCheckedChange={(c) => setFeatures({ ...features, fastResolver: c })} />
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                                            <Crown className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm">Coupon King Badge</h4>
                                            <p className="text-xs text-slate-500">Displayed if you host active discount campaigns.</p>
                                        </div>
                                    </div>
                                    <Switch checked={features.couponKing} onCheckedChange={(c) => setFeatures({ ...features, couponKing: c })} />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end pt-4">
                            <Button size="lg">Save Profile Changes</Button>
                        </div>

                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}
