import "@testing-library/jest-dom"

// jsdom gaps that Radix UI components rely on
global.ResizeObserver =
  global.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList)

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false)
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {})
