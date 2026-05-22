"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
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
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        "Failed to send message";
      toast.error(msg);
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Send Message</h1>
        <p className="text-gray-500 text-sm mt-1">
          Send a WhatsApp template message to a contact
        </p>
      </div>

      <div className="card max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center">
            <Send className="w-5 h-5 text-brand" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Single Message</p>
            <p className="text-xs text-gray-400">
              Requires WhatsApp API to be enabled in Settings
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To (phone number)
            </label>
            <input
              {...register("to")}
              className="input"
              placeholder="+1234567890"
            />
            {errors.to && <p className="text-red-500 text-xs mt-1">{errors.to.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Template
              </label>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="text-xs text-brand font-medium flex items-center gap-1 hover:underline"
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
                // Clear selected template if user types manually
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language code
            </label>
            <input
              {...register("languageCode")}
              className="input"
              placeholder="en_US"
            />
          </div>

          {/* Template variables — only shown when template has {{N}} placeholders */}
          {variables.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">
                Template variables — fill in all fields
              </p>
              {variables.map((n) => (
                <div key={n}>
                  <label className="block text-xs font-medium text-amber-700 mb-1">
                    Variable {`{{${n}}}`}
                  </label>
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

          {/* Live preview */}
          {previewBody && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Preview</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{previewBody}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !templateName}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}
