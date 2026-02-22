"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./UserMenu";
import { ThemeToggle } from "./ThemeToggle";

export default function Navbar() {
    const pathname = usePathname();

    // Highlight logic helpers
    const isActive = (path: string) => pathname === path;

    return (
        <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 sticky top-0 z-50 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/" className="font-bold text-xl text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all">
                                MFA
                            </Link>
                        </div>

                        {/* Navigation Links */}
                        <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                            <Link
                                href="/dashboard"
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${isActive("/dashboard")
                                    ? "border-indigo-500 text-indigo-600 dark:text-white"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200"
                                    }`}
                            >
                                Dashboard
                            </Link>
                            <Link
                                href="/upload"
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${isActive("/upload")
                                    ? "border-indigo-500 text-indigo-600 dark:text-white"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200"
                                    }`}
                            >
                                Upload CAS
                            </Link>
                        </div>
                    </div>

                    {/* User Menu & Theme Toggle */}
                    <div className="flex items-center space-x-4">
                        <ThemeToggle />
                        <UserMenu />
                    </div>
                </div>
            </div>
        </nav>
    );
}
