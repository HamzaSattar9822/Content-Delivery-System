/**
 * Loads ESM-only packages from this CommonJS backend.
 *
 * Better Auth ships as pure ESM. Under `module: CommonJS`, a normal static
 * import compiles to `require()` and throws `ERR_REQUIRE_ESM` at runtime.
 * Wrapping `import()` in `new Function` prevents TypeScript from down-compiling
 * it to `require()`, so a real dynamic import survives to runtime — letting us
 * consume Better Auth without converting the whole backend to ESM.
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = unknown>(
  specifier: string,
) => Promise<T>;

export function importEsm<T = unknown>(specifier: string): Promise<T> {
  return dynamicImport<T>(specifier);
}
