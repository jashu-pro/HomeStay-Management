import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global fetch interceptor to map 'Authorization' to 'X-Authorization'
// This bypasses Google Cloud Run's GFE infrastructure which intercepts 'Authorization' and returns 403 Forbidden
try {
  const originalFetch = window.fetch;
  if (originalFetch) {
    const customFetch = async function (this: any, input: RequestInfo | URL, init?: RequestInit) {
      if (init && init.headers) {
        if (init.headers instanceof Headers) {
          const auth = init.headers.get('Authorization') || init.headers.get('authorization');
          if (auth) {
            init.headers.set('X-Authorization', auth);
            init.headers.delete('Authorization');
            init.headers.delete('authorization');
          }
        } else if (Array.isArray(init.headers)) {
          for (let i = 0; i < init.headers.length; i++) {
            const [key, val] = init.headers[i];
            if (key.toLowerCase() === 'authorization') {
              init.headers[i] = ['X-Authorization', val];
            }
          }
        } else if (typeof init.headers === 'object') {
          const headersRecord = init.headers as Record<string, string>;
          const authKey = Object.keys(headersRecord).find(k => k.toLowerCase() === 'authorization');
          if (authKey) {
            headersRecord['X-Authorization'] = headersRecord[authKey];
            delete headersRecord[authKey];
          }
        }
      }
      return originalFetch.call(this || window, input, init);
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        configurable: true,
        writable: true,
        enumerable: true
      });
    } catch (e) {
      console.warn('Failed to define fetch on window via Object.defineProperty, trying direct assignment:', e);
      try {
        (window as any).fetch = customFetch;
      } catch (err) {
        console.error('Failed to override window.fetch entirely:', err);
      }
    }
  }
} catch (globalError) {
  console.error('Failed to set up global fetch interceptor:', globalError);
}

createRoot(document.getElementById('root')!).render(
  <App />,
);

