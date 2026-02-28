"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, ShieldCheck, Mail, Phone, Lock, UserPlus, Users, Store, Crown, Building, Trash2, CheckCircle2, ArrowUpRight } from "lucide-react";

export default function MerchantSettings() {
    // ---- Mock State ----

    // Account Level
    const [accountTier, setAccountTier] = useState(1); // 1 = Single Business, 2 = Multi-Business & Team
    const [personalInfo, setPersonalInfo] = useState({
        name: 'Mohammed Ali',
        email: 'mohammed@alsaha.ly',
        phone: '+218 91 123 4567'
    });

    // Business Level (Contextual)
    const [businessShield, setBusinessShield] = useState(0); // 0 = None, 1 = Trust, 2 = Fatora
    const [storefrontEnabled, setStorefrontEnabled] = useState(true);

    // Team Management
    const [teamMembers, setTeamMembers] = useState([
        { id: 1, email: 'admin@alsaha.ly', role: 'Owner', access: 'All Businesses' },
        { id: 2, email: 'reception@alsaha.ly', role: 'Manager', access: 'Al-Saha Clinic Tripoli' }
    ]);
    const [inviteEmail, setInviteEmail] = useState('');

    const handleUpgradeTier = () => setAccountTier(2);
    const handleDowngradeTier = () => setAccountTier(1);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 xl:p-8">
            <div className="max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                            Platform Settings
                            {accountTier === 1 ? (
                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Tier 1 Account</Badge>
                            ) : (
                                <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 border-none shadow-md shadow-purple-500/20"><Crown className="w-3 h-3 mr-1" /> Tier 2 Account</Badge>
                            )}
                        </h1>
                        <p className="text-slate-500 mt-1">Manage your personal account, business features, and team access.</p>
                    </div>
                </div>

                {/* Main Settings Layout */}
                <Tabs defaultValue="account" className="flex flex-col lg:flex-row gap-8">

                    {/* Vertical Sidebar Navigation */}
                    <TabsList className="flex flex-col w-full lg:w-64 h-auto bg-transparent p-0 gap-2 justify-start items-start">
                        <TabsTrigger
                            value="account"
                            className="w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium"
                        >
                            <Users className="w-4 h-4 mr-3 opacity-70" /> Account Details
                        </TabsTrigger>
                        <TabsTrigger
                            value="business"
                            className="w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium"
                        >
                            <Store className="w-4 h-4 mr-3 opacity-70" /> Business Settings
                        </TabsTrigger>
                        <TabsTrigger
                            value="team"
                            className="w-full justify-start py-3 px-4 rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-800 transition-all font-medium relative"
                        >
                            <UserPlus className="w-4 h-4 mr-3 opacity-70" /> Team Management
                            {accountTier === 1 && <Lock className="w-3 h-3 absolute right-4 text-slate-400" />}
                        </TabsTrigger>
                    </TabsList>

                    {/* Content Area */}
                    <div className="flex-1 w-full min-w-0">

                        {/* ==========================================
                            TAB 1: ACCOUNT DETAILS (GLOBAL)
                        ========================================== */}
                        <TabsContent value="account" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            {/* Tier Subscription Card */}
                            <Card className={`overflow-hidden transition-colors ${accountTier === 2 ? 'border-purple-500/50 bg-purple-50/30 dark:bg-purple-950/20' : ''}`}>
                                <div className={`h-1.5 w-full ${accountTier === 1 ? 'bg-slate-200 dark:bg-slate-800' : 'bg-gradient-to-r from-purple-500 to-indigo-500'}`} />
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-xl">
                                                Merchant Account Tier
                                                {accountTier === 2 && <Crown className="w-5 h-5 text-purple-500" />}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                Determines your global platform capabilities.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className={`p-4 rounded-xl border-2 transition-all ${accountTier === 1 ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800 opacity-60'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-bold">Tier 1 (Base)</h3>
                                                {accountTier === 1 && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                            </div>
                                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-3">
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Manage 1 Business Location</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Accept Reviews & Interactions</li>
                                                <li className="flex items-center gap-2 opacity-50"><Lock className="w-3 h-3" /> No Team Management</li>
                                            </ul>
                                            {accountTier === 2 && (
                                                <Button variant="outline" size="sm" className="w-full mt-4" onClick={handleDowngradeTier}>Downgrade to Tier 1</Button>
                                            )}
                                        </div>

                                        <div className={`p-4 rounded-xl border-2 transition-all ${accountTier === 2 ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-800 hover:border-purple-300'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-purple-500" /> Tier 2 (Pro)</h3>
                                                {accountTier === 2 && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                                            </div>
                                            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-3">
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Manage Unlimited Locations</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Unlock Team Management</li>
                                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Dedicated Account Manager</li>
                                            </ul>
                                            {accountTier === 1 && (
                                                <Button className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-lg shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700" onClick={handleUpgradeTier}>
                                                    Upgrade to Tier 2
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Personal Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Personal Information</CardTitle>
                                    <CardDescription>Details associated with your merchant login.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input value={personalInfo.name} onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email Address</Label>
                                            <div className="relative flex items-center">
                                                <Mail className="absolute left-3 w-4 h-4 text-slate-400" />
                                                <Input className="pl-9 bg-slate-50 dark:bg-slate-900" value={personalInfo.email} disabled />
                                                <Badge className="absolute right-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Verified</Badge>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Phone Number</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <Input className="pl-9" value={personalInfo.phone} onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                    <Button>Save Identity Changes</Button>
                                </CardContent>
                            </Card>

                            {/* Security */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Security</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                                                <Lock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">Password</p>
                                                <p className="text-sm text-slate-500">Last changed 3 months ago</p>
                                            </div>
                                        </div>
                                        <Button variant="outline">Update Password</Button>
                                    </div>
                                </CardContent>
                            </Card>

                        </TabsContent>

                        {/* ==========================================
                            TAB 2: BUSINESS SETTINGS (CONTEXTUAL)
                        ========================================== */}
                        <TabsContent value="business" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex items-center gap-3">
                                <Building className="w-5 h-5 text-indigo-600" />
                                <p className="text-sm text-indigo-900 dark:text-indigo-200">
                                    Currently configuring settings for: <strong className="font-bold">Al-Saha Clinic Tripoli</strong>
                                </p>
                            </div>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5 text-indigo-600" />
                                        <CardTitle>Shield Subscriptions (Per-Business)</CardTitle>
                                    </div>
                                    <CardDescription>Filter out fake reviews and enable the Dispute Manager for this specific location.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Shield 1 */}
                                    <div className={`p-5 rounded-xl border-2 transition-all ${businessShield >= 1 ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${businessShield >= 1 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                    <ShieldCheck className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        Tagdeer Trust Shield
                                                        <Badge variant="outline" className="text-xs">Level 1</Badge>
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1 max-w-md">Forces all incoming interactions to originate from SMS-verified accounts.</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={businessShield >= 1}
                                                onCheckedChange={(c) => setBusinessShield(c ? (businessShield === 2 ? 2 : 1) : 0)}
                                                className="data-[state=checked]:bg-amber-500 shrink-0"
                                            />
                                        </div>
                                    </div>

                                    {/* Shield 2 */}
                                    <div className={`p-5 rounded-xl border-2 transition-all ${businessShield === 2 ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                <div className={`p-3 rounded-full ${businessShield === 2 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                    <ShieldAlert className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold flex items-center gap-2">
                                                        Tagdeer Fatora Shield
                                                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-0">Level 2</Badge>
                                                    </h3>
                                                    <p className="text-sm text-slate-500 mt-1 max-w-md">Requires physical receipt uploads for complaints. Unlocks the <strong className="text-slate-700 dark:text-slate-300">Dispute Manager</strong>.</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={businessShield === 2}
                                                onCheckedChange={(c) => setBusinessShield(c ? 2 : 1)}
                                                disabled={businessShield === 0}
                                                className="data-[state=checked]:bg-blue-600 shrink-0"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Business Features</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                                                <Store className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">Digital Storefront</h4>
                                                <p className="text-sm text-slate-500">Allow customers to view menus/catalogs and request quotes directly.</p>
                                            </div>
                                        </div>
                                        <Switch checked={storefrontEnabled} onCheckedChange={setStorefrontEnabled} />
                                    </div>
                                </CardContent>
                            </Card>

                        </TabsContent>

                        {/* ==========================================
                            TAB 3: TEAM MANAGEMENT (TIER 2 ONLY)
                        ========================================== */}
                        <TabsContent value="team" className="space-y-6 m-0 animate-in fade-in duration-300 outline-none">

                            {accountTier === 1 ? (
                                <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20 text-center py-12">
                                    <CardContent className="flex flex-col items-center justify-center space-y-4">
                                        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 text-purple-600 rounded-full flex items-center justify-center">
                                            <Users className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold">Team Management Locked</h3>
                                            <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                                Upgrade your account to Tier 2 (Pro) to invite managers and staff to help run your businesses.
                                            </p>
                                        </div>
                                        <Button className="mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-lg hover:from-purple-700 hover:to-indigo-700" onClick={handleUpgradeTier}>
                                            Unlock with Tier 2
                                        </Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Invite Team Member</CardTitle>
                                            <CardDescription>Send an email invitation. They will need to create a Tagdeer account if they don't have one.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-col sm:flex-row gap-4">
                                                <div className="flex-1 space-y-2">
                                                    <Label>Email Address</Label>
                                                    <Input placeholder="manager@company.ly" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                                                </div>
                                                <div className="sm:w-1/3 space-y-2">
                                                    <Label>Access Scope</Label>
                                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300">
                                                        <option>Al-Saha Clinic Tripoli</option>
                                                        <option>All Businesses</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end">
                                                    <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">Send Invite</Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Active Members</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                                                {teamMembers.map(member => (
                                                    <div key={member.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-950">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                                                {member.email.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm">{member.email}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <Badge variant="outline" className="text-[10px] h-5">{member.role}</Badge>
                                                                    <span className="text-xs text-slate-500 flex items-center gap-1"><Store className="w-3 h-3" /> {member.access}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {member.role !== 'Owner' && (
                                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </TabsContent>

                    </div>
                </Tabs>

            </div>
        </div>
    );
}
