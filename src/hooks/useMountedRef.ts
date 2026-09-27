import { useEffect, useRef } from 'react';

/** Lets async callbacks skip state updates once their component has unmounted. */
export function useMountedRef() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
