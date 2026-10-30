// Preserve the minute cadence and three-second recovery while allowing only
// one active request or retry chain for each mounted statistics card.
export function startStatisticsPolling(fetchData: (signal: AbortSignal) => Promise<boolean>): () => void {
  const controller = new AbortController();
  let inFlight = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    if (controller.signal.aborted || inFlight) return;
    clearTimeout(retry);
    retry = undefined;
    inFlight = true;
    let success = false;
    try { success = await fetchData(controller.signal); }
    catch { /* A failed request follows the same bounded recovery path. */ }
    finally {
      inFlight = false;
      if (!success && !controller.signal.aborted) retry = setTimeout(() => { void poll(); }, 3000);
    }
  };
  void poll();
  const interval = setInterval(() => { void poll(); }, 60000);
  return () => {
    controller.abort();
    clearInterval(interval);
    clearTimeout(retry);
  };
}
