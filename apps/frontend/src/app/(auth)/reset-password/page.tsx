"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api, getErrMsg } from "@/lib/api";
import { CheckCircle2, AlertCircle, MessageSquare, ArrowLeft, ArrowRight, Lock, Eye, EyeOff } from "lucide-react";
import { brand } from "@/lib/brand";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
  confirm:  z.string().min(1, "Please confirm your password"),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});
type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token");
  const [done, setDone]               = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPass, setShowPass]       = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post("/auth/reset-password", { token, password: data.password });
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: unknown) {
      setServerError(getErrMsg(err, "Reset failed. The link may have expired."));
    }
  };

  // ── Invalid / missing token ─────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <AuthHeader />
        <main className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-400" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-black text-gray-900">Invalid reset link</h1>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                This reset link is missing a token or has been corrupted. Request a new link below.
              </p>
              <Link
                href="/forgot-password"
                className="mt-6 inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-200"
              >
                Request new link <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Main flow ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <AuthHeader />
      <main className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-5 h-5 text-brand" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-black text-gray-900">Set a new password</h1>
                <p className="text-gray-500 text-sm mt-1.5">Choose a strong password — at least 8 characters.</p>
              </div>

              {done ? (
                <div className="text-center py-2" role="status" aria-live="polite">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" aria-hidden="true" />
                  </div>
                  <p className="font-bold text-gray-900">Password updated!</p>
                  <p className="text-sm text-gray-500 mt-1.5">Redirecting to sign in…</p>
                </div>
              ) : (
                <>
                  {serverError && (
                    <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1.5">
                        New password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          {...register("password")}
                          type={showPass ? "text" : "password"}
                          className="w-full px-3.5 py-2.5 pr-11 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                          placeholder="••••••••"
                          autoFocus
                          autoComplete="new-password"
                          aria-invalid={!!errors.password}
                          aria-describedby={errors.password ? "password-error" : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 rounded transition-colors"
                          aria-label={showPass ? "Hide password" : "Show password"}
                          aria-pressed={showPass}
                          tabIndex={-1}
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p id="password-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="confirm" className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Confirm password
                      </label>
                      <input
                        id="confirm"
                        {...register("confirm")}
                        type={showPass ? "text" : "password"}
                        className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        aria-invalid={!!errors.confirm}
                        aria-describedby={errors.confirm ? "confirm-error" : undefined}
                      />
                      {errors.confirm && (
                        <p id="confirm-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.confirm.message}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none mt-1"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                          Updating…
                        </>
                      ) : (
                        <>Reset password <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                      )}
                    </button>
                  </form>

                  <p className="text-center text-sm text-gray-500 mt-6">
                    <Link
                      href="/forgot-password"
                      className="text-brand font-semibold hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1"
                    >
                      Request a new link
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

/** Shared header for reset-password & token-error views */
function AuthHeader() {
  return (
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
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
