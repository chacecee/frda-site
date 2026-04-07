"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { onValue, ref } from "firebase/database";
import { auth, db, rtdb } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";

type StaffRole = "Admin" | "Moderator" | "Reviewer" | "Staff";
type StaffStatus = "Invited" | "Active" | "Removed";

type StaffMember = {
  id: string;
  displayName: string;
  discordProfile: string;
  robloxInput: string;
  emailAddress: string;
  role: StaffRole;
  status: StaffStatus;
  dateInvited?: Timestamp | null;
  dateJoined?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type PresenceEntry = {
  state?: "online" | "offline";
  lastChanged?: number;
  email?: string;
};

const ROLE_OPTIONS: StaffRole[] = ["Admin", "Moderator", "Reviewer", "Staff"];

function formatDateTime(value?: Timestamp | null): string {
  if (!value) return "—";

  const date = value.toDate();

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  return `${datePart} (${timePart})`;
}

function normalizePresenceKey(value?: string | null): string {
  return value?.trim().toLowerCase().replaceAll(".", ",") || "";
}

function getStatusBadgeClass(status: StaffStatus) {
  switch (status) {
    case "Invited":
      return "bg-amber-500/10 text-amber-300";
    case "Active":
      return "bg-emerald-500/10 text-emerald-300";
    case "Removed":
      return "bg-zinc-800/80 text-zinc-300";
    default:
      return "bg-zinc-800/80 text-zinc-300";
  }
}

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        online ? "bg-emerald-400" : "bg-zinc-500"
      }`}
      title={online ? "Online" : "Offline"}
    />
  );
}

type StaffFormState = {
  displayName: string;
  discordProfile: string;
  robloxInput: string;
  emailAddress: string;
  role: StaffRole;
};

const EMPTY_FORM: StaffFormState = {
  displayName: "",
  discordProfile: "",
  robloxInput: "",
  emailAddress: "",
  role: "Staff",
};

export default function StaffPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceEntry>>(
    {}
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM);
  const [savingStaff, setSavingStaff] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const displayName =
    user?.displayName?.trim() ||
    (user?.email ? user.email.split("@")[0] : "Unknown User");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/admin/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    setLoadingStaff(true);
    setErrorMsg("");

    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: StaffMember[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<StaffMember, "id">),
        }));

        setStaffList(rows);
        setLoadingStaff(false);
      },
      (error) => {
        console.error("Error loading staff:", error);
        setErrorMsg("Could not load staff records.");
        setLoadingStaff(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const statusRef = ref(rtdb, "status");

    const unsubscribe = onValue(statusRef, (snapshot) => {
      setPresenceMap((snapshot.val() as Record<string, PresenceEntry>) || {});
    });

    return () => unsubscribe();
  }, []);

  const currentSignedInStaff = useMemo(() => {
    const signedInEmail = normalizeEmail(user?.email);
    if (!signedInEmail) return null;

    return (
      staffList.find(
        (staff) => normalizeEmail(staff.emailAddress) === signedInEmail
      ) || null
    );
  }, [staffList, user?.email]);

  const isAdmin = currentSignedInStaff?.role === "Admin";

  const filteredStaff = useMemo(() => {
    const queryText = searchTerm.trim().toLowerCase();
    if (!queryText) return staffList;

    return staffList.filter((staff) => {
      return (
        staff.displayName.toLowerCase().includes(queryText) ||
        staff.robloxInput.toLowerCase().includes(queryText) ||
        staff.emailAddress.toLowerCase().includes(queryText) ||
        staff.role.toLowerCase().includes(queryText) ||
        staff.status.toLowerCase().includes(queryText)
      );
    });
  }, [staffList, searchTerm]);

  function openAddModal() {
    setEditingStaffId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  }

  function openEditModal(staff: StaffMember) {
    if (!isAdmin) return;

    setEditingStaffId(staff.id);
    setForm({
      displayName: staff.displayName,
      discordProfile: staff.discordProfile,
      robloxInput: staff.robloxInput,
      emailAddress: staff.emailAddress,
      role: staff.role,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (savingStaff) return;
    setIsModalOpen(false);
    setEditingStaffId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  async function sendStaffInvite(
    emailAddress: string,
    displayName: string,
    role: string
  ) {
    const response = await fetch("/api/staff/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emailAddress,
        displayName,
        role,
      }),
    });
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to send invite email.");
      }

      return result;
    }

    const text = await response.text();
    throw new Error(
      `Invite route returned ${response.status} ${response.statusText}. ${text.slice(0, 200)}`
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !form.displayName.trim() ||
      !form.discordProfile.trim() ||
      !form.emailAddress.trim()
    ) {
      alert("Please fill out Display Name, Position, and Email Address.");
      return;
    }

    setSavingStaff(true);

    try {
      const trimmedDisplayName = form.displayName.trim();
      const trimmedDiscord = form.discordProfile.trim();
      const trimmedPosition = form.robloxInput.trim();
      const trimmedEmail = form.emailAddress.trim();

      if (editingStaffId) {
        await updateDoc(doc(db, "staff", editingStaffId), {
          displayName: trimmedDisplayName,
          discordProfile: trimmedDiscord,
          robloxInput: trimmedPosition,
          emailAddress: trimmedEmail,
          role: form.role,
          updatedAt: serverTimestamp(),
        });

        closeModal();
        return;
      }

      await addDoc(collection(db, "staff"), {
        displayName: trimmedDisplayName,
        discordProfile: trimmedDiscord,
        robloxInput: trimmedPosition,
        emailAddress: trimmedEmail,
        role: form.role,
        status: "Invited",
        dateInvited: serverTimestamp(),
        dateJoined: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSendingInvite(true);

      try {
        await sendStaffInvite(trimmedEmail, trimmedDisplayName, form.role);
        alert(`Staff record saved and invite email sent to ${trimmedEmail}.`);
      } catch (inviteError) {
        console.error("Invite email error:", inviteError);
        alert(
          `Staff record was saved, but the invite email could not be sent to ${trimmedEmail}. You can try again later.`
        );
      } finally {
        setSendingInvite(false);
      }

      closeModal();
    } catch (error) {
      console.error("Error saving staff member:", error);
      alert("Could not save this staff member. Please try again.");
    } finally {
      setSavingStaff(false);
    }
  }

  async function confirmRemoveStaff() {
    if (!pendingRemoveId) return;

    try {
      await updateDoc(doc(db, "staff", pendingRemoveId), {
        status: "Removed",
        updatedAt: serverTimestamp(),
      });
      setPendingRemoveId(null);
      closeModal();
    } catch (error) {
      console.error("Error removing staff:", error);
      alert("Could not remove this staff member.");
    }
  }

  async function confirmDeleteStaff() {
    if (!pendingDeleteId) return;

    try {
      await deleteDoc(doc(db, "staff", pendingDeleteId));
      setPendingDeleteId(null);
      closeModal();
    } catch (error) {
      console.error("Error deleting staff:", error);
      alert("Could not delete this staff member.");
    }
  }

  const editingStaff = editingStaffId
    ? staffList.find((staff) => staff.id === editingStaffId) || null
    : null;

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-sm text-zinc-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[250px_minmax(0,1fr)]">
        <AdminSidebar
          active="staff"
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onNavigate={(path) => router.push(path)}
          onSignOut={handleSignOut}
          displayName={displayName}
          email={user.email}
        />

        <section className="relative bg-zinc-900/75 px-5 py-5 md:px-10 md:py-8 xl:px-14">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              style={{ borderRadius: 8 }}
            >
              ☰
            </button>
            <p className="text-sm font-medium text-zinc-300">Menu</p>
          </div>

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Staff</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Manage staff access, roles, and invitation status.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={openAddModal}
                className="bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                style={{ borderRadius: 8 }}
              >
                Add Staff
              </button>
            )}
          </div>

          <div className="mb-5">
            <input
              type="text"
              placeholder="Search by display name, email, position, role, or status"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500"
              style={{ borderRadius: 10 }}
            />
          </div>

          {errorMsg ? <p className="mb-5 text-sm text-red-400">{errorMsg}</p> : null}

          <div
            className="hidden overflow-hidden border border-zinc-700 bg-zinc-900/85 md:block"
            style={{ borderRadius: 10 }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-zinc-800 bg-zinc-950/35">
                  <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                    <th className="px-4 py-4">Display Name</th>
                    <th className="px-4 py-4">Role</th>
                    <th className="px-4 py-4">Date Invited</th>
                    <th className="px-4 py-4">Date Joined</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingStaff ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-sm text-zinc-400">
                        Loading staff...
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-sm text-zinc-400">
                        No staff members found.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => {
                      const isOnline =
                        presenceMap[normalizePresenceKey(staff.emailAddress)]
                          ?.state === "online";

                      return (
                        <tr
                          key={staff.id}
                          className="border-b border-zinc-800/80 text-sm text-white last:border-b-0"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center gap-2 font-medium text-white">
                              <PresenceDot online={isOnline} />
                              <span>{staff.displayName}</span>
                            </div>

                            {staff.robloxInput.trim() && (
                              <div className="mt-1 pl-[18px] text-xs text-zinc-400">
                                {staff.robloxInput}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 align-top text-zinc-300">
                            {staff.role}
                          </td>
                          <td className="px-4 py-4 align-top text-zinc-300">
                            {formatDateTime(staff.dateInvited)}
                          </td>
                          <td className="px-4 py-4 align-top text-zinc-300">
                            {formatDateTime(staff.dateJoined)}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                                staff.status
                              )}`}
                            >
                              {staff.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right align-top">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => openEditModal(staff)}
                                className="border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
                                style={{ borderRadius: 8 }}
                              >
                                Edit
                              </button>
                            ) : (
                              <span className="text-zinc-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 md:hidden">
            {loadingStaff ? (
              <div
                className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                style={{ borderRadius: 10 }}
              >
                Loading staff...
              </div>
            ) : filteredStaff.length === 0 ? (
              <div
                className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                style={{ borderRadius: 10 }}
              >
                No staff members found.
              </div>
            ) : (
              filteredStaff.map((staff) => {
                const isOnline =
                  presenceMap[normalizePresenceKey(staff.emailAddress)]
                    ?.state === "online";

                return (
                  <div
                    key={staff.id}
                    className="border border-zinc-700 bg-zinc-900/85 p-4"
                    style={{ borderRadius: 10 }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <PresenceDot online={isOnline} />
                          <p className="text-base font-semibold text-white">
                            {staff.displayName}
                          </p>
                        </div>
                        {staff.robloxInput.trim() ? (
                          <p className="mt-1 pl-[18px] text-sm text-zinc-400">
                            {staff.robloxInput}
                          </p>
                        ) : null}
                      </div>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                          staff.status
                        )}`}
                      >
                        {staff.status}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-zinc-300">
                      <p>
                        <span className="text-zinc-500">Role:</span> {staff.role}
                      </p>
                      <p>
                        <span className="text-zinc-500">Invited:</span>{" "}
                        {formatDateTime(staff.dateInvited)}
                      </p>
                      <p>
                        <span className="text-zinc-500">Joined:</span>{" "}
                        {formatDateTime(staff.dateJoined)}
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openEditModal(staff)}
                        className="mt-4 w-full border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
                        style={{ borderRadius: 8 }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 10 }}
          >
            <div className="border-b border-zinc-800 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    {editingStaffId ? "Edit Staff Member" : "Invite Staff Member"}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    {editingStaffId
                      ? "Update this staff member’s details or role."
                      : "Add a new staff member to the FRDA portal."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white hover:bg-zinc-800"
                  style={{ borderRadius: 8 }}
                >
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                    style={{ borderRadius: 8 }}
                    placeholder="Enter display name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Position
                  </label>
                  <input
                    type="text"
                    value={form.robloxInput}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, robloxInput: e.target.value }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                    style={{ borderRadius: 8 }}
                    placeholder="Enter staff position or title"
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
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                    style={{ borderRadius: 8 }}
                    placeholder="Username or Discord profile"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.emailAddress}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, emailAddress: e.target.value }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                    style={{ borderRadius: 8 }}
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        role: e.target.value as StaffRole,
                      }))
                    }
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                    style={{ borderRadius: 8 }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Current Status
                  </label>
                  <div className="min-h-[48px] px-0 py-2 text-sm text-white">
                    {editingStaff ? (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                          editingStaff.status
                        )}`}
                      >
                        {editingStaff.status}
                      </span>
                    ) : (
                      <span className="text-zinc-400">
                        Will be set to Invited automatically when the invite is sent
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  {editingStaffId && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPendingRemoveId(editingStaffId)}
                        className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-500/15"
                        style={{ borderRadius: 8 }}
                      >
                        Remove
                      </button>

                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(editingStaffId)}
                        className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/15"
                        style={{ borderRadius: 8 }}
                      >
                        Delete Permanently
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
                    style={{ borderRadius: 8 }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={savingStaff}
                    className="bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderRadius: 8 }}
                  >
                    {savingStaff
                      ? sendingInvite
                        ? "Sending Invite..."
                        : "Saving..."
                      : editingStaffId
                        ? "Save Changes"
                        : "Add Staff"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingRemoveId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 10 }}
          >
            <h3 className="text-xl font-semibold text-white">Remove Staff Member</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              This will keep the staff record but mark the person as Removed.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingRemoveId(null)}
                className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
                style={{ borderRadius: 8 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmRemoveStaff}
                className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300 hover:bg-amber-500/15"
                style={{ borderRadius: 8 }}
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 10 }}
          >
            <h3 className="text-xl font-semibold text-white">Delete Permanently</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              This will permanently delete the staff record from Firestore.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
                style={{ borderRadius: 8 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteStaff}
                className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/15"
                style={{ borderRadius: 8 }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}