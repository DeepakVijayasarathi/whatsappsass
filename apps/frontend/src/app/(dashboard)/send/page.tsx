"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api, getErrMsg } from "@/lib/api";
import { Send, BookOpen, Loader2 } from "lucide-react";
import MediaHeaderInput, { type MediaFormat } from "@/components/MediaHeaderInput";
import TemplatePicker, { type Template } from "@/components/TemplatePicker";

const schema = z.object({
  to: z.string().min(7, "Phone number required"),
  templateName: z.string().min(1, "Template name required"),
  languageCode: z.string().default("en_US"),
});
type FormData = z.infer<typeof schema>;

// Extract {{1}}, {{2}} … placeholders from a template body
function extractVariables(body: string | null): number[] {
  if (!body) return [];
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)];
  const nums = [...new Set(matches.map((m) => Number(m[1])))].sort((a, b) => a - b);
  return nums;
}

// Build Meta components array from filled variable values + optional media header
function buildComponents(
  varValues: Record<number, string>,
  headerFormat?: string | null,
  headerMediaUrl?: string,
): object[] {
  const result: object[] = [];
  if (headerFormat && headerMediaUrl?.trim() && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
    const t = headerFormat.toLowerCase();
    result.push({ type: "header", parameters: [{ type: t, [t]: { link: headerMediaUrl.trim() } }] });
  }
  const parameters = Object.entries(varValues)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, text]) => ({ type: "text", text }));
  if (parameters.length > 0) result.push({ type: "body", parameters });
  return result;
}


export default function SendPage() {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [varValues, setVarValues] = useState<Record<number, string>>({});
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { languageCode: "en_US" } });

  const templateName = watch("templateName");
  const variables = extractVariables(selectedTemplate?.body ?? null);

  // Auto-lookup template body when user types a name manually (debounced 600ms)
  useEffect(() => {
    if (!templateName || templateName === selectedTemplate?.name) return;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await api.get("/templates");
        const match = (r.data.templates as Template[]).find(
          (t) => t.name.toLowerCase() === templateName.toLowerCase()
        );
        if (match) {
          setSelectedTemplate(match);
          setValue("languageCode", match.language, { shouldValidate: false });
        } else {
          // Template not found in provider — keep the typed name but clear the cached template
          setSelectedTemplate(null);
        }
      } catch {
        // silently ignore — user can still type and send
      } finally {
        setLookingUp(false);
      }
    }, 600);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateName]);

  const onSelect = (t: Template) => {
    setValue("templateName", t.name, { shouldValidate: true });
    setValue("languageCode", t.language, { shouldValidate: true });
    setSelectedTemplate(t);
    setVarValues({});
    setHeaderMediaUrl("");
    setShowPicker(false);
  };


  const onSubmit = async (data: FormData) => {
    const hf = selectedTemplate?.headerFormat;
    if (hf && ["IMAGE", "VIDEO", "DOCUMENT"].includes(hf) && !headerMediaUrl.trim()) {
      toast.error(`Provide a ${hf.toLowerCase()} URL for the template header`);
      return;
    }
    for (const n of variables) {
      if (!varValues[n]?.trim()) {
        toast.error(`Fill in variable {{${n}}} before sending`);
        return;
      }
    }
    try {
      await api.post("/whatsapp/send", {
        ...data,
        components: buildComponents(varValues, hf, headerMediaUrl),
      });
      toast.success("Message sent!");
      reset();
      setSelectedTemplate(null);
      setVarValues({});
      setHeaderMediaUrl("");
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to send message"));
    }
  };

  // Preview with variable substitution
  const previewBody = selectedTemplate?.body
    ? selectedTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, n) => varValues[Number(n)] || `{{${n}}}`)
    : null;

  return (
    <div>
      {showPicker && (
        <TemplatePicker onSelect={onSelect} onClose={() => setShowPicker(false)} />
      )}

      <div className="mb-6">
        <h1 className="page-title">Send Message</h1>
        <p className="page-subtitle">Send a one-off WhatsApp template message to any number</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Form */}
        <div className="card lg:col-span-3">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center shrink-0">
              <Send className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Single Message</p>
              <p className="text-xs text-gray-400">Requires WhatsApp API enabled in Settings</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To <span className="text-gray-400 font-normal">(phone with country code)</span>
              </label>
              <input
                {...register("to")}
                className="input font-mono"
                placeholder="+1234567890"
              />
              {errors.to && <p className="text-red-500 text-xs mt-1">{errors.to.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Template</label>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Browse templates
                </button>
              </div>
              <div className="relative">
                <input
                  {...register("templateName")}
                  className="input font-mono pr-8"
                  placeholder="hello_world"
                  onChange={(e) => {
                    setValue("templateName", e.target.value, { shouldValidate: true });
                    // Clear cached template if name is manually edited away from it
                    if (selectedTemplate && e.target.value !== selectedTemplate.name) {
                      setSelectedTemplate(null);
                      setVarValues({});
                    }
                  }}
                />
                {lookingUp && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
              {errors.templateName && (
                <p className="text-red-500 text-xs mt-1">{errors.templateName.message}</p>
              )}
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
                </label>
                <MediaHeaderInput
                  format={selectedTemplate.headerFormat as MediaFormat}
                  value={headerMediaUrl}
                  onChange={setHeaderMediaUrl}
                />
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
                    <input
                      className="input text-sm"
                      placeholder={`Value for {{${n}}}`}
                      value={varValues[n] ?? ""}
                      onChange={(e) => setVarValues((v) => ({ ...v, [n]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !templateName}
              className="btn-primary w-full"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>

        {/* Preview / Tips panel */}
        <div className="lg:col-span-2 space-y-4">
          {previewBody ? (
            <div className="card">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Message preview</p>
              {/* WhatsApp-style bubble */}
              <div className="bg-[#e5ddd5] rounded-xl p-3">
                <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm max-w-[90%]">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{previewBody}</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">WhatsApp template</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-right">
                Template: <code className="font-mono">{templateName}</code>
              </p>
            </div>
          ) : (
            <div className="card border-2 border-dashed border-gray-200 text-center py-10">
              <Send className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-400">Message preview</p>
              <p className="text-xs text-gray-300 mt-1">Select a template to see a preview</p>
            </div>
          )}

          <div className="card bg-blue-50 border-blue-100">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Tips</p>
            <ul className="space-y-1.5 text-xs text-blue-600">
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Include country code: <code className="font-mono">+1</code> for USA, <code className="font-mono">+91</code> for India</li>
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Only approved templates can be sent (add MSG91 templates in the <a href="/templates" className="underline font-semibold">Templates page</a>)</li>
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Type a template name to auto-look up its body and variables</li>
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>For bulk sends, use <a href="/campaigns" className="underline font-semibold">Campaigns</a> instead</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
