import '../app/globals.css';
import { TagdeerProvider } from '../context/TagdeerContext';

export const metadata = {
    title: 'Tagdeer - Libyan Business Evaluation & Rewards Platform',
    description: 'Tagdeer is a business evaluation and rewards platform.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="ar" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <TagdeerProvider>
                    {children}
                </TagdeerProvider>
            </body>
        </html>
    );
}
