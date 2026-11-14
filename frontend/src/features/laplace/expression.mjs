// MathLive may spell custom operator names as spaced letters in ASCII output.
export function calculatorExpression(ascii) {
  let output = ascii;
  for (const name of ['floor', 'ceil', 'rect', 'tri', 'sawtooth', 'square', 'erfc', 'erf', 'sinc', 'sgn', 'J0', 'J1', 'I0', 'Si', 'Ci']) {
    output = output.replace(new RegExp('\\b' + name.split('').join('\\s*') + '\\s*(?=\\()', 'gi'), name);
  }
  return output;
}
