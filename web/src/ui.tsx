import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CircleHelp,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { SourceRef } from "./types";

export const percent = (value?: number | null) =>
  value == null ? "Unknown" : `${Number((value * 100).toFixed(1))}%`;
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
export const tone = (
  value: number | null,
  bands: { green: number; amber: number },
) =>
  value == null
    ? "unknown"
    : value >= bands.green
      ? "ready"
      : value >= bands.amber
        ? "watch"
        : "risk";
export const toneLabel = {
  ready: "Ready",
  watch: "Watch",
  risk: "At risk",
  unknown: "Unknown",
};
export function Status({
  value,
  bands,
}: {
  value: number | null;
  bands: { green: number; amber: number };
}) {
  const status = tone(value, bands),
    Icon =
      status === "ready"
        ? CheckCircle2
        : status === "watch"
          ? Clock3
          : status === "risk"
            ? AlertCircle
            : CircleHelp;
  return (
    <span className={`status ${status}`}>
      <Icon size={15} />
      {toneLabel[status]}
    </span>
  );
}
export function Loading({ text = "Loading exercise data" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={22} className="spin" />
      {text}
    </div>
  );
}
export function SourceButton({
  source,
  onOpen,
}: {
  source: SourceRef;
  onOpen: (source: SourceRef) => void;
}) {
  return (
    <button
      className="source-link"
      title={source.file}
      onClick={() => onOpen(source)}
    >
      <FileText size={13} />
      {source.key || source.loc || source.file.split("/").pop()}
    </button>
  );
}
