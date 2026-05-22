"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { MessageSquare, ArrowRight, Zap, Shield, Globe, CheckCircle2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

const perks = [
  { icon: Zap,    text: "Meta Cloud API & MSG91 supported" },
  { icon: Shield, text: "Multi-tenant workspaces" },
  { icon: Globe,  text: "Self-hosted — your data, your rules" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
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
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel — dark brand ── */}
      <div className="hidden lg:flex lg:w-[48%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Glow layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(37,211,102,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(18,140,126,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Top — logo */}
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-lg shadow-brand/30">
              <MessageSquare className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-black text-white tracking-tight group-hover:text-brand transition-colors">
              {brand.name}
            </span>
          </Link>
        </div>

        {/* Middle — headline + perks */}
        <div className="relative space-y-8">
          <div>
            <p className="text-brand text-xs font-black uppercase tracking-widest mb-3">Welcome back</p>
            <h2 className="text-4xl font-black text-white leading-tight">
              Your workspace<br />is waiting for you
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mt-4 max-w-xs">
              Sign in to manage campaigns, contacts, and conversations — all in one place.
            </p>
          </div>

          <ul className="space-y-3.5">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-gray-300 font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom — footer */}
        <div className="relative">
          <p className="text-gray-600 text-xs">Self-hosted · Your data, your rules</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 relative">
        {/* Back to home — top left */}
        <Link
          href="/"
          className="absolute top-6 left-6 text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
        >
          ← Home
        </Link>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-sm shadow-brand/30">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900">{brand.name}</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900">Sign in</h1>
            <p className="text-gray-500 text-sm mt-2">
              New here?{" "}
              <Link href="/register" className="text-brand font-bold hover:underline underline-offset-2">
                Create a free account →
              </Link>
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 space-y-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                  Email address
                </label>
                <input
                  {...register("email")}
                  type="email"
                  className="input"
                  placeholder="you@company.com"
                  autoFocus
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs text-brand hover:underline underline-offset-2 font-semibold">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPass ? "text" : "password"}
                    className="input pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 font-semibold"
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-dark text-white font-bold py-3 rounded-xl shadow-md shadow-brand/25 hover:shadow-lg hover:shadow-brand/30 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <>Sign in <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">secure · encrypted</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <CheckCircle2 key={i} className="w-3.5 h-3.5 text-brand" />
              ))}
              <span className="text-xs text-gray-500 ml-1 font-medium">Trusted by teams worldwide</span>
            </div>
          </div>
        </div>
      </div>
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
