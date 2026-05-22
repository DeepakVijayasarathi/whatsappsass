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
import { MessageSquare } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", data);
      setAuth(res.data.token, res.data.user, res.data.workspace);
      const from = searchParams.get("from");
      const safePath = from && /^\/[^/]/.test(from) ? from : "/dashboard";
      router.push(safePath);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
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
            {brand.authLoginHeadline}
          </h2>
          <p className="text-white/70 text-sm leading-relaxed max-w-xs">
            Sign in to your workspace and pick up where you left off.
          </p>
        </div>

        <div className="text-white/40 text-xs space-y-1">
          <p>Self-hosted · Your data, your rules</p>
          <Link href="/" className="hover:text-white/60 underline underline-offset-2">
            ← Back to home
          </Link>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">{brand.name}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900">Sign in</h1>
            <p className="text-gray-500 text-sm mt-1.5">Enter your credentials to continue.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  autoFocus
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <Link href="/forgot-password" className="text-xs text-brand hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <input
                  {...register("password")}
                  type="password"
                  className="input"
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-1">
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-5">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-brand font-semibold hover:underline">
                Register free
              </Link>
            </p>
          </div>

          <p className="text-center mt-4 lg:hidden">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
              ← Back to home
            </Link>
          </p>
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
