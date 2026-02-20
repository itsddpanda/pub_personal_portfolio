"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadCAS, getSyncStatus } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Eye, EyeOff } from 'lucide-react';

import { useToast } from '@/components/ui/Toast';

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [phase, setPhase] = useState<'IDLE' | 'READING' | 'UNDERSTANDING' | 'CALCULATING'>('IDLE');
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
                setPhase('CALCULATING');

                // Poll for up to 30 seconds
                let attempts = 0;
                while (attempts < 15) {
                    try {
                        const syncStatus = await getSyncStatus();
                        if (!syncStatus.is_syncing) {
                            break;
                        }
                    } catch (e) {
                        // ignore polling errors
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempts++;
                }

                toast.success("CAS uploaded and analyzed successfully!");
                if (result.reconciled_opening_balances && result.reconciled_opening_balances > 0) {
                    toast.success(`Full history imported! Invested value updated for ${result.reconciled_opening_balances} scheme${result.reconciled_opening_balances > 1 ? 's' : ''}.`);
                }
                // Force a full reload to the dashboard to update the Navbar state
                window.location.href = '/dashboard';
            } else if (result.status === 'warning' && result.code === 'PAN_MISMATCH') {
                const proceed = window.confirm(`CAS belongs to new user (${result.detected_name}). Create & switch?`);
                if (proceed) {
                    await processUpload(true);
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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md" title="Upload CAS PDF">
                <form onSubmit={handleSubmit} className="space-y-4">

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            CAS PDF File
                        </label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Download your Detailed Consolidated Account Statement from CAMS or KFintech.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            PDF Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter PDF password"
                                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
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
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        isLoading={isLoading}
                        className="w-full justify-center"
                        disabled={!file || !password || isLoading}
                    >
                        {phase === 'IDLE' ? "Upload & Analyze" :
                            phase === 'READING' ? "Reading statement..." :
                                phase === 'UNDERSTANDING' ? "Understanding your statement..." :
                                    "Calculating portfolio..."}
                    </Button>

                </form>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 text-sm text-blue-700">
                    💡 For accurate invested value, download a <strong>Detailed CAS from inception</strong> (not just the last year) from <a href="https://www.camsonline.com" target="_blank" rel="noopener noreferrer" className="underline">mycams.com</a> or <a href="https://www.kfintech.com" target="_blank" rel="noopener noreferrer" className="underline">kfintech.com</a>.
                </div>
            </Card>
        </div>
    );
}
