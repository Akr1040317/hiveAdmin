/**
 * Recursively serialize an object to ensure all Date objects and other
 * non-serializable values are converted to plain JSON-serializable types.
 * This is necessary for passing data from Server Components to Client Components in Next.js.
 */

export function serializeForClient<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString() as any;
  }

  // Handle Firestore Timestamp objects
  if (
    typeof data === 'object' &&
    data !== null &&
    'seconds' in data &&
    'nanoseconds' in data &&
    typeof (data as any).seconds === 'number'
  ) {
    return new Date((data as any).seconds * 1000).toISOString() as any;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => serializeForClient(item)) as any;
  }

  // Handle plain objects
  if (typeof data === 'object' && data !== null) {
    // Skip functions and other non-serializable objects
    if (data.constructor && data.constructor !== Object && !Array.isArray(data)) {
      // For objects with custom constructors, try to convert to plain object
      try {
        const plainObj = { ...data };
        const result: any = {};
        for (const key in plainObj) {
          if (plainObj.hasOwnProperty(key)) {
            result[key] = serializeForClient(plainObj[key]);
          }
        }
        return result as T;
      } catch {
        // If we can't serialize it, return a string representation
        return String(data) as any;
      }
    }

    // Recursively serialize all properties
    const result: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        result[key] = serializeForClient((data as any)[key]);
      }
    }
    return result as T;
  }

  // Primitive types (string, number, boolean) are already serializable
  return data;
}
