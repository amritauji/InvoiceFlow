import { useEffect, useRef } from 'react';

export default function usePolling(callback, interval = 15000, enabled = true) {
  const savedCallback = useRef(callback);
  const abortRef = useRef(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      savedCallback.current(abortRef.current.signal);
    };

    const id = setInterval(tick, interval);

    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [interval, enabled]);
}
