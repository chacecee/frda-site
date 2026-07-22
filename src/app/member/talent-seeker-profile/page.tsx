"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  signOut,
} from "firebase/auth";

import { auth, storage } from "@/lib/firebase";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  Camera,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { compressDeveloperImage } from "@/lib/client/compressDeveloperImage";
import MemberPortalHeader from "@/components/member/MemberPortalHeader";
import { notify } from "@/components/ToastConfig";
import { useAuthUser } from "@/lib/useAuthUser";

type VerificationStatus =
  | "not_required"
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

type FormState = {
  entityType:
    | "individual"
    | "studio"
    | "company"
    | "organization";

  organizationName: string;
  role: string;
  contactEmail: string;
  websiteUrl: string;
  talentNeeds: string;
  reasonForJoining: string;
  avatarUrl: string;
  avatarStoragePath: string;
  avatarWidth: number;
  avatarHeight: number;
};

const EMPTY_FORM: FormState = {
  entityType: "individual",
  organizationName: "",
  role: "",
  contactEmail: "",
  websiteUrl: "",
  talentNeeds: "",
  reasonForJoining: "",
  avatarUrl: "",
  avatarStoragePath: "",
  avatarWidth: 0,
  avatarHeight: 0,
};

function getStatusLabel(
  value: VerificationStatus,
): string {
  switch (value) {
    case "not_submitted":
      return "Not Submitted";

    case "pending":
      return "Waiting for Review";

    case "verified":
      return "Verified";

    case "rejected":
      return "Changes Required";

    case "suspended":
      return "Suspended";

    default:
      return "Not Applicable";
  }
}

function getStatusClass(
  value: VerificationStatus,
): string {
  switch (value) {
    case "pending":
      return "border-blue-400/25 bg-blue-500/10 text-blue-200";

    case "verified":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";

    case "rejected":
      return "border-amber-400/25 bg-amber-500/10 text-amber-200";

    case "suspended":
      return "border-red-400/25 bg-red-500/10 text-red-200";

    default:
      return "border-white/10 bg-white/[0.04] text-zinc-300";
  }
}

