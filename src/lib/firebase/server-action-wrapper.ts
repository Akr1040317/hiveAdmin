/**
 * Helper to wrap server actions with authentication
 * Clients should use this to automatically pass the auth token
 */

import { getIdToken } from './client-auth';

export type ServerAction<T extends (...args: any[]) => Promise<any>> = T extends (
  ...args: infer P
) => Promise<infer R>
  ? (token: string | null, ...args: P) => Promise<R>
  : never;

/**
 * Wrapper function that gets the ID token and passes it to server actions
 * Usage: const wrappedAction = withAuth(serverAction);
 * Then call: wrappedAction(...args) - token is automatically included
 */
export function withAuth<T extends (token: string | null, ...args: any[]) => Promise<any>>(
  action: T
): (...args: Parameters<T> extends [string | null, ...infer Rest] ? Rest : Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: any[]) => {
    const token = await getIdToken();
    return action(token, ...args);
  };
}
