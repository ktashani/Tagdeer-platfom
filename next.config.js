/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
        }];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'pub-2e291b2cd42547b5957eac5e913acd6e.r2.dev',
            },
        ],
    },
}

export default nextConfig;
