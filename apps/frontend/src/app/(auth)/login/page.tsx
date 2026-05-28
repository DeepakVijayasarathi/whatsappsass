"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getErrMsg } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import {
  MessageSquare, ArrowRight, ArrowLeft, Eye, EyeOff,
  Megaphone, Inbox, BarChart2, Shield,
} from "lucide-react";

const schema = z.object({
  email:    z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

const perks = [
  { icon: Megaphone, text: "Campaigns, inbox & CRM in one place" },
  { icon: Inbox,     text: "Two-way inbox with auto-replies" },
  { icon: BarChart2, text: "Analytics, audit log & webhooks" },
  { icon: Shield,    text: "Self-hosted — your data, your rules" },
];

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", data);
      setAuth(res.data.token, res.data.user, res.data.workspace);
      const from = searchParams.get("from");
      const safePath = from && /^\/[^/]/.test(from) ? from : "/dashboard";
      router.push(safePath);
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel (dark, brand) ── */}
      <aside className="hidden lg:flex lg:w-[45%] flex-col bg-gray-950 p-14 relative overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(37,211,102,0.18),transparent)]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(37,211,102,0.07),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Logo */}
        <div className="relative shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded-lg"
            aria-label={`${brand.name} home`}
          >
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/30">
              <MessageSquare className="text-white" style={{ width: 18, height: 18 }} aria-hidden="true" />
            </div>
            <span className="font-black text-white tracking-tight group-hover:text-brand transition-colors">
              {brand.name}
            </span>
          </Link>
        </div>

        {/* Content */}
        <div className="relative flex-1 flex flex-col justify-center py-10">
          <p className="text-brand text-2xs font-black uppercase tracking-widest mb-4">Welcome back</p>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Your workspace<br />is waiting
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs">
            14 features. One dashboard. Your server.
          </p>
          <ul className="space-y-3.5">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-gray-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <p className="text-gray-600 text-xs">Self-hosted · Your data, your rules</p>
        </div>
      </aside>

      {/* ── Right panel (form) ── */}
      <main className="flex-1 flex flex-col bg-gray-50 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-gray-100 bg-white shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg px-1.5 py-1 -mx-1.5 -my-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Home
          </Link>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-white" aria-hidden="true" />
            </div>
            <span className="font-black text-gray-900 text-sm">{brand.name}</span>
          </div>
          <p className="text-sm text-gray-500">
            No account?{" "}
            <Link
              href="/register"
              className="text-brand font-bold hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900">Sign in</h1>
              <p className="text-gray-500 text-sm mt-1.5">Enter your credentials to continue</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    id="email"
                    {...register("email")}
                    type="email"
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                    placeholder="you@company.com"
                    autoFocus
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="email-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</label>
                    <Link
                      href="/forgot-password"
                      className="text-xs text-brand hover:text-brand-dark font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      {...register("password")}
                      type={showPass ? "text" : "password"}
                      className="w-full px-3.5 py-2.5 pr-11 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                      placeholder="••••••••"
                      autoComplete="current-password"
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

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none mt-1"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      Signing in…
                    </>
                  ) : (
                    <>Sign in <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                  )}
                </button>
              </form>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
                <span className="text-xs text-gray-500 font-medium">Secure · Encrypted · Self-hosted</span>
              </div>
            </div>

            <p className="text-center text-xs text-gray-500 mt-5">
              New to {brand.name}?{" "}
              <Link
                href="/register"
                className="text-brand font-semibold hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1"
              >
                Create a free account →
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
