/**
 * Test environment setup.
 *
 * jsdom implements no `matchMedia`, which Motion asks for. We answer "the user
 * prefers reduced motion": transitions become instant — so component tests are
 * fast and free of animation flake — and every component under test runs the
 * reduced-motion path a real user with that setting would get.
 */
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;
