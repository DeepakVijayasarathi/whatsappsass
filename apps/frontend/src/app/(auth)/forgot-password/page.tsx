"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { api } from "@/lib/api";
import { MessageSquare, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Copy, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { brand } from "@/lib/brand";

const schema = z.object({
  email: z.string().email("Invalid email"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent]         = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/forgot-password", data);
      if (res.data.resetUrl) setResetUrl(res.data.resetUrl);
    } catch {
      // Always show success to prevent user enumeration
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-gray-100 bg-white">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg px-1.5 py-1 -mx-1.5 -my-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Home
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg"
          aria-label={`${brand.name} home`}
        >
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-white" aria-hidden="true" />
          </div>
          <span className="font-black text-gray-900 text-sm">{brand.name}</span>
        </Link>
        <p className="text-sm text-gray-500 hidden sm:block">
          <Link
            href="/login"
            className="text-brand font-bold hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1"
          >
            Back to sign in
          </Link>
        </p>
        <span className="sm:hidden w-12" aria-hidden="true" />
      </header>

      {/* ── Card ── */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">

              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-5 h-5 text-brand" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-black text-gray-900">Forgot password?</h1>
                <p className="text-gray-500 text-sm mt-1.5">
                  Enter your email and we&apos;ll send a reset link.
                </p>
              </div>

              {sent ? (
                <div>
                  {resetUrl ? (
                    /* SMTP not configured — show URL directly */
                    <div>
                      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-amber-900 text-sm">SMTP not configured</p>
                          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                            Email delivery is not set up. Share the reset link below directly with the user.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                        <code className="text-xs text-gray-700 break-all flex-1 font-mono">{resetUrl}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(resetUrl); toast.success("Link copied"); }}
                          className="icon-btn-brand shrink-0"
                          aria-label="Copy reset link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-2xs text-amber-700 mb-4">
                        This link expires in 1 hour. Configure SMTP in Settings to enable email delivery.
                      </p>
                    </div>
                  ) : (
                    /* SMTP configured — show generic success message */
                    <div className="text-center py-2" role="status" aria-live="polite">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-7 h-7 text-emerald-500" aria-hidden="true" />
                      </div>
                      <p className="font-bold text-gray-900">Check your inbox</p>
                      <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                        If that email is registered, a reset link has been sent. It expires in 1 hour.
                      </p>
                    </div>
                  )}
                  <Link
                    href="/login"
                    className="mt-5 w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-200"
                  >
                    Back to sign in <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1.5">Email address</label>
                      <input
                        id="email"
                        {...register("email")}
                        type="email"
                        className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                        placeholder="you@example.com"
                        autoFocus
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? "email-error" : undefined}
                      />
                      {errors.email && (
                        <p id="email-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                          Sending…
                        </>
                      ) : (
                        <>Send reset link <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                      )}
                    </button>
                  </form>

                  <p className="text-center text-sm text-gray-500 mt-6">
                    Remembered it?{" "}
                    <Link
                      href="/login"
                      className="text-brand font-semibold hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
