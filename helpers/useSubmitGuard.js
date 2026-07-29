import { useCallback, useRef, useState } from "react";

/**
 * Guards an async submit handler against double-taps / concurrent runs.
 *
 * Why not just rely on a mutation's `isPending` (or a piece of state) to disable
 * the button? State updates are async in React, so two taps fired in the same
 * render tick can both pass a state-only check before the UI re-renders. The
 * `inFlightRef` here flips synchronously, so re-entrant calls are rejected
 * immediately — even within a single tick.
 *
 * Usage:
 *   const { isSubmitting, run } = useSubmitGuard();
 *   const onSave = () => run(async () => {
 *     await mutation.mutateAsync(payload);
 *     goBackOnce();
 *   });
 *   <Button onPress={onSave} disabled={isSubmitting} />
 */
export function useSubmitGuard() {
  const inFlightRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async (fn) => {
    if (inFlightRef.current) return undefined;
    inFlightRef.current = true;
    setIsSubmitting(true);
    try {
      return await fn();
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  return { isSubmitting, run };
}

/**
 * Returns a function that runs its callback at most once for the lifetime of the
 * component. Use it to make navigation idempotent so spamming a Back/Save/Cancel
 * button can't call `router.back()` / `router.replace()` multiple times (which
 * pops too many screens or crashes once the screen finally unmounts).
 *
 * Usage:
 *   const goOnce = useOneShot();
 *   <Button onPress={() => goOnce(() => router.back())} />
 */
export function useOneShot() {
  const firedRef = useRef(false);

  return useCallback((fn) => {
    if (firedRef.current) return;
    firedRef.current = true;
    fn();
  }, []);
}

export default useSubmitGuard;
