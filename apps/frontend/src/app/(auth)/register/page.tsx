"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import {
  MessageSquare, ArrowRight, ArrowLeft, CheckCircle2,
  Megaphone, Inbox, BarChart2, Kanban, Eye, EyeOff, Shield,
} from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Minimum 8 characters"),
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
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error || "Registration failed"
      );
    }
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col bg-gray-950 p-14 relative overflow-hidden overflow-y-auto">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(16,185,129,0.18),transparent)]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(16,185,129,0.07),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Logo */}
        <div className="relative shrink-0">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50">
              <MessageSquare className="text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">
              {brand.name}
            </span>
          </Link>
        </div>

        {/* Content */}
        <div className="relative flex-1 flex flex-col justify-center py-10">
          <p className="text-emerald-500 text-[11px] font-black uppercase tracking-widest mb-4">Free forever</p>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            14 features,<br />one dashboard
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs">
            Campaigns, inbox, CRM, drip sequences, analytics, team roles — all self-hosted on your server.
          </p>
          <ul className="space-y-3 mb-8">
            {leftPerks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-600/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-sm text-gray-300">{text}</span>
              </li>
            ))}
          </ul>

          {/* Stat grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: "∞",   l: "Contacts" },
              { v: "0₹",  l: "Per-message" },
              { v: "14",  l: "Features" },
              { v: "2",   l: "WA providers" },
            ].map(({ v, l }) => (
              <div key={l} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-xl font-black text-white">{v}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative">
          <p className="text-gray-600 text-xs">Self-hosted · Your data, your rules</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white shrink-0">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-gray-900 text-sm">{brand.name}</span>
          </div>
          <div className="text-sm text-gray-500">
            Have an account?{" "}
            <Link href="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
              Sign in
            </Link>
          </div>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900">Create your account</h1>
              <p className="text-gray-500 text-sm mt-1.5">Start free — no credit card required</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                {/* Name + Workspace row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full name</label>
                    <input
                      {...register("name")}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      placeholder="Jane Doe"
                      autoFocus
                      autoComplete="name"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1.5">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Workspace</label>
                    <input
                      {...register("workspaceName")}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      placeholder="My Business"
                      autoComplete="organization"
                    />
                    {errors.workspaceName && (
                      <p className="text-red-500 text-xs mt-1.5">{errors.workspaceName.message}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Work email</label>
                  <input
                    {...register("email")}
                    type="email"
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-700">Password</label>
                    <span className="text-[11px] text-gray-400">min. 8 characters</span>
                  </div>
                  <div className="relative">
                    <input
                      {...register("password")}
                      type={showPass ? "text" : "password"}
                      className="w-full px-3.5 py-2.5 pr-11 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-gray-400"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2.5 rounded-xl shadow-sm shadow-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none mt-1"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>Create free account <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4">
                {brand.authPerks.slice(0, 3).map((perk) => (
                  <div key={perk} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-[11px] text-gray-500 font-medium">{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              By creating an account you agree to our terms of service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
