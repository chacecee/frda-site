"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import { ClipboardList, Users, ShieldUser } from "lucide-react";
import { usePresence } from "@/lib/usePresence";

type AdminSidebarProps = {
  active: "applications" | "staff" | "admin_tools";
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  displayName: string;
  email?: string | null;
};

type StaffProfile = {
  id: string;
  displayName: string;
  discordProfile: string;
  robloxInput: string;
  emailAddress: string;
  role?: string;
  status?: string;
};

type ProfileFormState = {
  displayName: string;
  discordProfile: string;
  robloxInput: string;
};

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function SidebarLink({
  label,
  active = false,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left text-base font-medium transition ${active
        ? "text-white"
        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
        }`}
      style={{
        borderRadius: 0,
        borderLeft: active ? "2px solid #60a5fa" : "2px solid transparent",
        background: active
          ? "linear-gradient(90deg, rgba(59,130,246,0.34) 0%, rgba(96,165,250,0.16) 42%, rgba(24,24,27,0.96) 100%)"
          : "transparent",
        boxShadow: active
          ? "inset 0 0 0 1px rgba(59,130,246,0.08)"
          : "none",
      }}
    >
      <span
        className={`shrink-0 ${active ? "opacity-100 text-blue-300" : "opacity-70"}`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function AdminSidebar({
  active,
  sidebarOpen,
  onCloseSidebar,
  onNavigate,
  onSignOut,
  displayName,
  email,
}: AdminSidebarProps) {
  const { user } = useAuthUser();
  usePresence(user);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [form, setForm] = useState<ProfileFormState>({
    displayName: "",
    discordProfile: "",
    robloxInput: "",
  });

  const signedInEmail = normalizeEmail(user?.email || email);

  useEffect(() => {
    if (!signedInEmail) {
      setStaffProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError("");

    const q = query(
      collection(db, "staff"),
      where("emailAddress", "==", signedInEmail),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setStaffProfile(null);
          setProfileLoading(false);
          return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as Omit<StaffProfile, "id">;

        setStaffProfile({
          id: docSnap.id,
          ...data,
        });

        setProfileLoading(false);
      },
      (error) => {
        console.error("Error loading sidebar profile:", error);
        setProfileError("Could not load your profile details.");
        setProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [signedInEmail]);

  const displayedName = useMemo(() => {
    return staffProfile?.displayName?.trim() || displayName;
  }, [staffProfile?.displayName, displayName]);

  const displayedEmail = useMemo(() => {
    return staffProfile?.emailAddress?.trim() || email || "—";
  }, [staffProfile?.emailAddress, email]);

  const isAdminRole =
    staffProfile?.role?.trim().toLowerCase() === "admin";

  function openProfileModal() {
    setProfileError("");

    setForm({
      displayName: staffProfile?.displayName || displayName || "",
      discordProfile: staffProfile?.discordProfile || "",
      robloxInput: staffProfile?.robloxInput || "",
    });

    setProfileModalOpen(true);
  }

  function closeProfileModal() {
    if (savingProfile) return;
    setProfileModalOpen(false);
    setProfileError("");
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!staffProfile) {
      setProfileError("No matching staff profile was found for this account.");
      return;
    }

    if (!form.displayName.trim()) {
      setProfileError("Display Name is required.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      await updateDoc(doc(db, "staff", staffProfile.id), {
        displayName: form.displayName.trim(),
        discordProfile: form.discordProfile.trim(),
        robloxInput: form.robloxInput.trim(),
      });

      setProfileModalOpen(false);
    } catch (error) {
      console.error("Error saving own profile:", error);
      setProfileError("Could not save your profile changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseSidebar}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[250px] flex-col bg-[#02040a] transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.07) 16%, rgba(59,130,246,0.02) 28%, rgba(59,130,246,0) 40%), linear-gradient(to bottom, #02040a 0%, #010309 32%, #000000 100%)",
        }}
      >
        <div className="p-5">
          <div className="mb-8 flex items-center gap-3">
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-2xl font-semibold leading-tight text-white">
                FRDA Portal
              </p>
              <p className="text-xs text-zinc-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="space-y-0">
          <SidebarLink
            label="Developer Applications"
            icon={<ClipboardList size={18} strokeWidth={1.3} />}
            active={active === "applications"}
            onClick={() => {
              onCloseSidebar();
              onNavigate("/admin");
            }}
          />

          <SidebarLink
            label="Staff"
            icon={<Users size={18} strokeWidth={1.3} />}
            active={active === "staff"}
            onClick={() => {
              onCloseSidebar();
              onNavigate("/admin/staff");
            }}
          />

          {isAdminRole ? (
            <SidebarLink
              label="Admin"
              icon={<ShieldUser size={18} strokeWidth={1.3} />}
              active={active === "admin_tools"}
              onClick={() => {
                onCloseSidebar();
                onNavigate("/admin/reassign");
              }}
            />
          ) : null}
        </nav>

        <div className="mt-auto p-5">
          <div className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                Signed in as
              </p>

              <button
                type="button"
                onClick={openProfileModal}
                className="shrink-0 cursor-pointer bg-transparent p-0 text-2xl leading-none text-zinc-400 transition hover:text-blue-300"
                aria-label="Edit profile"
                title="Edit profile"
              >
                ⚙
              </button>
            </div>

            <p className="mt-4 break-words text-base font-semibold text-white">
              {displayedName}
            </p>
            <p className="mt-1 break-words text-sm text-zinc-400">
              {displayedEmail}
            </p>
          </div>

          <button
            onClick={onSignOut}
            className="mt-4 cursor-pointer text-sm font-medium text-zinc-400 transition hover:text-blue-300"
          >
            Log out
          </button>
        </div>
      </aside>

      {profileModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-lg border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 5 }}
          >
            <div className="border-b border-zinc-800 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Edit My Details
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Update your staff profile details.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeProfileModal}
                  aria-label="Close"
                  className="cursor-pointer text-white hover:text-zinc-300"
                  style={{
                    width: 42,
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    border: "1px solid rgba(63, 63, 70, 1)",
                    background: "rgba(9, 9, 11, 0.9)",
                    fontSize: 22,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        displayName: e.target.value,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 5 }}
                    placeholder="Enter your display name"
                    disabled={profileLoading || savingProfile}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Discord Profile
                  </label>
                  <input
                    type="text"
                    value={form.discordProfile}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        discordProfile: e.target.value,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 5 }}
                    placeholder="Enter your Discord profile"
                    disabled={profileLoading || savingProfile}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Roblox Username / User ID / Link
                  </label>
                  <input
                    type="text"
                    value={form.robloxInput}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        robloxInput: e.target.value,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 5 }}
                    placeholder="Optional"
                    disabled={profileLoading || savingProfile}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={displayedEmail}
                    readOnly
                    className="w-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400 outline-none"
                    style={{ borderRadius: 5 }}
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Your login email can’t be changed from this window.
                  </p>
                </div>

                {profileError ? (
                  <p className="text-sm text-red-400">{profileError}</p>
                ) : null}

                {!profileLoading && !staffProfile ? (
                  <p className="text-sm text-amber-300">
                    No matching staff profile was found for your signed-in email.
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeProfileModal}
                  className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    borderRadius: 5,
                    background: "transparent",
                    border: "1px solid rgba(113, 113, 122, 0.45)",
                  }}
                  disabled={savingProfile}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingProfile || profileLoading || !staffProfile}
                  className="px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    borderRadius: 5,
                    background: "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                    border: "1px solid rgba(96, 165, 250, 0.55)",
                    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                    minWidth: 130,
                  }}
                >
                  {savingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}