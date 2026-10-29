interface Watch {
  container: HTMLElement;
  text: HTMLElement;
  update: (overflow: number) => void;
}

const owners = new Map<Element, Watch>();
const pending = new Set<Watch>();
let observer: ResizeObserver | undefined;
let frame = 0;

function schedule(watch: Watch): void {
  pending.add(watch);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    // Read all geometry before any callback can trigger a React DOM update.
    const measurements = [...pending].map(entry => ({ entry, overflow: Math.max(0, entry.text.scrollWidth - entry.container.clientWidth) }));
    pending.clear();
    for (const { entry, overflow } of measurements) entry.update(overflow);
  });
}

export function observePingOverflow(container: HTMLElement, text: HTMLElement, update: (overflow: number) => void): () => void {
  const watch = { container, text, update };
  observer ??= new ResizeObserver(entries => {
    for (const entry of entries) {
      const owner = owners.get(entry.target);
      if (owner) schedule(owner);
    }
  });
  for (const node of [container, text]) { owners.set(node, watch); observer.observe(node); }
  schedule(watch);
  return () => {
    pending.delete(watch);
    for (const node of [container, text]) { owners.delete(node); observer?.unobserve(node); }
    if (owners.size === 0) { observer?.disconnect(); observer = undefined; cancelAnimationFrame(frame); frame = 0; }
  };
}
