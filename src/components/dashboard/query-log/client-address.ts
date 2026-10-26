export const QUERY_CLIENT_ADDRESS_WIDTH_SAMPLES = ['255.255.255.255', '::8888:8888', '::dddd:dddd'] as const;

export function formatQueryClientAddress(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.trim().split('%');
  const address = parts[0];
  const scope = parts[1];
  if (parts.length > 2 || (parts.length === 2 && !/^[\w.-]+$/.test(scope))) return value;
  // Already-short addresses are clearer in their original notation.
  if (address.length <= '::ffff:ffff'.length || !/^[\da-f:.]+$/i.test(address)) return value;
  try {
    const hostname = new URL(`http://[${address}]/`).hostname;
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) return value;
    const [start, end] = hostname.slice(1, -1).split('::');
    const leading = start ? start.split(':') : [];
    const trailing = end ? end.split(':') : [];
    const groups = end === undefined ? leading : [...leading, ...Array<string>(8 - leading.length - trailing.length).fill('0'), ...trailing];
    const suffix = `::${groups.slice(-2).join(':')}${scope ? `%${scope}` : ''}`;
    return suffix.length < value.length ? suffix : value;
  } catch {
    return value;
  }
}
