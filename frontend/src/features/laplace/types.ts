import type { TransformResult } from "./engine.mjs";
export type Mode = "forward" | "inverse";
export interface CalculationRequest {
  expression: string;
  mode: Mode;
  sigma: number;
  omega: number;
  time: number;
}
export interface CalculationResult extends Omit<TransformResult, "ast"> {
  numeric?: { label: string; value: string }[];
}
