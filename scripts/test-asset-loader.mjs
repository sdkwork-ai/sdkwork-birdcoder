const STYLE_MODULE_PATTERN = /\.(?:css|less|sass|scss)(?:\?.*)?$/iu;

export async function load(url, context, nextLoad) {
  if (!STYLE_MODULE_PATTERN.test(url)) {
    return nextLoad(url, context);
  }

  return {
    format: 'module',
    shortCircuit: true,
    source: 'export default {};\n',
  };
}
