// Global test setup

// BigInt JSON serialization polyfill
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

// Suppress console.warn in tests unless DEBUG
if (!process.env.DEBUG) {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
}
