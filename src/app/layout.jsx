import '../app/globals.css';
import { TagdeerProvider } from '../context/TagdeerContext';
import { ClientLayout } from './ClientLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata = {
    title: 'Tagdeer - Libyan Business Evaluation & Rewards Platform',
    description: 'Tagdeer is a business evaluation and rewards platform.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="ar" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <TagdeerProvider>
                    <ErrorBoundary>
                        <ClientLayout>
                            {children}
                        </ClientLayout>
                    </ErrorBoundary>
                </TagdeerProvider>
            </body>
        </html>
    );
}
