"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/useAuthUser";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { setPresenceOffline } from "@/lib/usePresence";

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

type ApplicationStatus =
  | "application_sent"
  | "manual_review"
  | "needs_more_info"
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

type ActivityLog = {
  id: string;
  type?: string;
  message?: string;
  actorType?: string;
  actorEmail?: string | null;
  actorName?: string | null;
  createdAt?: Timestamp;
  meta?: Record<string, unknown>;
};

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
  facebookProfile?: string;
  placeLink?: string;
  placeContribution?: string;
  supportingLinks?: string;
  verificationCode?: string;
  trackerToken?: string;
  status: ApplicationStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedByUid?: string;
  reviewedByEmail?: string;
  reviewedByName?: string;
  reviewerNote?: string;

  assignedReviewerUid?: string | null;
  assignedReviewerEmail?: string | null;
  assignedReviewerName?: string | null;

  claimedByUid?: string | null;
  claimedByEmail?: string | null;
  claimedByName?: string | null;
  claimStartedAt?: Timestamp | null;
  claimExpiresAt?: Timestamp | null;

  applicantResubmittedAt?: Timestamp;
};

type ModalTab = "application" | "activity";

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
}

function normalizeApplicationStatus(value?: string): ApplicationStatus {
  const normalized = (value || "").trim().toLowerCase();

  switch (normalized) {
    case "manual_review":
      return "manual_review";
    case "needs_more_info":
      return "needs_more_info";
    case "pending":
      return "pending";
    case "accepted":
      return "accepted";
    case "rejected":
      return "rejected";
    case "expired":
      return "expired";
    case "application_sent":
      return "application_sent";
    case "in_queue":
      return "application_sent";
    case "removed":
      return "expired";
    default:
      return "application_sent";
  }
}

