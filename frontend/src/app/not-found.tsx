import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="text-center max-w-md">
                <p className="text-6xl font-bold text-gray-200 mb-2">404</p>
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Page Not Found</h2>
                <p className="text-gray-500 text-sm mb-6">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link
                        href="/"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        Go Home
                    </Link>
                    <Link
                        href="/dashboard"
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
