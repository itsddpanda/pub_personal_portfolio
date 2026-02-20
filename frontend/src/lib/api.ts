const API_BASE = '/api'; // Relative path, proxied by Next.js

export async function uploadCAS(file: File, password: string, xUserId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    const headers: HeadersInit = {};
    if (xUserId) {
        headers['x-user-id'] = xUserId;
    }

    const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Upload failed');
    }

    return res.json();
}

export async function getDashboardSummary(xUserId: string) {
    const res = await fetch(`${API_BASE}/analytics/summary`, {
        headers: {
            'x-user-id': xUserId,
        },
    });

    if (!res.ok) {
        // If 404, might mean user doesn't exist yet (first time)
        if (res.status === 404) return null;
        throw new Error('Failed to fetch dashboard');
    }

    return res.json();
}

export async function syncNavs(xUserId?: string) {
    const headers: HeadersInit = {};
    if (xUserId) {
        headers['x-user-id'] = xUserId;
    }

    const res = await fetch(`${API_BASE}/sync-nav`, {
        method: 'POST',
        headers,
    });

    if (!res.ok) {
        throw new Error('Sync failed');
    }

    return res.json();
}

export async function getSyncStatus() {
    const res = await fetch(`${API_BASE}/status/sync`);
    if (!res.ok) {
        throw new Error('Failed to get sync status');
    }
    return res.json();
}
