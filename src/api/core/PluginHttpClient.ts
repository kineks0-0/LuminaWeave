import { STClient } from './st-adapter/STClient';

export async function pluginFetch(url: string, options: RequestInit = {}): Promise<Response> {
    if (typeof (STClient as any).fetchWithCsrf === 'function') {
        return await (STClient as any).fetchWithCsrf(url, options);
    }

    const headers = new Headers(options.headers || {});
    if (!headers.has('X-CSRF-Token') && typeof (STClient as any).getCsrfToken === 'function') {
        const csrfToken = await STClient.getCsrfToken();
        if (csrfToken) {
            headers.set('X-CSRF-Token', csrfToken);
        }
    }

    return await fetch(url, {
        ...options,
        headers
    });
}
