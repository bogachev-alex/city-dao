// BigInt is not serializable by default in JSON.stringify.
// This polyfill allows Prisma BigInt fields to serialize in API responses.
// Must be imported once in the app (e.g., in lib/prisma.ts or layout.tsx).

declare global {
  interface BigInt {
    toJSON(): string
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString()
}

export {}
