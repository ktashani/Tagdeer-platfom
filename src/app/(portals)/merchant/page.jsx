export default function MerchantDashboard() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Welcome back, Starbucks</h1>
                    <p className="text-neutral-500 mt-1">Here's what's happening with your stores today.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium shadow-sm">
                        View Stores
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm shadow-blue-600/20">
                        Create Campaign
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Stat Card 1 */}
                <div className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            </div>
                            <h3 className="font-medium text-neutral-600">Profile Views</h3>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-neutral-900">4,285</div>
                    <div className="mt-2 flex items-center text-sm font-medium text-emerald-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                        24% vs last week
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                            </div>
                            <h3 className="font-medium text-neutral-600">Coupons Redeemed</h3>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-neutral-900">142</div>
                    <div className="mt-2 flex items-center text-sm font-medium text-emerald-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                        8% vs last week
                    </div>
                </div>

                {/* Stat Card 3 */}
                <div className="bg-white border border-neutral-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <h3 className="font-medium text-neutral-600">Active Offers</h3>
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-neutral-900">3</div>
                    <div className="mt-2 flex items-center text-sm font-medium text-neutral-500">
                        2 expiring this week
                    </div>
                </div>

            </div>

            {/* Onboarding / Tips Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">

                <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <span className="bg-white/20 text-blue-50 text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full mb-4 inline-block">Pro Tip</span>
                        <h2 className="text-2xl font-bold mb-2">Boost your visibility during Ramadan</h2>
                        <p className="text-blue-100 mb-6 max-w-md">Stores that run exclusive Ramadan offers see an average of 3x more foot traffic. Create a targeted campaign today.</p>
                        <button className="bg-white text-blue-600 px-5 py-2.5 rounded-lg font-medium hover:bg-neutral-50 transition-colors shadow-sm">
                            Explore Ramadan Strategies
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 mb-1">Store Checklist</h3>
                        <p className="text-sm text-neutral-500 mb-6">Complete these steps to maximize reach.</p>

                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <div className="mt-0.5 text-emerald-500">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                </div>
                                <span className="text-sm text-neutral-500 line-through">Claim Store Profile</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-0.5 text-emerald-500">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                </div>
                                <span className="text-sm text-neutral-500 line-through">Verify Business Documents</span>
                            </li>
                            <li className="flex items-start gap-3 group cursor-pointer">
                                <div className="mt-0.5 text-neutral-300 group-hover:text-blue-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <span className="text-sm text-neutral-800 font-medium group-hover:text-blue-600 transition-colors">Upload Custom Logo</span>
                            </li>
                        </ul>
                    </div>

                    <div className="mt-6 pt-6 border-t border-neutral-100">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-500">Profile Completion</span>
                            <span className="font-medium text-emerald-600">66%</span>
                        </div>
                        <div className="w-full bg-neutral-100 rounded-full h-2 mt-2">
                            <div className="bg-emerald-500 h-2 rounded-full w-2/3"></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
