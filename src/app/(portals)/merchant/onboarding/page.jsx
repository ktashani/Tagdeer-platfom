"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Store, UploadCloud, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function MerchantOnboarding() {
    const router = useRouter();
    const { user, profile } = useTagdeer();

    // Mock Business Logic Rule: 1 business = free tier max. 2+ businesses = requires Pro Tier.
    // Must match the TopNav state exactly.
    const stores = [
        { id: '1', name: 'Al-Saha Clinic', location: 'Tripoli', active: true }
        // Uncomment to test Pro Tier limit redirect
        // ,{ id: '2', name: 'Al-Saha Pharmacy', location: 'Benghazi', active: false }
    ];
    const isPro = false;
    const canAccessOnboarding = stores.length < 1 || isPro;

    useEffect(() => {
        if (!canAccessOnboarding) {
            toast.error('Free Tier Limit: Upgrade to Pro to claim additional businesses.');
            router.push('/dashboard');
        }
    }, [canAccessOnboarding, router]);

    const [step, setStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedBusiness, setSelectedBusiness] = useState(null);

    const [newBusinessData, setNewBusinessData] = useState({
        name: '',
        category: '',
        region: 'Tripoli',
    });

    const [documents, setDocuments] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [claimStatus, setClaimStatus] = useState(null); // 'pending', 'approved', 'rejected'

    // Search existing businesses
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('*')
                .ilike('name', `%${searchQuery}%`)
                .limit(10);

            if (error) throw error;
            setSearchResults(data || []);

        } catch (error) {
            console.error('Error searching businesses:', error);
            toast.error('Failed to search businesses');
        } finally {
            setIsSearching(false);
        }
    };

    // Handle claiming an existing business
    const handleClaimExisting = (business) => {
        setSelectedBusiness(business);
        setStep(3); // Skip straight to document upload
    };

    // Handle file selection
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setDocuments(e.target.files[0]);
        }
    };

    // Submit final claim (MOCKED FOR UI DEVELOPMENT)
    const submitClaim = async () => {
        if (!documents && !selectedBusiness) {
            toast.error('Please upload verification documents');
            return;
        }

        setIsSubmitting(true);
        try {
            // Simulate network request delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Proceed directly to the success UI step
            setStep(4);
            setClaimStatus('pending');
            toast.success('Claim submitted successfully!');

        } catch (error) {
            console.error('Error submitting claim:', error);
            toast.error('Failed to submit claim. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Prevent rendering the form UI if they shouldn't be here (prevents screen flicker before redirect)
    if (!canAccessOnboarding) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Store className="w-8 h-8 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Checking Authorization...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Claim Your Business
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Link your physical location to unlock your merchant dashboard and start engaging with customers.
                    </p>
                </div>

                {/* Step Progress Tracker */}
                <div className="flex items-center justify-between mb-8 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 h-2">
                    <div
                        className="bg-blue-600 h-full transition-all duration-500 ease-in-out"
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                </div>

                <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">

                    {/* STEP 1: Search */}
                    {step === 1 && (
                        <div className="p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <Search className="w-5 h-5 text-blue-500" />
                                Find your business
                            </h2>

                            <form onSubmit={handleSearch} className="flex gap-3 mb-8">
                                <Input
                                    placeholder="e.g. Al-Saha Clinic Tripoli"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 text-lg py-6"
                                />
                                <Button type="submit" size="lg" disabled={isSearching} className="py-6 px-8">
                                    {isSearching ? 'Searching...' : 'Search'}
                                </Button>
                            </form>

                            {searchResults.length > 0 && (
                                <div className="space-y-3 mb-8">
                                    <p className="text-sm font-medium text-slate-500">Found {searchResults.length} results</p>
                                    {searchResults.map((business) => (
                                        <div
                                            key={business.id}
                                            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
                                            onClick={() => handleClaimExisting(business)}
                                        >
                                            <div>
                                                <h3 className="font-semibold text-lg">{business.name}</h3>
                                                <p className="text-slate-500 text-sm">{business.category} • {business.region}</p>
                                            </div>
                                            <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                                Claim This
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {searchQuery && searchResults.length === 0 && !isSearching && (
                                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mb-6">
                                    <p className="text-slate-500 mb-4">Can't find your business?</p>
                                    <Button onClick={() => setStep(2)} variant="secondary">
                                        Create New Listing
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Create New */}
                    {step === 2 && (
                        <div className="p-6 md:p-10 animate-in fade-in slide-in-from-right-8 duration-500">
                            <Button variant="ghost" className="mb-6 -ml-4" onClick={() => setStep(1)}>
                                &larr; Back to Search
                            </Button>

                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <Store className="w-5 h-5 text-indigo-500" />
                                Add new business
                            </h2>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <Label>Business Name</Label>
                                    <Input
                                        placeholder="Exact legal name"
                                        value={newBusinessData.name}
                                        onChange={(e) => setNewBusinessData({ ...newBusinessData, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <select
                                            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={newBusinessData.category}
                                            onChange={(e) => setNewBusinessData({ ...newBusinessData, category: e.target.value })}
                                        >
                                            <option value="">Select...</option>
                                            <option value="Restaurant">Restaurant & Cafe</option>
                                            <option value="Healthcare">Healthcare</option>
                                            <option value="Retail">Retail</option>
                                            <option value="Services">Services</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Region</Label>
                                        <select
                                            className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={newBusinessData.region}
                                            onChange={(e) => setNewBusinessData({ ...newBusinessData, region: e.target.value })}
                                        >
                                            <option value="Tripoli">Tripoli</option>
                                            <option value="Benghazi">Benghazi</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 rounded-lg flex gap-3 text-amber-800 dark:text-amber-400 mt-6">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <p className="text-sm">
                                        <strong>Anti-Fraud Notice:</strong> All new listings are checked against our database. Duplicate names or locations to bypass poor ratings will be permanently banned.
                                    </p>
                                </div>

                                <Button
                                    className="w-full mt-6"
                                    size="lg"
                                    disabled={!newBusinessData.name || !newBusinessData.category}
                                    onClick={() => setStep(3)}
                                >
                                    Continue to Verification
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Verification Wall */}
                    {step === 3 && (
                        <div className="p-6 md:p-10 animate-in fade-in zoom-in-95 duration-500">
                            <Button variant="ghost" className="mb-6 -ml-4" onClick={() => setStep(selectedBusiness ? 1 : 2)}>
                                &larr; Back
                            </Button>

                            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-blue-500" />
                                The Verification Wall
                            </h2>
                            <p className="text-slate-500 mb-8">
                                Upload legal proof (Commercial License, Tax ID, or Storefront Photo with you) to prove ownership of <strong>{selectedBusiness?.name || newBusinessData.name}</strong>.
                            </p>

                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-10 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileChange}
                                    accept="image/*,.pdf"
                                />
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <UploadCloud className="w-8 h-8" />
                                </div>
                                <h3 className="font-semibold text-lg mb-1">
                                    {documents ? documents.name : 'Click to upload document'}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {documents ? 'Document selected. Ready to submit.' : 'PDF, JPG, PNG up to 10MB'}
                                </p>
                            </div>

                            <Button
                                className="w-full mt-8"
                                size="lg"
                                disabled={!documents || isSubmitting}
                                onClick={submitClaim}
                            >
                                {isSubmitting ? 'Submitting Claim...' : 'Submit Claim for Review'}
                            </Button>
                        </div>
                    )}

                    {/* STEP 4: Success / Tracker */}
                    {step === 4 && (
                        <div className="p-10 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Clock className="w-10 h-10" />
                            </div>

                            <h2 className="text-2xl font-bold mb-3">Pending Admin Approval</h2>
                            <p className="text-slate-500 mb-8 max-w-md mx-auto">
                                Your claim for <strong>{selectedBusiness?.name || newBusinessData.name}</strong> has been submitted. Our team will review your documents within 24-48 hours.
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 mb-8 text-left">
                                <h3 className="font-semibold mb-4 text-slate-700 dark:text-slate-300">Free Tier Limits</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Businesses Claimed</span>
                                    <span className="font-bold">1 / 1 (Max limit reached)</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-3">
                                    <div className="bg-blue-600 h-full rounded-full w-full"></div>
                                </div>
                            </div>

                            <Button
                                onClick={() => router.push('/merchant')}
                                className="w-full"
                                variant="outline"
                            >
                                Go to Merchant Dashboard
                            </Button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
