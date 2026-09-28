import type { RunChange } from "./fetchAPI";

/** What POST /live/register answers; `url` is null where the backend has no live updates. */
export interface LiveRegistration {
    url: string | null;
    expiresAt?: string;
}

/** connected: notifications arrive; disconnected: lost, reconnecting; unavailable: the backend has no live updates. */
export type LiveStatus = 'connected' | 'disconnected' | 'unavailable';

const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Keeps one live update connection open until unsubscribed: a WebSocket to Web PubSub, or an
 * EventSource to the Node backend's sse driver, told apart by the scheme of the URL. Renews the
 * registration before it expires, since the backend only publishes for registered workflows.
 */
export function subscribeLive(register: () => Promise<LiveRegistration>, onChange: (change: RunChange | undefined) => void, onStatus?: (status: LiveStatus) => void): () => void {
    let closed = false;
    let connection: WebSocket | EventSource | undefined;
    let renewTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let backoff = MIN_BACKOFF_MS;
    let connectedOnce = false;

    const receive = (data: unknown) => {
        try {
            const message = JSON.parse(String(data));
            if (message?.type === 'runChanged') onChange(message as RunChange);
        } catch {
            // not ours
        }
    };

    const scheduleRenew = (expiresAt?: string) => {
        clearTimeout(renewTimer);
        const remaining = expiresAt ? Date.parse(expiresAt) - Date.now() : NaN;
        if (!(remaining > 0)) return;
        renewTimer = setTimeout(() => register().then(r => scheduleRenew(r.expiresAt ?? undefined)).catch(() => reconnect()), remaining * 2 / 3);
    };

    const report = (status: LiveStatus) => { if (!closed) onStatus?.(status); };

    const opened = () => {
        backoff = MIN_BACKOFF_MS;
        report('connected');
        // whatever happened while disconnected was not notified
        if (connectedOnce) onChange(undefined);
        connectedOnce = true;
    };

    const reconnect = () => {
        connection?.close();
        connection = undefined;
        if (closed || retryTimer) return;
        report('disconnected');
        retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    };

    const connect = async () => {
        let registration: LiveRegistration;
        try {
            registration = await register();
        } catch (error) {
            // an older backend without the route answers 404; nothing to retry then
            if (String(error).includes('(404)')) { report('unavailable'); return; }
            reconnect();
            return;
        }
        if (closed) return;
        if (!registration.url) { report('unavailable'); return; }
        scheduleRenew(registration.expiresAt);

        if (/^wss?:/.test(registration.url)) {
            const socket = new WebSocket(registration.url);
            socket.onopen = opened;
            socket.onmessage = event => receive(event.data);
            socket.onclose = () => { if (connection === socket) reconnect(); };
            connection = socket;
        } else {
            const source = new EventSource(registration.url);
            source.onopen = opened;
            source.onmessage = event => receive(event.data);
            // EventSource retries on its own, but not once the token it carries has been refused
            source.onerror = () => { if (source.readyState === EventSource.CLOSED && connection === source) reconnect(); };
            connection = source;
        }
    };

    void connect();
    return () => {
        closed = true;
        clearTimeout(renewTimer);
        clearTimeout(retryTimer);
        const current = connection;
        connection = undefined;
        current?.close();
    };
}
