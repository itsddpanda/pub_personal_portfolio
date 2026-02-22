import React from 'react';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface CardProps {
    title?: string;
    href?: string;
    children: React.ReactNode;
    className?: string;
}

export function Card({ title, href, children, className = '' }: CardProps) {
    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm dark:shadow-xl p-6 transition-all hover:shadow-md dark:hover:bg-slate-900/80 ${className}`}>
            {title && (
                href ? (
                    <Link href={href} className="group flex items-center justify-between mb-4 hover:bg-slate-50 dark:hover:bg-white/5 -mx-2 px-2 py-1 rounded transition-colors duration-200">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200">
                            {title}
                        </h3>
                        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200" />
                    </Link>
                ) : (
                    <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-200">{title}</h3>
                )
            )}
            {children}
        </div>
    );
}
