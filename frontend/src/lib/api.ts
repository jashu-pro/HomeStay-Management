const API_BASE = import.meta.env.VITE_API_URL || '';

export interface SafeFetchOptions extends RequestInit {
  timeout?: number;
  _retryCount?: number;
}

// ─── BACKEND WAKE-UP PING ─────────────────────────────────────────────────────
let backendWakeUpDone = false;
let backendReady = false;

export function isBackendReady(): boolean {
  return backendReady;
}

export function wakeUpBackend(): void {
  if (backendWakeUpDone) return;
  backendWakeUpDone = true;
  const pingUrl = `${API_BASE}/api/health`;
  console.log('[WakeUp] Pinging backend to wake from sleep...', pingUrl);

  const tryPing = (attempt: number) => {
    fetch(pingUrl, { method: 'GET', cache: 'no-store' })
      .then(res => {
        if (res.ok) {
          backendReady = true;
          console.log(`[WakeUp] Backend is awake ✅ (attempt ${attempt})`);
          window.dispatchEvent(new CustomEvent('backend-ready'));
        } else {
          scheduleRetry(attempt);
        }
      })
      .catch(() => scheduleRetry(attempt));
  };

  const scheduleRetry = (attempt: number) => {
    if (attempt < 6) {
      const delay = Math.min(attempt * 5000, 20000); // 5s, 10s, 15s, 20s, 20s
      console.log(`[WakeUp] Retry ${attempt + 1} in ${delay / 1000}s...`);
      setTimeout(() => tryPing(attempt + 1), delay);
    } else {
      console.warn('[WakeUp] Backend did not wake up after 6 attempts.');
    }
  };

  tryPing(1);
}

// ─── COLD-START ERROR DETECTION ───────────────────────────────────────────────
function isColdStartError(message: string): boolean {
  return (
    message.includes('starting up') ||
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('timed out') ||
    message.includes('offline or unreachable')
  );
}

// ─── MAIN FETCH WRAPPER ────────────────────────────────────────────────────────
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<any> {
  const { timeout = 25000, _retryCount = 0, ...fetchOptions } = options;

  const resolvedUrl = url.startsWith('/api/') ? `${API_BASE}${url}` : url;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  console.log(`[API Request] ${fetchOptions.method || 'GET'} ${resolvedUrl}`);

  try {
    const response = await fetch(resolvedUrl, {
      ...fetchOptions,
      signal: controller.signal
    });

    clearTimeout(id);
    console.log(`[API Response] ${response.status} ${response.statusText} for ${resolvedUrl}`);

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      if (isJson) {
        const errorData = await response.json();
        const errMsg = errorData.error || errorData.message || 'Unknown error occurred.';
        throw new Error(errMsg);
      } else {
        const textBody = await response.text();
        if (response.status === 404) throw new Error('Requested resource could not be found (404).');
        if (response.status === 500) throw new Error('Internal Server Error (500). Please try again later.');
        if (response.status === 401 || response.status === 403) throw new Error(`${response.status}: Access denied or session expired. Please verify your login credentials (401/403).`);
        if (!textBody || textBody.trim() === '') throw new Error('Server is currently starting up. Please wait a moment and try again.');
        console.error(`[API Error] Status: ${response.status}`, textBody);
        throw new Error(`Server error (Status ${response.status}).`);
      }
    }

    // Read body as text first to safely detect empty/HTML responses
    const rawText = await response.text();

    if (!rawText || rawText.trim() === '') {
      throw new Error('Server is currently starting up. Please wait a moment and try again.');
    }

    const isHtml = rawText.includes('<!doctype html>') || rawText.includes('<html') || rawText.includes('Starting Server...');
    if (isHtml) {
      throw new Error('Server is currently starting up. Please wait a moment and try again.');
    }

    try {
      const data = JSON.parse(rawText);

      // Auto-backup db to localStorage
      if (data && data.db && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('homestay_db', JSON.stringify(data.db));
      }

      // Background sync after writes
      const method = (options.method || 'GET').toUpperCase();
      if (
        (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
        !url.includes('/api/sync') &&
        !url.includes('/api/login') &&
        !url.includes('/api/signup') &&
        typeof window !== 'undefined' && window.localStorage
      ) {
        const token = window.localStorage.getItem('hs_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        fetch(`${API_BASE}/api/sync`, { headers })
          .then(res => res.json())
          .then(syncData => {
            if (syncData?.db) window.localStorage.setItem('homestay_db', JSON.stringify(syncData.db));
          })
          .catch(err => console.error('[Background Sync] Failed:', err));
      }

      return data;
    } catch (parseError: any) {
      if (parseError.message?.includes('starting up')) throw parseError;
      console.error('[API JSON Parse Error]', parseError);
      throw new Error('Failed to parse response. The server response was malformed.');
    }

  } catch (error: any) {
    clearTimeout(id);

    // Normalize error message
    let message = error.message || '';
    if (error.name === 'AbortError') {
      message = 'Server is currently starting up. Please wait a moment and try again.';
    } else if (message === 'Failed to fetch') {
      message = 'Server is currently starting up. Please wait a moment and try again.';
    }

    // AUTO-RETRY for cold-start errors (up to 3 times, with increasing delay)
    if (isColdStartError(message) && _retryCount < 3) {
      const delay = (_retryCount + 1) * 6000; // 6s, 12s, 18s
      console.warn(`[API Retry] Cold-start detected. Retrying in ${delay / 1000}s... (attempt ${_retryCount + 1}/3)`);

      await new Promise(resolve => setTimeout(resolve, delay));

      return safeFetch(url, { ...options, _retryCount: _retryCount + 1 });
    }

    throw new Error(message);
  }
}
