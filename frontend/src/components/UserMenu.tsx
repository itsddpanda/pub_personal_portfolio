"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Lock, Unlock, Settings as SettingsIcon } from "lucide-react";

interface User {
    id: string;
    name: string;
    is_pin_set: boolean;
}

export default function UserMenu() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [activeUserId, setActiveUserId] = useState<string | null>(null);
    const [activeUserName, setActiveUserName] = useState<string>("");
    const [isOpen, setIsOpen] = useState(false);

    const API_BASE = "/api";

    useEffect(() => {
        // 1. Get Active User from LocalStorage
        const storedId = localStorage.getItem("mfa_user_id");
        setActiveUserId(storedId);

        // 2. Fetch All Users
        fetch(`${API_BASE}/users`)
            .then((res) => res.json())
            .then((data) => {
                setUsers(data);
                if (storedId) {
                    const u = data.find((user: User) => user.id === storedId);
                    if (u) {
                        setActiveUserName(u.name);
                    } else {
                        console.warn("Stale user session detected. Logging out.");
                        localStorage.removeItem("mfa_user_id");
                        setActiveUserId(null);
                        if (window.location.pathname !== '/upload' && window.location.pathname !== '/') {
                            window.location.href = '/upload';
                        }
                    }
                }
            })
            .catch((err) => console.error("Failed to fetch users", err));
    }, []);

    const handleSwitchUser = async (user: User) => {
        if (user.id === activeUserId) {
            setIsOpen(false);
            return;
        }

        if (user.is_pin_set) {
            router.push(`/auth/pin?mode=verify&userId=${user.id}&name=${encodeURIComponent(user.name)}`);
            setIsOpen(false);
        } else {
            performSwitch(user.id);
        }
    };

    const performSwitch = (userId: string) => {
        localStorage.setItem("mfa_user_id", userId);
        window.location.href = "/dashboard"; // Force reload to refresh state
    };

    const handleLogout = () => {
        localStorage.removeItem("mfa_user_id");
        window.location.href = "/";
    };

    return (
        <div className="relative">
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none"
            >
                <div className="w-8 h-8 md:w-9 md:h-9 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20">
                    <UserIcon size={16} />
                </div>
                <span className="hidden sm:inline-block font-bold">{activeUserId && users.find(u => u.id === activeUserId) ? activeUserName : "Login"}</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-2xl py-3 z-20 border border-slate-200 dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-white/5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-5 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                            {users.length > 0 ? "Switch Profile" : "Upload CAS to create profile"}
                        </div>

                        <div className="max-h-48 overflow-y-auto mb-2 thin-scrollbar">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSwitchUser(user)}
                                    className={`w-full text-left px-5 py-3 text-sm flex items-center justify-between transition-all ${user.id === activeUserId
                                        ? "bg-indigo-50/50 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold"
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${user.id === activeUserId ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                        <span className="truncate max-w-[140px]">{user.name}</span>
                                    </div>
                                    {user.is_pin_set && <Lock size={12} className="text-slate-400 dark:text-slate-600" />}
                                </button>
                            ))}
                        </div>

                        {activeUserId && (
                            <>
                                <div className="border-t border-slate-100 dark:border-white/5 my-2 mx-4" />

                                <div className="px-5 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                                    Security & Rules
                                </div>

                                <button
                                    onClick={() => {
                                        router.push(`/auth/pin?mode=set&userId=${activeUserId}&name=${encodeURIComponent(activeUserName)}`);
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white flex items-center transition-colors group"
                                >
                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg mr-3 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                                        <Lock size={14} />
                                    </div>
                                    <span className="font-medium">Update Secure PIN</span>
                                </button>

                                {users.find(u => u.id === activeUserId)?.is_pin_set && (
                                    <button
                                        onClick={() => {
                                            router.push(`/auth/pin?mode=remove&userId=${activeUserId}&name=${encodeURIComponent(activeUserName)}`);
                                            setIsOpen(false);
                                        }}
                                        className="w-full text-left px-5 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-rose-500/5 hover:text-rose-500 dark:hover:text-rose-400 flex items-center transition-colors group"
                                    >
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg mr-3 group-hover:bg-rose-500/10 transition-colors">
                                            <Unlock size={14} />
                                        </div>
                                        <span className="font-medium">Disable Passcode</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        router.push("/preferences");
                                        setIsOpen(false);
                                    }}
                                    className="w-full text-left px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-500/5 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center transition-colors group"
                                >
                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg mr-3 group-hover:bg-indigo-500/10 transition-colors">
                                        <SettingsIcon size={14} />
                                    </div>
                                    <span className="font-medium">Evaluation Rules</span>
                                </button>

                                <div className="border-t border-slate-100 dark:border-white/5 my-2 mx-4" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-5 py-2.5 text-sm text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 hover:shadow-inner flex items-center transition-colors font-bold"
                                >
                                    <LogOut size={14} className="mr-3" />
                                    Sign Out
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

