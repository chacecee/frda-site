"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";

type ApplicationStatus = "in_queue" | "accepted" | "rejected" | "removed";
type FilterTab = "in_queue" | "accepted" | "rejected" | "removed";

type Application = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age: number | null;
  region: string;
  skills: string;
  organization: string;
  roblox: string;
  discordId: string;
  viber: string;
  status: ApplicationStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedByUid?: string;
  reviewedByEmail?: string;
  reviewedByName?: string;
  reviewNote?: string;
  discordInviteUrl?: string;
  discordInviteCode?: string;
  discordInviteCreatedAt?: Timestamp;
  inviteEmailSentAt?: Timestamp;
};

function formatTimestamp(timestamp?: Timestamp) {
  if (!timestamp) return "—";
  return timestamp.toDate().toLocaleString();
}

function formatRegisteredOn(timestamp?: Timestamp) {
  if (!timestamp) return "—";

  const date = timestamp.toDate();

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

function getReviewerName(email?: string | null) {
  if (!email) return "Unknown";
  return email.split("@")[0];
}

function getStatusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "accepted":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
    case "rejected":
      return "bg-red-500/15 text-red-300 border border-red-500/20";
    case "removed":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    default:
      return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  }
}

function getRobloxLink(input?: string) {
  const raw = input?.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (/^\d+$/.test(raw)) {
    return `https://www.roblox.com/users/${raw}/profile`;
  }

  return `https://www.roblox.com/search/users?keyword=${encodeURIComponent(raw)}`;
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer px-1 py-2 text-sm font-medium transition ${
        active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-zinc-800 py-3 last:border-b-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="break-words text-sm text-white">{value || "—"}</div>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-zinc-800 pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("in_queue");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [pendingAction, setPendingAction] = useState<ApplicationStatus | null>(
    null
  );

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

    setLoadingApps(true);
    setErrorMsg("");

    const q = query(
      collection(db, "applications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: Application[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Application, "id">),
        }));

        setApplications(rows);
        setLoadingApps(false);
      },
      (error) => {
        console.error("Error loading applications:", error);
        setErrorMsg("Could not load applications.");
        setLoadingApps(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedApplication) return;

    const refreshed = applications.find((a) => a.id === selectedApplication.id);
    if (!refreshed) return;

    setSelectedApplication(refreshed);
  }, [applications, selectedApplication?.id]);

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();

    return applications.filter((app) => {
      const matchesTab = app.status === activeTab;
      if (!matchesTab) return false;

      if (!q) return true;

      const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        app.viber?.toLowerCase().includes(q) ||
        app.discordId?.toLowerCase().includes(q) ||
        app.roblox?.toLowerCase().includes(q) ||
        app.status?.toLowerCase().includes(q)
      );
    });
  }, [applications, search, activeTab]);

  function openReviewModal(app: Application) {
    setSelectedApplication(app);
    setReviewNote(app.reviewNote || "");
    setPendingAction(null);
  }

  function closeReviewModal() {
    if (savingReview) return;
    setSelectedApplication(null);
    setReviewNote("");
    setPendingAction(null);
  }

  function askForConfirmation(nextStatus: ApplicationStatus) {
    setPendingAction(nextStatus);
  }

  function closeConfirmation() {
    if (savingReview) return;
    setPendingAction(null);
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  async function sendAcceptedApplicantInvite(app: Application) {
    const response = await fetch("/api/discord/create-applicant-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        discordUserId: app.discordId,
        email: app.email,
        firstName: app.firstName,
      }),
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to create invite and send email.");
      }

      return result;
    }

    const text = await response.text();
    throw new Error(
      `Invite route returned ${response.status} ${response.statusText}. ${text.slice(0, 200)}`
    );
  }

  async function confirmReviewAction() {
    if (!selectedApplication || !user || !pendingAction) return;

    setSavingReview(true);

    try {
      const reviewerEmail = user.email || "";
      const reviewerName = getReviewerName(reviewerEmail);

      await updateDoc(doc(db, "applications", selectedApplication.id), {
        status: pendingAction,
        reviewNote: reviewNote.trim(),
        reviewedAt: serverTimestamp(),
        reviewedByUid: user.uid,
        reviewedByEmail: reviewerEmail,
        reviewedByName: reviewerName,
        updatedAt: serverTimestamp(),
      });

      if (pendingAction === "accepted") {
        if (!selectedApplication.discordId || !/^\d+$/.test(selectedApplication.discordId)) {
          alert(
            "Application was marked accepted, but no valid numeric Discord user ID was found, so no invite email was sent."
          );
        } else if (!selectedApplication.email) {
          alert(
            "Application was marked accepted, but no email address was found, so no invite email was sent."
          );
        } else {
          try {
            const inviteResult = await sendAcceptedApplicantInvite(selectedApplication);

            await updateDoc(doc(db, "applications", selectedApplication.id), {
              discordInviteUrl: inviteResult.inviteUrl,
              discordInviteCode: inviteResult.code,
              discordInviteCreatedAt: serverTimestamp(),
              inviteEmailSentAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            alert(
              `Application accepted and Discord invite email sent to ${selectedApplication.email}.`
            );
          } catch (inviteError) {
            console.error("Accepted applicant invite error:", inviteError);
            alert(
              "Application was accepted, but the Discord invite email could not be sent."
            );
          }
        }
      }

      setPendingAction(null);
      setSelectedApplication(null);
      setReviewNote("");
    } catch (error) {
      console.error("Error updating application:", error);
      alert("Could not update this application. Please try again.");
    } finally {
      setSavingReview(false);
    }
  }

  function getConfirmationCopy() {
    if (!selectedApplication || !pendingAction) return "";

    const name = selectedApplication.firstName || "this user";

    if (pendingAction === "accepted") {
      return `Are you sure you want to accept ${name}'s application?`;
    }

    if (pendingAction === "rejected") {
      return `Are you sure you want to reject ${name}'s application?`;
    }

    return `Are you sure you want to mark ${name}'s application as removed?`;
  }

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
          active="applications"
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onNavigate={(path) => router.push(path)}
          onSignOut={handleSignOut}
          displayName={displayName}
          email={user.email}
        />

        <section className="bg-zinc-900/75 p-4 md:p-8">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="cursor-pointer border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              style={{ borderRadius: 8 }}
            >
              ☰
            </button>
            <p className="text-sm font-medium text-zinc-300">Menu</p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Developer Applications</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Review and manage incoming developer registrations.
            </p>
          </div>

          <div className="mb-5">
            <input
              type="text"
              placeholder="Search by name, email, contact number, Discord ID, Roblox username, or status"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-emerald-500"
              style={{ borderRadius: 10 }}
            />
          </div>

          <div className="mb-5 flex items-center gap-6 overflow-x-auto border-b border-zinc-800">
            <FilterButton
              label="Pending Review"
              active={activeTab === "in_queue"}
              onClick={() => setActiveTab("in_queue")}
            />
            <FilterButton
              label="Accepted"
              active={activeTab === "accepted"}
              onClick={() => setActiveTab("accepted")}
            />
            <FilterButton
              label="Rejected"
              active={activeTab === "rejected"}
              onClick={() => setActiveTab("rejected")}
            />
            <FilterButton
              label="Removed"
              active={activeTab === "removed"}
              onClick={() => setActiveTab("removed")}
            />
          </div>

          {errorMsg ? (
            <p className="mb-6 text-sm text-red-400">{errorMsg}</p>
          ) : null}

          <div
            className="hidden overflow-hidden border border-zinc-700 bg-zinc-900/85 md:block"
            style={{ borderRadius: 12 }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-zinc-800 bg-zinc-950/35">
                  <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                    <th className="px-4 py-4">#</th>
                    <th className="px-4 py-4">Complete Name</th>
                    <th className="px-4 py-4">Contact Number</th>
                    <th className="px-4 py-4">Registered On</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loadingApps ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-zinc-400">
                        Loading applications...
                      </td>
                    </tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-zinc-400">
                        No matching submissions found.
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app, index) => {
                      const alreadyReviewed = app.status !== "in_queue";

                      return (
                        <tr
                          key={app.id}
                          className="border-b border-zinc-800/80 text-sm text-white last:border-b-0"
                        >
                          <td className="px-4 py-4 text-zinc-400">{index + 1}</td>

                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => openReviewModal(app)}
                              className="cursor-pointer font-medium text-white underline-offset-4 hover:underline"
                            >
                              {app.firstName} {app.lastName}
                            </button>
                          </td>

                          <td className="px-4 py-4 text-zinc-300">
                            {app.viber || "—"}
                          </td>

                          <td className="px-4 py-4 text-zinc-300">
                            {formatRegisteredOn(app.createdAt)}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                                app.status
                              )}`}
                            >
                              {app.status}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => openReviewModal(app)}
                              className="cursor-pointer border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
                              style={{ borderRadius: 8 }}
                            >
                              {alreadyReviewed ? "Modify Review" : "Review"}
                            </button>
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
            {loadingApps ? (
              <div
                className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                style={{ borderRadius: 12 }}
              >
                Loading applications...
              </div>
            ) : filteredApplications.length === 0 ? (
              <div
                className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                style={{ borderRadius: 12 }}
              >
                No matching submissions found.
              </div>
            ) : (
              filteredApplications.map((app, index) => {
                const alreadyReviewed = app.status !== "in_queue";

                return (
                  <div
                    key={app.id}
                    className="border border-zinc-700 bg-zinc-900/85 p-4"
                    style={{ borderRadius: 12 }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          #{index + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => openReviewModal(app)}
                          className="mt-1 cursor-pointer text-left text-base font-semibold text-white"
                        >
                          {app.firstName} {app.lastName}
                        </button>
                      </div>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                          app.status
                        )}`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-300">{app.viber || "—"}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Registered on {formatRegisteredOn(app.createdAt)}
                    </p>

                    <button
                      type="button"
                      onClick={() => openReviewModal(app)}
                      className="mt-4 w-full cursor-pointer border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
                      style={{ borderRadius: 8 }}
                    >
                      {alreadyReviewed ? "Modify Review" : "Review"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {selectedApplication ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 10 }}
          >
            <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    {selectedApplication.firstName} {selectedApplication.lastName}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    Review applicant details
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="cursor-pointer border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white hover:bg-zinc-800"
                  style={{ borderRadius: 8 }}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="border-b border-zinc-800 pb-4">
                <p className="text-sm text-zinc-200">
                  <span className="font-semibold text-white">Full Name:</span>{" "}
                  {selectedApplication.firstName} {selectedApplication.lastName}
                </p>
              </div>

              <DetailSection title="Personal Details">
                <DetailRow label="Email" value={selectedApplication.email} />
                <DetailRow
                  label="Age"
                  value={
                    selectedApplication.age === null
                      ? "—"
                      : String(selectedApplication.age)
                  }
                />
                <DetailRow label="Region" value={selectedApplication.region || "—"} />
                <DetailRow
                  label="Organization"
                  value={selectedApplication.organization || "—"}
                />
              </DetailSection>

              <DetailSection title="Developer Background">
                <DetailRow
                  label="Skills / Expertise"
                  value={selectedApplication.skills}
                />
                <DetailRow
                  label="Roblox Username / Profile"
                  value={
                    selectedApplication.roblox ? (
                      <a
                        href={getRobloxLink(selectedApplication.roblox) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cursor-pointer text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
                      >
                        {selectedApplication.roblox}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
              </DetailSection>

              <DetailSection title="Contact Details">
                <DetailRow
                  label="Discord User ID"
                  value={selectedApplication.discordId}
                />
                <DetailRow
                  label="Viber / Contact Number"
                  value={selectedApplication.viber}
                />
              </DetailSection>

              <DetailSection title="Application Status">
                <DetailRow label="Current Status" value={selectedApplication.status} />
                <DetailRow
                  label="Submitted At"
                  value={formatTimestamp(selectedApplication.createdAt)}
                />
              </DetailSection>

              <div className="border-t border-zinc-800 pt-5">
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Internal Note
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={5}
                  placeholder="Add an internal note for staff reference..."
                  className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500"
                  style={{ borderRadius: 8 }}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:justify-between sm:items-end">
                <div className="text-xs leading-5 text-zinc-500">
                  Last reviewed by{" "}
                  <span className="text-zinc-300">
                    {selectedApplication.reviewedByName ||
                      selectedApplication.reviewedByEmail ||
                      "—"}
                  </span>{" "}
                  on{" "}
                  <span className="text-zinc-300">
                    {formatTimestamp(selectedApplication.reviewedAt)}
                  </span>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => askForConfirmation("removed")}
                    disabled={savingReview}
                    className="cursor-pointer border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderRadius: 8 }}
                  >
                    {savingReview ? "Saving..." : "Remove"}
                  </button>

                  <button
                    type="button"
                    onClick={() => askForConfirmation("rejected")}
                    disabled={savingReview}
                    className="cursor-pointer border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderRadius: 8 }}
                  >
                    {savingReview ? "Saving..." : "Reject"}
                  </button>

                  <button
                    type="button"
                    onClick={() => askForConfirmation("accepted")}
                    disabled={savingReview}
                    className="cursor-pointer bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderRadius: 8 }}
                  >
                    {savingReview ? "Saving..." : "Accept"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedApplication && pendingAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md border border-zinc-800 bg-zinc-900 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            style={{ borderRadius: 10 }}
          >
            <h3 className="text-xl font-semibold text-white">Confirm Action</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {getConfirmationCopy()}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={savingReview}
                className="cursor-pointer border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ borderRadius: 8 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmReviewAction}
                disabled={savingReview}
                className="cursor-pointer bg-emerald-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ borderRadius: 8 }}
              >
                {savingReview ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}