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
import { MessageSquare, CheckCircle2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Minimum 8 characters"),
  workspaceName: z.string().min(1, "Workspace name required"),
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/register", data);
      setAuth(res.data.token, res.data.user, res.data.workspace);
      toast.success("Account created! Welcome aboard.");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        "Registration failed";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — branding ── */}
      <div className={`hidden lg:flex lg:w-[45%] bg-gradient-to-br ${brand.authGradient} flex-col justify-between p-12 text-white`}>
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-bold text-white tracking-tight">{brand.name}</span>
          </div>

          <h2 className="text-3xl font-extrabold leading-tight mb-4">
            {brand.authRegisterHeadline}
          </h2>
          <p className="text-white/70 text-sm leading-relaxed max-w-xs">
            One dashboard for campaigns, inbox, CRM, and automation. Self-hosted, no per-message fees.
          </p>

          <ul className="mt-10 space-y-3.5">
            {brand.authPerks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-sm text-white/90">
                <CheckCircle2 className="w-4.5 h-4.5 text-white/70 shrink-0" style={{ width: 18, height: 18 }} />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/40 text-xs">Self-hosted · Your data, your rules</p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">{brand.name}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900">Create your account</h1>
            <p className="text-gray-500 text-sm mt-1.5">Free to start. No credit card required.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                  <input {...register("name")} className="input" placeholder="Jane Doe" autoFocus />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
                  <input {...register("workspaceName")} className="input" placeholder="My Business" />
                  {errors.workspaceName && <p className="text-red-500 text-xs mt-1">{errors.workspaceName.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
                <input {...register("email")} type="email" className="input" placeholder="you@example.com" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input {...register("password")} type="password" className="input" placeholder="Min. 8 characters" />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5 mt-1">
                {isSubmitting ? "Creating your account…" : "Create account →"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Already have an account?{" "}
              <Link href="/login" className="text-brand font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            By creating an account you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
