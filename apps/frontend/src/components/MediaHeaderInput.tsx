"use client";

import { useRef, useState } from "react";
import { Upload, Link2, RefreshCw, Image, Video, File, CheckCircle } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import Cookies from "js-cookie";

export type MediaFormat = "IMAGE" | "VIDEO" | "DOCUMENT";

export const ACCEPT_BY_FORMAT: Record<MediaFormat, string> = {
  IMAGE:    "image/jpeg,image/png,image/webp,image/gif",
  VIDEO:    "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const SIZE_HINT: Record<MediaFormat, string> = {
  IMAGE:    "JPEG, PNG, WEBP, GIF · max 5 MB",
  VIDEO:    "MP4, 3GP · max 16 MB",
  DOCUMENT: "PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX · max 100 MB",
};

async function uploadTemplateMedia(file: File): Promise<string> {
  const token = Cookies.get("token");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/uploads/template-media", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const json = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Upload failed");
  return json.url!;
}

/**
 * Dual-mode media input: "Upload File" tab and "Enter URL" tab.
 * Calls onChange(url) whenever a URL becomes available.
 */
export default function MediaHeaderInput({
  format,
  value,
  onChange,
}: {
  format: MediaFormat;
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadTemplateMedia(file);
      onChange(url);
      setUploadedName(file.name);
      toast.success("File uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const FormatIcon = format === "IMAGE" ? Image : format === "VIDEO" ? Video : File;

  return (
    <div className="space-y-2">
      <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={clsx(
            "px-3 py-1.5 flex items-center gap-1.5 transition-colors",
            mode === "upload" ? "bg-brand text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <Upload className="w-3 h-3" /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={clsx(
            "px-3 py-1.5 flex items-center gap-1.5 transition-colors border-l border-gray-200",
            mode === "url" ? "bg-brand text-white" : "bg-white text-gray-500 hover:bg-gray-50"
          )}
        >
          <Link2 className="w-3 h-3" /> Enter URL
        </button>
      </div>

      {mode === "upload" ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_BY_FORMAT[format]}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <label
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={clsx(
              "flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-colors",
              uploading
                ? "border-brand/40 bg-brand/5 cursor-wait"
                : "border-gray-200 hover:border-brand/50 hover:bg-brand/5"
            )}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <RefreshCw className="w-5 h-5 text-brand animate-spin" />
                <span className="text-xs text-brand font-medium">Uploading…</span>
              </>
            ) : value && uploadedName ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-xs text-green-700 font-medium text-center break-all">{uploadedName}</span>
                <span className="text-[10px] text-gray-400">Click to replace</span>
              </>
            ) : (
              <>
                <FormatIcon className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Click to choose file</span>
                <span className="text-[10px] text-gray-400 text-center">{SIZE_HINT[format]}</span>
                <span className="text-[10px] text-gray-400">or drag and drop</span>
              </>
            )}
          </label>
        </div>
      ) : (
        <input
          value={value}
          onChange={(e) => { setUploadedName(""); onChange(e.target.value); }}
          className="input text-sm"
          placeholder={`https://example.com/sample.${format === "IMAGE" ? "jpg" : format === "VIDEO" ? "mp4" : "pdf"}`}
          type="url"
        />
      )}
    </div>
  );
}
