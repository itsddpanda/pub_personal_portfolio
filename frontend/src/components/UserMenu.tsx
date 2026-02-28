"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Lock, Unlock } from "lucide-react";

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
    const [pinModalUser, setPinModalUser] = useState<User | null>(null);
    const [isSettingPin, setIsSettingPin] = useState(false);
    const [isRemovingPin, setIsRemovingPin] = useState(false);
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");

    const API_BASE = "/api";

    const handleSetPin = async () => {
        if (!pinModalUser || !pin || pin.length !== 4) {
            setError("PIN must be 4 digits");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/users/${pinModalUser.id}/set-pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                setPinModalUser(null);
                setIsSettingPin(false);
                setPin("");
                // Refresh user list to update lock icon
                window.location.reload();
            } else {
                const data = await res.json();
                setError(data.detail || "Failed to set PIN");
            }
        } catch (err) {
            setError("Network error");
        }
    };

    const handleRemovePin = async () => {
        if (!pinModalUser || !pin || pin.length !== 4) {
            setError("Enter your current 4-digit PIN");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/users/${pinModalUser.id}/remove-pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                setPinModalUser(null);
                setIsRemovingPin(false);
                setPin("");
                window.location.reload();
            } else {
                setError("Incorrect PIN");
            }
        } catch (err) {
            setError("Network error");
        }
    };

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
        setError("");
        setPin("");

        if (user.id === activeUserId) {
            setIsOpen(false);
            return;
        }

        if (user.is_pin_set) {
            setPinModalUser(user); // Open PIN Modal
            setIsOpen(false);
        } else {
            performSwitch(user.id);
        }
    };

    const verifyPin = async () => {
        if (!pinModalUser) return;

        try {
            const res = await fetch(`${API_BASE}/users/${pinModalUser.id}/verify-pin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                performSwitch(pinModalUser.id);
                setPinModalUser(null);
            } else {
                setError("Incorrect PIN");
            }
        } catch (err) {
            setError("Verification failed");
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

    // Close dropdown on click outside (simplified for MVP: just use overlay)

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
                <span className="hidden sm:inline-block">{activeUserId && users.find(u => u.id === activeUserId) ? activeUserName : "Login"}</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] py-2 z-20 border border-slate-200 dark:border-white/10 ring-1 ring-slate-900/5 dark:ring-white/5">
                        <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {users.length > 0 ? "Select User" : "Upload CAS to create user"}
                        </div>
                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => handleSwitchUser(user)}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${user.id === activeUserId ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                            >
                                <span className="truncate">{user.name}</span>
                                {user.is_pin_set && <Lock size={12} className="text-slate-400 dark:text-slate-500" />}
                            </button>
                        ))}

                        {activeUserId && users.find(u => u.id === activeUserId) && (
                            <>
                                <button
                                    onClick={() => {
                                        if (activeUserId) {
                                            setPinModalUser({ id: activeUserId, name: activeUserName, is_pin_set: false }); // Mock user obj for modal
                                            setIsSettingPin(true);
                                            setIsOpen(false);
                                            setPin(""); // Clear any previous PIN
                                            setError(""); // Clear any previous error
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center transition-colors"
                                >
                                    <Lock size={14} className="mr-2 text-slate-400" />
                                    Set/Update PIN
                                </button>
                                {users.find(u => u.id === activeUserId)?.is_pin_set && (
                                    <button
                                        onClick={() => {
                                            if (activeUserId) {
                                                setPinModalUser({ id: activeUserId, name: activeUserName, is_pin_set: true });
                                                setIsRemovingPin(true);
                                                setIsOpen(false);
                                                setPin("");
                                                setError("");
                                            }
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center transition-colors"
                                    >
                                        <Unlock size={14} className="mr-2 text-slate-400" />
                                        Remove PIN
                                    </button>
                                )}
                                <div className="border-t border-slate-100 dark:border-white/10 my-1 mx-2" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-red-400 hover:bg-rose-50 dark:hover:bg-red-500/10 hover:text-rose-700 dark:hover:text-red-300 flex items-center transition-colors"
                                >
                                    <LogOut size={14} className="mr-2" />
                                    Logout
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* PIN Modal */}
            {pinModalUser && (
                <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 w-80 max-w-full">
                        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
                            {isRemovingPin ? `Remove PIN for ${pinModalUser.name}` : isSettingPin ? `Set PIN for ${pinModalUser.name}` : "Enter PIN"}
                        </h3>
                        {isRemovingPin && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Enter your current PIN to confirm removal.</p>
                        )}

                        <input
                            type="password"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-3 mb-4 text-center tracking-widest text-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (isRemovingPin ? handleRemovePin() : isSettingPin ? handleSetPin() : verifyPin())}
                            autoFocus
                            placeholder={isSettingPin ? "New 4-digit PIN" : "****"}
                        />

                        {error && <p className="text-red-500 dark:text-red-400 text-sm mb-4 px-1">{error}</p>}

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => { setPinModalUser(null); setIsSettingPin(false); setIsRemovingPin(false); setPin(""); setError(""); }}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={isRemovingPin ? handleRemovePin : isSettingPin ? handleSetPin : verifyPin}
                                className={`px-4 py-2 text-white rounded-xl text-sm font-medium transition-all shadow-lg ${isRemovingPin ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25'}`}
                            >
                                {isRemovingPin ? "Remove PIN" : isSettingPin ? "Save PIN" : "Verify"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
