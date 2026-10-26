export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'electron') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./mockElectron.mjs', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
