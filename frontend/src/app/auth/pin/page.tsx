"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PinForm from "@/components/auth/PinForm";

function PinPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // params: mode=verify|set|remove & userId=xxx & name=xxx
    const mode = (searchParams.get("mode") as "verify" | "set" | "remove") || "verify";
    const userId = searchParams.get("userId");
    const name = searchParams.get("name") || "User";

    useEffect(() => {
        if (!userId) {
            router.push("/");
        }
    }, [userId, router]);

    if (!userId) {
        return null;
    }

    const handleSuccess = (id: string) => {
        if (mode === "verify") {
            localStorage.setItem("mfa_user_id", id);
            router.push("/dashboard");
        } else {
            // After set or remove, just go back
            router.push("/dashboard");
        }
    };

    const handleCancel = () => {
        router.back();
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[160px] opacity-60" />
            </div>

            <div className="animate-in fade-in zoom-in-95 duration-500 ease-out flex flex-col items-center">
                <PinForm
                    mode={mode}
                    user={{ id: userId, name }}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                />

                <p className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center opacity-60">
                    Encrypted Locally <span className="mx-2">•</span> Secured by SHA-256
                </p>
            </div>
        </main>
    );
}

export default function PinPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-slate-400 animate-pulse">Loading secure session...</p></div>}>
            <PinPageContent />
        </Suspense>
    );
}
