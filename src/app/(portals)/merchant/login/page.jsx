export default function MerchantLogin() {
    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-neutral-100">
                <h1 className="text-3xl font-bold mb-2 text-center text-neutral-900">Partner Login</h1>
                <p className="text-neutral-500 mb-8 text-center text-sm">Access your business dashboard</p>

                <form className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Business Email</label>
                        <input
                            type="email"
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="merchant@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-neutral-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="button"
                        className="w-full bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 text-white font-medium py-2.5 rounded-lg transition-all mt-4"
                    >
                        Sign In to Dashboard
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-neutral-500">
                    Interested in partnering? <a href="#" className="text-blue-600 font-medium hover:underline">Claim your store</a>
                </div>
            </div>
        </div>
    )
}
