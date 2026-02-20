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

    const API_BASE = "http://localhost:8000/api";

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
                    if (u) setActiveUserName(u.name);
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
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
            >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <UserIcon size={16} />
                </div>
                <span>{activeUserId ? activeUserName : "Login"}</span>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-100">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
                            {users.length > 0 ? "Select User" : "No users found"}
                        </div>
                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => handleSwitchUser(user)}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-50 ${user.id === activeUserId ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                                    }`}
                            >
                                <span className="truncate">{user.name}</span>
                                {user.is_pin_set && <Lock size={12} className="text-gray-400" />}
                            </button>
                        ))}

                        {activeUserId && (
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
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                >
                                    <Lock size={14} className="mr-2" />
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
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                    >
                                        <Unlock size={14} className="mr-2" />
                                        Remove PIN
                                    </button>
                                )}
                                <div className="border-t border-gray-100 my-1" />

                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-80 max-w-full">
                        <h3 className="text-lg font-semibold mb-4">
                            {isRemovingPin ? `Remove PIN for ${pinModalUser.name}` : isSettingPin ? `Set PIN for ${pinModalUser.name}` : "Enter PIN"}
                        </h3>
                        {isRemovingPin && (
                            <p className="text-sm text-gray-500 mb-3">Enter your current PIN to confirm removal.</p>
                        )}

                        <input
                            type="password"
                            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (isRemovingPin ? handleRemovePin() : isSettingPin ? handleSetPin() : verifyPin())}
                            autoFocus
                            placeholder={isSettingPin ? "New 4-digit PIN" : "****"}
                        />

                        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => { setPinModalUser(null); setIsSettingPin(false); setIsRemovingPin(false); setPin(""); setError(""); }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={isRemovingPin ? handleRemovePin : isSettingPin ? handleSetPin : verifyPin}
                                className={`px-4 py-2 text-white rounded text-sm ${isRemovingPin ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
