"use client";

export const dynamic = "force-dynamic";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { MessageSquare, ArrowRight, CheckCircle2, Megaphone, Inbox, BarChart2, GitBranch } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Minimum 8 characters"),
  workspaceName: z.string().min(1, "Workspace name required"),
});
type FormData = z.infer<typeof schema>;

const leftPerks = [
  { icon: Megaphone,  text: "WhatsApp & Email campaigns" },
  { icon: Inbox,      text: "Two-way inbox with auto-replies" },
  { icon: BarChart2,  text: "Analytics, CRM & drip sequences" },
  { icon: GitBranch,  text: "No per-message fees, ever" },
];

export default function RegisterPage() {
  const router = useRouter();

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
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel — dark brand ── */}
      <div className="hidden lg:flex lg:w-[44%] bg-gray-950 flex-col justify-between p-12 relative overflow-hidden">
        {/* Glow layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(37,211,102,0.20),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(18,140,126,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />

        {/* Logo */}
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-lg shadow-brand/30">
              <MessageSquare style={{ width: 18, height: 18 }} className="text-white" />
            </div>
            <span className="font-black text-white tracking-tight group-hover:text-brand transition-colors">
              {brand.name}
            </span>
          </Link>
        </div>

        {/* Content */}
        <div className="relative space-y-8">
          <div>
            <p className="text-brand text-xs font-black uppercase tracking-widest mb-3">Free forever</p>
            <h2 className="text-4xl font-black text-white leading-tight">
              Everything you need<br />to grow on WhatsApp
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mt-4 max-w-xs">
              One dashboard for campaigns, inbox, CRM, and automation. Self-hosted, no per-message fees.
            </p>
          </div>

          <ul className="space-y-3">
            {leftPerks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm text-gray-300 font-medium">{text}</span>
              </li>
            ))}
          </ul>

          {/* Mini stat strip */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { v: "∞", l: "Contacts" },
              { v: "0₹", l: "Per-message" },
              { v: "9+", l: "Features" },
              { v: "2", l: "Providers" },
            ].map(({ v, l }) => (
              <div key={l} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <p className="text-xl font-black text-white">{v}</p>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <p className="text-gray-600 text-xs">Self-hosted · Your data, your rules</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 relative">
        {/* Back to home */}
        <Link
          href="/"
          className="absolute top-6 left-6 text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
        >
          ← Home
        </Link>

        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-sm shadow-brand/30">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900">{brand.name}</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900">Create your account</h1>
            <p className="text-gray-500 text-sm mt-2">
              Already have one?{" "}
              <Link href="/login" className="text-brand font-bold hover:underline underline-offset-2">
                Sign in →
              </Link>
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Name + Workspace row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                    Full name
                  </label>
                  <input
                    {...register("name")}
                    className="input"
                    placeholder="Jane Doe"
                    autoFocus
                    autoComplete="name"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                    Workspace
                  </label>
                  <input
                    {...register("workspaceName")}
                    className="input"
                    placeholder="My Business"
                    autoComplete="organization"
                  />
                  {errors.workspaceName && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                      {errors.workspaceName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                  Work email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  className="input"
                  placeholder="you@company.com"
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
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                  Password
                  <span className="ml-1.5 text-gray-400 normal-case font-normal tracking-normal">min. 8 characters</span>
                </label>
                <input
                  {...register("password")}
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
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
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-brand-dark text-white font-bold py-3 rounded-xl shadow-md shadow-brand/25 hover:shadow-lg hover:shadow-brand/30 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  <>Create free account <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">no credit card required</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Perks row */}
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {brand.authPerks.slice(0, 3).map((perk) => (
                <div key={perk} className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                  {perk}
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
  );
}
