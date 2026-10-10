import { useEffect, useState } from 'react';

export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    // CSRF token باید از login response یا meta tag یا window خوانده شود
    const token = (window as any).__csrfToken ||
                  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                  '';
    
    if (!token) {
      console.warn('CSRF token not found. Mutations may fail.');
    }
    
    setCsrfToken(token);
  }, []);

  return csrfToken;
}
