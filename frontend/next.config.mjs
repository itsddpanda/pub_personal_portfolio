/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    async rewrites() {
        // Use BACKEND_URL from environment for local dev, fallback to Docker service name
        const backendUrl = process.env.BACKEND_URL || 'http://backend:8001';
        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
        ]
    },
};

export default nextConfig;