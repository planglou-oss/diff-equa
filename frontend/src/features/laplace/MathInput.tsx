import { useEffect, useRef, useState } from "react";
import { MathfieldElement } from "mathlive";
import type { Mode } from "./types";
import { calculatorExpression } from "./expression.mjs";
MathfieldElement.fontsDirectory = "/mathlive/fonts";
MathfieldElement.soundsDirectory = null;

type Key = {
  label: string;
  latex?: string;
  command?:
    | "undo"
    | "moveToPreviousChar"
    | "moveToNextChar"
    | "deleteBackward"
    | "moveToSuperscript";
  title?: string;
};
const baseKeys: Key[] = [
  { label: "a / b", latex: "\\frac{#0}{#?}", title: "เศษส่วน" },
  { label: "aⁿ", command: "moveToSuperscript", title: "เลขยกกำลัง" },
  { label: "√", latex: "\\sqrt{#0}", title: "รากที่สอง" },
  { label: "( )", latex: "\\left(#0\\right)", title: "วงเล็บ" },
  { label: "7", latex: "7" },
  { label: "8", latex: "8" },
  { label: "9", latex: "9" },
  { label: "÷", latex: "/" },
  { label: "4", latex: "4" },
  { label: "5", latex: "5" },
  { label: "6", latex: "6" },
  { label: "×", latex: "\\cdot" },
  { label: "1", latex: "1" },
  { label: "2", latex: "2" },
  { label: "3", latex: "3" },
  { label: "−", latex: "-" },
  { label: "0", latex: "0" },
  { label: ".", latex: "." },
  { label: "π", latex: "\\pi" },
  { label: "+", latex: "+" },
];
const functionKeys: Key[] = [
  { label: "sin", latex: "\\sin\\left(#0\\right)" },
  { label: "cos", latex: "\\cos\\left(#0\\right)" },
  { label: "tan", latex: "\\tan\\left(#0\\right)" },
  { label: "arctan", latex: "\\arctan\\left(#0\\right)" },
  { label: "sinh", latex: "\\sinh\\left(#0\\right)" },
  { label: "cosh", latex: "\\cosh\\left(#0\\right)" },
  { label: "tanh", latex: "\\tanh\\left(#0\\right)" },
  { label: "eⁿ", latex: "e^{#0}" },
  { label: "ln", latex: "\\ln\\left(#0\\right)" },
  { label: "|a|", latex: "\\left|#0\\right|" },
  { label: "a²", latex: "#0^2" },
  { label: "1 / a", latex: "\\frac{1}{#0}" },
];
const specialKeys: Key[] = [
  { label: "u(t−a)", latex: "u\\left(t-#0\\right)", title: "Unit step" },
  {
    label: "δ(t−a)",
    latex: "\\delta\\left(t-#0\\right)",
    title: "Dirac delta",
  },
  { label: "rect", latex: "\\operatorname{rect}\\left(#0\\right)" },
  { label: "tri", latex: "\\operatorname{tri}\\left(#0\\right)" },
  { label: "floor", latex: "\\operatorname{floor}\\left(#0\\right)" },
  { label: "saw", latex: "\\operatorname{sawtooth}\\left(#0\\right)" },
  { label: "J₀", latex: "\\operatorname{J0}\\left(#0\\right)" },
  { label: "erf", latex: "\\operatorname{erf}\\left(#0\\right)" },
];
export interface EditorValue {
  latex: string;
  expression: string;
}
export function MathInput({
  value,
  mode,
  onChange,
  onSubmit,
}: {
  value: string;
  mode: Mode;
  onChange: (value: EditorValue) => void;
  onSubmit: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const callbacks = useRef({ onChange, onSubmit });
  callbacks.current = { onChange, onSubmit };
  const [tab, setTab] = useState("basic");
  const [open, setOpen] = useState(true);
  const notify = () => {
    const mf = field.current;
    if (mf)
      callbacks.current.onChange({
        latex: mf.value,
        expression: calculatorExpression(mf.getValue("ascii-math")),
      });
  };
  useEffect(() => {
    const mf = new MathfieldElement();
    mf.mathVirtualKeyboardPolicy = "manual";
    mf.smartFence = true;
    mf.setAttribute("aria-label", "พิมพ์สมการ Laplace");
    mf.setAttribute("aria-describedby", "laplace-editor-help");
    mf.setAttribute("placeholder", "พิมพ์สมการที่นี่");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        callbacks.current.onSubmit();
      }
    };
    mf.addEventListener("input", notify);
    mf.addEventListener("keydown", onKey, true);
    host.current?.append(mf);
    field.current = mf;
    return () => {
      mf.removeEventListener("input", notify);
      mf.removeEventListener("keydown", onKey, true);
      mf.remove();
      field.current = null;
    };
  }, []);
  useEffect(() => {
    if (field.current && field.current.value !== value)
      field.current.value = value;
  }, [value]);
  const press = (key: Key) => {
    const mf = field.current;
    if (!mf) return;
    mf.focus();
    if (key.command) mf.executeCommand(key.command);
    else if (key.latex)
      mf.insert(key.latex, {
        focus: true,
        selectionMode: key.latex.includes("#") ? "placeholder" : "after",
      });
    notify();
  };
  const keys =
    tab === "basic"
      ? baseKeys
      : tab === "functions"
        ? functionKeys
        : specialKeys;
  const renderKey = (key: Key) => (
    <button
      type="button"
      key={key.label}
      className={
        ["t", "s", "e"].includes(key.label) ? "laplace-variable-key" : ""
      }
      title={key.title}
      aria-label={key.title || key.label}
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => press(key)}
    >
      {key.title === "เศษส่วน" ? (
        <span className="laplace-fraction-key">
          <i>a</i>
          <i>b</i>
        </span>
      ) : (
        key.label
      )}
    </button>
  );
  return (
    <>
      <div className="laplace-editor-shell">
        <span className="laplace-prefix">
          {mode === "forward" ? "f(t)" : "F(s)"} =
        </span>
        <div className="laplace-math-host" ref={host} />
      </div>
      <div className="laplace-editor-caption">
        <small id="laplace-editor-help">
          ใช้ / สร้างเศษส่วน · ^ ยกกำลัง · ลูกศรเลื่อนตำแหน่ง · Enter คำนวณ
        </small>
        <button
          type="button"
          className="laplace-text-button"
          aria-expanded={open}
          aria-controls="laplace-keypad"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "ซ่อนแป้นพิมพ์" : "เปิดแป้นพิมพ์"}
        </button>
      </div>
      {open && (
        <div
          className="laplace-keypad"
          id="laplace-keypad"
          aria-label="แป้นพิมพ์สัญลักษณ์คณิตศาสตร์"
        >
          <div className="laplace-keypad-top">
            <div
              className="laplace-key-tabs"
              role="group"
              aria-label="หมวดสัญลักษณ์"
            >
              {[
                ["basic", "123"],
                ["functions", "ฟังก์ชัน"],
                ["special", "Laplace"],
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="laplace-edit-keys">
              {(
                [
                  { label: "↶", title: "เลิกทำ", command: "undo" },
                  {
                    label: "←",
                    title: "เลื่อนไปซ้าย",
                    command: "moveToPreviousChar",
                  },
                  {
                    label: "→",
                    title: "เลื่อนไปขวา",
                    command: "moveToNextChar",
                  },
                  {
                    label: "⌫",
                    title: "ลบสัญลักษณ์",
                    command: "deleteBackward",
                  },
                ] satisfies Key[]
              ).map((key) => (
                <button
                  type="button"
                  key={key.title}
                  aria-label={key.title}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => press(key)}
                >
                  {key.label}
                </button>
              ))}
            </div>
          </div>
          {tab === "basic" ? (
            <div className="laplace-basic-layout">
              <div className="laplace-key-grid laplace-symbol-keys">
                {[
                  {
                    label: mode === "forward" ? "t" : "s",
                    latex: mode === "forward" ? "t" : "s",
                  },
                  { label: "e", latex: "e" },
                  ...baseKeys.slice(0, 4),
                  ...functionKeys.slice(0, 2),
                ].map((key) => renderKey(key))}
              </div>
              <div className="laplace-key-grid laplace-number-keys">
                {baseKeys.slice(4).map((key) => renderKey(key))}
              </div>
            </div>
          ) : (
            <div className="laplace-key-grid">
              {keys.map((key) => renderKey(key))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
