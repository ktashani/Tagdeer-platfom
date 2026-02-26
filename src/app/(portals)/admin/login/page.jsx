export default function AdminLogin() {
    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
                <h1 className="text-3xl font-bold mb-6 text-center text-white">Admin Access</h1>
                <p className="text-slate-400 mb-8 text-center text-sm">Secure login for Tagdeer administrators.</p>

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Admin Email</label>
                        <input
                            type="email"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            placeholder="admin@tagdeer.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="button"
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-lg transition-colors mt-4"
                    >
                        Authenticate
                    </button>
                </form>
            </div>
        </div>
    )
}
