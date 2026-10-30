import { LazyLog } from '@melloware/react-logviewer';

export const LOG_LINE_LIMIT = 2000;

// appendLines always terminates complete lines with LF. Copy the retained tail
// so the backing allocation, as well as the displayed rows, stays bounded.
export function retainLogTail(bytes: Uint8Array, limit = LOG_LINE_LIMIT): Uint8Array {
  let lines = 0;
  for (let index = bytes.length - 1; index >= 0; index--) {
    if (bytes[index] === 10 && ++lines > limit) return bytes.slice(index + 1);
  }
  return bytes;
}

// This adapter is used only in external mode. Keep rows, count and searchable
// bytes consistent in one update, including bursts larger than the line limit.
export class BoundedLog extends LazyLog {
  override handleUpdate = ({ lines: incoming, encodedLog }: { lines: LazyLog['state']['lines']; encodedLog: Uint8Array }): void => {
    this.encodedLog = retainLogTail(encodedLog);
    this.setState((state, props) => {
      // eslint-disable-next-line unicorn/prefer-spread -- This is an Immutable List, not an Array.
      const lines = state.lines.concat(incoming).takeLast(LOG_LINE_LIMIT);
      const count = lines.size;
      const scrollToLine = props.scrollToLine ?? 0;
      const scrollToIndex = props.follow ? count - 1 : scrollToLine && state.count <= scrollToLine ? scrollToLine - 1 : -1;
      return { lines, count, offset: 0, scrollToIndex };
    }, this.forceSearch);
  };
}
