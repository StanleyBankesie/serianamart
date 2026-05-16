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
      const resp = await fetch(`https://open.er-api.com/v6/latest/${from}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.rates && data.rates[to]) {
          return data.rates[to];
        }
      }

      throw new Error('Failed to fetch exchange rate');
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
      const resp = await fetch('https://open.er-api.com/v6/latest/USD');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.rates) {
          return Object.keys(data.rates).map(code => ({
            code,
            name: code
          }));
        }
      }
      throw new Error('Failed to fetch currencies');
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