function formatTimestamp(timestamp?: Timestamp | null) {
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

function getStatusBadgeClass(status: ApplicationStatus) {
  switch (status) {
    case "accepted":
      return "bg-blue-500/15 text-blue-300 border border-blue-500/20";
    case "rejected":
      return "bg-red-500/15 text-red-300 border border-red-500/20";
    case "expired":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
    case "needs_more_info":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
    case "pending":
      return "bg-zinc-700/70 text-zinc-200 border border-zinc-500/40";
    case "manual_review":
      return "bg-blue-400/15 text-blue-200 border border-blue-400/20";
    default:
      return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  }
}

function getStatusLabel(status: ApplicationStatus) {
  switch (status) {
    case "application_sent":
      return "Application Sent";
    case "manual_review":
      return "Manual Review";
    case "needs_more_info":
      return "Needs More Info";
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function isClaimActive(application: Application) {
  if (!application.claimedByEmail || !application.claimExpiresAt) return false;
  return application.claimExpiresAt.toDate().getTime() > Date.now();
}

function getCurrentOwnerEmail(application: Application) {
  const assignedEmail = normalizeEmail(application.assignedReviewerEmail);
  if (assignedEmail) return assignedEmail;

  const claimedEmail = normalizeEmail(application.claimedByEmail);
  if (isClaimActive(application) && claimedEmail) return claimedEmail;

  return "";
}

function getCurrentOwnerName(application: Application) {
  if (application.assignedReviewerName) return application.assignedReviewerName;
  if (application.assignedReviewerEmail) return application.assignedReviewerEmail;
  if (isClaimActive(application) && application.claimedByName) return application.claimedByName;
  if (isClaimActive(application) && application.claimedByEmail) return application.claimedByEmail;
  return "—";
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

function ModalTabButton({
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
      className="cursor-pointer px-4 py-2 text-sm font-medium transition"
      style={{
        background: "transparent",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        borderBottom: active ? "2px solid rgb(96, 165, 250)" : "2px solid transparent",
        borderRadius: 0,
        color: active ? "rgb(147, 197, 253)" : "rgb(161, 161, 170)",
      }}
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
      {children}
    </h3>
  );
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-zinc-800 py-3 last:border-b-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>

      <div className="break-words text-sm text-white">{value || "—"}</div>
    </div>
  );
}

export default function ReassignPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReviewerEmail, setSelectedReviewerEmail] = useState("");

  const [reassignSelections, setReassignSelections] = useState<Record<string, string>>(
    {}
  );
  const [reassigningId, setReassigningId] = useState<string | null>(null);

  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("application");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

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
        setErrorMsg("Could not load staff.");
        setLoadingStaff(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    setLoadingApps(true);

    const q = query(collection(db, "applications"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: Application[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data() as Omit<Application, "id" | "status"> & {
            status?: string;
          };

          return {
            id: docSnap.id,
            ...raw,
            status: normalizeApplicationStatus(raw.status),
          } as Application;
        });

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
    if (!selectedApplication) {
      setActivityLogs([]);
      setLoadingActivity(false);
      return;
    }

    setLoadingActivity(true);

    const q = query(
      collection(db, "applications", selectedApplication.id, "activityLogs"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: ActivityLog[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ActivityLog, "id">),
        }));

        setActivityLogs(rows);
        setLoadingActivity(false);
      },
      (error) => {
        console.error("Error loading activity logs:", error);
        setLoadingActivity(false);
      }
    );

    return () => unsubscribe();
  }, [selectedApplication?.id]);

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

  const eligibleReviewers = useMemo(() => {
    return staffList
      .filter((staff) => staff.status !== "Removed")
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [staffList]);

  const visibleApplications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return applications.filter((app) => {
      const ownerEmail = getCurrentOwnerEmail(app);

      if (!selectedReviewerEmail || ownerEmail !== normalizeEmail(selectedReviewerEmail)) {
        return false;
      }

      const statusAllowed =
        app.status === "manual_review" ||
        app.status === "needs_more_info" ||
        app.status === "pending";

      if (!statusAllowed) return false;

      if (!q) return true;

      const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();

      return (
        fullName.includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        app.roblox?.toLowerCase().includes(q) ||
        app.status?.toLowerCase().includes(q) ||
        getCurrentOwnerName(app).toLowerCase().includes(q)
      );
    });
  }, [applications, selectedReviewerEmail, searchTerm]);

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
      await signOut(auth);
      router.replace("/admin/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }

  async function handleReassign(app: Application) {
    if (!user) return;

    const nextOwnerEmail = normalizeEmail(reassignSelections[app.id]);
    const currentOwnerEmail = getCurrentOwnerEmail(app);

    if (!nextOwnerEmail) {
      alert("Please choose a reviewer first.");
      return;
    }

    if (nextOwnerEmail === currentOwnerEmail) {
      alert("This application is already assigned to that reviewer.");
      return;
    }

    const nextOwner = eligibleReviewers.find(
      (staff) => normalizeEmail(staff.emailAddress) === nextOwnerEmail
    );

    if (!nextOwner) {
      alert("Could not find the selected reviewer.");
      return;
    }

    setReassigningId(app.id);

    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "pending",
        assignedReviewerUid: null,
        assignedReviewerEmail: nextOwner.emailAddress,
        assignedReviewerName: nextOwner.displayName,

        claimedByUid: null,
        claimedByEmail: null,
        claimedByName: null,
        claimStartedAt: null,
        claimExpiresAt: null,

        reviewedAt: serverTimestamp(),
        reviewedByUid: user.uid,
        reviewedByEmail: user.email || "",
        reviewedByName: displayName,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "applications", app.id, "activityLogs"), {
        type: "application_reassigned",
        message: `Application reassigned from ${getCurrentOwnerName(
          app
        )} to ${nextOwner.displayName}.`,
        actorType: "admin",
        actorEmail: user.email || null,
        actorName: displayName,
        createdAt: serverTimestamp(),
        meta: {
          previousOwnerEmail: currentOwnerEmail,
          previousOwnerName: getCurrentOwnerName(app),
          newOwnerEmail: nextOwner.emailAddress,
          newOwnerName: nextOwner.displayName,
        },
      });

      setReassignSelections((prev) => {
        const next = { ...prev };
        delete next[app.id];
        return next;
      });
    } catch (error) {
      console.error("Error reassigning application:", error);
      alert("Could not reassign this application.");
    } finally {
      setReassigningId(null);
    }
  }

  function openReadOnlyModal(app: Application) {
    setSelectedApplication(app);
    setModalTab("application");
  }

  function closeReadOnlyModal() {
    setSelectedApplication(null);
    setModalTab("application");
    setActivityLogs([]);
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
          active="admin_tools"
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
              className="bg-zinc-900 px-3 py-2 text-sm text-white"
              style={{ borderRadius: 5 }}
            >
              ☰
            </button>
            <p className="text-2xl font-semibold leading-none text-white">Admin</p>
          </div>

          <div className="mb-6 hidden md:block">
            <h1 className="text-2xl font-semibold text-white">Admin</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Reassign owned applications to another reviewer when needed.
            </p>
          </div>

          {!loadingStaff && !isAdmin ? (
            <div
              className="border border-zinc-700 bg-zinc-900/85 p-6"
              style={{ borderRadius: 10 }}
            >
              <h2 className="text-lg font-semibold text-white">Access Restricted</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                This page is only available to staff members with the Admin role.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end">
                <div className="w-full md:max-w-[300px]">
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Select Reviewer
                  </label>
                  <select
                    value={selectedReviewerEmail}
                    onChange={(e) => setSelectedReviewerEmail(e.target.value)}
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                    style={{ borderRadius: 10 }}
                    disabled={loadingStaff}
                  >
                    <option value="">Choose reviewer</option>
                    {eligibleReviewers.map((staff) => (
                      <option
                        key={staff.id}
                        value={normalizeEmail(staff.emailAddress)}
                      >
                        {staff.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full md:flex-1">
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Search within this reviewer’s applications
                  </label>
                  <input
                    type="text"
                    placeholder="Optional search by applicant, email, Roblox, status, or owner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                    style={{ borderRadius: 10 }}
                  />
                </div>
              </div>

              {errorMsg ? (
                <p className="mb-5 text-sm text-red-400">{errorMsg}</p>
              ) : null}

              <div
                className="hidden overflow-hidden border border-zinc-700 bg-zinc-900/85 md:block"
                style={{ borderRadius: 10 }}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-950/35">
                      <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                        <th className="px-4 py-4 text-center"> </th>
                        <th className="px-4 py-4 text-left">Complete Name</th>
                        <th className="px-4 py-4 text-center">Registered On</th>
                        <th className="px-4 py-4 text-center">Current Owner</th>
                        <th className="px-4 py-4 text-center">Status</th>
                        <th className="px-4 py-4 text-center">Reassign To</th>
                        <th className="px-4 py-4 text-center">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loadingApps || loadingStaff ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-sm text-zinc-400">
                            Loading reassignment data...
                          </td>
                        </tr>
                      ) : !selectedReviewerEmail ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-sm text-zinc-400">
                            Choose a reviewer to see owned applications.
                          </td>
                        </tr>
                      ) : visibleApplications.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-sm text-zinc-400">
                            No owned applications found for this reviewer.
                          </td>
                        </tr>
                      ) : (
                        visibleApplications.map((app, index) => {
                          const currentOwnerEmail = getCurrentOwnerEmail(app);
                          const currentSelectValue =
                            reassignSelections[app.id] || currentOwnerEmail || "";

                          return (
                            <tr
                              key={app.id}
                              className="border-b border-zinc-800/80 text-sm text-white last:border-b-0"
                            >
                              <td className="px-4 py-4 text-center text-zinc-400">
                                {index + 1}
                              </td>

                              <td className="px-4 py-4 text-left">
                                <button
                                  type="button"
                                  onClick={() => openReadOnlyModal(app)}
                                  className="cursor-pointer font-medium text-white underline-offset-4 hover:underline"
                                >
                                  {app.firstName} {app.lastName}
                                </button>
                              </td>

                              <td className="px-4 py-4 text-center text-zinc-300">
                                {formatRegisteredOn(app.createdAt)}
                              </td>

                              <td className="px-4 py-4 text-center text-zinc-300">
                                {getCurrentOwnerName(app)}
                              </td>

                              <td className="px-4 py-4 text-center">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                                    app.status
                                  )}`}
                                >
                                  {getStatusLabel(app.status)}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-center">
                                <select
                                  value={currentSelectValue}
                                  onChange={(e) =>
                                    setReassignSelections((prev) => ({
                                      ...prev,
                                      [app.id]: e.target.value,
                                    }))
                                  }
                                  className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                  style={{ borderRadius: 8, minWidth: 180 }}
                                >
                                  {eligibleReviewers.map((staff) => (
                                    <option
                                      key={staff.id}
                                      value={normalizeEmail(staff.emailAddress)}
                                    >
                                      {staff.displayName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="px-4 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleReassign(app)}
                                  disabled={
                                    reassigningId === app.id ||
                                    !currentSelectValue ||
                                    currentSelectValue === currentOwnerEmail
                                  }
                                  className="cursor-pointer border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  style={{ borderRadius: 8 }}
                                >
                                  {reassigningId === app.id ? "Reassigning..." : "Reassign"}
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
                {loadingApps || loadingStaff ? (
                  <div
                    className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                    style={{ borderRadius: 10 }}
                  >
                    Loading reassignment data...
                  </div>
                ) : !selectedReviewerEmail ? (
                  <div
                    className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                    style={{ borderRadius: 10 }}
                  >
                    Choose a reviewer to see owned applications.
                  </div>
                ) : visibleApplications.length === 0 ? (
                  <div
                    className="border border-zinc-700 bg-zinc-900/85 p-4 text-sm text-zinc-400"
                    style={{ borderRadius: 10 }}
                  >
                    No owned applications found for this reviewer.
                  </div>
                ) : (
                  visibleApplications.map((app, index) => {
                    const currentOwnerEmail = getCurrentOwnerEmail(app);
                    const currentSelectValue =
                      reassignSelections[app.id] || currentOwnerEmail || "";

                    return (
                      <div
                        key={app.id}
                        className="border border-zinc-700 bg-zinc-900/85 p-4"
                        style={{ borderRadius: 10 }}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-zinc-500">
                              #{index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => openReadOnlyModal(app)}
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
                            {getStatusLabel(app.status)}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm text-zinc-300">
                          <p>
                            <span className="text-zinc-500">Registered:</span>{" "}
                            {formatRegisteredOn(app.createdAt)}
                          </p>
                          <p>
                            <span className="text-zinc-500">Current Owner:</span>{" "}
                            {getCurrentOwnerName(app)}
                          </p>
                        </div>

                        <select
                          value={currentSelectValue}
                          onChange={(e) =>
                            setReassignSelections((prev) => ({
                              ...prev,
                              [app.id]: e.target.value,
                            }))
                          }
                          className="mt-4 w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500"
                          style={{ borderRadius: 8 }}
                        >
                          {eligibleReviewers.map((staff) => (
                            <option
                              key={staff.id}
                              value={normalizeEmail(staff.emailAddress)}
                            >
                              {staff.displayName}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleReassign(app)}
                          disabled={
                            reassigningId === app.id ||
                            !currentSelectValue ||
                            currentSelectValue === currentOwnerEmail
                          }
                          className="mt-4 w-full cursor-pointer border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ borderRadius: 8 }}
                        >
                          {reassigningId === app.id ? "Reassigning..." : "Reassign"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {selectedApplication ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="flex min-h-full items-start justify-center py-6">
            <div
              className="flex h-[min(88vh,760px)] w-full max-w-3xl flex-col overflow-hidden border border-zinc-800 bg-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
              style={{ borderRadius: 12 }}
            >
              <div className="sticky top-0 z-10 bg-zinc-900 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-white">
                      {selectedApplication.firstName} {selectedApplication.lastName}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      Read-only application view
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeReadOnlyModal}
                    aria-label="Close"
                    className="cursor-pointer text-white hover:text-zinc-300"
                    style={{
                      width: 42,
                      height: 42,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      border: "1px solid rgba(63, 63, 70, 1)",
                      background: "rgba(9, 9, 11, 0.9)",
                      fontSize: 22,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 flex gap-4 overflow-x-auto border-b border-zinc-800 pb-2">
                  <ModalTabButton
                    label="Application"
                    active={modalTab === "application"}
                    onClick={() => setModalTab("application")}
                  />
                  <ModalTabButton
                    label="Activity Log"
                    active={modalTab === "activity"}
                    onClick={() => setModalTab("activity")}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {modalTab === "application" ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <SectionTitle>Personal Details</SectionTitle>

                      <div className="grid gap-6">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-4 py-2">
                          <DetailLine label="Email" value={selectedApplication.email} />
                          <DetailLine
                            label="Facebook Profile"
                            value={
                              selectedApplication.facebookProfile ? (
                                <a
                                  href={selectedApplication.facebookProfile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block max-w-full truncate cursor-pointer text-blue-300 underline underline-offset-4"
                                  title={selectedApplication.facebookProfile}
                                >
                                  {selectedApplication.facebookProfile}
                                </a>
                              ) : (
                                "—"
                              )
                            }
                          />
                          <DetailLine
                            label="Discord ID"
                            value={selectedApplication.discordId || "—"}
                          />
                          <DetailLine
                            label="Region"
                            value={selectedApplication.region || "—"}
                          />
                          <DetailLine
                            label="Organization"
                            value={selectedApplication.organization || "—"}
                          />
                        </div>

                      </div>
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Developer Background</SectionTitle>

                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-4 py-2">
                        <DetailLine
                          label="Roblox Profile"
                          value={
                            selectedApplication.roblox ? (
                              <a
                                href={getRobloxLink(selectedApplication.roblox) || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer text-blue-300 underline underline-offset-4"
                              >
                                {selectedApplication.roblox}
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />

                        <DetailLine
                          label="Skills / Expertise"
                          value={selectedApplication.skills || "—"}
                        />

                        <DetailLine
                          label="Experience Link"
                          value={
                            selectedApplication.placeLink ? (
                              <a
                                href={selectedApplication.placeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer text-blue-300 underline underline-offset-4"
                              >
                                {selectedApplication.placeLink}
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />

                        <DetailLine
                          label="Declared Contribution"
                          value={selectedApplication.placeContribution || "—"}
                        />

                        <DetailLine
                          label="Supporting Links"
                          value={
                            selectedApplication.supportingLinks ? (
                              <div className="whitespace-pre-line">
                                {selectedApplication.supportingLinks}
                              </div>
                            ) : (
                              "—"
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <SectionTitle>Reviewer Notes</SectionTitle>

                      <div
                        className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-4 py-3 text-sm text-zinc-300"
                        style={{ minHeight: 110 }}
                      >
                        {selectedApplication.reviewerNote?.trim() || "No reviewer note added."}
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-5 text-xs leading-5 text-zinc-500">
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
                  </div>
                ) : (
                  <div className="space-y-4">
                    <SectionTitle>Activity Log</SectionTitle>

                    {loadingActivity ? (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 p-4 text-sm text-zinc-400">
                        Loading activity log...
                      </div>
                    ) : activityLogs.length === 0 ? (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 p-4 text-sm text-zinc-400">
                        No activity recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activityLogs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-lg border border-zinc-800 bg-zinc-950/35 p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-medium text-white">
                                {log.message || "Activity recorded"}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {formatTimestamp(log.createdAt)}
                              </p>
                            </div>

                            <div className="mt-2 text-xs text-zinc-400">
                              <span className="text-zinc-300">
                                {log.actorName || log.actorEmail || "Unknown Actor"}
                              </span>{" "}
                              · {log.actorType || "unknown"}
                            </div>

                            {log.type ? (
                              <div className="mt-2 text-xs uppercase tracking-wide text-zinc-500">
                                {log.type}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}