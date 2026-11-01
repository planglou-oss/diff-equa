import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import type { Image } from "../lib/api";

export function MathHTML({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    if (!ref.current) return;
    ref.current.innerHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        "p",
        "h4",
        "b",
        "strong",
        "em",
        "div",
        "span",
        "br",
        "ul",
        "ol",
        "li",
      ],
      ALLOWED_ATTR: ["class"],
    });
    void import("katex/contrib/auto-render").then(
      ({ default: renderMathInElement }) => {
        if (active && ref.current)
          renderMathInElement(ref.current, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
            ],
            throwOnError: false,
            trust: false,
          });
      },
    );
    return () => {
      active = false;
    };
  }, [html]);
  return <div className="aib" ref={ref} />;
}
export function safeStudyHTML(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "h4",
      "b",
      "strong",
      "em",
      "div",
      "span",
      "br",
      "ul",
      "ol",
      "li",
    ],
    ALLOWED_ATTR: ["class"],
  });
}
export function Mascot({ className = "ic" }: { className?: string }) {
  return (
    <img
      className={className}
      src="/mascot.png"
      alt=""
      width={className === "av" ? 44 : 24}
      height={className === "av" ? 44 : 24}
    />
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      {error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}
      {retry && (
        <button className="chip" onClick={retry}>
          ลองใหม่
        </button>
      )}
    </div>
  );
}
export function QuestionImage({ image, alt }: { image: Image; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <div className="img">
        <button
          className="image-button"
          onClick={() => {
            setZoom(false);
            dialog.current?.showModal();
          }}
          aria-label={`ขยายภาพ ${alt}`}
        >
          <img
            src={image.url}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            alt={alt}
          />
        </button>
      </div>
      <dialog
        ref={dialog}
        className="image-dialog"
        aria-label={alt}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="dialog-toolbar">
          <span>{alt}</span>
          <button className="chip" onClick={() => setZoom((v) => !v)}>
            {zoom ? "พอดีหน้าจอ" : "ขนาดจริง"}
          </button>
          <button
            className="chip"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            ปิด ✕
          </button>
        </div>
        <div className={`zoom-image ${zoom ? "actual" : ""}`}>
          <img
            src={image.url}
            width={image.width}
            height={image.height}
            alt={alt}
          />
        </div>
      </dialog>
    </>
  );
}
