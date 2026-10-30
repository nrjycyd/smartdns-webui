// MUI 7's default paper surfaces, guarded against upstream changes by a theme
// equivalence test. The tables use these independently of the page palette.
export function tableBackground(colorScheme: string | undefined): string {
  return colorScheme === 'dark' ? '#121212' : '#fff';
}
