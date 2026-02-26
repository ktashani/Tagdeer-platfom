export default function AdminDashboard() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">System Overview</h1>
                    <p className="text-slate-400 mt-1">Monitor Tagdeer platform health and metrics.</p>
                </div>
                <div className="flex items-center space-x-3 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-300">All Systems Operational</span>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Stat Card 1 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Total Users</h3>
                        <svg className="w-5 h-5 text-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </div>
                    <div className="text-3xl font-bold text-white">12,450</div>
                    <div className="mt-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 inline-block px-2 py-1 rounded-md">+12% this month</div>
                </div>

                {/* Stat Card 2 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Active Merchants</h3>
                        <svg className="w-5 h-5 text-blue-400 opacity-80 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </div>
                    <div className="text-3xl font-bold text-white">842</div>
                    <div className="mt-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 inline-block px-2 py-1 rounded-md">+5% this month</div>
                </div>

                {/* Stat Card 3 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Live Campaigns</h3>
                        <svg className="w-5 h-5 text-purple-400 opacity-80 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                    </div>
                    <div className="text-3xl font-bold text-white">1,204</div>
                    <div className="mt-2 text-xs font-medium text-slate-400 bg-slate-700/50 inline-block px-2 py-1 rounded-md">Coupons allocated</div>
                </div>

                {/* Stat Card 4 */}
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Pending Actions</h3>
                        <svg className="w-5 h-5 text-amber-400 opacity-80 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <div className="text-3xl font-bold text-white">28</div>
                    <div className="mt-2 text-xs font-medium text-amber-400 bg-amber-400/10 inline-block px-2 py-1 rounded-md">Action required</div>
                </div>

            </div>

            {/* Recent Activity Table */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden mt-8">
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-white">Recent Store Claims</h2>
                    <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">View All</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Business Name</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Requested By</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Date</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Status</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">Starbucks - Riyadh Front</td>
                                <td className="px-6 py-4">ahmed@example.com</td>
                                <td className="px-6 py-4">Today, 10:42 AM</td>
                                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span></td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-emerald-400 hover:text-emerald-300 font-medium mr-4">Approve</button>
                                    <button className="text-slate-500 hover:text-slate-400 font-medium">Reject</button>
                                </td>
                            </tr>
                            <tr className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">Zara Menswear</td>
                                <td className="px-6 py-4">sara@zara.com</td>
                                <td className="px-6 py-4">Yesterday, 4:15 PM</td>
                                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span></td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-500 hover:text-slate-400 font-medium">Details</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
