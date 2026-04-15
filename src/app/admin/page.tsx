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
import { notify } from "@/components/ToastConfig";

type ApplicationStatus =
  | "application_sent"
  | "manual_review"
  | "needs_more_info"
  | "pending"
  | "accepted"
  | "rejected"
  | "expired";

type FilterTab =
  | "ready_for_review"
  | "resubmitted_for_review"
  | "pending";

type OtherFilterStatus =
  | "application_sent"
  | "accepted"
  | "rejected"
  | "expired";

type CorrectionFieldKey =
  | "roblox"
  | "placeLink"
  | "placeContribution"
  | "supportingLinks"
  | "facebookProfile"
  | "discordId"
  | "email"
  | "idPhoto";

type CorrectionRequest = {
  fieldKey: CorrectionFieldKey;
  label: string;
  note?: string;
};

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
  correctionRequests?: CorrectionRequest[];
  correctionRequestedAt?: Timestamp;
  correctedFieldKeys?: CorrectionFieldKey[];
  correctedFieldLabels?: string[];
  applicantResubmittedAt?: Timestamp;
  discordInviteUrl?: string;
  discordInviteCode?: string;
  discordInviteCreatedAt?: Timestamp;
  inviteEmailSentAt?: Timestamp;
  idFilePath?: string;
  idFileName?: string;
  idFileUrl?: string | null;
};

type ModalTab = "application" | "request_more_info" | "activity";

const CORRECTION_FIELD_OPTIONS: Array<{
  key: CorrectionFieldKey;
  label: string;
}> = [
    { key: "roblox", label: "Roblox Username / Profile" },
    { key: "placeLink", label: "Roblox Experience Link" },
    { key: "placeContribution", label: "Declared Contribution" },
    { key: "supportingLinks", label: "Supporting Links" },
    { key: "facebookProfile", label: "Facebook Profile URL" },
    { key: "discordId", label: "Discord User ID" },
    { key: "email", label: "Email Address" },
    { key: "idPhoto", label: "ID Photo Reupload" },
  ];

const MOBILE_STATUS_PILLS: Array<{
  key: string;
  label: string;
  type: "tab" | "other";
  value: FilterTab | OtherFilterStatus;
}> = [
    { key: "ready_for_review", label: "Ready for Review", type: "tab", value: "ready_for_review" },
    { key: "resubmitted_for_review", label: "Resubmitted", type: "tab", value: "resubmitted_for_review" },
    { key: "pending", label: "Pending", type: "tab", value: "pending" },
    { key: "application_sent", label: "Applications", type: "other", value: "application_sent" },
    { key: "accepted", label: "Accepted", type: "other", value: "accepted" },
    { key: "rejected", label: "Declined", type: "other", value: "rejected" },
    { key: "expired", label: "Expired", type: "other", value: "expired" },
  ];

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
      console.warn("Unknown application status from Firestore:", value);
      return "application_sent";
  }
}

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

