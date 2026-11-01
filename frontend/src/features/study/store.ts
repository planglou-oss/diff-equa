import { useSyncExternalStore } from "react";
import type { Question } from "../../lib/api";
import {
  defaultRecord,
  emptyStudy,
  finishPractice,
  parseStudy,
  remainingSeconds,
  safeListURL,
} from "./model";
import type { Practice, RecordState, StudyData } from "./model";

const key = "ee-math-study-v1";
type Snapshot = StudyData & { storageError?: string };
let snapshot: Snapshot;
try {
  snapshot = parseStudy(localStorage.getItem(key));
} catch {
  snapshot = {
    ...emptyStudy(),
    storageError:
      "เบราว์เซอร์ไม่อนุญาตให้บันทึกความคืบหน้า ข้อมูลจะอยู่ชั่วคราวในหน้านี้",
  };
}
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
function update(fn: (s: StudyData) => StudyData) {
  const { storageError: _, ...data } = snapshot;
  const next = fn(data);
  snapshot = next;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    snapshot = {
      ...next,
      storageError:
        "บันทึกในเครื่องไม่สำเร็จ กรุณาตรวจพื้นที่หรือสิทธิ์ของเบราว์เซอร์",
    };
  }
  notify();
}
window.addEventListener("storage", (e) => {
  if (e.key === key) {
    snapshot = parseStudy(e.newValue);
    notify();
  }
});
export function useStudy() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => snapshot,
  );
}
export const study = {
  view(id: string, patch: Partial<StudyData["views"][string]>) {
    const initial = {
      original: false,
      explanation: false,
      help: false,
      hints: 0,
      step: 1,
    };
    try {
      initial.original = sessionStorage.getItem("original:" + id) === "1";
      initial.explanation = sessionStorage.getItem("explanation:" + id) === "1";
    } catch {
      /* New reading state still works when session storage is unavailable. */
    }
    update((s) => ({
      ...s,
      views: {
        ...s.views,
        [id]: {
          ...(s.views[id] ?? initial),
          ...patch,
        },
      },
    }));
  },
  record(id: string, patch: Partial<RecordState>) {
    update((s) => ({
      ...s,
      records: {
        ...s.records,
        [id]: {
          ...(s.records[id] ?? defaultRecord()),
          ...patch,
          updatedAt: Date.now(),
        },
      },
    }));
  },
  list(url: string, y: number) {
    if (snapshot.lastList.url === url && Math.abs(snapshot.lastList.y - y) < 2)
      return;
    update((s) => ({ ...s, lastList: { url: safeListURL(url), y } }));
  },
  visit(q: Question) {
    if (snapshot.resumeQuestion?.id === q.id) return;
    update((s) => ({
      ...s,
      resumeQuestion: {
        id: q.id,
        title: `${q.topic} · ข้อ ${q.displayNumber}`,
      },
    }));
  },
  start(questions: Question[], minutes: number) {
    update((s) => ({
      ...s,
      practice: {
        id: crypto.randomUUID(),
        questions,
        answers: {},
        index: 0,
        startedAt: Date.now(),
        durationSeconds: minutes * 60,
        finishedAt: null,
      },
    }));
  },
  practice(patch: Partial<Pick<Practice, "index" | "answers">>) {
    if (patch.answers && snapshot.practice) {
      if (snapshot.practice.finishedAt !== null) return;
      if (remainingSeconds(snapshot.practice) === 0) {
        this.finish();
        return;
      }
    }
    update((s) =>
      s.practice ? { ...s, practice: { ...s.practice, ...patch } } : s,
    );
  },
  finish() {
    update((s) => finishPractice(s));
  },
  finishIfExpired() {
    if (
      snapshot.practice &&
      snapshot.practice.finishedAt === null &&
      remainingSeconds(snapshot.practice) === 0
    )
      this.finish();
  },
  openResult(p: Practice) {
    if (p.finishedAt !== null && snapshot.practice?.finishedAt !== null)
      update((s) => ({ ...s, practice: p }));
  },
};
