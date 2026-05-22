"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser, setAuth, getWorkspace } from "@/lib/auth";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Lock, Building2 } from "lucide-react";
import clsx from "clsx";

const profileSchema = z.object({
  name: z.string().min(1, "Name required"),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(8, "Min 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const roleBadge: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  marketer: "bg-gray-100 text-gray-600",
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const me = getUser();
  const workspace = getWorkspace();

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me?.name ?? "" },
  });

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSaveProfile = async (data: ProfileForm) => {
    try {
      const res = await api.patch("/workspace/profile", data);
      // Update local storage so sidebar reflects new name
      const token = document.cookie.match(/token=([^;]+)/)?.[1] ?? "";
      setAuth(token, { ...res.data, id: me!.id }, workspace!);
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Update failed"
      );
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    try {
      await api.patch("/workspace/profile", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success("Password changed successfully");
      resetPwd();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          "Password change failed"
      );
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "password", label: "Password", icon: Lock },
  ] as const;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your personal account settings</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left — identity card */}
        <div className="col-span-1">
          <div className="card text-center">
            <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl font-bold text-brand">
                {me?.name?.[0]?.toUpperCase() ?? "U"}
              </span>
            </div>
            <p className="font-semibold text-gray-900">{me?.name}</p>
            <p className="text-sm text-gray-500 mt-0.5">{me?.email}</p>
            <span className={clsx("badge mt-3 capitalize", roleBadge[me?.role ?? "marketer"])}>
              {me?.role}
            </span>

            <div className="mt-5 pt-5 border-t border-gray-100 text-left">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{workspace?.name}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-6 uppercase tracking-wide">
                {workspace?.plan} plan
              </p>
            </div>
          </div>
        </div>

        {/* Right — forms */}
        <div className="col-span-2">
          {/* Tabs */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTab === id
                    ? "border-brand text-brand"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "profile" && (
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Personal Information</h2>
              <form onSubmit={handleProfile(onSaveProfile)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full name
                  </label>
                  <input {...regProfile("name")} className="input" />
                  {profileErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{profileErrors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    value={me?.email ?? ""}
                    disabled
                    className="input bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input
                    value={me?.role ?? ""}
                    disabled
                    className="input bg-gray-50 text-gray-400 cursor-not-allowed capitalize"
                  />
                </div>
                <button
                  type="submit"
                  disabled={profileSubmitting}
                  className="btn-primary"
                >
                  {profileSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "password" && (
            <div className="card">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Change Password</h2>
              <form onSubmit={handlePwd(onChangePassword)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current password
                  </label>
                  <input
                    {...regPwd("currentPassword")}
                    type="password"
                    className="input"
                    placeholder="••••••••"
                  />
                  {pwdErrors.currentPassword && (
                    <p className="text-red-500 text-xs mt-1">{pwdErrors.currentPassword.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <input
                    {...regPwd("newPassword")}
                    type="password"
                    className="input"
                    placeholder="Min 8 characters"
                  />
                  {pwdErrors.newPassword && (
                    <p className="text-red-500 text-xs mt-1">{pwdErrors.newPassword.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <input
                    {...regPwd("confirmPassword")}
                    type="password"
                    className="input"
                    placeholder="Re-enter new password"
                  />
                  {pwdErrors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">{pwdErrors.confirmPassword.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={pwdSubmitting}
                  className="btn-primary"
                >
                  {pwdSubmitting ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
