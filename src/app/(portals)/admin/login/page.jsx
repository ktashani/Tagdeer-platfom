'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAdmin } from '@/actions/adminAuth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Shield, Mail, Lock, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function AdminLogin() {
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const result = await loginAdmin(email, password)
            if (result.success) {
                const redirectPath = searchParams.get('redirect') || '/admin'
                window.location.href = redirectPath
            } else {
                setError(result.error || 'Authentication failed')
                setIsLoading(false)
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
            setIsLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-emerald-400" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold mb-2 text-center text-white">Admin Access</h1>
                <p className="text-slate-400 mb-8 text-center text-sm">Secure login for Tagdeer administrators.</p>

                {error && (
                    <Alert variant="destructive" className="mb-6 bg-red-950/50 border-red-900 text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <form className="space-y-4" onSubmit={handleLogin}>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Admin Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="admin@tagdeer.co"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors mt-4 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating...</>
                        ) : (
                            'Authenticate'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
