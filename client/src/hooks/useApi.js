import { useState, useEffect, useCallback } from 'react';
import { get } from '../api/client';

export default function useApi(path, options = {}) {
  const { immediate = true, deps = [] } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (overridePath) => {
    setLoading(true);
    setError(null);
    try {
      const result = await get(overridePath || path);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (immediate && path) fetch();
  }, [path, immediate, ...deps]);

  return { data, loading, error, refetch: fetch, setData };
}
