"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadCAS } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Eye, EyeOff } from 'lucide-react';

import { useToast } from '@/components/ui/Toast';

export default function UploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const toast = useToast();

    // ... (handleFileChange remains same) ...

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !password) {
            toast.error("Please select a file and enter the password.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const existingUserId = localStorage.getItem('mfa_user_id') || undefined;
            const result = await uploadCAS(file, password, existingUserId);

            if (result.status === 'success') {
                if (result.user_id) {
                    localStorage.setItem('mfa_user_id', result.user_id);
                }
                toast.success("CAS uploaded and analyzed successfully!");
                router.push('/dashboard');
            } else if (result.status === 'warning') {
                toast.error(`Import Warning: ${result.message}`);
                setError(`Warning: ${result.message}`);
            } else if (result.status === 'error') {
                toast.error(result.message);
                setError(result.message);
            }
        } catch (err: any) {
            const msg = err.message || "Upload failed";
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
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
                        disabled={!file || !password}
                    >
                        Upload & Analyze
                    </Button>

                </form>
            </Card>
        </div>
    );
}
