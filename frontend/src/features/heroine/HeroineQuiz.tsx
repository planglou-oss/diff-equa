import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./heroineQuiz.css";

const INTERVAL_MS = 6 * 60 * 60 * 1000;
const JUMPSCARE_IMAGE = "/images/yotsuba-jumpscare.png";
const choices = ["ichika", "nino", "miku", "yotsuba", "itsuki"] as const;

function HeroineDialog({
  onAnswer,
  onDismiss,
}: {
  onAnswer: (correct: boolean) => void;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState("");
  const [wrong, setWrong] = useState(false);
  const [correct, setCorrect] = useState(false);
  useEffect(() => {
    const image = new Image();
    image.src = JUMPSCARE_IMAGE;
  }, []);
  useEffect(() => {
    if (!correct) return;
    const timer = window.setTimeout(onDismiss, 3000);
    return () => window.clearTimeout(timer);
  }, [correct, onDismiss]);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={
        correct ? "heroine-dialog heroine-jumpscare" : "heroine-dialog"
      }
      aria-labelledby={correct ? undefined : "heroine-title"}
      aria-label={correct ? "Yotsuba — ตอบถูก" : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      {correct ? (
        <div className="heroine-jumpscare-stage">
          <img
            src={JUMPSCARE_IMAGE}
            alt="Yotsuba"
            className="heroine-jumpscare-image"
          />
        </div>
      ) : (
        <>
          <div className="heroine-dialog-accent" />
          <div className="heroine-dialog-body">
            <span className="heroine-eyebrow">พักตอบสักข้อ</span>
            <h2 id="heroine-title">ใครคือนางเอก</h2>
            {wrong ? (
              <div className="heroine-wrong">
                <p role="alert">คุณเป็น gay</p>
                <button
                  type="button"
                  className="heroine-submit"
                  autoFocus
                  onClick={onDismiss}
                >
                  ปิด
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selected) return;
                  const correct = selected === "yotsuba";
                  if (correct) setCorrect(true);
                  else {
                    setWrong(true);
                    onAnswer(false);
                  }
                }}
              >
                <fieldset className="heroine-choices">
                  <legend className="heroine-sr-only">
                    เลือกคำตอบหนึ่งข้อ
                  </legend>
                  {choices.map((choice, i) => (
                    <label
                      key={choice}
                      className={selected === choice ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="heroine"
                        value={choice}
                        checked={selected === choice}
                        onChange={() => setSelected(choice)}
                        required
                      />
                      <span className="heroine-option-number">{i + 1}</span>
                      <span>{choice}</span>
                    </label>
                  ))}
                </fieldset>
                <button
                  type="submit"
                  className="heroine-submit"
                  disabled={!selected}
                >
                  ตอบ
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}

export function HeroineReminder() {
  const [open, setOpen] = useState(false);
  const progress = useRef(0);
  const openRef = useRef(false);
  const resetRef = useRef(() => {});
  useEffect(() => {
    const canShow = () => document.visibilityState === "visible";
    let previousTime = Date.now();
    let running = true;
    const tick = () => {
      const now = Date.now();
      // Background tabs may throttle timers; count the full elapsed time.
      const delta =
        running && !openRef.current ? Math.max(0, now - previousTime) : 0;
      previousTime = now;
      progress.current = Math.min(INTERVAL_MS, progress.current + delta);
      if (
        progress.current >= INTERVAL_MS &&
        running &&
        !openRef.current &&
        canShow()
      ) {
        openRef.current = true;
        setOpen(true);
      }
    };
    const onActivityChange = () => tick();
    const onPageHide = () => {
      progress.current = 0;
      openRef.current = false;
      running = false;
      previousTime = Date.now();
      setOpen(false);
    };
    const onPageShow = () => {
      previousTime = Date.now();
      running = true;
    };
    resetRef.current = () => {
      progress.current = 0;
      openRef.current = false;
      previousTime = Date.now();
      running = true;
      setOpen(false);
    };
    tick();
    const timer = setInterval(tick, 1000);
    window.addEventListener("focus", onActivityChange);
    window.addEventListener("blur", onActivityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onActivityChange);
    return () => {
      tick();
      clearInterval(timer);
      window.removeEventListener("focus", onActivityChange);
      window.removeEventListener("blur", onActivityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onActivityChange);
    };
  }, []);
  if (!open) return null;
  return (
    <HeroineDialog
      onAnswer={(correct) => {
        if (correct) resetRef.current();
      }}
      onDismiss={() => resetRef.current()}
    />
  );
}

export function HeroineQuizBeta() {
  const [open, setOpen] = useState(true);
  const [attempt, setAttempt] = useState(0);
  return (
    <main className="heroine-beta">
      <span className="heroine-eyebrow">BETA PREVIEW</span>
      <h2>คำถามพักระหว่างเรียน</h2>
      <p>
        คำถามจะขึ้นเมื่อสะสมเวลาเปิดหน้าเว็บนี้ครบ 6 ชั่วโมง
        สลับแท็บหรือย่อหน้าต่างยังนับเวลาต่อ หากครบเวลาจะถามเมื่อกลับมาที่เว็บ
        ปิดเว็บหรือรีเฟรชจะเริ่มนับใหม่ หน้านี้เปิดให้ลองทันที
      </p>
      <div className="heroine-beta-card">
        <span className="heroine-beta-time">06:00:00</span>
        <h3>ใครคือนางเอก</h3>
        <p>
          ตอบถูก รูป Yotsuba จะเด้งขึ้นเต็มหน้าจอ แล้วปิดเองใน 3 วินาที
          <br />
          ตอบผิด จะแสดงข้อความที่กำหนด
        </p>
        <button
          type="button"
          className="heroine-submit"
          onClick={() => {
            setAttempt((n) => n + 1);
            setOpen(true);
          }}
        >
          ทดลองอีกครั้ง
        </button>
      </div>
      <Link to="/questions">กลับคลังข้อสอบ →</Link>
      {open && (
        <HeroineDialog
          key={attempt}
          onAnswer={(correct) => {
            if (correct) setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </main>
  );
}
