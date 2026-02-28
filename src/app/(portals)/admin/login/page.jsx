'use client';

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAdmin } from '@/actions/adminAuth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTagdeer } from '@/context/TagdeerContext'

export default function AdminLogin() {
    const searchParams = useSearchParams()
    const { setUser } = useTagdeer()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const formData = new FormData()
            const result = await loginAdmin(username, password)
            if (result.success) {
                // If using demo bypass, sync user state for guards
                if (username === 'admin') {
                    const mockUser = {
                        username: 'admin',
                        role: 'admin',
                        full_name: 'System Admin'
                    };
                    setUser(mockUser);
                    // Manually persist to localStorage immediately
                    localStorage.setItem('tagdeer-user', JSON.stringify(mockUser));
                }

                // Redirect to intended page or admin dashboard
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
                <h1 className="text-3xl font-bold mb-6 text-center text-white">Admin Access</h1>
                <p className="text-slate-400 mb-8 text-center text-sm">Secure login for Tagdeer administrators.</p>

                {error && (
                    <Alert variant="destructive" className="mb-6 bg-red-950/50 border-red-900 text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <form className="space-y-4" onSubmit={handleLogin}>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            placeholder="admin"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors mt-4"
                    >
                        {isLoading ? 'Authenticating...' : 'Authenticate'}
                    </button>
                    <p className="text-xs text-center text-slate-500 mt-4">For demo: use admin / admin</p>
                </form>
            </div>
        </div>
    )
}
