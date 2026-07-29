import { useCallback, useRef, useState } from 'react';

const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  // Synchronous re-entry guard: blocks a second submit fired in the same render
  // tick (before `isLoading` state flips) from starting a duplicate request.
  const inFlightRef = useRef(false);

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  const withLoading = useCallback(async (asyncFunction) => {
    if (inFlightRef.current) return undefined;
    inFlightRef.current = true;
    try {
      startLoading();
      const result = await asyncFunction();
      return result;
    } finally {
      inFlightRef.current = false;
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    withLoading,
  };
};

export default useLoading; 