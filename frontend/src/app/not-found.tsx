import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="text-center max-w-md">
                <p className="text-6xl font-bold text-slate-200 dark:text-slate-800 mb-2">404</p>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-3">Page Not Found</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link
                        href="/"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Go Home
                    </Link>
                    <Link
                        href="/dashboard"
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-white/10"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
