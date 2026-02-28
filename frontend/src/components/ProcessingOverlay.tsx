"use client";

import React, { useEffect, useState } from 'react';

type Phase = 'IDLE' | 'READING' | 'UNDERSTANDING' | 'CALCULATING' | 'SYNCING' | 'DONE';

interface ProcessingOverlayProps {
    phase: Phase;
    visible: boolean;
    detailText?: string;
}

const STEPS: { phase: Phase; icon: string; label: string }[] = [
    { phase: 'READING', icon: '📄', label: 'Reading your statement…' },
    { phase: 'UNDERSTANDING', icon: '🧠', label: 'Understanding your portfolio…' },
    { phase: 'CALCULATING', icon: '📊', label: 'Calculating returns…' },
    { phase: 'SYNCING', icon: '🔄', label: 'Loading market data…' },
];

function getPhaseIndex(phase: Phase): number {
    if (phase === 'READING') return 0;
    if (phase === 'UNDERSTANDING') return 1;
    if (phase === 'CALCULATING') return 2;
    if (phase === 'SYNCING') return 3;
    if (phase === 'DONE') return 4;
    return -1;
}

export default function ProcessingOverlay({ phase, visible, detailText }: ProcessingOverlayProps) {
    const [show, setShow] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        if (visible) {
            setShow(true);
            setFadeOut(false);
        } else if (show) {
            setFadeOut(true);
            const timer = setTimeout(() => {
                setShow(false);
                setFadeOut(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [visible, show]);

    if (!show) return null;

    const currentIndex = getPhaseIndex(phase);
    const isDone = phase === 'DONE';
    const isSyncing = phase === 'SYNCING';

    // Progress ring calculation
    const circumference = 2 * Math.PI * 54; // radius=54
    const progressPercent = isDone ? 100 : isSyncing ? 80 : ((currentIndex + 1) / 4) * 85;
    const dashOffset = circumference - (progressPercent / 100) * circumference;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
        >
            {/* Frosted glass backdrop */}
            <div className="absolute inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xl" />

            {/* Shimmer background */}
            <div className="absolute inset-0 processing-shimmer opacity-20 pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-10 px-6">
                {/* Progress Ring */}
                <div className="relative w-36 h-36">
                    {/* Glow behind the ring */}
                    <div className={`absolute inset-0 rounded-full ${isDone ? 'bg-emerald-500/20' : 'bg-indigo-500/20'} blur-2xl processing-pulse-ring transition-colors duration-700`} />

                    <svg className={`w-36 h-36 ${!isDone ? 'animate-spin' : '-rotate-90'}`} viewBox="0 0 120 120">
                        {/* Background track */}
                        <circle
                            cx="60" cy="60" r="54"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-white/10"
                        />
                        {/* Progress arc */}
                        <circle
                            cx="60" cy="60" r="54"
                            fill="none"
                            strokeWidth="4"
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-out ${isDone ? 'text-emerald-400' : 'text-indigo-400'}`}
                            stroke="currentColor"
                            strokeDasharray={circumference}
                            strokeDashoffset={!isDone ? circumference * 0.25 : dashOffset}
                        />
                    </svg>

                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {isDone ? (
                            <span className="text-5xl processing-fade-in-up" key="done">✓</span>
                        ) : (
                            <span className="text-4xl processing-fade-in-up" key={phase}>
                                {STEPS[currentIndex]?.icon || '📄'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Phase label */}
                <div className="text-center min-h-[3rem]">
                    {isDone ? (
                        <p className="text-xl font-semibold text-emerald-400 processing-fade-in-up" key="done-text">
                            Done! Loading your dashboard…
                        </p>
                    ) : (
                        <div className="flex flex-col items-center">
                            <p className="text-xl font-semibold text-white processing-fade-in-up" key={phase}>
                                {STEPS[currentIndex]?.label || 'Processing…'}
                            </p>
                            {detailText && phase === 'SYNCING' && (
                                <p className="text-sm text-indigo-200/80 mt-2 font-medium tracking-wide animate-pulse">
                                    {detailText}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Step dots */}
                <div className="flex items-center gap-3">
                    {STEPS.map((step, i) => {
                        const isActive = i === currentIndex && !isDone;
                        const isComplete = i < currentIndex || isDone;
                        return (
                            <div key={step.phase} className="flex items-center gap-3">
                                <div
                                    className={`w-3 h-3 rounded-full transition-all duration-500 ${isComplete
                                        ? 'bg-emerald-400 scale-100'
                                        : isActive
                                            ? 'bg-indigo-400 scale-125 processing-pulse-ring'
                                            : 'bg-white/20 scale-100'
                                        }`}
                                />
                                {i < STEPS.length - 1 && (
                                    <div
                                        className={`w-8 h-0.5 transition-all duration-500 ${isComplete ? 'bg-emerald-400/50' : 'bg-white/10'
                                            }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
