import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import katex from "katex";
import { MathInput } from "./MathInput";
import type { EditorValue } from "./MathInput";
import type { CalculationRequest, CalculationResult, Mode } from "./types";
import "./laplace.css";

const examples = {
  forward: [
    {
      label: "พหุนาม + ไซน์",
      latex: "t^2e^{-3t}+\\sin(2t)",
      expression: "t^2*e^(-3*t)+sin(2*t)",
    },
    {
      label: "sin(at) / t",
      latex: "\\frac{\\sin(3t)}{t}",
      expression: "sin(3*t)/t",
    },
    { label: "Unit step", latex: "(t-2)u(t-2)", expression: "(t-2)*u(t-2)" },
    { label: "Dirac delta", latex: "\\delta(t-3)", expression: "delta(t-3)" },
    {
      label: "ค่าสัมบูรณ์",
      latex: "\\left|t-3\\right|",
      expression: "abs(t-3)",
    },
    { label: "ค่าสัมบูรณ์ไซน์", latex: "\\left|\\sin(t)\\right|", expression: "abs(sin(t))" },
    { label: "เชิงตัวเลข", latex: "\\tanh(t)", expression: "tanh(t)" },
  ],
  inverse: [
    {
      label: "แยกเศษส่วน",
      latex: "\\frac{2s+5}{(s+1)(s+3)}",
      expression: "(2*s+5)/((s+1)*(s+3))",
    },
    {
      label: "กำลังสองสมบูรณ์",
      latex: "\\frac{3s+7}{s^2+2s+5}",
      expression: "(3*s+7)/(s^2+2*s+5)",
    },
    {
      label: "ขั้วซ้ำ",
      latex: "\\frac{s^2+2s+3}{(s+1)^3}",
      expression: "(s^2+2*s+3)/(s+1)^3",
    },
    {
      label: "เลื่อนเวลา",
      latex: "\\frac{e^{-2s}}{s^2}",
      expression: "e^(-2*s)/s^2",
    },
    {
      label: "กำลังเศษส่วน",
      latex: "\\frac{1}{\\sqrt{s}}",
      expression: "1/sqrt(s)",
    },
    {
      label: "เชิงตัวเลข",
      latex: "\\frac{1}{s\\ln(s+2)}",
      expression: "1/(s*ln(s+2))",
    },
  ],
};
const pairs = [
  ["1", "\\frac{1}{s}", "s > 0"],
  ["t^n", "\\frac{n!}{s^{n+1}}", "n = 0, 1, 2, …"],
  ["e^{at}", "\\frac{1}{s-a}", "Re(s) > a"],
  ["\\sin(bt)", "\\frac{b}{s^2+b^2}", "Re(s) > 0"],
  ["\\cos(bt)", "\\frac{s}{s^2+b^2}", "Re(s) > 0"],
  ["u(t-a)", "\\frac{e^{-as}}{s}", "a ≥ 0"],
];
function Formula({ tex, display = false }: { tex: string; display?: boolean }) {
  const html = katex.renderToString(tex.replace(/\\frac/g, "\\dfrac"), {
    displayMode: display,
    throwOnError: false,
    trust: false,
  });
  return (
    <div
      className={display ? "laplace-formula display" : "laplace-formula"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
export function LaplacePage() {
  const [mode, setMode] = useState<Mode>("forward");
  const [editor, setEditor] = useState<EditorValue>(examples.forward[0]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [sigma, setSigma] = useState(1);
  const [omega, setOmega] = useState(0);
  const [time, setTime] = useState(1);
  const job = useRef<{
    worker: Worker;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const stop = useCallback(() => {
    if (job.current) {
      clearTimeout(job.current.timer);
      job.current.worker.terminate();
      job.current = null;
    }
  }, []);
  const calculate = useCallback(
    (request: CalculationRequest) => {
      stop();
      setResult(null);
      setError("");
      setCopied("");
      if (!request.expression.trim()) {
        setBusy(false);
        setError("ใส่สมการก่อนคำนวณ หรือลองเลือกตัวอย่างด้านล่าง");
        return;
      }
      setBusy(true);
      const worker = new Worker(
        new URL("./calculator.worker.ts", import.meta.url),
        { type: "module" },
      );
      const timer = setTimeout(() => {
        stop();
        setBusy(false);
        setError("สมการนี้ใช้เวลาคำนวณนาน ลองแยกเป็นพจน์ย่อยแล้วคำนวณใหม่");
      }, 8000);
      job.current = { worker, timer };
      worker.onmessage = ({
        data,
      }: MessageEvent<{ result?: CalculationResult; error?: string }>) => {
        stop();
        setBusy(false);
        if (data.error) setError(data.error);
        else if (data.result) setResult(data.result);
      };
      worker.onerror = () => {
        stop();
        setBusy(false);
        setError("เปิดเครื่องคำนวณไม่สำเร็จ กรุณาลองใหม่");
      };
      worker.postMessage(request);
    },
    [stop],
  );
  useEffect(() => () => stop(), [stop]);
  const run = () =>
    calculate({ expression: editor.expression, mode, sigma, omega, time });
  const changeEditor = (value: EditorValue) => {
    stop();
    setBusy(false);
    setEditor(value);
    setResult(null);
    setError("");
    setCopied("");
  };
  const chooseMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    changeEditor(examples[next][0]);
  };
  const chooseExample = (example: EditorValue) => {
    setEditor(example);
    calculate({ expression: example.expression, mode, sigma, omega, time });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        result?.plainFs || result?.plainOut || "",
      );
      setCopied("คัดลอกแล้ว");
    } catch {
      setCopied("คัดลอกอัตโนมัติไม่ได้ เลือกข้อความด้านล่างเพื่อคัดลอก");
    }
  };
  return (
    <main className="laplace-page">
      <div className="laplace-breadcrumb">
        <Link to="/questions">คลังข้อสอบ</Link>
        <span>/</span>
        <span>enuma elish</span>
      </div>
      <div className="laplace-page-heading">
        <div>
          <span className="laplace-eyebrow">STUDY TOOL / 01</span>
          <h2>
            enuma <span>elish</span>
          </h2>
          <p>ลองสมการ เห็นวิธีทำ เข้าใจการแปลง</p>
        </div>
        <span className="laplace-local-badge">
          <i />
          คำนวณในเครื่อง · ไม่ใช้ API
        </span>
      </div>
      <div className="laplace-workspace">
        <section
          className="laplace-panel laplace-input-panel"
          aria-labelledby="laplace-input-title"
        >
          <div
            className="laplace-mode-switch"
            role="group"
            aria-label="โหมดการแปลง"
          >
            <button
              type="button"
              aria-pressed={mode === "forward"}
              onClick={() => chooseMode("forward")}
            >
              แปลง Laplace <span>f(t) → F(s)</span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "inverse"}
              onClick={() => chooseMode("inverse")}
            >
              แปลงกลับ <span>F(s) → f(t)</span>
            </button>
          </div>
          <div className="laplace-panel-heading">
            <span className="laplace-step-number">01</span>
            <h3 id="laplace-input-title">ใส่ฟังก์ชันของคุณ</h3>
            <span className="laplace-domain">
              {mode === "forward" ? "TIME DOMAIN" : "s DOMAIN"}
            </span>
          </div>
          <MathInput
            value={editor.latex}
            mode={mode}
            onChange={changeEditor}
            onSubmit={run}
          />
          <div className="laplace-actions">
            <button
              type="button"
              className="laplace-calculate"
              onClick={run}
              disabled={busy}
            >
              {busy
                ? "กำลังคำนวณ…"
                : mode === "forward"
                  ? "คำนวณ Laplace"
                  : "คำนวณแปลงกลับ"}
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              className="laplace-clear"
              onClick={() => changeEditor({ latex: "", expression: "" })}
            >
              ล้าง
            </button>
          </div>
          <div className="laplace-examples">
            <h4>เริ่มจากตัวอย่าง</h4>
            <div>
              {examples[mode].map((example) => (
                <button
                  type="button"
                  key={example.label}
                  onClick={() => chooseExample(example)}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section
          className="laplace-panel laplace-result-panel"
          aria-labelledby="laplace-result-title"
          aria-busy={busy}
        >
          <div className="laplace-panel-heading">
            <span className="laplace-step-number green">02</span>
            <h3 id="laplace-result-title">ผลลัพธ์และวิธีทำ</h3>
            {result && (
              <span className="laplace-result-tag">
                {result.isNumericFallback ? "ค่าประมาณ" : "รูปแบบสัญลักษณ์"}
              </span>
            )}
          </div>
          {busy ? (
            <div className="laplace-empty" role="status">
              <div className="laplace-loading" />
              <h4>กำลังหาผลแปลง</h4>
              <p>จัดสมการและตรวจคู่แปลงที่ใช้</p>
              <button
                type="button"
                className="laplace-text-button"
                onClick={() => {
                  stop();
                  setBusy(false);
                }}
              >
                ยกเลิก
              </button>
            </div>
          ) : error ? (
            <div className="laplace-error" role="alert">
              <strong>ลองตรวจสมการอีกครั้ง</strong>
              <p>{error}</p>
              <small>
                ใช้ตัวแปร {mode === "forward" ? "t" : "s"}{" "}
                และใส่อาร์กิวเมนต์ของฟังก์ชันในวงเล็บ เช่น sin(2t)
              </small>
            </div>
          ) : result ? (
            <>
              <div className="laplace-result-answer">
                <span>
                  {result.isNumericFallback
                    ? "รูปอินทิกรัล · ดูค่าประมาณด้านล่าง"
                    : mode === "forward"
                      ? "ผลแปลง F(s)"
                      : "ผลแปลงกลับ f(t)"}
                </span>
                <Formula tex={result.resultTex} display />
                <small>{result.rocText || result.badgeText}</small>
              </div>
              <details className="laplace-parsed">
                <summary>สมการที่เครื่องมืออ่านได้</summary>
                <Formula tex={result.parsedTex} display />
              </details>
              <div className="laplace-solution-steps">
                {result.steps.map((step, index) => (
                  <div className="laplace-solution-step" key={index}>
                    <div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <h4>{step.ruleName}</h4>
                    </div>
                    <Formula tex={step.stepTex} display />
                  </div>
                ))}
              </div>
              {result.numeric && (
                <div className="laplace-numeric">
                  <h4>คำนวณค่าประมาณ</h4>
                  <p>
                    {mode === "forward"
                      ? "Gauss–Legendre quadrature · s = σ + jω"
                      : "Fixed Talbot · เวลา t > 0"}
                  </p>
                  <div className="laplace-numeric-controls">
                    {mode === "forward" ? (
                      <>
                        <label>
                          σ
                          <input
                            type="number"
                            step="0.5"
                            value={sigma}
                            onChange={(e) => setSigma(Number(e.target.value))}
                          />
                        </label>
                        <label>
                          ω
                          <input
                            type="number"
                            step="0.5"
                            value={omega}
                            onChange={(e) => setOmega(Number(e.target.value))}
                          />
                        </label>
                      </>
                    ) : (
                      <label>
                        t
                        <input
                          type="number"
                          min="0.05"
                          step="0.25"
                          value={time}
                          onChange={(e) => setTime(Number(e.target.value))}
                        />
                      </label>
                    )}
                    <button type="button" onClick={run}>
                      อัปเดตค่า
                    </button>
                  </div>
                  <dl>
                    {result.numeric.map((sample, i) => (
                      <div key={i}>
                        <dt>{sample.label}</dt>
                        <dd>{sample.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="laplace-copy">
                <code>{result.plainFs || result.plainOut}</code>
                <button type="button" onClick={copy}>
                  คัดลอก
                </button>
              </div>
              {copied && <small role="status">{copied}</small>}
            </>
          ) : (
            <div className="laplace-empty">
              <span className="laplace-empty-symbol">ℒ</span>
              <h4>จากสมการ สู่ความเข้าใจ</h4>
              <p>
                ใส่ฟังก์ชันแล้วกดคำนวณ
                <br />
                หรือเลือกตัวอย่างเพื่อเริ่มลองได้เลย
              </p>
              <Formula
                tex={
                  mode === "forward"
                    ? "\\mathcal{L}\\{f(t)\\}=\\int_0^{\\infty}e^{-st}f(t)\\,dt"
                    : "\\mathcal{L}^{-1}\\{F(s)\\}=f(t)"
                }
                display
              />
            </div>
          )}
        </section>
      </div>
      <section className="laplace-reference">
        <div>
          <span className="laplace-eyebrow">QUICK REFERENCE</span>
          <h3>คู่แปลงพื้นฐาน</h3>
          <p>สำหรับการแปลงด้านเดียว เมื่อ t ≥ 0</p>
          <Link to="/formulas">เปิดรวมสรุปสูตร →</Link>
        </div>
        <div className="laplace-pair-grid">
          {pairs.map(([from, to, note]) => (
            <div className="laplace-pair" key={from}>
              <Formula tex={from + "\\;\\longleftrightarrow\\;" + to} />
              <small>{note}</small>
            </div>
          ))}
        </div>
      </section>
      <p className="laplace-footnote">
        ใช้ช่วยตรวจและทบทวนวิธีทำ · รองรับรูปแบบตามกฎในเครื่องมือเดิม
        บางฟังก์ชันใช้การประมาณเชิงตัวเลข ควรตรวจเงื่อนไขการลู่เข้าประกอบ
      </p>
    </main>
  );
}
