import test from "node:test";
import assert from "node:assert/strict";
import { computeLaplace, computeInverseLaplace, parseExpression, evalAt, numericLaplaceIntegral, talbotNumericInverse } from "../src/features/laplace/engine.mjs";
import { calculatorExpression } from "../src/features/laplace/expression.mjs";

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), actual + " vs " + expected);
test("Laplace transforms match independent analytic values, including shifted and impulse signals", () => {
  const cases = [
    ["1", s => 1/s], ["t^2", s => 2/s**3],
    ["t^2*e^(-3*t)+sin(2*t)", s => 2/(s+3)**3 + 2/(s*s+4)],
    ["sin(3*t)/t", s => Math.atan(3/s)],
    ["delta(t-3)", s => Math.exp(-3*s)],
    ["(t-2)*u(t-2)", s => Math.exp(-2*s)/s**2],
    ["abs(t-3)", s => -1/s**2+3/s+2*Math.exp(-3*s)/s**2],
  ];
  for (const [input, expected] of cases) {
    const output = computeLaplace(input);
    assert.equal(output.isNumericFallback, false, input);
    const ast = parseExpression(output.plainFs, "s");
    for (const s of [1, 2.5, 4]) near(evalAt(ast, s), expected(s));
  }
});
test("inverse transforms handle repeated poles and causal delay without numerical artifacts", () => {
  const cases = [
    ["(2*s+5)/((s+1)*(s+3))", t => .5*Math.exp(-3*t)+1.5*Math.exp(-t)],
    ["(s^2+2*s+3)/(s+1)^3", t => (1+t*t)*Math.exp(-t)],
    ["(3*s+7)/(s^2+2*s+5)", t => Math.exp(-t)*(3*Math.cos(2*t)+2*Math.sin(2*t))],
    ["e^(-2*s)/s^2", t => t < 2 ? 0 : t-2],
    ["1/sqrt(s)", t => 1/Math.sqrt(Math.PI*t)],
  ];
  for (const [input, expected] of cases) {
    const output = computeInverseLaplace(input);
    assert.equal(output.isNumericFallback, false, input);
    const ast = parseExpression(output.plainOut);
    for (const t of [.2, 1, 2.5, 4]) near(evalAt(ast, t), expected(t));
  }
  assert.doesNotMatch(computeInverseLaplace("(s^2+2*s+3)/(s+1)^3").plainOut, /e-\d/);
});
test("numerical integration and inverse agree with known results and reject invalid time", () => {
  const forward = numericLaplaceIntegral(parseExpression("e^(-t)"), 2, 1);
  assert.equal(forward.ok, true);
  near(forward.re, .3, 1e-5); near(forward.im, -.1, 1e-5);
  const inverse = talbotNumericInverse(parseExpression("1/(s+1)", "s"), 1);
  assert.equal(inverse.ok, true);
  near(inverse.value, Math.exp(-1), 1e-5);
  assert.equal(talbotNumericInverse(parseExpression("1/s", "s"), 0).ok, false);
});
test("MathLive operator serialization reaches the calculator as function calls", () => {
  for (const [ascii, expected] of [
    ["f l o o r (t)", "floor(t)"], ["r e c t (t)", "rect(t)"],
    ["s a w t o o t h (t)", "sawtooth(t)"], ["e r f (t)", "erf(t)"],
    ["J0 (4t)", "J0(4t)"], ["(sin (3t))/(t)", "(sin (3t))/(t)"],
  ]) {
    assert.equal(calculatorExpression(ascii), expected);
    assert.doesNotThrow(() => parseExpression(calculatorExpression(ascii)));
  }
});
test("invalid expressions and noncausal advances produce actionable errors", () => {
  for (const input of ["sin(", "t+unknown(t)", "t^"]) assert.throws(() => computeLaplace(input));
  assert.throws(() => computeInverseLaplace("e^(2*s)/s"), /เลื่อนเวลา/);
});
