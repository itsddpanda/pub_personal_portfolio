import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    isLoading?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    isLoading,
    className = '',
    disabled,
    ...props
}: ButtonProps) {

    const baseStyles = "px-4 py-2 flex justify-center items-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-950";

    const variants = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500 shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.25)] hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]",
        secondary: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus:ring-slate-500 border border-slate-200 dark:border-white/5",
        danger: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 focus:ring-red-500 border border-red-200 dark:border-red-500/20",
        outline: "bg-transparent border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 focus:ring-indigo-500",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading ? 'Loading...' : children}
        </button>
    );
}
