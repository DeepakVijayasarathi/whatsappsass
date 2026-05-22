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

export default function SendPage() {
  const [showPicker, setShowPicker] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { languageCode: "en_US" } });

  const templateName = watch("templateName");

  const onSelect = (t: Template) => {
    setValue("templateName", t.name, { shouldValidate: true });
    setValue("languageCode", t.language, { shouldValidate: true });
    setShowPicker(false);
  };

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/whatsapp/send", data);
      toast.success("Message sent!");
      reset();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        "Failed to send message";
      toast.error(msg);
    }
  };

  return (
    <div>
      {showPicker && (
        <TemplatePicker onSelect={onSelect} onClose={() => setShowPicker(false)} />
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Send Message</h1>
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
                Template name
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
            />
            {templateName && (
              <p className="text-xs text-gray-400 mt-1 font-mono">Selected: {templateName}</p>
            )}
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

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            {isSubmitting ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}
