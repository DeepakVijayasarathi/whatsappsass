"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api, getErrMsg } from "@/lib/api";
import { Send, BookOpen } from "lucide-react";
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

// Build Meta components array from filled variable values
function buildComponents(varValues: Record<number, string>): object[] {
  const parameters = Object.entries(varValues)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, text]) => ({ type: "text", text }));
  if (parameters.length === 0) return [];
  return [{ type: "body", parameters }];
}

export default function SendPage() {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [varValues, setVarValues] = useState<Record<number, string>>({});

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

  const onSelect = (t: Template) => {
    setValue("templateName", t.name, { shouldValidate: true });
    setValue("languageCode", t.language, { shouldValidate: true });
    setSelectedTemplate(t);
    setVarValues({});
    setShowPicker(false);
  };

  const onSubmit = async (data: FormData) => {
    // Validate all variables are filled
    for (const n of variables) {
      if (!varValues[n]?.trim()) {
        toast.error(`Fill in variable {{${n}}} before sending`);
        return;
      }
    }
    try {
      await api.post("/whatsapp/send", {
        ...data,
        components: buildComponents(varValues),
      });
      toast.success("Message sent!");
      reset();
      setSelectedTemplate(null);
      setVarValues({});
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Failed to send message"));
    }
  };

  // Highlight template body substituting variables
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
              <input
                {...register("templateName")}
                className="input font-mono"
                placeholder="hello_world"
                onChange={(e) => {
                  setValue("templateName", e.target.value, { shouldValidate: true });
                  if (selectedTemplate && e.target.value !== selectedTemplate.name) {
                    setSelectedTemplate(null);
                    setVarValues({});
                  }
                }}
              />
              {errors.templateName && (
                <p className="text-red-500 text-xs mt-1">{errors.templateName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language code</label>
              <input {...register("languageCode")} className="input" placeholder="en_US" />
            </div>

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
              <div className="bg-gray-50 rounded-xl p-4 relative">
                <div className="absolute -left-1 top-3 w-2 h-4 bg-gray-50 rounded-l" />
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{previewBody}</p>
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
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>Only approved Meta templates can be sent</li>
              <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span>For bulk sends, use Campaigns instead</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
