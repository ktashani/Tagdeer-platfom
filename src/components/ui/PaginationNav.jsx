'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable Pagination component
 * 
 * Props:
 *  - currentPage: number (1-indexed)
 *  - totalItems: number
 *  - pageSize: number (default 10)
 *  - onPageChange: (page: number) => void
 *  - variant: 'dark' | 'light' (default 'dark')
 */
export default function Pagination({ currentPage, totalItems, pageSize = 10, onPageChange, variant = 'dark' }) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    if (totalPages <= 1) return null;

    const isDark = variant === 'dark';

    return (
        <div className="flex items-center justify-between px-4 py-3 mt-4">
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
            </span>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                            ? 'hover:bg-slate-700 text-slate-300'
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                        // Show first, last, current, and neighbors
                        if (p === 1 || p === totalPages) return true;
                        if (Math.abs(p - currentPage) <= 1) return true;
                        return false;
                    })
                    .reduce((acc, p, idx, arr) => {
                        // Insert ellipsis between non-consecutive pages
                        if (idx > 0 && p - arr[idx - 1] > 1) {
                            acc.push('...' + p);
                        }
                        acc.push(p);
                        return acc;
                    }, [])
                    .map((p) => {
                        if (typeof p === 'string') {
                            return (
                                <span key={p} className={`px-1.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    …
                                </span>
                            );
                        }
                        return (
                            <button
                                key={p}
                                onClick={() => onPageChange(p)}
                                className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${p === currentPage
                                        ? isDark
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-blue-50 text-blue-600 border border-blue-200'
                                        : isDark
                                            ? 'text-slate-400 hover:bg-slate-700'
                                            : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                {p}
                            </button>
                        );
                    })
                }

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isDark
                            ? 'hover:bg-slate-700 text-slate-300'
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                    aria-label="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

/**
 * Utility hook for pagination state
 * Usage: const { page, setPage, paginated, totalPages } = usePagination(items, 10);
 */
export function usePagination(items = [], pageSize = 10) {
    const { useState } = require('react');
    const [page, setPage] = useState(1);

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    // Clamp page to valid range
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const paginated = items.slice(start, start + pageSize);

    return {
        page: safePage,
        setPage,
        paginated,
        totalPages,
        totalItems: items.length,
        pageSize,
    };
}
