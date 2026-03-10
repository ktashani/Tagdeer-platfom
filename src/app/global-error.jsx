'use client';

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="ar" dir="rtl">
            <body style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                fontFamily: 'system-ui, sans-serif',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                textAlign: 'center',
                padding: '2rem',
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>
                        حدث خطأ غير متوقع
                    </h1>
                    <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '2rem' }}>
                        نعتذر عن هذا الخلل. فريق تقدير تم إبلاغه تلقائياً.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: 'pointer',
                        }}
                    >
                        حاول مرة أخرى
                    </button>
                </div>
            </body>
        </html>
    );
}
