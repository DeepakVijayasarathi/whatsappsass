"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getErrMsg } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import {
  MessageSquare, ArrowRight, ArrowLeft, CheckCircle2,
  Megaphone, Inbox, BarChart2, Kanban, Eye, EyeOff, Shield,
} from "lucide-react";

const schema = z.object({
  name:          z.string().min(1, "Name required"),
  email:         z.string().email("Invalid email"),
  password:      z.string().min(8, "Minimum 8 characters"),
  workspaceName: z.string().min(1, "Workspace name required"),
});
type FormData = z.infer<typeof schema>;

const leftPerks = [
  { icon: Megaphone, text: "WhatsApp & Email campaigns" },
  { icon: Inbox,     text: "Two-way inbox with auto-replies" },
  { icon: Kanban,    text: "CRM pipeline + drip sequences" },
  { icon: BarChart2, text: "Analytics, audit log & webhooks" },
  { icon: Shield,    text: "Self-hosted — no per-message fees" },
];

const stats = [
  { v: "∞",   l: "Contacts" },
  { v: "0₹",  l: "Per-message" },
  { v: "14",  l: "Features" },
  { v: "2",   l: "WA providers" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/register", data);
      setAuth(res.data.token, res.data.user, res.data.workspace);
      toast.success("Account created! Welcome aboard.");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(getErrMsg(err, "Registration failed"));
    }
  };

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel (dark, brand) ── */}
      <aside className="hidden lg:flex lg:w-[42%] flex-col bg-gray-950 p-14 relative overflow-hidden overflow-y-auto" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(37,211,102,0.20),transparent)]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(37,211,102,0.08),transparent_70%)]" />
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
          <p className="text-brand text-2xs font-black uppercase tracking-widest mb-4">Free forever</p>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            14 features,<br />one dashboard
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs">
            Campaigns, inbox, CRM, drip sequences, analytics, team roles — all self-hosted on your server.
          </p>
          <ul className="space-y-3 mb-8">
            {leftPerks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand/15 border border-brand/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-gray-300">{text}</span>
              </li>
            ))}
          </ul>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map(({ v, l }) => (
              <div key={l} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-xl font-black text-white">{v}</p>
                <p className="text-2xs text-gray-400 font-medium mt-0.5">{l}</p>
              </div>
            ))}
          </div>
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
            Have an account?{" "}
            <Link
              href="/login"
              className="text-brand font-bold hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded px-1 -mx-1 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900">Create your account</h1>
              <p className="text-gray-500 text-sm mt-1.5">Start free — no credit card required</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>

                {/* Name + Workspace row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1.5">Full name</label>
                    <input
                      id="name"
                      {...register("name")}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                      placeholder="Jane Doe"
                      autoFocus
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "name-error" : undefined}
                    />
                    {errors.name && (
                      <p id="name-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="workspaceName" className="block text-xs font-semibold text-gray-700 mb-1.5">Workspace</label>
                    <input
                      id="workspaceName"
                      {...register("workspaceName")}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                      placeholder="My Business"
                      autoComplete="organization"
                      aria-invalid={!!errors.workspaceName}
                      aria-describedby={errors.workspaceName ? "workspace-error" : undefined}
                    />
                    {errors.workspaceName && (
                      <p id="workspace-error" role="alert" className="text-red-500 text-xs mt-1.5">{errors.workspaceName.message}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1.5">Work email</label>
                  <input
                    id="email"
                    {...register("email")}
                    type="email"
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                    placeholder="you@company.com"
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
                    <span className="text-2xs text-gray-400">min. 8 characters</span>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      {...register("password")}
                      type={showPass ? "text" : "password"}
                      className="w-full px-3.5 py-2.5 pr-11 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all placeholder:text-gray-400"
                      placeholder="••••••••"
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

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-bold text-sm py-2.5 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none mt-1"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                      Creating account…
                    </>
                  ) : (
                    <>Create free account <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                  )}
                </button>
              </form>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4">
                {brand.authPerks.slice(0, 3).map((perk) => (
                  <div key={perk} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
                    <span className="text-2xs text-gray-500 font-medium">{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-500 mt-4">
              By creating an account you agree to our terms of service.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
