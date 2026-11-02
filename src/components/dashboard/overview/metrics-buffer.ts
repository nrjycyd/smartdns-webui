// Batch presentation, not sampling: every QPS sample in the chart's bounded
// history is retained, including while the document is hidden.
export function bufferMetrics<T extends Record<string, unknown>>(deliver: (latest: T, samples: readonly number[], count: number) => void): { push: (value: T) => void; dispose: () => void } {
  let latest: T | undefined;
  let samples: number[] = [];
  let count = 0;
  let delivered = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hidden = () => typeof document !== 'undefined' && document.hidden;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (disposed || hidden() || !latest) return;
    // A complete history snapshot also survives React combining two deliveries
    // into one commit. Never mutate an array already handed to the chart.
    const value = latest, batch = [...samples], received = count;
    latest = undefined;
    count = 0;
    delivered = true;
    deliver(value, batch, received);
  };
  const visibility = () => {
    if (hidden()) { clearTimeout(timer); timer = undefined; }
    else flush();
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
  return {
    push(value) {
      if (disposed) return;
      latest = value;
      samples.push(typeof value.qps === 'number' ? value.qps : 0);
      if (samples.length > 60) samples.splice(0, samples.length - 60);
      count++;
      if (hidden()) return;
      if (delivered) timer ??= setTimeout(flush, 250);
      else flush();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      latest = undefined;
      samples = [];
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
    },
  };
}