function normalizeEmail(value?: string | null): string {
  return value?.trim().toLowerCase() || "";
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
      return "Declined";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function getOtherStatusLabel(status: OtherFilterStatus | null) {
  switch (status) {
    case "application_sent":
      return "Applications";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Declined";
    case "expired":
      return "Expired";
    default:
      return "Others";
  }
}

const CLAIM_DURATION_MS = 60 * 1000;

function isClaimActive(application: Application) {
  const hasClaimOwner =
    !!normalizeEmail(application.claimedByEmail) || !!application.claimedByUid;

  if (!hasClaimOwner || !application.claimExpiresAt) return false;
  return application.claimExpiresAt.toDate().getTime() > Date.now();
}

function getApplicationOwnerName(application: Application) {
  if (application.assignedReviewerName) return application.assignedReviewerName;
  if (application.assignedReviewerEmail) return application.assignedReviewerEmail;
  if (application.claimedByName) return application.claimedByName;
  if (application.claimedByEmail) return application.claimedByEmail;
  return "another reviewer";
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
      className={`relative cursor-pointer whitespace-nowrap px-5 py-3 text-sm font-semibold transition ${active
        ? "text-white"
        : "text-zinc-300 hover:text-white"
        }`}
      style={{
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        background: active ? "rgba(30, 41, 59, 0.96)" : "rgba(82, 82, 91, 0.42)",
        borderTop: active
          ? "1px solid rgba(96, 165, 250, 0.42)"
          : "1px solid rgba(113, 113, 122, 0.34)",
        borderLeft: active
          ? "1px solid rgba(96, 165, 250, 0.42)"
          : "1px solid rgba(113, 113, 122, 0.34)",
        borderRight: active
          ? "1px solid rgba(96, 165, 250, 0.42)"
          : "1px solid rgba(113, 113, 122, 0.34)",
        borderBottom: active
          ? "1px solid rgba(6, 9, 19, 1)"
          : "1px solid rgba(113, 113, 122, 0.22)",
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

function MobileFilterPill({
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
      className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${active
        ? "border-blue-400/50 bg-blue-500/15 text-white"
        : "border-zinc-700 bg-zinc-900 text-zinc-300"
        }`}
    >
      {label}
    </button>
  );
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

function CompactField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="break-words text-sm text-white">{value || "—"}</div>
    </div>
  );
}

function DetailLine({
  label,
  value,
  state,
}: {
  label: string;
  value: React.ReactNode;
  state?: "requested" | "updated";
}) {
  const isRequested = state === "requested";
  const isUpdated = state === "updated";

  const rowStyle = isRequested
    ? { background: "rgba(239, 68, 68, 0.04)" }
    : isUpdated
      ? { background: "rgba(245, 158, 11, 0.06)" }
      : undefined;

  const labelClass = `detail-line-label text-[11px] font-medium uppercase tracking-wide ${isRequested
      ? "text-red-200"
      : isUpdated
        ? "text-amber-200"
        : "text-zinc-500"
    }`;

  const valueStyle = {
    color: isRequested
      ? "rgb(252, 129, 129)"
      : isUpdated
        ? "rgb(253, 224, 71)"
        : "rgb(255,255,255)",
  };

  const borderClass = isRequested
    ? "border-red-500/30"
    : isUpdated
      ? "border-amber-400/30"
      : "border-zinc-800";

  return (
    <div
      className={`detail-line border-b py-3 last:border-b-0 ${borderClass}`}
      style={rowStyle}
    >
      <div className={labelClass}>{label}</div>
      <div className="detail-line-value break-words text-sm" style={valueStyle}>
        {value || "—"}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
      {children}
    </h3>
  );
}

function VerificationCodeBadge({ code }: { code?: string }) {
  return (
    <div
      className="px-4 py-3 text-base font-semibold text-white"
      style={{
        borderRadius: 5,
        background: "rgba(34, 197, 94, 0.14)",
        border: "1px solid rgba(34, 197, 94, 0.35)",
        minWidth: 150,
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {code || "No Code"}
    </div>
  );
}

function hasCorrectionRequest(
  application: Application | null,
  fieldKey: CorrectionFieldKey
) {
  if (!application?.correctionRequests?.length) return false;
  return application.correctionRequests.some((item) => item.fieldKey === fieldKey);
}

function hasUpdatedCorrection(
  application: Application | null,
  fieldKey: CorrectionFieldKey
) {
  if (!application?.correctedFieldKeys?.length) return false;
  return application.correctedFieldKeys.includes(fieldKey);
}

export default function AdminPage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ready_for_review");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [othersOpen, setOthersOpen] = useState(false);
  const [selectedOtherStatus, setSelectedOtherStatus] = useState<OtherFilterStatus | null>(null);
  const [reviewerFilter, setReviewerFilter] = useState<string>("you");

  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);

  const [modalTab, setModalTab] = useState<ModalTab>("application");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [generalReviewerNote, setGeneralReviewerNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [pendingAction, setPendingAction] = useState<ApplicationStatus | null>(
    null
  );

  const [selectedCorrectionFields, setSelectedCorrectionFields] = useState<
    Record<string, boolean>
  >({});
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>({});

  const [expandedCorrectionFields, setExpandedCorrectionFields] = useState<
    Record<string, boolean>
  >({});

  function resetReviewModalState() {
    setPendingAction(null);
    setSelectedApplication(null);
    setGeneralReviewerNote("");
    setSelectedCorrectionFields({});
    setFieldNotes({});
    setExpandedCorrectionFields({});
  }

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
        const rows: Application[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data() as Omit<Application, "id" | "status"> & {
            status?: string;
          };

          const normalizedStatus = normalizeApplicationStatus(raw.status);

          if (raw.status !== normalizedStatus) {
            console.log("Application status normalized", {
              id: docSnap.id,
              rawStatus: raw.status,
              normalizedStatus,
            });
          }

          return {
            id: docSnap.id,
            ...raw,
            status: normalizedStatus,
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
    if (!selectedApplication) return;

    const refreshed = applications.find((a) => a.id === selectedApplication.id);
    if (!refreshed) return;

    setSelectedApplication(refreshed);
  }, [applications, selectedApplication?.id]);

  const reviewerOptions = useMemo(() => {
    const map = new Map<string, string>();
    const signedInEmail = normalizeEmail(user?.email);

    applications.forEach((app) => {
      const assignedEmail = normalizeEmail(app.assignedReviewerEmail);
      const claimedEmail =
        isClaimActive(app) ? normalizeEmail(app.claimedByEmail) : "";

      if (assignedEmail && assignedEmail !== signedInEmail) {
        map.set(
          assignedEmail,
          app.assignedReviewerName || app.assignedReviewerEmail || "Unknown Reviewer"
        );
        return;
      }

      if (!assignedEmail && claimedEmail && claimedEmail !== signedInEmail) {
        map.set(
          claimedEmail,
          app.claimedByName || app.claimedByEmail || "Unknown Reviewer"
        );
      }
    });

    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [applications, user?.email]);

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

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    const signedInEmail = normalizeEmail(user?.email);

    return applications.filter((app) => {
      const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();

      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        app.facebookProfile?.toLowerCase().includes(q) ||
        app.discordId?.toLowerCase().includes(q) ||
        app.roblox?.toLowerCase().includes(q) ||
        app.placeLink?.toLowerCase().includes(q) ||
        app.status?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isResubmitted =
        !!app.applicantResubmittedAt ||
        (Array.isArray(app.correctedFieldKeys) &&
          app.correctedFieldKeys.length > 0);

      const inLane =
        (activeTab === "ready_for_review" &&
          app.status === "manual_review" &&
          !isResubmitted) ||
        (activeTab === "resubmitted_for_review" &&
          app.status === "manual_review" &&
          isResubmitted) ||
        (activeTab === "pending" &&
          (app.status === "pending" || app.status === "needs_more_info"));

      const inOthers = selectedOtherStatus
        ? app.status === selectedOtherStatus
        : false;

      const inCurrentView = q ? true : selectedOtherStatus ? inOthers : inLane;

      if (!inCurrentView) return false;

      const assignedToOther =
        !!normalizeEmail(app.assignedReviewerEmail) &&
        normalizeEmail(app.assignedReviewerEmail) !== signedInEmail;

      const claimActive = isClaimActive(app);
      const claimedByOther =
        claimActive &&
        !!normalizeEmail(app.claimedByEmail) &&
        normalizeEmail(app.claimedByEmail) !== signedInEmail;

      if (reviewerFilter === "you") {
        return !assignedToOther && !claimedByOther;
      }

      return (
        normalizeEmail(app.assignedReviewerEmail) === normalizeEmail(reviewerFilter) ||
        (!normalizeEmail(app.assignedReviewerEmail) &&
          claimActive &&
          normalizeEmail(app.claimedByEmail) === normalizeEmail(reviewerFilter))
      );
    });
  }, [
    applications,
    search,
    activeTab,
    selectedOtherStatus,
    reviewerFilter,
    user?.email,
  ]);

  async function openReviewModal(app: Application) {
    if (!user) return;

    const latest = applications.find((item) => item.id === app.id) || app;
    const signedInEmail = normalizeEmail(user.email);

    const assignedToOther =
      !!normalizeEmail(latest.assignedReviewerEmail) &&
      normalizeEmail(latest.assignedReviewerEmail) !== signedInEmail;

    const claimActive = isClaimActive(latest);
    const claimedByOther =
      claimActive &&
      !!normalizeEmail(latest.claimedByEmail) &&
      normalizeEmail(latest.claimedByEmail) !== signedInEmail;

    const readOnly = assignedToOther || claimedByOther;

    if (!readOnly) {
      try {
        await updateDoc(doc(db, "applications", latest.id), {
          claimedByUid: user.uid,
          claimedByEmail: user.email || "",
          claimedByName: displayName,
          claimStartedAt: serverTimestamp(),
          claimExpiresAt: Timestamp.fromMillis(Date.now() + CLAIM_DURATION_MS),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Could not claim application:", error);
        return;
      }
    }

    setSelectedApplication(latest);
    setModalReadOnly(readOnly);
    setModalTab("application");
    setGeneralReviewerNote(latest.reviewerNote || "");
    setPendingAction(null);
    setOthersOpen(false);

    setSelectedCorrectionFields({});
    setFieldNotes({});
    setExpandedCorrectionFields({});
  }

  async function closeReviewModal() {
    if (savingReview) return;

    const appToClose = selectedApplication;
    const wasReadOnly = modalReadOnly;
    const signedInEmail = normalizeEmail(user?.email);

    setSelectedApplication(null);
    setModalReadOnly(false);
    setModalTab("application");
    setGeneralReviewerNote("");
    setPendingAction(null);
    setSelectedCorrectionFields({});
    setFieldNotes({});
    setExpandedCorrectionFields({});
    setActivityLogs([]);

    if (!wasReadOnly && appToClose && user) {
      try {
        const latest = applications.find((item) => item.id === appToClose.id) || appToClose;

        const belongsToYou =
          normalizeEmail(latest.claimedByEmail) === signedInEmail ||
          latest.claimedByUid === user.uid;

        if (!belongsToYou) return;

        await updateDoc(doc(db, "applications", appToClose.id), {
          claimedByUid: null,
          claimedByEmail: null,
          claimedByName: null,
          claimStartedAt: null,
          claimExpiresAt: null,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Could not release claim:", error);
      }
    }
  }

  function askForConfirmation(nextStatus: ApplicationStatus) {
    setPendingAction(nextStatus);
  }

  function closeConfirmation() {
    if (savingReview) return;
    setPendingAction(null);
  }

  function toggleCorrectionField(fieldKey: CorrectionFieldKey) {
    setSelectedCorrectionFields((prev) => {
      const nextValue = !prev[fieldKey];

      if (!nextValue) {
        setExpandedCorrectionFields((current) => ({
          ...current,
          [fieldKey]: false,
        }));
      }

      return {
        ...prev,
        [fieldKey]: nextValue,
      };
    });
  }

  function toggleExpandedCorrectionField(fieldKey: CorrectionFieldKey) {
    setExpandedCorrectionFields((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  }

  function updateFieldNote(fieldKey: CorrectionFieldKey, value: string) {
    setFieldNotes((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  }

  function selectOtherStatus(status: OtherFilterStatus) {
    setSelectedOtherStatus(status);
    setOthersOpen(false);
  }

  function handleMobilePillClick(item: (typeof MOBILE_STATUS_PILLS)[number]) {
    if (item.type === "tab") {
      setActiveTab(item.value as FilterTab);
      setSelectedOtherStatus(null);
      setOthersOpen(false);
      return;
    }

    setSelectedOtherStatus(item.value as OtherFilterStatus);
    setOthersOpen(false);
  }

  function isMobilePillActive(item: (typeof MOBILE_STATUS_PILLS)[number]) {
    if (item.type === "tab") {
      return activeTab === item.value && !selectedOtherStatus;
    }
    return selectedOtherStatus === item.value;
  }

  async function handleSignOut() {
    try {
      await setPresenceOffline(user?.email);
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
      `Invite route returned ${response.status} ${response.statusText}. ${text.slice(
        0,
        200
      )}`
    );
  }

  async function writeActivityLog(
    applicationId: string,
    type: string,
    message: string,
    meta?: Record<string, unknown>
  ) {
    await addDoc(collection(db, "applications", applicationId, "activityLogs"), {
      type,
      message,
      actorType: "admin",
      actorEmail: user?.email || null,
      actorName: displayName,
      createdAt: serverTimestamp(),
      meta: meta || {},
    });
  }

  async function sendNeedsMoreInfoEmail(args: {
    email: string;
    firstName: string;
    applicationId: string;
    trackerToken: string;
    correctionRequests: CorrectionRequest[];
    reviewerNote: string;
  }) {
    const response = await fetch("/api/email/request-more-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.error || "Could not send the request-more-info email."
      );
    }

    return result;
  }

  async function confirmReviewAction() {
    if (!selectedApplication || !user || !pendingAction) return;

    setSavingReview(true);

    try {
      const reviewerEmail = user.email || "";
      const reviewerName = getReviewerName(reviewerEmail);
      const docRef = doc(db, "applications", selectedApplication.id);

      if (pendingAction === "needs_more_info") {
        const chosen = CORRECTION_FIELD_OPTIONS.filter(
          (option) => selectedCorrectionFields[option.key]
        );

        if (chosen.length === 0) {
          notify.error("Please select at least one field that needs correction.");
          setSavingReview(false);
          return;
        }

        const correctionRequests: CorrectionRequest[] = chosen.map((item) => ({
          fieldKey: item.key,
          label: item.label,
          note: fieldNotes[item.key]?.trim() || "",
        }));

        const emailPayload = {
          email: selectedApplication.email,
          firstName: selectedApplication.firstName,
          applicationId: selectedApplication.id,
          trackerToken: selectedApplication.trackerToken,
          correctionRequests,
          reviewerNote: generalReviewerNote.trim(),
        };

        await updateDoc(docRef, {
          status: "needs_more_info",
          reviewerNote: generalReviewerNote.trim(),
          correctionRequests,
          correctionRequestedAt: serverTimestamp(),

          assignedReviewerUid: user.uid,
          assignedReviewerEmail: reviewerEmail,
          assignedReviewerName: reviewerName,

          claimedByUid: null,
          claimedByEmail: null,
          claimedByName: null,
          claimStartedAt: null,
          claimExpiresAt: null,

          reviewedAt: serverTimestamp(),
          reviewedByUid: user.uid,
          reviewedByEmail: reviewerEmail,
          reviewedByName: reviewerName,
          updatedAt: serverTimestamp(),
        });

        await writeActivityLog(
          selectedApplication.id,
          "needs_more_info_requested",
          "Reviewer requested corrections or more information from the applicant.",
          {
            correctionFieldKeys: correctionRequests.map((item) => item.fieldKey),
            correctionFieldLabels: correctionRequests.map((item) => item.label),
            reviewerNote: generalReviewerNote.trim(),
            actorName: reviewerName,
          }
        );

        resetReviewModalState();
        notify.success("Correction request saved and sent to applicant.");

        setTimeout(async () => {
          try {
            if (
              emailPayload.email &&
              emailPayload.firstName &&
              emailPayload.trackerToken
            ) {
              await sendNeedsMoreInfoEmail({
                email: emailPayload.email,
                firstName: emailPayload.firstName,
                applicationId: emailPayload.applicationId,
                trackerToken: emailPayload.trackerToken,
                correctionRequests: emailPayload.correctionRequests,
                reviewerNote: emailPayload.reviewerNote,
              });
            } else {
              console.warn(
                "Skipped request-more-info email because applicant email, first name, or tracker token was missing."
              );
              notify.warning("Request saved, but no email was sent because applicant email details were incomplete.");
            }
          } catch (emailError) {
            console.error("Needs more info email error:", emailError);
            notify.warning("Request saved, but the email could not be sent.");
          }
        }, 0);

        return;
      }

      if (pendingAction === "manual_review") {
        await updateDoc(docRef, {
          status: "manual_review",
          reviewerNote: generalReviewerNote.trim(),

          assignedReviewerUid: user.uid,
          assignedReviewerEmail: reviewerEmail,
          assignedReviewerName: reviewerName,

          claimedByUid: null,
          claimedByEmail: null,
          claimedByName: null,
          claimStartedAt: null,
          claimExpiresAt: null,

          reviewedAt: serverTimestamp(),
          reviewedByUid: user.uid,
          reviewedByEmail: reviewerEmail,
          reviewedByName: reviewerName,
          updatedAt: serverTimestamp(),
        });

        await writeActivityLog(
          selectedApplication.id,
          "manual_review_started",
          "Reviewer moved the application into manual review.",
          {
            reviewerNote: generalReviewerNote.trim(),
            actorName: reviewerName,
          }
        );

        setPendingAction(null);
        resetReviewModalState();
        return;
      }

      await updateDoc(docRef, {
        status: pendingAction,
        reviewerNote: generalReviewerNote.trim(),
        correctionRequests:
          pendingAction === "pending"
            ? selectedApplication.correctionRequests || []
            : [],

        assignedReviewerUid: user.uid,
        assignedReviewerEmail: reviewerEmail,
        assignedReviewerName: reviewerName,

        claimedByUid: null,
        claimedByEmail: null,
        claimedByName: null,
        claimStartedAt: null,
        claimExpiresAt: null,

        reviewedAt: serverTimestamp(),
        reviewedByUid: user.uid,
        reviewedByEmail: reviewerEmail,
        reviewedByName: reviewerName,
        updatedAt: serverTimestamp(),
      });

      await writeActivityLog(
        selectedApplication.id,
        pendingAction,
        pendingAction === "rejected"
          ? "Reviewer marked the application as declined."
          : `Reviewer marked the application as ${pendingAction}.`,
        {
          reviewerNote: generalReviewerNote.trim(),
          actorName: reviewerName,
        }
      );

      if (pendingAction === "accepted") {
        if (!selectedApplication.discordId || !/^\d+$/.test(selectedApplication.discordId)) {
          notify.error(
            "Application was accepted, but no valid Discord user ID was found, so no invite email was sent."
          );
        } else if (!selectedApplication.email) {
          notify.error(
            "Application was accepted, but no email address was found, so no invite email was sent."
          );
        } else {
          try {
            const inviteResult = await sendAcceptedApplicantInvite(selectedApplication);

            await updateDoc(docRef, {
              discordInviteUrl: inviteResult.inviteUrl,
              discordInviteCode: inviteResult.code,
              discordInviteCreatedAt: serverTimestamp(),
              inviteEmailSentAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            notify.success(
              `Application accepted and Discord invite email sent to ${selectedApplication.email}.`
            );
          } catch (inviteError) {
            console.error("Accepted applicant invite error:", inviteError);
            notify.error(
              "Application was accepted, but the Discord invite email could not be sent."
            );
          }
        }
      }

      resetReviewModalState();
    } catch (error) {
      console.error("Error updating application:", error);
      notify.error("Could not update this application. Please try again.");
    } finally {
      setSavingReview(false);
    }
  }

  function getConfirmationCopy() {
    if (!selectedApplication || !pendingAction) return "";

    const name = selectedApplication.firstName || "this user";

    if (pendingAction === "manual_review") {
      return `Are you sure you want to move ${name}'s application into Manual Review?`;
    }

    if (pendingAction === "accepted") {
      return `Are you sure you want to accept ${name}'s application?`;
    }

    if (pendingAction === "rejected") {
      return `Are you sure you want to decline ${name}'s application?`;
    }
    if (pendingAction === "needs_more_info") {
      return `Are you sure you want to request more information or corrections from ${name}?`;
    }

    if (pendingAction === "pending") {
      return `Are you sure you want to mark ${name}'s application as Pending?`;
    }

    return `Are you sure you want to mark ${name}'s application as expired?`;
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

  function getFieldState(fieldKey: CorrectionFieldKey): "requested" | "updated" | undefined {
    if (hasUpdatedCorrection(selectedApplication, fieldKey)) return "updated";
    if (hasCorrectionRequest(selectedApplication, fieldKey)) return "requested";
    return undefined;
  }

  return (
  <>
      <style jsx global>{`
      .detail-line {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
      }

      @media (min-width: 640px) {
        .detail-line {
          grid-template-columns: 140px minmax(0, 1fr);
          gap: 1rem;
        }
      }
    `}</style>

      <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-white">
        <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-[250px_minmax(0,1fr)]">
          <AdminSidebar
            active="applications"
            sidebarOpen={sidebarOpen}
            onCloseSidebar={() => setSidebarOpen(false)}
            onNavigate={(path) => router.push(path)}
            onSignOut={handleSignOut}
            displayName={displayName}
            email={user.email}
          />

          <section className="min-w-0 w-full max-w-full overflow-x-hidden bg-zinc-900 px-4 py-5 md:px-10 md:py-8 xl:px-14">
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="cursor-pointer bg-zinc-900 px-3 py-2 text-sm text-white"
                style={{ borderRadius: 8 }}
              >
                ☰
              </button>
              <p className="text-2xl font-semibold leading-none text-white">Developer Applications</p>
            </div>

            <div className="mb-6 hidden md:block">
              <h1 className="text-2xl font-semibold text-white">Developer Applications</h1>
            </div>

            <div className="mb-5">
              <input
                type="text"
                placeholder="Search by name, email, Facebook profile, Discord ID, Roblox username, place link, or status"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-blue-500"
                style={{ borderRadius: 10 }}
              />
            </div>

            <div className="mb-6 border-b border-zinc-800 pb-4">
              <div className="hidden md:block">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <FilterButton
                      label="Ready for Review"
                      active={activeTab === "ready_for_review" && !selectedOtherStatus}
                      onClick={() => {
                        setActiveTab("ready_for_review");
                        setSelectedOtherStatus(null);
                        setOthersOpen(false);
                      }}
                    />
                    <FilterButton
                      label="Resubmitted for Review"
                      active={activeTab === "resubmitted_for_review" && !selectedOtherStatus}
                      onClick={() => {
                        setActiveTab("resubmitted_for_review");
                        setSelectedOtherStatus(null);
                        setOthersOpen(false);
                      }}
                    />
                    <FilterButton
                      label="Pending"
                      active={activeTab === "pending" && !selectedOtherStatus}
                      onClick={() => {
                        setActiveTab("pending");
                        setSelectedOtherStatus(null);
                        setOthersOpen(false);
                      }}
                    />

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOthersOpen((prev) => !prev)}
                        className={`cursor-pointer whitespace-nowrap px-2 py-2 text-sm font-medium transition ${selectedOtherStatus || othersOpen
                          ? "text-white"
                          : "text-zinc-400 hover:text-white"
                          }`}
                        style={{
                          background: "transparent",
                          border: "none",
                          borderRadius: 0,
                          marginBottom: 6,
                        }}
                      >
                        {getOtherStatusLabel(selectedOtherStatus)} ▼
                      </button>

                      {othersOpen ? (
                        <div
                          className="absolute left-0 top-full z-20 min-w-[220px] border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
                          style={{ borderRadius: 8, marginTop: 8 }}
                        >
                          <div className="space-y-1">
                            {[
                              { key: "application_sent", label: "Applications" },
                              { key: "accepted", label: "Accepted" },
                              { key: "rejected", label: "Declined" },
                              { key: "expired", label: "Expired" },
                            ].map((item) => {
                              const active = selectedOtherStatus === item.key;

                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => selectOtherStatus(item.key as OtherFilterStatus)}
                                  className={`flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm transition ${active
                                    ? "bg-blue-500/15 text-blue-200"
                                    : "text-zinc-200 hover:bg-zinc-800/70"
                                    }`}
                                >
                                  <span>{item.label}</span>
                                  {active ? (
                                    <span className="text-xs text-blue-300">Selected</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!selectedOtherStatus ? (
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">
                        Reviewer
                      </span>

                      <select
                        value={reviewerFilter}
                        onChange={(e) => setReviewerFilter(e.target.value)}
                        className="border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                        style={{ borderRadius: 8 }}
                      >
                        <option value="you">You</option>
                        {reviewerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 max-w-full md:hidden">
                <div
                  style={{
                    width: "calc(100vw - 32px)",
                    maxWidth: "calc(100vw - 32px)",
                    height: 45,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      height: 45,
                      overflowX: "auto",
                      overflowY: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: "max-content",
                        minWidth: "max-content",
                        height: 40,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {MOBILE_STATUS_PILLS.map((item) => (
                        <MobileFilterPill
                          key={item.key}
                          label={item.label}
                          active={isMobilePillActive(item)}
                          onClick={() => handleMobilePillClick(item)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {!selectedOtherStatus ? (
                  <div className="mt-3">
                    <div className="mb-2 pl-1 text-[11px] uppercase tracking-wide text-zinc-500">
                      Reviewer
                    </div>
                    <select
                      value={reviewerFilter}
                      onChange={(e) => setReviewerFilter(e.target.value)}
                      className="w-full border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white outline-none"
                      style={{ borderRadius: 8 }}
                    >
                      <option value="you">You</option>
                      {reviewerOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>

            {errorMsg ? <p className="mb-6 text-sm text-red-400">{errorMsg}</p> : null}

            <div
              className="hidden overflow-hidden border border-zinc-700 bg-zinc-900/85 md:block"
              style={{ borderRadius: 12 }}
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="border-b border-zinc-800 bg-zinc-950/35">
                    <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                      <th className="px-4 py-3 text-center"> </th>
                      <th className="px-4 py-3 text-left">Complete Name</th>
                      <th className="px-4 py-3 text-center">Facebook Profile</th>
                      <th className="px-4 py-3 text-center">Registered On</th>
                      <th className="px-4 py-3 text-center">Last Reviewer</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loadingApps ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-sm text-zinc-400">
                          Loading applications...
                        </td>
                      </tr>
                    ) : filteredApplications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-sm text-zinc-400">
                          No matching submissions found.
                        </td>
                      </tr>
                    ) : (
                      filteredApplications.map((app, index) => {
                        const signedInEmail = normalizeEmail(user?.email);
                        const assignedToOther =
                          !!normalizeEmail(app.assignedReviewerEmail) &&
                          normalizeEmail(app.assignedReviewerEmail) !== signedInEmail;
                        const claimActive = isClaimActive(app);
                        const claimedByOther =
                          claimActive &&
                          !!normalizeEmail(app.claimedByEmail) &&
                          normalizeEmail(app.claimedByEmail) !== signedInEmail;
                        const inProcessByOther = assignedToOther || claimedByOther;

                        return (
                          <tr
                            key={app.id}
                            className={`border-b border-zinc-800/80 text-sm text-white last:border-b-0 ${inProcessByOther ? "opacity-55" : ""
                              }`}
                          >
                            <td className="px-4 py-4 text-center text-zinc-400">{index + 1}</td>

                            <td className="px-4 py-4 text-left">
                              <button
                                type="button"
                                onClick={() => openReviewModal(app)}
                                className={`font-medium underline-offset-4 ${inProcessByOther
                                  ? "cursor-pointer text-zinc-300 hover:underline"
                                  : "cursor-pointer text-white hover:underline"
                                  }`}
                              >
                                {app.firstName} {app.lastName}
                              </button>
                            </td>

                            <td className="px-4 py-4 text-center text-zinc-300">
                              {app.facebookProfile ? (
                                <a
                                  href={app.facebookProfile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cursor-pointer text-blue-300 underline underline-offset-4 hover:text-blue-200"
                                >
                                  View Profile
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td className="px-4 py-4 text-center text-zinc-300">
                              {formatRegisteredOn(app.createdAt)}
                            </td>

                            <td className="px-4 py-4 text-center text-zinc-300">
                              {app.assignedReviewerName ||
                                app.assignedReviewerEmail ||
                                (isClaimActive(app)
                                  ? app.claimedByName || app.claimedByEmail || "—"
                                  : "—")}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <span
                                className={`shrink-0 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                                  app.status
                                )}`}
                              >
                                {getStatusLabel(app.status)}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-center">
                              {inProcessByOther ? (
                                <span className="text-sm font-medium text-zinc-400">
                                  In Process
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(app)}
                                  className="mt-4 block w-full max-w-full cursor-pointer border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
                                  style={{ borderRadius: 8 }}
                                >
                                  {app.status === "application_sent" ? "View" : "Review"}
                                </button>
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

            <div className="min-w-0 max-w-full space-y-4 md:hidden">
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
                  const signedInEmail = normalizeEmail(user?.email);
                  const assignedToOther =
                    !!normalizeEmail(app.assignedReviewerEmail) &&
                    normalizeEmail(app.assignedReviewerEmail) !== signedInEmail;
                  const claimActive = isClaimActive(app);
                  const claimedByOther =
                    claimActive &&
                    !!normalizeEmail(app.claimedByEmail) &&
                    normalizeEmail(app.claimedByEmail) !== signedInEmail;
                  const inProcessByOther = assignedToOther || claimedByOther;

                  return (
                    <div
                      key={app.id}
                      className={`min-w-0 max-w-full overflow-hidden border border-zinc-700 bg-zinc-900/85 p-4 ${inProcessByOther ? "opacity-55" : ""
                        }`}
                      style={{ borderRadius: 12 }}
                    >
                      <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs uppercase tracking-wide text-zinc-500">
                            #{index + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => openReviewModal(app)}
                            className={`mt-1 block max-w-full truncate text-left text-base font-semibold ${inProcessByOther
                              ? "cursor-pointer text-zinc-300"
                              : "cursor-pointer text-white"
                              }`}
                          >
                            {app.firstName} {app.lastName}
                          </button>
                        </div>

                        <span
                          className={`shrink-0 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getStatusBadgeClass(
                            app.status
                          )}`}
                        >
                          {getStatusLabel(app.status)}
                        </span>
                      </div>

                      <p className="text-sm text-zinc-300">
                        {app.facebookProfile ? "Facebook profile provided" : "No Facebook profile"}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Registered on {formatRegisteredOn(app.createdAt)}
                      </p>

                      {inProcessByOther ? (
                        <div className="mt-4 text-center text-sm font-medium text-zinc-400">
                          In Process
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReviewModal(app)}
                          className="mt-4 w-full cursor-pointer border border-zinc-500 bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
                          style={{ borderRadius: 8 }}
                        >
                          {app.status === "application_sent" ? "View" : "Review"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
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
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold leading-tight text-white">
                        {selectedApplication.firstName} {selectedApplication.lastName}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-400">
                        Review applicant details
                      </p>

                      <div className="mt-3 md:hidden">
                        <VerificationCodeBadge code={selectedApplication.verificationCode} />
                      </div>

                      {modalReadOnly ? (
                        <div
                          className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300"
                          style={{
                            borderRadius: 999,
                            background: "rgba(63, 63, 70, 0.45)",
                            border: "1px solid rgba(113, 113, 122, 0.35)",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "999px",
                              background:
                                selectedApplication.status === "pending" ||
                                  selectedApplication.status === "needs_more_info"
                                  ? "rgb(251, 191, 36)"
                                  : "rgb(34, 197, 94)",
                              boxShadow:
                                selectedApplication.status === "pending" ||
                                  selectedApplication.status === "needs_more_info"
                                  ? "0 0 10px rgba(251, 191, 36, 0.45)"
                                  : "0 0 10px rgba(34, 197, 94, 0.45)",
                            }}
                          />
                          <span className="text-zinc-500">
                            {selectedApplication.status === "pending" ||
                              selectedApplication.status === "needs_more_info"
                              ? "Reserved by"
                              : "Currently open by"}
                          </span>
                          <span className="text-white">
                            {getApplicationOwnerName(selectedApplication)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-start gap-3">
                      <div className="hidden md:block">
                        <VerificationCodeBadge code={selectedApplication.verificationCode} />
                      </div>

                      <button
                        type="button"
                        onClick={closeReviewModal}
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
                  </div>

                  <div className="mt-4 flex gap-4 overflow-x-auto border-b border-zinc-800 pb-2">
                    <ModalTabButton
                      label="Application"
                      active={modalTab === "application"}
                      onClick={() => setModalTab("application")}
                    />

                    {!modalReadOnly && selectedApplication.status !== "application_sent" ? (
                      <ModalTabButton
                        label="Request More Info"
                        active={modalTab === "request_more_info"}
                        onClick={() => setModalTab("request_more_info")}
                      />
                    ) : null}

                    {selectedApplication.status !== "application_sent" ? (
                      <ModalTabButton
                        label="Activity Log"
                        active={modalTab === "activity"}
                        onClick={() => setModalTab("activity")}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  {modalTab === "application" ? (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <SectionTitle>Personal Details</SectionTitle>

                        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-4 py-2">
                            <DetailLine
                              label="Email"
                              value={selectedApplication.email}
                              state={getFieldState("email")}
                            />
                            <DetailLine
                              label="Facebook Profile"
                              state={getFieldState("facebookProfile")}
                              value={
                                selectedApplication.facebookProfile ? (
                                  <a
                                    href={selectedApplication.facebookProfile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block align-top cursor-pointer underline underline-offset-4"
                                    title={selectedApplication.facebookProfile}
                                    style={{
                                      color:
                                        getFieldState("facebookProfile") === "requested"
                                          ? "rgb(252, 129, 129)"
                                          : getFieldState("facebookProfile") === "updated"
                                            ? "rgb(253, 224, 71)"
                                            : "rgb(147, 197, 253)",
                                    }}
                                  >
                                    <span className="sm:hidden">[Open Link]</span>
                                    <span className="hidden max-w-[220px] truncate sm:inline-block sm:max-w-full">
                                      {selectedApplication.facebookProfile}
                                    </span>
                                  </a>
                                ) : (
                                  "—"
                                )
                              }
                            />
                            <DetailLine
                              label="Discord ID"
                              value={selectedApplication.discordId || "—"}
                              state={getFieldState("discordId")}
                            />
                            <DetailLine label="Region" value={selectedApplication.region || "—"} />
                            <DetailLine
                              label="Organization"
                              value={selectedApplication.organization || "—"}
                            />
                          </div>

                          <div
                            className={`rounded-lg border p-4 flex flex-col justify-start text-left ${getFieldState("idPhoto") === "requested"
                              ? "border-red-500/40"
                              : getFieldState("idPhoto") === "updated"
                                ? "border-amber-400/40"
                                : "border-zinc-800"
                              }`}
                            style={
                              getFieldState("idPhoto") === "requested"
                                ? { background: "rgba(239, 68, 68, 0.04)" }
                                : getFieldState("idPhoto") === "updated"
                                  ? { background: "rgba(245, 158, 11, 0.06)" }
                                  : { background: "rgba(9, 9, 11, 0.35)" }
                            }
                          >
                            <p
                              className={`mb-3 text-[11px] font-medium uppercase tracking-wide ${getFieldState("idPhoto") === "requested"
                                ? "text-red-200"
                                : getFieldState("idPhoto") === "updated"
                                  ? "text-amber-200"
                                  : "text-zinc-500"
                                }`}
                            >
                              ID Photo
                            </p>

                            {getFieldState("idPhoto") === "requested" ? (
                              <p className="mb-3 text-xs font-medium text-red-300">
                                Requested reupload
                              </p>
                            ) : getFieldState("idPhoto") === "updated" ? (
                              <p className="mb-3 text-xs font-medium text-amber-300">
                                Updated by applicant
                              </p>
                            ) : null}

                            {selectedApplication.idFileUrl ? (
                              <>
                                <a
                                  href={selectedApplication.idFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block cursor-pointer"
                                  style={{ width: 180 }}
                                >
                                  <div
                                    className={`relative overflow-hidden border ${getFieldState("idPhoto") === "requested"
                                      ? "border-red-500/40 bg-red-950/20"
                                      : getFieldState("idPhoto") === "updated"
                                        ? "border-amber-400/40 bg-amber-950/20"
                                        : "border-zinc-700 bg-zinc-900"
                                      }`}
                                    style={{ borderRadius: 10, width: 180, aspectRatio: "3 / 2" }}
                                  >
                                    <img
                                      src={selectedApplication.idFileUrl}
                                      alt="Uploaded ID"
                                      className="absolute inset-0 h-full w-full object-cover"
                                    />
                                  </div>
                                </a>

                                <a
                                  href={selectedApplication.idFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`mt-2 inline-block w-fit cursor-pointer text-xs underline underline-offset-4 ${getFieldState("idPhoto") === "requested"
                                    ? "text-red-300 hover:text-red-200"
                                    : getFieldState("idPhoto") === "updated"
                                      ? "text-amber-300 hover:text-amber-200"
                                      : "text-blue-300 hover:text-blue-200"
                                    }`}
                                >
                                  Click to enlarge
                                </a>
                              </>
                            ) : (
                              <div
                                className={`text-sm ${getFieldState("idPhoto") === "requested"
                                  ? "text-red-300"
                                  : getFieldState("idPhoto") === "updated"
                                    ? "text-amber-300"
                                    : "text-zinc-400"
                                  }`}
                              >
                                No ID uploaded
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="space-y-4">
                          <SectionTitle>Developer Background</SectionTitle>

                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/35 px-4 py-2">
                            <DetailLine
                              label="Roblox Profile"
                              state={getFieldState("roblox")}
                              value={
                                selectedApplication.roblox ? (
                                  <a
                                    href={getRobloxLink(selectedApplication.roblox) || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cursor-pointer underline underline-offset-4"
                                    style={{
                                      color:
                                        getFieldState("roblox") === "requested"
                                          ? "rgb(252, 129, 129)"
                                          : getFieldState("roblox") === "updated"
                                            ? "rgb(253, 224, 71)"
                                            : "rgb(147, 197, 253)",
                                    }}
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
                              state={getFieldState("placeLink")}
                              value={
                                selectedApplication.placeLink ? (
                                  <a
                                    href={selectedApplication.placeLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cursor-pointer underline underline-offset-4"
                                    style={{
                                      color:
                                        getFieldState("placeLink") === "requested"
                                          ? "rgb(252, 129, 129)"
                                          : getFieldState("placeLink") === "updated"
                                            ? "rgb(253, 224, 71)"
                                            : "rgb(147, 197, 253)",
                                    }}
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
                              state={getFieldState("placeContribution")}
                            />

                            <DetailLine
                              label="Supporting Links"
                              state={getFieldState("supportingLinks")}
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
                      </div>

                      <div className="mt-2">
                        <div className="space-y-4">
                          <SectionTitle>Reviewer Notes</SectionTitle>

                          <textarea
                            value={generalReviewerNote}
                            onChange={(e) => setGeneralReviewerNote(e.target.value)}
                            rows={4}
                            placeholder="Add a general note for the applicant or staff..."
                            className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                            style={{ borderRadius: 8 }}
                          />
                        </div>
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

                        {modalReadOnly ? (
                          <div className="text-sm font-medium text-zinc-400">
                            Read only
                          </div>
                        ) : selectedApplication.status === "application_sent" ? (
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => askForConfirmation("manual_review")}
                              disabled={savingReview}
                              className="cursor-pointer px-8 py-3 text-base font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                              style={{
                                borderRadius: 5,
                                background: "rgb(59, 130, 246)",
                                border: "1px solid rgba(96, 165, 250, 0.45)",
                                minWidth: 180,
                              }}
                            >
                              {savingReview ? "Saving..." : "Start Review"}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => askForConfirmation("rejected")}
                              disabled={savingReview}
                              className="cursor-pointer border border-red-500/30 bg-red-500/10 px-6 py-2 text-sm font-semibold uppercase tracking-wide leading-none text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-70"
                              style={{ borderRadius: 5, minWidth: 130 }}
                            >
                              {savingReview ? "Saving..." : "Decline"}
                            </button>

                            <button
                              type="button"
                              onClick={() => askForConfirmation("pending")}
                              disabled={savingReview || selectedApplication.status === "pending"}
                              className="cursor-pointer border border-zinc-500/40 bg-zinc-700/50 px-6 py-2 text-sm font-semibold uppercase tracking-wide leading-none text-zinc-200 transition hover:bg-zinc-600/60 disabled:cursor-not-allowed disabled:opacity-70"
                              style={{ borderRadius: 5, minWidth: 150 }}
                            >
                              {selectedApplication.status === "pending" ? "Marked Pending" : "Mark Pending"}
                            </button>

                            <button
                              type="button"
                              onClick={() => askForConfirmation("accepted")}
                              disabled={savingReview}
                              className="cursor-pointer px-8 py-3 text-sm font-semibold uppercase tracking-wide leading-none text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                              style={{
                                borderRadius: 5,
                                background: "rgb(59, 130, 246)",
                                border: "1px solid rgba(96, 165, 250, 0.45)",
                                minWidth: 150,
                              }}
                            >
                              {savingReview ? "Saving..." : "Accept"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : modalTab === "request_more_info" && selectedApplication.status !== "application_sent" ? (
                    <div className="space-y-5">
                      <div className="space-y-4">
                        <SectionTitle>Request Corrections / More Info</SectionTitle>

                        <p className="text-sm leading-6 text-zinc-400">
                          Select the fields that need correction. Selected items will be
                          marked in red and can be expanded to include optional instructions.
                        </p>

                        <div className="space-y-4">
                          {CORRECTION_FIELD_OPTIONS.map((option) => {
                            const checked = !!selectedCorrectionFields[option.key];
                            const expanded = !!expandedCorrectionFields[option.key];

                            return (
                              <div
                                key={option.key}
                                className={`overflow-hidden border transition ${checked ? "" : "border-zinc-800 bg-zinc-950/40"
                                  }`}
                                style={
                                  checked
                                    ? {
                                      borderColor: "rgba(239, 68, 68, 0.88)",
                                      background: "rgba(239, 68, 68, 0.06)",
                                      boxShadow: "0 0 0 1px rgba(239, 68, 68, 0.22)",
                                      borderRadius: 5,
                                    }
                                    : { borderRadius: 5 }
                                }
                              >
                                <div className="flex items-center justify-between gap-4 px-4 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleCorrectionField(option.key)}
                                    className="min-w-0 flex-1 cursor-pointer text-left"
                                  >
                                    <div className="text-sm font-medium text-white">{option.label}</div>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!checked) {
                                        toggleCorrectionField(option.key);
                                        setExpandedCorrectionFields((prev) => ({
                                          ...prev,
                                          [option.key]: true,
                                        }));
                                        return;
                                      }

                                      toggleExpandedCorrectionField(option.key);
                                    }}
                                    className={`shrink-0 cursor-pointer text-lg font-semibold leading-none ${checked ? "text-red-400" : "text-zinc-400"
                                      }`}
                                    style={{
                                      width: 36,
                                      height: 36,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {checked && expanded ? "−" : "+"}
                                  </button>
                                </div>

                                {checked && expanded ? (
                                  <div className="px-4 pb-2.5 pt-0">
                                    <textarea
                                      value={fieldNotes[option.key] || ""}
                                      onChange={(e) => updateFieldNote(option.key, e.target.value)}
                                      rows={3}
                                      placeholder={`Instructions (Optional) — Add instructions for ${option.label}...`}
                                      className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                                      style={{ borderRadius: 5 }}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-center border-t border-zinc-800 pt-5">
                        {selectedApplication.status === "needs_more_info" ? (
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed px-6 py-3 text-base font-semibold uppercase tracking-wide text-zinc-300 opacity-80"
                            style={{
                              borderRadius: 5,
                              background: "rgba(63, 63, 70, 0.75)",
                              border: "1px solid rgba(113, 113, 122, 0.45)",
                              minWidth: 320,
                            }}
                          >
                            Waiting for Applicant to Respond
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => askForConfirmation("needs_more_info")}
                            disabled={savingReview}
                            className="cursor-pointer px-6 py-3 text-base font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                            style={{
                              borderRadius: 5,
                              background: "rgb(59, 130, 246)",
                              border: "1px solid rgba(96, 165, 250, 0.45)",
                              minWidth: 170,
                            }}
                          >
                            {savingReview ? "Saving..." : "Send Request"}
                          </button>
                        )}
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

                              {Array.isArray(log.meta?.correctionFieldLabels) &&
                                log.meta.correctionFieldLabels.length > 0 ? (
                                <div className="mt-3 text-xs text-zinc-400">
                                  <span className="text-zinc-500">Requested corrections for:</span>{" "}
                                  <span className="text-zinc-200">
                                    {log.meta.correctionFieldLabels.join(", ")}
                                  </span>
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

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeConfirmation}
                  disabled={savingReview}
                  className="cursor-pointer px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800/30 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    borderRadius: 5,
                    background: "transparent",
                    border: "1px solid rgba(113, 113, 122, 0.45)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmReviewAction}
                  disabled={savingReview}
                  className="cursor-pointer px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                  style={{
                    borderRadius: 5,
                    background: "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)",
                    border: "1px solid rgba(96, 165, 250, 0.55)",
                    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
                    minWidth: 110,
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {savingReview ? (
                      <>
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                          aria-hidden="true"
                        />
                        <span>Saving...</span>
                      </>
                    ) : (
                      "Confirm"
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
       </>
      ); 
}