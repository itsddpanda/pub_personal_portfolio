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

export async function getSchemeDetails(amfiCode: string, xUserId: string) {
    const res = await fetch(`${API_BASE}/scheme/${amfiCode}`, {
        headers: {
            'x-user-id': xUserId,
        },
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch scheme details');
    }

    return res.json();
}

export async function getSchemeHistory(amfiCode: string) {
    const res = await fetch(`${API_BASE}/scheme/${amfiCode}/history`);
    if (!res.ok) {
        throw new Error('Failed to fetch scheme history');
    }
    return res.json();
}

export class RetryableError extends Error {
    retryAfter: number;
    constructor(message: string, retryAfter: number) {
        super(message);
        this.name = "RetryableError";
        this.retryAfter = retryAfter;
    }
}

export async function getSchemeEnrichment(amfiCode: string) {
    const res = await fetch(`${API_BASE}/scheme/${amfiCode}/enrichment`);

    if (res.status === 503) {
        // Backend DaaS triggers a background calc.
        const retryAfterStr = res.headers.get("Retry-After");
        // Default to 60s if header is missing
        const retryAfter = retryAfterStr ? parseInt(retryAfterStr, 10) : 60;
        throw new RetryableError("Data is being calculated in the background.", retryAfter);
    }

    if (!res.ok) {
        if (res.status === 404) return null; // No enrichment data available for this ISIN
        throw new Error('Failed to fetch scheme enrichment intelligence');
    }

    return res.json();
}
