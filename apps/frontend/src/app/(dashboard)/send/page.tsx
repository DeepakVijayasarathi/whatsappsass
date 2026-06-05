"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api, getErrMsg } from "@/lib/api";
import { Send, BookOpen, Loader2, Image, Video, FileText, Music } from "lucide-react";
import MediaHeaderInput, { type MediaFormat } from "@/components/MediaHeaderInput";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";
import clsx from "clsx";

// ── Template send ─────────────────────────────────────────────────────────────

const templateSchema = z.object({
  to: z.string().min(7, "Phone number required"),
  templateName: z.string().min(1, "Template name required"),
  languageCode: z.string().default("en_US"),
});
type TemplateForm = z.infer<typeof templateSchema>;

function extractVariables(body: string | null): number[] {
  if (!body) return [];
  const nums = [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  return nums;
}

function buildComponents(varValues: Record<number, string>, headerFormat?: string | null, headerMediaUrl?: string): object[] {
  const result: object[] = [];
  if (headerFormat && headerMediaUrl?.trim() && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
    const t = headerFormat.toLowerCase();
    result.push({ type: "header", parameters: [{ type: t, [t]: { link: headerMediaUrl.trim() } }] });
  }
  const parameters = Object.entries(varValues).sort(([a], [b]) => Number(a) - Number(b)).map(([, text]) => ({ type: "text", text }));
  if (parameters.length > 0) result.push({ type: "body", parameters });
  return result;
}

// ── Media send ────────────────────────────────────────────────────────────────

type MediaType = "image" | "video" | "document" | "audio";

const MEDIA_TYPES: { value: MediaType; label: string; icon: React.ElementType; format: MediaFormat | null }[] = [
  { value: "image",    label: "Image",    icon: Image,    format: "IMAGE" },
  { value: "video",    label: "Video",    icon: Video,    format: "VIDEO" },
  { value: "document", label: "Document", icon: FileText, format: "DOCUMENT" },
  { value: "audio",    label: "Audio",    icon: Music,    format: null },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SendPage() {
  const [mode, setMode] = useState<"template" | "media">("template");

  // ── Template state ──
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [varValues, setVarValues] = useState<Record<number, string>>({});
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<TemplateForm>({ resolver: zodResolver(templateSchema), defaultValues: { languageCode: "en_US" } });

  const templateName = watch("templateName");
  const variables = extractVariables(selectedTemplate?.body ?? null);

  useEffect(() => {
    if (!templateName || templateName === selectedTemplate?.name) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await api.get("/templates");
        const match = (r.data.templates as Template[]).find((t) => t.name.toLowerCase() === templateName.toLowerCase());
        if (match) { setSelectedTemplate(match); setValue("languageCode", match.language, { shouldValidate: false }); }
        else setSelectedTemplate(null);
      } catch { /* silently ignore */ } finally { setLookingUp(false); }
    }, 600);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  const onSelectTemplate = (t: Template) => {
    setValue("templateName", t.name, { shouldValidate: true });
    setValue("languageCode", t.language, { shouldValidate: true });
    setSelectedTemplate(t);
    setVarValues({});
    setHeaderMediaUrl("");
    setShowPicker(false);
  };

  const onSubmitTemplate = async (data: TemplateForm) => {
    const hf = selectedTemplate?.headerFormat;
    for (const n of variables) {
      if (!varValues[n]?.trim()) { toast.error(`Fill in variable {{${n}}} before sending`); return; }
    }
    try {
      await api.post("/whatsapp/send", { ...data, components: buildComponents(varValues, hf, headerMediaUrl) });
      toast.success("Message sent!");
      reset();
      setSelectedTemplate(null);
      setVarValues({});
      setHeaderMediaUrl("");
    } catch (err) { toast.error(getErrMsg(err, "Failed to send message")); }
  };

  const previewBody = selectedTemplate?.body
    ? selectedTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, n) => varValues[Number(n)] || `{{${n}}}`)
    : null;

  // ── Media state ──
  const [mediaTo, setMediaTo]           = useState("");
  const [mediaType, setMediaType]       = useState<MediaType>("image");
  const [mediaUrl, setMediaUrl]         = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaFilename, setMediaFilename] = useState("");
  const [mediaSending, setMediaSending] = useState(false);

  const onSendMedia = async () => {
    if (!mediaTo.trim()) { toast.error("Enter a phone number"); return; }
    if (!mediaUrl.trim()) { toast.error("Provide a media URL or upload a file"); return; }
    setMediaSending(true);
    try {
      await api.post("/whatsapp/send-media", {
        to:       mediaTo.trim(),
        mediaType,
        url:      mediaUrl.trim(),
        ...(mediaCaption.trim() ? { caption: mediaCaption.trim() } : {}),
        ...(mediaType === "document" && mediaFilename.trim() ? { filename: mediaFilename.trim() } : {}),
      });
      toast.success("Media sent!");
      setMediaTo("");
      setMediaUrl("");
      setMediaCaption("");
      setMediaFilename("");
    } catch (err) { toast.error(getErrMsg(err, "Failed to send media")); }
    finally { setMediaSending(false); }
  };

  const activeMedia = MEDIA_TYPES.find((m) => m.value === mediaType)!;

  return (
    <div>
      {showPicker && <TemplatePicker onSelect={onSelectTemplate} onClose={() => setShowPicker(false)} />}

      <div className="mb-6">
        <h1 className="page-title">Send Message</h1>
        <p className="page-subtitle">Send a one-off WhatsApp message to any number</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="card lg:col-span-3">
          {/* Mode tabs */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-6 w-fit text-sm font-semibold">
            <button
              type="button"
              onClick={() => setMode("template")}
              className={clsx("px-4 py-2 transition-colors", mode === "template" ? "bg-brand text-white" : "bg-white text-gray-500 hover:bg-gray-50")}
            >
              Template
            </button>
            <button
              type="button"
              onClick={() => setMode("media")}
              className={clsx("px-4 py-2 transition-colors border-l border-gray-200", mode === "media" ? "bg-brand text-white" : "bg-white text-gray-500 hover:bg-gray-50")}
            >
              Image / Media
            </button>
          </div>

          {/* ── Template form ── */}
          {mode === "template" && (
            <form onSubmit={handleSubmit(onSubmitTemplate)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To <span className="text-gray-400 font-normal">(phone with country code)</span>
                </label>
                <input {...register("to")} className="input font-mono" placeholder="+1234567890" />
                {errors.to && <p className="text-red-500 text-xs mt-1">{errors.to.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Template</label>
                  <button type="button" onClick={() => setShowPicker(true)} className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                    <BookOpen className="w-3.5 h-3.5" /> Browse templates
                  </button>
                </div>
                <div className="relative">
                  <input
                    {...register("templateName")}
                    className="input font-mono pr-8"
                    placeholder="hello_world"
                    onChange={(e) => {
                      setValue("templateName", e.target.value, { shouldValidate: true });
                      if (selectedTemplate && e.target.value !== selectedTemplate.name) { setSelectedTemplate(null); setVarValues({}); }
                    }}
                  />
                  {lookingUp && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                </div>
                {errors.templateName && <p className="text-red-500 text-xs mt-1">{errors.templateName.message}</p>}
                {selectedTemplate && !lookingUp && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                    Template found · {selectedTemplate.category.toLowerCase()} · {selectedTemplate.language}
                  </p>
                )}
                {templateName && !selectedTemplate && !lookingUp && (
                  <p className="text-xs text-amber-500 mt-1">Template not found in provider — you can still send if it exists</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language code</label>
                <input {...register("languageCode")} className="input" placeholder="en_US" />
              </div>

              {selectedTemplate?.headerFormat && ["IMAGE", "VIDEO", "DOCUMENT"].includes(selectedTemplate.headerFormat) && (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {selectedTemplate.headerFormat.charAt(0) + selectedTemplate.headerFormat.slice(1).toLowerCase()} Header
                    <span className="text-gray-400 font-normal ml-1">(optional — leave blank to use template&apos;s stored image)</span>
                  </label>
                  <MediaHeaderInput format={selectedTemplate.headerFormat as MediaFormat} value={headerMediaUrl} onChange={setHeaderMediaUrl} />
                </div>
              )}

              {variables.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                    <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold text-amber-800">!</span>
                    Fill in template variables
                  </p>
                  {variables.map((n) => (
                    <div key={n}>
                      <label className="block text-xs font-medium text-amber-700 mb-1">{`{{${n}}}`}</label>
                      <input className="input text-sm" placeholder={`Value for {{${n}}}`} value={varValues[n] ?? ""} onChange={(e) => setVarValues((v) => ({ ...v, [n]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" disabled={isSubmitting || !templateName} className="btn-primary w-full">
                <Send className="w-4 h-4" />
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}

          {/* ── Media form ── */}
          {mode === "media" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To <span className="text-gray-400 font-normal">(phone with country code)</span>
                </label>
                <input className="input font-mono" placeholder="+1234567890" value={mediaTo} onChange={(e) => setMediaTo(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Media type</label>
                <div className="grid grid-cols-4 gap-2">
                  {MEDIA_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setMediaType(value); setMediaUrl(""); }}
                      className={clsx(
                        "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-colors",
                        mediaType === value ? "border-brand bg-brand/5 text-brand" : "border-gray-200 text-gray-500 hover:border-gray-300"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{activeMedia.label}</label>
                {activeMedia.format ? (
                  <MediaHeaderInput format={activeMedia.format} value={mediaUrl} onChange={setMediaUrl} />
                ) : (
                  <input
                    className="input text-sm"
                    placeholder="https://example.com/audio.mp3"
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                )}
              </div>

              {mediaType === "document" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filename <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input className="input text-sm" placeholder="document.pdf" value={mediaFilename} onChange={(e) => setMediaFilename(e.target.value)} />
                </div>
              )}

              {mediaType !== "audio" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Caption <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea className="input text-sm resize-none" rows={2} placeholder="Add a caption..." value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
                </div>
              )}

              <button onClick={onSendMedia} disabled={mediaSending} className="btn-primary w-full">
                <Send className="w-4 h-4" />
                {mediaSending ? "Sending..." : `Send ${activeMedia.label}`}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Standalone media messages require an active 24-hour session window (the recipient must have messaged you first, or a template was sent).
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {mode === "template" && previewBody ? (
            <div className="card">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Message preview</p>
              <div className="bg-[#e5ddd5] rounded-xl p-3">
                <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm max-w-[90%]">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{previewBody}</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">WhatsApp template</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-right">Template: <code className="font-mono">{templateName}</code></p>
            </div>
          ) : mode === "media" && mediaUrl ? (
            <div className="card">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Preview</p>
              <div className="bg-[#e5ddd5] rounded-xl p-3">
                <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 shadow-sm max-w-[90%]">
                  {mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt="preview" className="rounded-lg w-full h-32 object-cover mb-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex items-center gap-2 py-2 text-xs text-gray-600 mb-1">
                      {mediaType === "video" ? <Video className="w-4 h-4 text-gray-400" /> : mediaType === "document" ? <FileText className="w-4 h-4 text-gray-400" /> : <Music className="w-4 h-4 text-gray-400" />}
                      <span className="truncate">{mediaFilename || activeMedia.label}</span>
                    </div>
                  )}
                  {mediaCaption && <p className="text-sm text-gray-800">{mediaCaption}</p>}
                  <p className="text-[10px] text-gray-400 text-right mt-1">WhatsApp media</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card border-2 border-dashed border-gray-200 text-center py-10">
              <Send className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-400">Preview</p>
              <p className="text-xs text-gray-300 mt-1">{mode === "template" ? "Select a template to see a preview" : "Add a media URL to see a preview"}</p>
            </div>
          )}

          <div className="card bg-blue-50 border-blue-100">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Tips</p>
            <ul className="space-y-1.5 text-xs text-blue-600">
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Include country code: <code className="font-mono">+91</code> for India, <code className="font-mono">+1</code> for USA</li>
              {mode === "template" ? (
                <>
                  <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Only approved templates can be sent</li>
                  <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>For bulk sends, use <a href="/campaigns" className="underline font-semibold">Campaigns</a></li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Image: JPEG/PNG max 5 MB · Video: MP4 max 16 MB · Document: any max 100 MB</li>
                  <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>MSG91 only — not supported on Meta Cloud API</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