export default function TalentSeekerProfilePage() {
  const router = useRouter();

  const {
    user,
    authLoading,
  } = useAuthUser();

  const [form, setForm] =
    useState<FormState>(EMPTY_FORM);

  const [status, setStatus] =
    useState<VerificationStatus>(
      "not_submitted",
    );

  const [reviewerNote, setReviewerNote] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [updatingAvatar, setUpdatingAvatar] =
    useState(false);

  useEffect(() => {
    if (
      !authLoading &&
      !user
    ) {
      router.replace("/member/login");
    }
  }, [
    authLoading,
    user,
    router,
  ]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadVerification() {
      setLoading(true);
      setErrorMessage("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/member/talent-seeker-profile",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          },
        );

        const result =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.error ||
            "Could not load your talent-seeker verification.",
          );
        }

        if (!cancelled) {
          setStatus(
            result.verification.status,
          );

          setReviewerNote(
            result.verification
              .reviewerNote || "",
          );

          setForm({
            ...EMPTY_FORM,
            ...(
              result.verification
                .profile || {}
            ),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load your verification.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVerification();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function submitVerification(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !user ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/member/talent-seeker-profile",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify(form),
        },
      );

      const result =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.error ||
          "Could not submit your verification information.",
        );
      }

      setStatus("pending");
      setReviewerNote("");
      setSuccessMessage(
        result.message,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit your verification information.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAvatar(
    avatarImage: {
      url: string;
      storagePath: string;
      width: number;
      height: number;
    } | null,
  ) {
    if (!user) return;

    const idToken =
      await user.getIdToken();

    const response = await fetch(
      "/api/member/talent-seeker-profile",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "update_avatar",
          avatarImage,
        }),
      },
    );

    const result =
      await response
        .json()
        .catch(() => null);

    if (
      !response.ok ||
      !result?.ok
    ) {
      throw new Error(
        result?.error ||
        "Could not update your profile photo.",
      );
    }
  }

  async function uploadAvatar(
    file: File | undefined,
  ) {
    if (
      !user ||
      !file ||
      updatingAvatar
    ) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/",
      )
    ) {
      notify.error(
        "Please select an image file.",
      );
      return;
    }

    setUpdatingAvatar(true);

    try {
      const compressed =
        await compressDeveloperImage(
          file,
        );

      const storagePath =
        `developer-avatars/${user.uid}/talent-seeker-${Date.now()}.webp`;

      const storageReference =
        ref(storage, storagePath);

      await uploadBytes(
        storageReference,
        compressed.blob,
        {
          contentType: "image/webp",
          customMetadata: {
            ownerUid: user.uid,
            imagePurpose:
              "talent-seeker-avatar",
          },
        },
      );

      const url =
        await getDownloadURL(
          storageReference,
        );

      const previousPath =
        form.avatarStoragePath;

      const avatarImage = {
        url,
        storagePath,
        width: compressed.width,
        height: compressed.height,
      };

      await saveAvatar(
        avatarImage,
      );

      setForm((current) => ({
        ...current,
        avatarUrl: url,
        avatarStoragePath:
          storagePath,
        avatarWidth:
          compressed.width,
        avatarHeight:
          compressed.height,
      }));

      if (
        previousPath &&
        previousPath !== storagePath
      ) {
        await deleteObject(
          ref(storage, previousPath),
        ).catch(() => undefined);
      }

      notify.success(
        "Profile photo updated.",
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not update your profile photo.",
      );
    } finally {
      setUpdatingAvatar(false);
    }
  }

  async function removeAvatar() {
    if (
      !user ||
      !form.avatarUrl ||
      updatingAvatar
    ) {
      return;
    }

    setUpdatingAvatar(true);

    try {
      const previousPath =
        form.avatarStoragePath;

      await saveAvatar(null);

      setForm((current) => ({
        ...current,
        avatarUrl: "",
        avatarStoragePath: "",
        avatarWidth: 0,
        avatarHeight: 0,
      }));

      if (previousPath) {
        await deleteObject(
          ref(storage, previousPath),
        ).catch(() => undefined);
      }

      notify.success(
        "Profile photo removed.",
      );
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Could not remove your profile photo.",
      );
    } finally {
      setUpdatingAvatar(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace(
        "/member/login",
      );
    } catch (error) {
      console.error(
        "Member sign-out error:",
        error,
      );
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="min-h-screen bg-[#071225] px-5 py-12 text-white">
        <p className="text-center text-sm text-zinc-400">
          Loading verification form...
        </p>
      </main>
    );
  }

  const locked =
    status === "pending" ||
    status === "verified" ||
    status === "suspended";

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <MemberPortalHeader
        active="dashboard"
        title="FRDA Member Portal"
        subtitle="Talent-Seeker Verification"
      />

      <section className="mx-auto max-w-3xl px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">
              Talent-Seeker Verification
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              FRDA verifies talent-seeker
              accounts before they can contact
              developers through the directory.
            </p>
          </div>

          <span
            className={`inline-flex w-fit border px-3 py-1.5 text-xs font-medium ${getStatusClass(
              status,
            )}`}
            style={{
              borderRadius: 999,
            }}
          >
            {getStatusLabel(status)}
          </span>
        </div>

        {reviewerNote ? (
          <div
            className="mt-6 border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"
            style={{
              borderRadius: 8,
            }}
          >
            <p className="font-semibold">
              FRDA review note
            </p>

            <p className="mt-2">
              {reviewerNote}
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <div
            className="mt-6 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
            style={{
              borderRadius: 8,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div
            className="mt-6 border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200"
            style={{
              borderRadius: 8,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col items-center">
          <div className="relative">
            {form.avatarUrl ? (
              <img
                src={form.avatarUrl}
                alt="Profile photo"
                className="h-24 w-24 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-white/15 bg-black/20 text-sm text-zinc-500">
                No photo
              </div>
            )}

            <label
              className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sky-300/30 bg-sky-500 text-white shadow-lg hover:bg-sky-400"
              title="Upload profile photo"
            >
              {updatingAvatar ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={updatingAvatar}
                onChange={(event) => {
                  uploadAvatar(
                    event.target.files?.[0],
                  );
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {form.avatarUrl ? (
            <button
              type="button"
              onClick={removeAvatar}
              disabled={updatingAvatar}
              className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-500 transition hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove photo
            </button>
          ) : null}

          <p className="mt-3 max-w-sm text-center text-xs leading-5 text-zinc-500">
            This photo will appear with connection requests you send to developers.
          </p>
        </div>

        <form
          onSubmit={submitVerification}
          className="mt-6 border border-white/10 bg-white/[0.025] p-5 md:p-6"
          style={{
            borderRadius: 8,
          }}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Account Type
              </label>

              <select
                value={form.entityType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    entityType:
                      event.target.value as
                        FormState["entityType"],
                  }))
                }
                disabled={locked}
                className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                  colorScheme: "dark",
                }}
              >
                <option value="individual">
                  Individual
                </option>

                <option value="studio">
                  Studio
                </option>

                <option value="company">
                  Company
                </option>

                <option value="organization">
                  Organization
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Organization Name
              </label>

              <input
                type="text"
                value={
                  form.organizationName
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    organizationName:
                      event.target.value,
                  }))
                }
                disabled={locked}
                maxLength={160}
                placeholder="Optional for individuals"
                className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                }}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Your Role
              </label>

              <input
                type="text"
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role:
                      event.target.value,
                  }))
                }
                disabled={locked}
                maxLength={160}
                placeholder="Founder, producer, recruiter, client..."
                className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                }}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Contact Email
              </label>

              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    contactEmail:
                      event.target.value,
                  }))
                }
                disabled={locked}
                maxLength={254}
                className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                }}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Website or Professional Page
              </label>

              <input
                type="url"
                value={form.websiteUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    websiteUrl:
                      event.target.value,
                  }))
                }
                disabled={locked}
                maxLength={500}
                placeholder="Optional"
                className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                }}
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Talent You Are Looking For
                </label>

                <span className="text-xs text-zinc-600">
                  {form.talentNeeds.length} / 2,000
                </span>
              </div>

              <textarea
                rows={5}
                value={form.talentNeeds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    talentNeeds:
                      event.target.value,
                  }))
                }
                disabled={locked}
                maxLength={2000}
                placeholder="Describe the roles, skills, or project needs you expect to contact developers about."
                className="w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                }}
                required
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Reason for Joining
                </label>

                <span className="text-xs text-zinc-600">
                  {form.reasonForJoining.length} / 2,000
                </span>
              </div>

              <textarea
                rows={5}
                value={form.reasonForJoining}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reasonForJoining:
                      event.target.value,
                  }))
                }
                disabled={locked}
                maxLength={2000}
                placeholder="Tell FRDA why you need access to the developer contact system."
                className="w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-400 disabled:opacity-65"
                style={{
                  borderRadius: 5,
                }}
                required
              />
            </div>
          </div>

          {!locked ? (
            <button
              type="submit"
              disabled={saving}
              className="mt-6 cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderRadius: 5,
              }}
            >
              {saving
                ? "Submitting..."
                : status === "rejected"
                  ? "Resubmit for Verification"
                  : "Submit for Verification"}
            </button>
          ) : (
            <p className="mt-6 text-sm leading-6 text-zinc-400">
              {status === "pending"
                ? "Your information is waiting for FRDA review."
                : status === "verified"
                  ? "Your talent-seeker account is verified. Contact access will be enabled once the connection-request workflow is launched."
                  : "This verification form is currently locked."}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}