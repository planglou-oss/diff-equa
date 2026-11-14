export interface TransformResult {
  isNumericFallback: boolean; ast: unknown; parsedTex: string; resultTex: string;
  plainFs?: string; plainOut?: string; rocText?: string; badgeText?: string;
  steps: { ruleName: string; stepTex: string }[];
}
export type NumericValue = { ok: true; re: number; im: number; value: number } | { ok: false; reason: string };
export function computeLaplace(input: string): TransformResult;
export function computeInverseLaplace(input: string): TransformResult;
export function numericLaplaceIntegral(ast: unknown, sigma: number, omega: number): NumericValue;
export function talbotNumericInverse(ast: unknown, t: number): NumericValue;
export function formatComplexVal(re: number, im: number): string;
export function parseExpression(input: string, variable?: string): unknown;

export function evalAt(ast: unknown, t: number): number;
