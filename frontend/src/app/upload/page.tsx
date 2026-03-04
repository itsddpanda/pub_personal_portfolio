"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadCAS, getSyncStatus } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Eye, EyeOff } from 'lucide-react';
import ProcessingOverlay from '@/components/ProcessingOverlay';

import { useToast } from '@/components/ui/Toast';

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [phase, setPhase] = useState<'IDLE' | 'READING' | 'UNDERSTANDING' | 'CALCULATING' | 'SYNCING' | 'DONE'>('IDLE');
    const [syncProgress, setSyncProgress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const toast = useToast();

    // ... (handleFileChange remains same) ...

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const processUpload = async (ignoreActiveUser: boolean = false) => {
        if (!file || !password) {
            toast.error("Please select a file and enter the password.");
            return;
        }

        setIsLoading(true);
        setPhase('READING');
        setError(null);

        try {
            const existingUserId = ignoreActiveUser ? undefined : (localStorage.getItem('mfa_user_id') || undefined);

            setPhase('UNDERSTANDING');
            const result = await uploadCAS(file, password, existingUserId);

            if (result.status === 'success') {
                if (result.user_id) {
                    localStorage.setItem('mfa_user_id', result.user_id);
                }

                // Phase 3: Wait for NAV sync
                setPhase('SYNCING');

                // Poll for up to 30 seconds
                let attempts = 0;
                while (attempts < 15) {
                    try {
                        const syncStatus = await getSyncStatus();
                        if (syncStatus.progress) {
                            setSyncProgress(syncStatus.progress);
                        }
                        if (!syncStatus.is_syncing) {
                            break;
                        }
                    } catch (e) {
                        // ignore polling errors
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempts++;
                }

                const successMsgs = [];
                successMsgs.push(`Success: Imported ${result.new_transactions || 0} new transactions, skipped ${result.skipped_transactions || 0} duplicates.`);

                if (result.reconciled_opening_balances && result.reconciled_opening_balances > 0) {
                    successMsgs.push(`Full history imported! Invested value updated for ${result.reconciled_opening_balances} scheme${result.reconciled_opening_balances > 1 ? 's' : ''}.`);
                }

                // Instead of displaying them here where they get immediately destroyed by the hard navigation,
                // we stash them in sessionStorage for the newly loaded dashboard.
                sessionStorage.setItem('upload_success_messages', JSON.stringify(successMsgs));


                // Show "Done!" animation before redirecting
                setPhase('DONE');
                await new Promise(resolve => setTimeout(resolve, 800));
                // Force a full reload to the dashboard to update the Navbar state
                window.location.href = '/dashboard';
            } else if (result.status === 'warning' && result.code === 'PAN_MISMATCH') {
                const proceed = window.confirm(`CAS belongs to new user (${result.detected_name}). Create & switch?`);
                if (proceed) {
                    await processUpload(true);
                    return;
                } else {
                    toast.error("Upload cancelled.");
                    setError("Upload cancelled due to PAN mismatch.");
                    setIsLoading(false);
                    setPhase('IDLE');
                }
            } else if (result.status === 'warning') {
                toast.error(`Import Warning: ${result.message}`);
                setError(`Warning: ${result.message}`);
                setIsLoading(false);
                setPhase('IDLE');
            } else if (result.status === 'error') {
                toast.error(result.message);
                setError(result.message);
                setIsLoading(false);
                setPhase('IDLE');
            }
        } catch (err: any) {
            const msg = err.message || "Upload failed";
            setError(msg);
            toast.error(msg);
            setIsLoading(false);
            setPhase('IDLE');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await processUpload(false);
    };

    return (
        <>
            <ProcessingOverlay phase={phase} visible={phase !== 'IDLE'} detailText={syncProgress && syncProgress !== '0/0' ? `${syncProgress} schemes loaded` : undefined} />
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-transparent">
                <Card className="w-full max-w-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl" title="Upload CAS PDF">
                    <form onSubmit={handleSubmit} className="space-y-5">

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                                CAS PDF File
                            </label>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-slate-600 dark:text-slate-400
                file:mr-4 file:py-2.5 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 dark:file:bg-indigo-500/10 file:text-indigo-600 dark:file:text-indigo-400
                hover:file:bg-indigo-100 dark:hover:file:bg-indigo-500/20 transition-colors file:cursor-pointer
                border border-slate-200 dark:border-white/5 rounded-xl p-1 bg-slate-50 dark:bg-slate-950/50"
                            />
                            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                Download your Detailed Consolidated Account Statement from CAMS or KFintech.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                                PDF Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            processUpload(false);
                                        }
                                    }}
                                    placeholder="Enter PDF password"
                                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner pr-10 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff size={18} />
                                    ) : (
                                        <Eye size={18} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-xl">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="w-full justify-center text-base py-3"
                            disabled={!file || !password || isLoading}
                        >
                            {phase === 'IDLE' ? "Upload & Analyze" :
                                phase === 'READING' ? "Reading statement..." :
                                    phase === 'UNDERSTANDING' ? "Understanding your statement..." :
                                        "Calculating portfolio..."}
                        </Button>

                    </form>

                    <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4 mt-6 text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                        <span className="text-xl inline-block mb-2">💡</span><br />
                        For accurate invested value, download a <strong className="text-indigo-600 dark:text-indigo-200">Detailed CAS from inception</strong> (not just the last year) from <a href="https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement" target="_blank" rel="noopener noreferrer" className="underline decoration-indigo-300 dark:decoration-indigo-500/30 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors">mycams.com</a> or <a href="https://mfs.kfintech.com/investor/General/ConsolidatedAccountStatement" target="_blank" rel="noopener noreferrer" className="underline decoration-indigo-300 dark:decoration-indigo-500/30 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors">kfintech.com</a>.
                    </div>
                </Card>
            </div>
        </>
    );
}
