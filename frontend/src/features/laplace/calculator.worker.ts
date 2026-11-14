import {
  computeLaplace,
  computeInverseLaplace,
  numericLaplaceIntegral,
  talbotNumericInverse,
  formatComplexVal,
} from "./engine.mjs";
import type { CalculationRequest, CalculationResult } from "./types";
self.onmessage = ({ data }: MessageEvent<CalculationRequest>) => {
  try {
    if (data.expression.length > 800)
      throw new Error(
        "สมการยาวเกินไป กรุณาแยกคำนวณทีละส่วน (ไม่เกิน 800 ตัวอักษร)",
      );
    const result =
      data.mode === "forward"
        ? computeLaplace(data.expression)
        : computeInverseLaplace(data.expression);
    const { ast, ...rest } = result;
    const output: CalculationResult = rest;
    if (result.isNumericFallback) {
      if (data.mode === "forward") {
        output.numeric = [
          [data.sigma, data.omega],
          [0.5, 0],
          [1, 0],
          [2, 0],
          [5, 0],
        ].map(([s, w], index) => {
          const r = numericLaplaceIntegral(ast, s, w);
          return {
            label:
              (index === 0 ? "ค่าที่เลือก · " : "") +
              "s = " +
              formatComplexVal(s, w),
            value: r.ok ? "≈ " + formatComplexVal(r.re, r.im) : r.reason,
          };
        });
      } else {
        output.numeric = [data.time, 0.25, 0.5, 1, 2].map((t, index) => {
          const r = talbotNumericInverse(ast, t);
          return {
            label: (index === 0 ? "ค่าที่เลือก · " : "") + "t = " + t,
            value: r.ok ? "≈ " + Number(r.value.toPrecision(7)) : r.reason,
          };
        });
      }
    }
    self.postMessage({ result: output });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "คำนวณไม่ได้ กรุณาตรวจสมการอีกครั้ง",
    });
  }
};
