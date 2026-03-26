'use client';

/**
 * Skeleton primitives for progressive loading
 * Provides shimmer-animated placeholders that match content layout
 */

/** Base shimmer block */
export function Skeleton({ className = '', style = {} }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 bg-[length:200%_100%] ${className}`}
            style={style}
        />
    );
}

/** Dark-themed shimmer for admin portal */
export function SkeletonDark({ className = '' }) {
    return (
        <div className={`animate-pulse rounded-md bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%] ${className}`} />
    );
}

/** Skeleton table rows (for admin tables) */
export function SkeletonTable({ rows = 5, cols = 4, variant = 'dark' }) {
    const Skel = variant === 'dark' ? SkeletonDark : Skeleton;
    return (
        <div className="space-y-3 p-4">
            {/* Header row */}
            <div className="flex gap-4 pb-3 border-b border-slate-700/30 dark:border-slate-700/30">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skel key={`h-${i}`} className={`h-4 ${i === 0 ? 'w-1/3' : 'w-1/6'}`} />
                ))}
            </div>
            {/* Data rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4 py-3">
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skel key={`${r}-${c}`} className={`h-4 ${c === 0 ? 'w-1/3' : 'w-1/6'}`} />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Skeleton card grid (for discover page, campaign cards) */
export function SkeletonCardGrid({ count = 6, variant = 'light' }) {
    const Skel = variant === 'dark' ? SkeletonDark : Skeleton;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`rounded-2xl p-5 space-y-3 ${variant === 'dark' ? 'bg-slate-800/30 border border-slate-700/50' : 'bg-white border border-slate-200 shadow-sm'}`}>
                    <Skel className="h-5 w-2/3" />
                    <Skel className="h-4 w-1/2" />
                    <div className="flex gap-2 mt-3">
                        <Skel className="h-8 w-16 rounded-full" />
                        <Skel className="h-8 w-16 rounded-full" />
                    </div>
                    <Skel className="h-3 w-full mt-2" />
                    <Skel className="h-3 w-4/5" />
                </div>
            ))}
        </div>
    );
}

/** Skeleton list items (for inbox, requests) */
export function SkeletonList({ count = 5, variant = 'dark' }) {
    const Skel = variant === 'dark' ? SkeletonDark : Skeleton;
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`flex items-center gap-3 p-4 rounded-xl ${variant === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                    <Skel className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skel className="h-4 w-1/3" />
                        <Skel className="h-3 w-2/3" />
                    </div>
                    <Skel className="h-6 w-16 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/** Skeleton stats cards (for dashboard headers) */
export function SkeletonStats({ count = 4, variant = 'dark' }) {
    const Skel = variant === 'dark' ? SkeletonDark : Skeleton;
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={`p-6 rounded-2xl ${variant === 'dark' ? 'bg-slate-800/50 border border-slate-700' : 'bg-white border border-slate-200 shadow-sm'}`}>
                    <div className="flex justify-between mb-4">
                        <Skel className="h-4 w-24" />
                        <Skel className="h-5 w-5 rounded" />
                    </div>
                    <Skel className="h-8 w-20" />
                </div>
            ))}
        </div>
    );
}
