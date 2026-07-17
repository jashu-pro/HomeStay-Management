export interface SafeFetchOptions extends RequestInit {
  timeout?: number;
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<any> {
  const { timeout = 15000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  console.log(`[API Request] ${fetchOptions.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(id);
    
    console.log(`[API Response] ${response.status} ${response.statusText} for ${url}`);
    
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
      const isHtml = textBody.includes('<!doctype html>') || textBody.includes('<html') || textBody.includes('Starting Server...');
      if (isHtml) {
        console.warn(`[API Warmup] HTML response detected for ${url}. Server might be starting up.`);
        throw new Error('Server is currently starting up. Please wait...');
      }
      console.warn(`[API Non-JSON Response] url: ${url}`);
      throw new Error('Server returned invalid data format (expected JSON but got HTML/Text).');
    }
    
    try {
      const data = await response.json();
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
        
        fetch('/api/sync', { headers })
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
      throw new Error('Failed to parse response data. The server response was malformed.');
    }
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      console.error(`[API Timeout] Request to ${url} exceeded timeout of ${timeout}ms`);
      throw new Error('Network request timed out. Please check your internet connection and try again.');
    }
    
    if (error.message === 'Failed to fetch') {
      console.warn(`[API Connection Failed] Could not connect to ${url}`);
      throw new Error('Unable to connect to the server. The backend might be offline or unreachable.');
    }
    
    throw error;
  }
}
