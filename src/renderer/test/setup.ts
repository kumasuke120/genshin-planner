import '@testing-library/jest-dom/vitest';

Object.assign(globalThis, {
  __APP_VERSION__: '1.1.0-test',
  __APP_AUTHOR__: 'Kumasuke120',
  __BUILD_ID__: 'test-build'
});

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true
  })
});
