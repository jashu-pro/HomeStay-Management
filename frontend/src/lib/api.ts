const API_BASE = import.meta.env.VITE_API_URL || '';

export interface SafeFetchOptions extends RequestInit {
  timeout?: number;
}

// ─── BACKEND WAKE-UP PING ─────────────────────────────────────────────────────
// Pings the Render backend on app load so it wakes up from free-tier sleep
// before the user tries to do anything. Fire-and-forget.
let backendWakeUpDone = false;
export function wakeUpBackend(): void {
  if (backendWakeUpDone) return;
  backendWakeUpDone = true;
  const pingUrl = `${API_BASE}/api/health`;
  console.log('[WakeUp] Pinging backend to wake from sleep...', pingUrl);
  fetch(pingUrl, { method: 'GET', cache: 'no-store' })
    .then(() => console.log('[WakeUp] Backend is awake ✅'))
    .catch(() => {
      // Retry after 8 seconds if first ping fails
      setTimeout(() => {
        fetch(pingUrl, { method: 'GET', cache: 'no-store' })
          .then(() => console.log('[WakeUp] Backend awake on retry ✅'))
          .catch(() => console.warn('[WakeUp] Backend still waking up…'));
      }, 8000);
    });
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<any> {
  const { timeout = 20000, ...fetchOptions } = options;
  
  // In production, prefix relative /api/* paths with the backend base URL
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
    
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    console.log('[API Response Headers]', headersObj);
    
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    
    if (!response.ok) {
      if (isJson) {
        const errorData = await response.json();
        const errMsg = errorData.error || errorData.message || 'Unknown error occurred.';
        throw new Error(errMsg);
      } else {
        const textBody = await response.text();
        console.error(`[API Error Non-JSON Body] Status: ${response.status}`, textBody);
        
        if (response.status === 404) {
          throw new Error('Requested resource could not be found on the server (404).');
        } else if (response.status === 500) {
          throw new Error('Internal Server Error (500). Please try again later.');
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Access denied or session expired. Please verify your login credentials (401/403).');
        } else {
          throw new Error(`Server error occurred (Status ${response.status}).`);
        }
      }
    }
    
    if (!isJson) {
      const textBody = await response.text();
      // Empty body — backend likely waking up
      if (!textBody || textBody.trim() === '') {
        console.warn(`[API Warmup] Empty response body for ${url}. Server might be starting up.`);
        throw new Error('Server is currently starting up. Please wait a moment and try again.');
      }
      const isHtml = textBody.includes('<!doctype html>') || textBody.includes('<html') || textBody.includes('Starting Server...');
      if (isHtml) {
        console.warn(`[API Warmup] HTML response detected for ${url}. Server might be starting up.`);
        throw new Error('Server is currently starting up. Please wait a moment and try again.');
      }
      console.warn(`[API Non-JSON Response] url: ${url}`);
      throw new Error('Server returned invalid data format (expected JSON but got HTML/Text).');
    }
    
    try {
      // Handle empty body even with JSON content-type header
      const rawText = await response.text();
      if (!rawText || rawText.trim() === '') {
        console.warn(`[API Empty JSON] Empty JSON body for ${url}. Server may be waking up.`);
        throw new Error('Server is currently starting up. Please wait a moment and try again.');
      }

      const data = JSON.parse(rawText);
      if (data && data.db && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('homestay_db', JSON.stringify(data.db));
        console.log('[API Interceptor] Captured database state from response. Local backup updated.');
      }
      
      // Auto-trigger background sync on write operations to ensure client-side storage is always up to date
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
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        fetch(`${API_BASE}/api/sync`, { headers })
          .then(res => res.json())
          .then(syncData => {
            if (syncData && syncData.db) {
              window.localStorage.setItem('homestay_db', JSON.stringify(syncData.db));
              console.log('[Background Sync] Auto-updated local database copy after write operation.');
            }
          })
          .catch(err => console.error('[Background Sync] Failed to sync updated db:', err));
      }

      return data;
    } catch (parseError: any) {
      console.error('[API JSON Parse Error]', parseError);
      if (parseError.message && parseError.message.includes('starting up')) throw parseError;
      throw new Error('Failed to parse response data. The server response was malformed.');
    }
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      console.error(`[API Timeout] Request to ${resolvedUrl} exceeded timeout of ${timeout}ms`);
      throw new Error('Network request timed out. The server may be waking up — please try again in a moment.');
    }
    
    if (error.message === 'Failed to fetch') {
      console.warn(`[API Connection Failed] Could not connect to ${resolvedUrl}`);
      throw new Error('Unable to connect to the server. The backend might be offline or unreachable.');
    }
    
    throw error;
  }
}
