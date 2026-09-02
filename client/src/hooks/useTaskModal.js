import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps the open task in the URL as `?task=<id>` instead of in component state.
 *
 * A task used to exist only as a modal driven by local state, which meant a
 * task had no address: you could not send someone a link to ALP-4, could not
 * bookmark or reload one, and the browser's back button did nothing. Holding it
 * in the query string gives every page a shareable URL for whatever is open,
 * makes Back close the modal, and survives a refresh - without navigating away
 * from the list or board the task was opened from.
 */
export function useTaskModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get('task');

  const openTask = useCallback((id) => {
    if (!id) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('task', String(id));
      return next;
    });
  }, [setSearchParams]);

  // Replace rather than push, so closing does not leave an entry that Back
  // would only reopen.
  const closeTask = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('task');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { taskId, isTaskOpen: Boolean(taskId), openTask, closeTask };
}
