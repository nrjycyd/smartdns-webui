// Each mount owns its socket and retry timer, including during Strict Mode replay.
export function openMetricsStream(url: string, onOpen: () => void, onMessage: (event: MessageEvent) => void): () => void {
  let disposed = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function connect() {
    if (disposed) return;
    const current = new WebSocket(url);
    socket = current;
    current.onopen = () => { if (!disposed && socket === current) onOpen(); };
    current.onmessage = event => { if (!disposed && socket === current) onMessage(event); };
    current.onclose = () => {
      if (!disposed && socket === current) timer = setTimeout(connect, 3000);
    };
  }
  connect();
  return () => {
    disposed = true;
    if (timer !== undefined) clearTimeout(timer);
    socket?.close();
  };
}
