"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import AnalysisPreferencesForm from "@/components/preferences/AnalysisPreferencesForm";

export default function PreferencesPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const storedId = localStorage.getItem("mfa_user_id");
        if (!storedId) {
            router.push("/");
            return;
        }
        setUserId(storedId);
    }, [router]);

    if (!userId) return null;

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 md:py-24 px-4 sm:px-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[128px]" />
            </div>

            <div className="max-w-4xl mx-auto space-y-10">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="group flex items-center text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                    >
                        <ChevronLeft className="mr-1 group-hover:-translate-x-1 transition-transform" size={18} />
                        Back to Dashboard
                    </button>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AnalysisPreferencesForm userId={userId} />
                </div>

                <p className="text-center text-xs text-slate-400 font-medium">
                    Changes here affect all fund intelligence calculations across your portfolio.
                </p>
            </div>
        </main>
    );
}
