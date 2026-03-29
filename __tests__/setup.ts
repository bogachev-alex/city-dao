;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

if (!process.env.DEBUG) {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
}
