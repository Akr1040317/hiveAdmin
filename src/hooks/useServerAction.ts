'use client';

import { useState, useCallback } from 'react';
import { getIdToken } from '@/lib/firebase/client-auth';

export function useServerAction<T extends (...args: any[]) => Promise<any>>(
  action: T
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<any> => {
      setLoading(true);
      setError(null);

      try {
        const token = await getIdToken();
        if (!token) {
          throw new Error('Not authenticated');
        }

        // Pass token as last argument
        const result = await action(...args, token);
        return result;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [action]
  );

  return { execute, loading, error };
}
