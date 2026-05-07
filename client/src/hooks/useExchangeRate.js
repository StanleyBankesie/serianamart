import { useState, useCallback } from 'react';

export function useExchangeRate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getExchangeRate = useCallback(async (from, to) => {
    if (!from || !to) return null;
    if (from === to) return 1;

    setLoading(true);
    setError(null);
    try {
      // Primary: ExchangeRate-API (Free Tier, Secured HTTPS)
      // This API supports GHS and is very reliable.
      const resp = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.rates && data.rates[to]) {
          return data.rates[to];
        }
      }

      // Secondary: Frankfurter (Secured HTTPS, Free)
      // Note: Frankfurter does not support GHS.
      if (from !== 'GHS') {
        const response = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.rates && data.rates[to]) {
            return data.rates[to];
          }
        }
      }
      
      // Tertiary Fallback: v4 ExchangeRate-API
      const v4Resp = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
      if (v4Resp.ok) {
        const v4Data = await v4Resp.json();
        if (v4Data && v4Data.rates && v4Data.rates[to]) {
          return v4Data.rates[to];
        }
      }

      throw new Error('Failed to fetch exchange rate from all providers');
    } catch (err) {
      console.error('Error fetching exchange rate:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAvailableCurrencies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use Frankfurter for a clean list of currencies
      const response = await fetch('https://api.frankfurter.app/currencies');
      if (!response.ok) {
        // Fallback to ExchangeRate-API
        const altResp = await fetch('https://open.er-api.com/v6/latest/USD');
        const altData = await altResp.json();
        if (altData && altData.rates) {
          return Object.keys(altData.rates).map(code => ({
            code,
            name: code // ExchangeRate-API doesn't provide names in the latest endpoint easily
          }));
        }
        throw new Error('Failed to fetch currencies');
      }
      const data = await response.json();
      return Object.entries(data).map(([code, name]) => ({
        code,
        name
      }));
    } catch (err) {
      console.error('Error fetching available currencies:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { getExchangeRate, getAvailableCurrencies, loading, error };
}
