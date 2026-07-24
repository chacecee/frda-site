"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
} from "framer-motion";
import { signOut } from "firebase/auth";
import { auth, storage } from "@/lib/firebase";
import MemberPortalHeader from "@/components/member/MemberPortalHeader";
import {
  Camera,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type StorageError,
} from "firebase/storage";

import { compressDeveloperImage } from "@/lib/client/compressDeveloperImage";
import { useAuthUser } from "@/lib/useAuthUser";
import { notify } from "@/components/ToastConfig";
import {
  GAME_GENRE_OPTIONS,
  type GameDirectoryGenre,
} from "@/lib/gameDirectory";

import Cropper, { type Area, type Point } from "react-easy-crop";

import {
  createProfileCrop,
  type PixelCrop,
} from "@/lib/client/createProfileCrop";

type CoverShowcaseImage = {
  id: string;
  url: string;
  storagePath: string;
  width: number;
  height: number;
  order: 1 | 2 | 3;
};

type AvatarImage = {
  url: string;
  storagePath: string;
  width: number;
  height: number;
};

type WorkSampleImage = {
  id: string;
  url: string;
  storagePath: string;
  width: number;
  height: number;

  showcaseOrder: number | null;
  showcaseUrl: string;
  showcaseStoragePath: string;
};

type WorkSampleMediaOrderItem = {
  type: "image" | "youtube";
  id: string;
};

type WorkSample = {
  id: string;
  title: string;
  projectUrl: string;
  youtubeVideoUrl: string;
  mediaOrder: WorkSampleMediaOrderItem[];
  role: string;
  contribution: string;
  teamName: string;

  projectType: "owned" | "team" | "client" | "other";

  isInDevelopment: boolean;

  images: WorkSampleImage[];

  thumbnailUrl: string;
};



type ExperienceTier =
  | "aspiring"
  | "emerging"
  | "established"
  | "experienced";

type DeliveryScope =
  | "full_team"
  | "solo_full_project"
  | "specialist";

type DeveloperProfile = {
  uid: string;
  memberId: string;
  email: string;
  displayName: string;
  headline: string;
  bio: string;
  skills: string[];
  genreExperience: GameDirectoryGenre[];
  availability: string;
  experienceTier: ExperienceTier | "";
  deliveryScope: DeliveryScope | "";
  robloxProfileUrl: string;
  portfolioUrl: string;
  workSamples: WorkSample[];
  coverShowcaseImages: CoverShowcaseImage[];
  avatarUrl: string;
  avatarStoragePath: string;

  customSubdomain: string;
  customProfileAddress: string;

  profileStatus: string;
  isPublished: boolean;
  moderationLock: boolean;
  moderationNote: string;
  moderationSource: string;
  moderationReportId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type ProfileForm = {
  displayName: string;
  headline: string;
  bio: string;
  skillsText: string;
  genreExperience: GameDirectoryGenre[];
  availability: string;
  experienceTier: ExperienceTier | "";
  deliveryScope: DeliveryScope | "";
  robloxProfileUrl: string;
  portfolioUrl: string;
};

type PublicationStatus = {
  status: string;
  isPublished: boolean;
  publishedAt: string | null;
  unpublishedAt: string | null;
  reviewerNote: string;
  moderationLock: boolean;
  moderationNote: string;
  moderationSource: string;
  moderationReportId: string;
};

const SKILL_OPTIONS = [
  "Scripting",
  "Building",
  "UI/UX Design",
  "3D Modeling",
  "Animation",
  "VFX",
  "Audio Design",
  "Game Design",
  "Level Design",
  "Project Management",
  "Video Editing",
  "Graphic Design",
  "Clothing Design",
  "Off-site Scripting",
  "Other",
] as const;

const EMPTY_FORM: ProfileForm = {
  displayName: "",
  headline: "",
  bio: "",
  skillsText: "",
  genreExperience: [],
  availability: "",
  experienceTier: "",
  deliveryScope: "",
  robloxProfileUrl: "",
  portfolioUrl: "",
};

function profileToForm(profile: DeveloperProfile): ProfileForm {
  return {
    displayName: profile.displayName || "",
    headline: profile.headline || "",
    bio: profile.bio || "",
    skillsText: (profile.skills || []).join(", "),
    genreExperience:
      Array.isArray(profile.genreExperience)
        ? profile.genreExperience
        : [],
    availability: profile.availability || "",
    experienceTier: profile.experienceTier || "",
    deliveryScope: profile.deliveryScope || "",
    robloxProfileUrl: profile.robloxProfileUrl || "",
    portfolioUrl: profile.portfolioUrl || "",
  };
}

function parseSkills(value: string): string[] {
  const uniqueSkills = new Set<string>();

  value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean)
    .forEach((skill) => uniqueSkills.add(skill));

  return Array.from(uniqueSkills).slice(0, 20);
}

function createEmptyWorkSample(): WorkSample {
  const generatedId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `work-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: generatedId,
    title: "",
    projectUrl: "",
    youtubeVideoUrl: "",
    mediaOrder: [],
    role: "",
    contribution: "",
    teamName: "",
    projectType: "owned",
    isInDevelopment: false,
    images: [],
    thumbnailUrl: "",
  };
}

function normalizeWorkSamples(value: unknown): WorkSample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const raw =
      typeof item === "object" && item !== null
        ? (item as Partial<WorkSample>)
        : {};

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : `work-${index + 1}`,

      title: typeof raw.title === "string" ? raw.title : "",

      projectUrl: typeof raw.projectUrl === "string" ? raw.projectUrl : "",

      youtubeVideoUrl:
        typeof raw.youtubeVideoUrl === "string" ? raw.youtubeVideoUrl : "",

      mediaOrder:
        Array.isArray(raw.mediaOrder)
          ? raw.mediaOrder
              .map((entry) => {
                const rawEntry =
                  typeof entry === "object" && entry !== null
                    ? (entry as Partial<WorkSampleMediaOrderItem>)
                    : {};

                if (
                  (rawEntry.type !== "image" &&
                    rawEntry.type !== "youtube") ||
                  typeof rawEntry.id !== "string"
                ) {
                  return null;
                }

                return {
                  type: rawEntry.type,
                  id: rawEntry.id,
                };
              })
              .filter(
                (
                  entry,
                ): entry is WorkSampleMediaOrderItem =>
                  entry !== null,
              )
          : [],

      role: typeof raw.role === "string" ? raw.role : "",

      contribution:
        typeof raw.contribution === "string" ? raw.contribution : "",

      teamName: typeof raw.teamName === "string" ? raw.teamName : "",

      projectType:
        raw.projectType === "owned" ||
        raw.projectType === "team" ||
        raw.projectType === "client" ||
        raw.projectType === "other"
          ? raw.projectType
          : "other",

      isInDevelopment: raw.isInDevelopment === true,

      images: Array.isArray(raw.images)
        ? raw.images.map((image) => {
            const rawImage =
              typeof image === "object" && image !== null
                ? (image as Partial<WorkSampleImage>)
                : {};

            return {
              id: typeof rawImage.id === "string" ? rawImage.id : "",

              url: typeof rawImage.url === "string" ? rawImage.url : "",

              storagePath:
                typeof rawImage.storagePath === "string"
                  ? rawImage.storagePath
                  : "",

              width: typeof rawImage.width === "number" ? rawImage.width : 1,

              height: typeof rawImage.height === "number" ? rawImage.height : 1,

              showcaseOrder:
                rawImage.showcaseOrder === 1 ||
                rawImage.showcaseOrder === 2 ||
                rawImage.showcaseOrder === 3
                  ? rawImage.showcaseOrder
                  : null,

              showcaseUrl:
                typeof rawImage.showcaseUrl === "string"
                  ? rawImage.showcaseUrl
                  : "",

              showcaseStoragePath:
                typeof rawImage.showcaseStoragePath === "string"
                  ? rawImage.showcaseStoragePath
                  : "",
            };
          })
        : [],

      thumbnailUrl:
        typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl : "",
    };
  });
}

function normalizeCoverShowcaseImages(value: unknown): CoverShowcaseImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const raw =
        typeof item === "object" && item !== null
          ? (item as Partial<CoverShowcaseImage>)
          : {};

      if (
        typeof raw.id !== "string" ||
        typeof raw.url !== "string" ||
        typeof raw.storagePath !== "string" ||
        (raw.order !== 1 && raw.order !== 2 && raw.order !== 3)
      ) {
        return null;
      }

      return {
        id: raw.id,
        url: raw.url,
        storagePath: raw.storagePath,
        width: typeof raw.width === "number" ? raw.width : 1600,
        height: typeof raw.height === "number" ? raw.height : 900,
        order: raw.order,
      };
    })
    .filter((item): item is CoverShowcaseImage => item !== null)
    .sort((first, second) => first.order - second.order)
    .slice(0, 3);
}

function getYouTubeVideoId(
  value: string,
): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    const hostname = url.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return (
        url.pathname
          .split("/")
          .filter(Boolean)[0] || ""
      );
    }

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }

      const parts = url.pathname
        .split("/")
        .filter(Boolean);

      if (
        parts[0] === "shorts" ||
        parts[0] === "embed" ||
        parts[0] === "live"
      ) {
        return parts[1] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

function getOrderedProjectMedia(
  item: WorkSample,
): WorkSampleMediaOrderItem[] {
  const validImageIds = new Set(
    item.images.map((image) => image.id),
  );

  const hasYoutube =
    Boolean(item.youtubeVideoUrl.trim());

  const used = new Set<string>();
  const ordered: WorkSampleMediaOrderItem[] = [];

  item.mediaOrder.forEach((entry) => {
    const key = `${entry.type}:${entry.id}`;

    if (used.has(key)) return;

    if (
      entry.type === "image" &&
      !validImageIds.has(entry.id)
    ) {
      return;
    }

    if (
      entry.type === "youtube" &&
      (!hasYoutube || entry.id !== "youtube")
    ) {
      return;
    }

    used.add(key);
    ordered.push(entry);
  });

  if (
    hasYoutube &&
    !used.has("youtube:youtube")
  ) {
    ordered.push({
      type: "youtube",
      id: "youtube",
    });

    used.add("youtube:youtube");
  }

  item.images.forEach((image) => {
    const key = `image:${image.id}`;

    if (!used.has(key)) {
      ordered.push({
        type: "image",
        id: image.id,
      });

      used.add(key);
    }
  });

  return ordered;
}

function isStorageObjectMissing(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (
      (error as StorageError).code ===
        "storage/object-not-found" ||
      String(
        (error as { code?: unknown }).code ||
          "",
      ) === "storage/object-not-found"
    )
  );
}

async function safelyDeleteStorageObject(
  storagePath: string,
): Promise<void> {
  const normalizedPath =
    storagePath.trim();

  if (!normalizedPath) {
    return;
  }

  try {
    await deleteObject(
      ref(storage, normalizedPath),
    );
  } catch (error) {
    if (isStorageObjectMissing(error)) {
      return;
    }

    throw error;
  }
}



function getPublicationValidationMessage({
  displayName,
  skills,
  experienceTier,
  deliveryScope,
  coverShowcaseImages,
  workSamples,
}: {
  displayName: string;
  skills: string[];
  experienceTier: ExperienceTier | "";
  deliveryScope: DeliveryScope | "";
  coverShowcaseImages: CoverShowcaseImage[];
  workSamples: WorkSample[];
}): string {
  const missing: string[] = [];

  if (!displayName.trim()) missing.push("display name");
  if (skills.length === 0) missing.push("at least one skill");
  if (!experienceTier) missing.push("experience level");
  if (!deliveryScope) missing.push("development capacity");
  if (coverShowcaseImages.length === 0) {
    missing.push("at least one cover photo");
  }

  const hasValidWorkSample = workSamples.some(
    (item) => item.title.trim() && item.role.trim(),
  );

  if (!hasValidWorkSample) {
    missing.push(
      "at least one featured work item with a title and your role",
    );
  }

  return missing.length
    ? `Complete these required fields first: ${missing.join(", ")}.`
    : "";
}

export default function MemberProfilePage() {
  const router = useRouter();
  const { user, authLoading } = useAuthUser();

  const [profile, setProfile] = useState<DeveloperProfile | null>(null);

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [publication, setPublication] = useState<PublicationStatus>({
    status: "draft",
    isPublished: false,
    publishedAt: null,
    unpublishedAt: null,
    reviewerNote: "",
    moderationLock: false,
    moderationNote: "",
    moderationSource: "",
    moderationReportId: "",
  });

  const [submittingForReview, setSubmittingForReview] = useState(false);

  const [subdomainValue, setSubdomainValue] = useState("");

  const [savingSubdomain, setSavingSubdomain] = useState(false);

  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(
    null,
  );

  const [subdomainMessage, setSubdomainMessage] = useState("");

  const [editingSubdomain, setEditingSubdomain] =
    useState(false);

  const [workSamples, setWorkSamples] = useState<WorkSample[]>([]);

  const [
    editingWorkSampleId,
    setEditingWorkSampleId,
  ] = useState<string | null>(null);

  const [
    newlyCreatedWorkSampleId,
    setNewlyCreatedWorkSampleId,
  ] = useState<string | null>(null);

  const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(
    null,
  );

  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const [coverShowcaseImages, setCoverShowcaseImages] = useState<
    CoverShowcaseImage[]
  >([]);

  const [avatarImage, setAvatarImage] = useState<AvatarImage | null>(null);

  const [mediaCropTarget, setMediaCropTarget] = useState<{
    kind: "cover" | "avatar" | "project";
    sourceUrl: string;
    revokeSourceUrl: boolean;
    existingCover?: CoverShowcaseImage;
    projectId?: string;
    projectImage?: WorkSampleImage;
  } | null>(null);

  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 });

  const [cropZoom, setCropZoom] = useState(1);

  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(
    null,
  );

  const [savingMediaCrop, setSavingMediaCrop] = useState(false);

  const [deletingCoverId, setDeletingCoverId] = useState<string | null>(null);

  const [deletingAvatar, setDeletingAvatar] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/member/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const currentUser = user;
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setErrorMessage("");

      try {
        const idToken = await currentUser.getIdToken();

        const [profileResponse, publicationResponse] = await Promise.all([
          fetch("/api/member/profile", {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            cache: "no-store",
          }),

          fetch("/api/member/profile/publication-request", {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
            cache: "no-store",
          }),
        ]);

        const profileResult = await profileResponse.json().catch(() => null);

        const publicationResult = await publicationResponse
          .json()
          .catch(() => null);

        if (!profileResponse.ok || !profileResult?.ok) {
          throw new Error(
            profileResult?.error || "Could not load your developer profile.",
          );
        }

        if (!publicationResponse.ok || !publicationResult?.ok) {
          throw new Error(
            publicationResult?.error ||
              "Could not load your publication status.",
          );
        }

        if (!cancelled) {
          setProfile(profileResult.profile);

          setForm(profileToForm(profileResult.profile));

          setSubdomainValue(profileResult.profile.customSubdomain || "");

          setWorkSamples(
            normalizeWorkSamples(profileResult.profile.workSamples),
          );

          setCoverShowcaseImages(
            normalizeCoverShowcaseImages(
              profileResult.profile.coverShowcaseImages,
            ),
          );

          setAvatarImage(
            profileResult.profile.avatarUrl &&
              profileResult.profile.avatarStoragePath
              ? {
                  url: profileResult.profile.avatarUrl,
                  storagePath: profileResult.profile.avatarStoragePath,
                  width: 512,
                  height: 512,
                }
              : null,
          );

          setPublication(publicationResult.publication);
        }
      } catch (error) {
        console.error("Developer profile load error:", error);

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load your developer profile.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggleSkill(skill: string) {
    const selectedSkills =
      parseSkills(form.skillsText);

    const nextSkills =
      selectedSkills.includes(skill)
        ? selectedSkills.filter(
            (item) => item !== skill,
          )
        : [...selectedSkills, skill].slice(
            0,
            20,
          );

    setForm((current) => ({
      ...current,
      skillsText: nextSkills.join(", "),
    }));
  }

  function toggleGenreExperience(
    genre: GameDirectoryGenre,
  ) {
    setForm((current) => {
      const alreadySelected =
        current.genreExperience.includes(
          genre,
        );

      return {
        ...current,
        genreExperience:
          alreadySelected
            ? current.genreExperience.filter(
                (item) => item !== genre,
              )
            : [
                ...current.genreExperience,
                genre,
              ].slice(0, 12),
      };
    });
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user || saving) return;

    if (!form.experienceTier) {
      const message =
        "Choose the experience level that best describes you.";
      setErrorMessage(message);
      notify.error(message);
      return;
    }

    if (!form.deliveryScope) {
      const message =
        "Choose the type of development work you can take on.";
      setErrorMessage(message);
      notify.error(message);
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/member/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          headline: form.headline.trim(),
          bio: form.bio.trim(),
          skills: parseSkills(form.skillsText),
          genreExperience: form.genreExperience,
          availability: form.availability,
          experienceTier: form.experienceTier,
          deliveryScope: form.deliveryScope,
          robloxProfileUrl: form.robloxProfileUrl.trim(),
          portfolioUrl: form.portfolioUrl.trim(),

          workSamples,
          coverShowcaseImages,
          avatarImage,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error || "Could not save your developer profile.",
        );
      }

      setProfile(result.profile);
      setForm(profileToForm(result.profile));

      setWorkSamples(normalizeWorkSamples(result.profile.workSamples));
      setCoverShowcaseImages(
        normalizeCoverShowcaseImages(result.profile.coverShowcaseImages),
      );
      setAvatarImage(
        result.profile.avatarUrl && result.profile.avatarStoragePath
          ? {
              url: result.profile.avatarUrl,
              storagePath: result.profile.avatarStoragePath,
              width: 512,
              height: 512,
            }
          : null,
      );
      setSuccessMessage("Your developer profile draft has been saved.");
      notify.success("Developer profile saved.");
    } catch (error) {
      console.error("Developer profile save error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Could not save your developer profile.";

      setErrorMessage(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCurrentProfile(): Promise<boolean> {
    if (!user) return false;

    if (!form.experienceTier) {
      throw new Error(
        "Choose the experience level that best describes you.",
      );
    }

    if (!form.deliveryScope) {
      throw new Error(
        "Choose the type of development work you can take on.",
      );
    }

    const idToken = await user.getIdToken();

    const response = await fetch("/api/member/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        displayName: form.displayName.trim(),
        headline: form.headline.trim(),
        bio: form.bio.trim(),
        skills: parseSkills(form.skillsText),
        genreExperience: form.genreExperience,
        availability: form.availability,
        experienceTier: form.experienceTier,
        deliveryScope: form.deliveryScope,
        robloxProfileUrl: form.robloxProfileUrl.trim(),
        portfolioUrl: form.portfolioUrl.trim(),

        workSamples,
        coverShowcaseImages,
        avatarImage,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      throw new Error(
        result?.error || "Could not save your developer profile.",
      );
    }

    setProfile(result.profile);
    setForm(profileToForm(result.profile));

    setWorkSamples(normalizeWorkSamples(result.profile.workSamples));

    return true;
  }

  async function updatePublication(action: "publish" | "unpublish") {
    if (!user || submittingForReview || saving) return;

    if (
      action === "publish" &&
      publication.moderationLock
    ) {
      const message =
        "Your public profile is currently hidden by FRDA moderation and cannot be republished until the restriction is lifted.";

      setErrorMessage(message);
      notify.error(message);
      return;
    }

    if (action === "publish") {
      const validationMessage = getPublicationValidationMessage({
        displayName: form.displayName,
        skills: parseSkills(form.skillsText),
        experienceTier: form.experienceTier,
        deliveryScope: form.deliveryScope,
        coverShowcaseImages,
        workSamples,
      });

      if (validationMessage) {
        setErrorMessage(validationMessage);
        notify.error(validationMessage);
        return;
      }
    }

    setSubmittingForReview(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (action === "publish") {
        await saveCurrentProfile();
      }

      const idToken = await user.getIdToken();

      const response = await fetch("/api/member/profile/publication-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action,
          confirmedAccuracy: action === "publish",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error || "Could not update your profile publication status.",
        );
      }

      setPublication(result.publication);
      setSuccessMessage(result.message);
      notify.success(result.message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update your profile publication status.";

      setErrorMessage(message);
      notify.error(message);
    } finally {
      setSubmittingForReview(false);
    }
  }

  function addWorkSample() {
    if (workSamples.length >= 6) {
      return;
    }

    const newSample =
      createEmptyWorkSample();

    setWorkSamples((current) => [
      ...current,
      newSample,
    ]);

    setNewlyCreatedWorkSampleId(
      newSample.id,
    );

    setEditingWorkSampleId(
      newSample.id,
    );
  }

  function editWorkSample(id: string) {
    setNewlyCreatedWorkSampleId(null);
    setEditingWorkSampleId(id);
  }

  function closeWorkSampleModal() {
    if (
      newlyCreatedWorkSampleId &&
      editingWorkSampleId ===
        newlyCreatedWorkSampleId
    ) {
      const sample = workSamples.find(
        (item) =>
          item.id ===
          newlyCreatedWorkSampleId,
      );

      const isBlank =
        sample &&
        !sample.title.trim() &&
        !sample.projectUrl.trim() &&
        !sample.youtubeVideoUrl.trim() &&
        !sample.role.trim() &&
        !sample.contribution.trim() &&
        !sample.teamName.trim() &&
        sample.images.length === 0;

      if (isBlank) {
        setWorkSamples((current) =>
          current.filter(
            (item) =>
              item.id !==
              newlyCreatedWorkSampleId,
          ),
        );
      }
    }

    setEditingWorkSampleId(null);
    setNewlyCreatedWorkSampleId(null);
  }

  function updateWorkSample(id: string, updates: Partial<WorkSample>) {
    setWorkSamples((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
            }
          : item,
      ),
    );
  }

  function updateYoutubeVideoUrl(
    projectId: string,
    value: string,
  ) {
    setWorkSamples((current) =>
      current.map((item) => {
        if (item.id !== projectId) {
          return item;
        }

        const nextMediaOrder =
          value.trim()
            ? getOrderedProjectMedia({
                ...item,
                youtubeVideoUrl: value,
              })
            : getOrderedProjectMedia({
                ...item,
                youtubeVideoUrl: "",
                mediaOrder:
                  item.mediaOrder.filter(
                    (entry) =>
                      entry.type !== "youtube",
                  ),
              });

        return {
          ...item,
          youtubeVideoUrl: value,
          mediaOrder: nextMediaOrder,
        };
      }),
    );
  }

  function moveProjectMedia(
    projectId: string,
    type: "image" | "youtube",
    mediaId: string,
    direction: -1 | 1,
  ) {
    setWorkSamples((current) =>
      current.map((item) => {
        if (item.id !== projectId) {
          return item;
        }

        const ordered =
          getOrderedProjectMedia(item);

        const index =
          ordered.findIndex(
            (entry) =>
              entry.type === type &&
              entry.id === mediaId,
          );

        const destination =
          index + direction;

        if (
          index < 0 ||
          destination < 0 ||
          destination >= ordered.length
        ) {
          return item;
        }

        const next = [...ordered];

        [next[index], next[destination]] = [
          next[destination],
          next[index],
        ];

        return {
          ...item,
          mediaOrder: next,
        };
      }),
    );
  }

  function removeYoutubeVideo(
    projectId: string,
  ) {
    setWorkSamples((current) =>
      current.map((item) =>
        item.id === projectId
          ? {
              ...item,
              youtubeVideoUrl: "",
              mediaOrder:
                item.mediaOrder.filter(
                  (entry) =>
                    entry.type !== "youtube",
                ),
            }
          : item,
      ),
    );

    setSuccessMessage(
      "The project video was removed. Save your profile to keep the change.",
    );
  }

  async function removeWorkSample(id: string) {
    const sample = workSamples.find((item) => item.id === id);
    if (!sample) return;

    setErrorMessage("");
    setSuccessMessage("");

    try {
      for (const image of sample.images || []) {
        await safelyDeleteStorageObject(
          image.showcaseStoragePath,
        );

        await safelyDeleteStorageObject(
          image.storagePath,
        );
      }

      setWorkSamples((current) => current.filter((item) => item.id !== id));
      setSuccessMessage(
        "The work sample and its uploaded images were removed. Save your profile to keep the change.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not remove this work sample.",
      );
    }
  }

  async function uploadProjectImages(
    projectId: string,
    files: FileList | null,
  ) {
    if (!user || !files?.length) return;

    const project = workSamples.find((item) => item.id === projectId);
    if (!project) return;

    const remainingSlots = 5 - (project.images?.length || 0);
    if (remainingSlots <= 0) {
      setErrorMessage("This project already has five images.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    setUploadingProjectId(projectId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const uploadedImages: WorkSampleImage[] = [];

      for (const file of selectedFiles) {
        const compressed = await compressDeveloperImage(file);
        const imageId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const storagePath = `developer-work/${user.uid}/${projectId}/${imageId}.webp`;
        const storageReference = ref(storage, storagePath);

        await uploadBytes(storageReference, compressed.blob, {
          contentType: "image/webp",
          customMetadata: { projectId, ownerUid: user.uid },
        });

        const url = await getDownloadURL(storageReference);
        uploadedImages.push({
          id: imageId,
          url,
          storagePath,
          width: compressed.width,
          height: compressed.height,
          showcaseOrder: null,
          showcaseUrl: "",
          showcaseStoragePath: "",
        });
      }

      setWorkSamples((current) =>
        current.map((item) =>
          item.id === projectId
            ? {
                ...item,
                images: [...(item.images || []), ...uploadedImages].slice(0, 5),
                mediaOrder: [
                  ...getOrderedProjectMedia(item),
                  ...uploadedImages.map(
                    (image) => ({
                      type: "image" as const,
                      id: image.id,
                    }),
                  ),
                ],
              }
            : item,
        ),
      );

      const message =
        `${uploadedImages.length} project ${
          uploadedImages.length === 1 ? "image was" : "images were"
        } uploaded. Save your profile to keep the changes.`;

      setSuccessMessage(message);
      notify.success(message);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not upload the selected images.";

      setErrorMessage(message);
      notify.error(message);
    } finally {
      setUploadingProjectId(null);
    }
  }

  async function removeProjectImage(projectId: string, image: WorkSampleImage) {
    if (!user || deletingImageId) return;

    setDeletingImageId(image.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await safelyDeleteStorageObject(
        image.showcaseStoragePath,
      );

      await safelyDeleteStorageObject(
        image.storagePath,
      );

      setWorkSamples((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                images: (project.images || []).filter(
                  (candidate) => candidate.id !== image.id,
                ),
                mediaOrder:
                  project.mediaOrder.filter(
                    (entry) =>
                      !(
                        entry.type === "image" &&
                        entry.id === image.id
                      ),
                  ),
              }
            : project,
        ),
      );
      setSuccessMessage(
        "The project image was removed. Save your profile to keep the change.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not remove this image.",
      );
    } finally {
      setDeletingImageId(null);
    }
  }

  function openNewCoverCrop(file: File | undefined) {
    if (!file || coverShowcaseImages.length >= 3) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      return;
    }

    const sourceUrl = URL.createObjectURL(file);
    setMediaCropTarget({
      kind: "cover",
      sourceUrl,
      revokeSourceUrl: true,
    });
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }

  function openExistingCoverCrop(cover: CoverShowcaseImage) {
    setMediaCropTarget({
      kind: "cover",
      sourceUrl: cover.url,
      revokeSourceUrl: false,
      existingCover: cover,
    });
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }

  function openProjectImageCrop(
    projectId: string,
    image: WorkSampleImage,
  ) {
    setMediaCropTarget({
      kind: "project",
      sourceUrl: image.url,
      revokeSourceUrl: false,
      projectId,
      projectImage: image,
    });

    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }

  function openAvatarCrop(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      if (file) setErrorMessage("Please select an image file.");
      return;
    }

    const sourceUrl = URL.createObjectURL(file);
    setMediaCropTarget({
      kind: "avatar",
      sourceUrl,
      revokeSourceUrl: true,
    });
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }

  function closeMediaCrop() {
    if (savingMediaCrop) return;
    if (mediaCropTarget?.revokeSourceUrl) {
      URL.revokeObjectURL(mediaCropTarget.sourceUrl);
    }
    setMediaCropTarget(null);
    setCroppedAreaPixels(null);
    setCropZoom(1);
  }

  function getNextCoverOrder(): 1 | 2 | 3 | null {
    const used = new Set(coverShowcaseImages.map((image) => image.order));
    return ([1, 2, 3] as const).find((order) => !used.has(order)) ?? null;
  }

  async function saveMediaCrop() {
    if (!user || !mediaCropTarget || !croppedAreaPixels || savingMediaCrop) {
      return;
    }

    setSavingMediaCrop(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (mediaCropTarget.kind === "avatar") {
        const cropped = await createProfileCrop(
          mediaCropTarget.sourceUrl,
          croppedAreaPixels,
          {
            outputWidth: 512,
            outputHeight: 512,
            targetBytes: 250 * 1024,
          },
        );
        const storagePath = `developer-avatars/${user.uid}/avatar-${Date.now()}.webp`;
        const storageReference = ref(storage, storagePath);

        await uploadBytes(storageReference, cropped.blob, {
          contentType: "image/webp",
          customMetadata: { ownerUid: user.uid, imagePurpose: "avatar" },
        });
        const url = await getDownloadURL(storageReference);

        if (avatarImage?.storagePath) {
          await safelyDeleteStorageObject(
            avatarImage.storagePath,
          );
        }

        setAvatarImage({
          url,
          storagePath,
          width: cropped.width,
          height: cropped.height,
        });
        setSuccessMessage(
          "Your profile photo was updated. Save your profile to keep the change.",
        );
      } else if (
        mediaCropTarget.kind === "project"
      ) {
        const projectId =
          mediaCropTarget.projectId;

        const projectImage =
          mediaCropTarget.projectImage;

        if (!projectId || !projectImage) {
          throw new Error(
            "This project image could not be edited.",
          );
        }

        const cropped = await createProfileCrop(
          mediaCropTarget.sourceUrl,
          croppedAreaPixels,
          {
            outputWidth: 1600,
            outputHeight: 900,
            targetBytes: 700 * 1024,
          },
        );

        const storagePath =
          `developer-work/${user.uid}/${projectId}/${projectImage.id}-${Date.now()}.webp`;

        const storageReference =
          ref(storage, storagePath);

        await uploadBytes(
          storageReference,
          cropped.blob,
          {
            contentType: "image/webp",
            customMetadata: {
              ownerUid: user.uid,
              projectId,
              imagePurpose:
                "project-gallery",
            },
          },
        );

        const url =
          await getDownloadURL(
            storageReference,
          );

        if (projectImage.storagePath) {
          await safelyDeleteStorageObject(
            projectImage.storagePath,
          );
        }

        setWorkSamples((current) =>
          current.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  images:
                    project.images.map(
                      (image) =>
                        image.id ===
                        projectImage.id
                          ? {
                              ...image,
                              url,
                              storagePath,
                              width:
                                cropped.width,
                              height:
                                cropped.height,
                            }
                          : image,
                    ),
                }
              : project,
          ),
        );

        setSuccessMessage(
          "The project image crop was updated. Save your profile to keep the change.",
        );
      } else {
        const existing = mediaCropTarget.existingCover;
        const order = existing?.order ?? getNextCoverOrder();
        if (!order) {
          throw new Error("You can upload up to three cover photos.");
        }

        const cropped = await createProfileCrop(
          mediaCropTarget.sourceUrl,
          croppedAreaPixels,
          {
            outputWidth: 1600,
            outputHeight: 900,
            targetBytes: 600 * 1024,
          },
        );
        const id =
          existing?.id ??
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `cover-${Date.now()}`);
        const storagePath = `developer-showcase/${user.uid}/${id}-${Date.now()}.webp`;
        const storageReference = ref(storage, storagePath);

        await uploadBytes(storageReference, cropped.blob, {
          contentType: "image/webp",
          customMetadata: { ownerUid: user.uid, imagePurpose: "profile-cover" },
        });
        const url = await getDownloadURL(storageReference);

        if (existing?.storagePath) {
          await safelyDeleteStorageObject(
            existing.storagePath,
          );
        }

        const newCover: CoverShowcaseImage = {
          id,
          url,
          storagePath,
          width: cropped.width,
          height: cropped.height,
          order,
        };

        setCoverShowcaseImages((current) =>
          existing
            ? current
                .map((cover) => (cover.id === existing.id ? newCover : cover))
                .sort((a, b) => a.order - b.order)
            : [...current, newCover].sort((a, b) => a.order - b.order),
        );
        setSuccessMessage(
          "The cover photo was prepared and uploaded. Save your profile to keep the change.",
        );
      }

      if (mediaCropTarget.revokeSourceUrl) {
        URL.revokeObjectURL(mediaCropTarget.sourceUrl);
      }
      setMediaCropTarget(null);
      setCroppedAreaPixels(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not prepare this image.",
      );
    } finally {
      setSavingMediaCrop(false);
    }
  }

  async function deleteCoverImage(cover: CoverShowcaseImage) {
    if (deletingCoverId) return;
    setDeletingCoverId(cover.id);
    setErrorMessage("");

    try {
      await safelyDeleteStorageObject(
        cover.storagePath,
      );
      setCoverShowcaseImages((current) =>
        current
          .filter((item) => item.id !== cover.id)
          .map((item, index) => ({
            ...item,
            order: (index + 1) as 1 | 2 | 3,
          })),
      );
      setSuccessMessage(
        "The cover photo was removed. Save your profile to keep the change.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not delete the cover photo.",
      );
    } finally {
      setDeletingCoverId(null);
    }
  }

  function moveCoverImage(coverId: string, direction: -1 | 1) {
    setCoverShowcaseImages((current) => {
      const ordered = [...current].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((item) => item.id === coverId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= ordered.length) {
        return current;
      }
      [ordered[index], ordered[destination]] = [
        ordered[destination],
        ordered[index],
      ];
      return ordered.map((item, itemIndex) => ({
        ...item,
        order: (itemIndex + 1) as 1 | 2 | 3,
      }));
    });
  }

  async function deleteAvatarImage() {
    if (!avatarImage || deletingAvatar) return;
    setDeletingAvatar(true);
    setErrorMessage("");

    try {
      await safelyDeleteStorageObject(
        avatarImage.storagePath,
      );
      setAvatarImage(null);
      setSuccessMessage(
        "Your profile photo was removed. Save your profile to keep the change.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not delete your profile photo.",
      );
    } finally {
      setDeletingAvatar(false);
    }
  }

  async function checkSubdomainAvailability() {
    if (!user || !subdomainValue.trim()) return;

    setCheckingSubdomain(true);
    setSubdomainMessage("");
    setSubdomainAvailable(null);

    try {
      const idToken = await user.getIdToken();

      const normalizedValue = subdomainValue.trim().toLowerCase();

      const response = await fetch(
        `/api/member/profile/subdomain?value=${encodeURIComponent(
          normalizedValue,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          cache: "no-store",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Could not check this address.");
      }

      setSubdomainAvailable(result.available === true);

      setSubdomainMessage(
        result.available
          ? "This address is available."
          : result.error || "This address is unavailable.",
      );
    } catch (error) {
      setSubdomainAvailable(false);

      setSubdomainMessage(
        error instanceof Error
          ? error.message
          : "Could not check this address.",
      );
    } finally {
      setCheckingSubdomain(false);
    }
  }

  async function saveCustomSubdomain() {
    if (!user || savingSubdomain) return;

    setSavingSubdomain(true);
    setSubdomainMessage("");
    setSubdomainAvailable(null);

    try {
      const idToken = await user.getIdToken();

      const normalizedValue = subdomainValue.trim().toLowerCase();

      const response = await fetch("/api/member/profile/subdomain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${idToken}`,
        },

        body: JSON.stringify({
          customSubdomain: normalizedValue,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Could not reserve this address.");
      }

      setSubdomainValue(result.customSubdomain);

      setSubdomainAvailable(true);
      setSubdomainMessage(result.message);
      setEditingSubdomain(false);

      setProfile((current) =>
        current
          ? {
              ...current,
              customSubdomain: result.customSubdomain,
              customProfileAddress: result.publicAddress,
            }
          : current,
      );
    } catch (error) {
      setSubdomainAvailable(false);

      setSubdomainMessage(
        error instanceof Error
          ? error.message
          : "Could not reserve this address.",
      );
    } finally {
      setSavingSubdomain(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace("/member/login");
    } catch (error) {
      console.error("Member sign-out error:", error);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-[#071225] px-5 py-12 text-white">
        <p className="text-center text-sm text-zinc-400">
          Loading your developer profile...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071225] text-white">
      <AnimatePresence>
        {(saving ||
          uploadingProjectId ||
          savingMediaCrop) ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-x-0 top-0 z-[250] flex justify-center px-4 pt-3"
          >
            <div
              className="inline-flex items-center gap-2 border border-sky-300/20 bg-[#071225]/88 px-4 py-2.5 text-sm font-medium text-sky-100 shadow-[0_10px_34px_rgba(0,0,0,0.35),0_0_22px_rgba(56,189,248,0.14)] backdrop-blur-xl"
              style={{ borderRadius: 999 }}
            >
              <LoaderCircle className="h-4 w-4 animate-spin" />

              {saving
                ? "Saving profile..."
                : savingMediaCrop
                  ? "Saving image..."
                  : "Processing images..."}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MemberPortalHeader
        active="profile"
        title="FRDA Member Portal"
        subtitle="Developer Profile"
      />

      <section className="mx-auto max-w-5xl px-5 py-8 pb-32 md:px-8 md:py-10 md:pb-32">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-white">
            Developer Profile
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage the information shown on your public developer profile.
          </p>
        </div>

        {publication.moderationLock ? (
          <div
            className="mb-6 border border-red-400/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100"
            style={{ borderRadius: 8 }}
          >
            <p className="font-semibold">
              Your public profile is hidden by FRDA moderation.
            </p>

            <p className="mt-2 text-red-100/80">
              You may continue editing and saving your profile, but publishing is disabled until FRDA lifts the restriction.
            </p>

            {publication.moderationNote ? (
              <div className="mt-3 border-t border-red-300/15 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-200/75">
                  Moderator Note
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-red-100">
                  {publication.moderationNote}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-sky-300/20 bg-[#071225]/76 shadow-[0_-14px_42px_rgba(0,0,0,0.42),0_-2px_24px_rgba(56,189,248,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
            <p className="hidden text-sm font-semibold text-white sm:block">
              Profile Editor
            </p>

            <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/member/profile/preview",
                  )
                }
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-white/10 bg-white/[0.035] px-3.5 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.07]"
                style={{ borderRadius: 6 }}
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>

              <button
                type="submit"
                form="developer-profile-form"
                disabled={
                  saving ||
                  submittingForReview
                }
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderRadius: 6 }}
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>

              <button
                type="button"
                onClick={() =>
                  updatePublication(
                    publication.isPublished
                      ? "unpublish"
                      : "publish",
                  )
                }
                disabled={
                  saving ||
                  submittingForReview ||
                  (
                    publication.moderationLock &&
                    !publication.isPublished
                  )
                }
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  publication.isPublished
                    ? "border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    : "bg-emerald-600 text-white hover:bg-emerald-500"
                }`}
                style={{ borderRadius: 6 }}
              >
                {submittingForReview ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                {publication.isPublished
                  ? "Unpublish"
                  : publication.moderationLock
                    ? "Publishing Disabled"
                    : "Publish"}
              </button>
            </div>
          </div>
        </div>

        <form id="developer-profile-form" onSubmit={saveProfile}>
          <div className="space-y-6">
            <section
              className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <h2 className="text-lg font-semibold text-white">
                Profile Introduction
              </h2>

              <div className="mt-5 grid gap-6 md:grid-cols-[150px_minmax(0,1fr)] md:items-start">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {avatarImage ? (
                      <img
                        src={avatarImage.url}
                        alt="Profile photo preview"
                        className="h-28 w-28 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-white/15 bg-black/20 text-sm text-zinc-500">
                        No photo
                      </div>
                    )}

                    <label
                      className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-sky-300/30 bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition hover:bg-blue-500"
                      title={
                        avatarImage
                          ? "Change profile photo"
                          : "Upload profile photo"
                      }
                    >
                      <Camera className="h-4 w-4" />

                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          openAvatarCrop(
                            event.target.files?.[0],
                          );
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {avatarImage ? (
                    <button
                      type="button"
                      onClick={deleteAvatarImage}
                      disabled={deletingAvatar}
                      className="mt-3 flex h-8 w-8 cursor-pointer items-center justify-center text-zinc-500 transition hover:text-red-300 disabled:opacity-50"
                      aria-label="Delete profile photo"
                      title="Delete profile photo"
                    >
                      {deletingAvatar ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Display Name
                      </label>

                      <input
                        type="text"
                        value={form.displayName}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            displayName:
                              event.target.value,
                          }))
                        }
                        maxLength={100}
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Professional Headline
                      </label>

                      <input
                        type="text"
                        value={form.headline}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            headline:
                              event.target.value,
                          }))
                        }
                        maxLength={140}
                        placeholder="Example — Roblox scripter and systems developer"
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Bio
                      </label>

                      <span className="text-xs text-zinc-600">
                        {form.bio.length} / 2,000
                      </span>
                    </div>

                    <textarea
                      value={form.bio}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          bio: event.target.value,
                        }))
                      }
                      rows={4}
                      maxLength={2000}
                      placeholder="Tell people about your experience, strengths, and the kinds of projects you enjoy."
                      className="w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                      style={{ borderRadius: 5 }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section
              className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Custom Profile Address
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Choose a short address for your public profile.
                  </p>
                </div>
              </div>

              {profile?.customSubdomain &&
              !editingSubdomain ? (
                <div
                  className="mt-4 flex flex-col gap-3 border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderRadius: 7 }}
                >
                  <p className="break-all text-sm font-semibold text-emerald-100">
                    {profile.customSubdomain}
                    .frdaph.org
                  </p>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const subdomain =
                          profile.customSubdomain;

                        const hostname =
                          window.location.hostname;

                        const isLocalhost =
                          hostname === "localhost" ||
                          hostname.endsWith(
                            ".localhost",
                          );

                        const targetUrl =
                          isLocalhost
                            ? `http://${subdomain}.localhost${
                                window.location.port
                                  ? `:${window.location.port}`
                                  : ""
                              }`
                            : `https://${subdomain}.frdaph.org`;

                        window.open(
                          targetUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
                      style={{ borderRadius: 6 }}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubdomain(true);
                        setSubdomainMessage("");
                        setSubdomainAvailable(null);
                      }}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center text-emerald-200 transition hover:text-white"
                      aria-label="Edit custom profile address"
                      title="Edit custom profile address"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div
                      className="flex min-w-0 flex-1 overflow-hidden border border-white/10 bg-black/20 focus-within:border-blue-400"
                      style={{ borderRadius: 6 }}
                    >
                      <input
                        type="text"
                        value={subdomainValue}
                        onChange={(event) => {
                          const value =
                            event.target.value
                              .toLowerCase()
                              .replace(
                                /[^a-z0-9-]/g,
                                "",
                              );

                          setSubdomainValue(value);
                          setSubdomainAvailable(null);
                          setSubdomainMessage("");
                        }}
                        minLength={3}
                        maxLength={30}
                        placeholder="your-name"
                        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600"
                      />

                      <span className="flex shrink-0 items-center border-l border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-500">
                        .frdaph.org
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={saveCustomSubdomain}
                      disabled={
                        savingSubdomain ||
                        checkingSubdomain ||
                        !subdomainValue.trim()
                      }
                      className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderRadius: 6 }}
                    >
                      {savingSubdomain ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : null}
                      Use Subdomain
                    </button>

                    {profile?.customSubdomain ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubdomain(false);
                          setSubdomainValue(
                            profile.customSubdomain,
                          );
                          setSubdomainMessage("");
                          setSubdomainAvailable(null);
                        }}
                        className="min-h-10 cursor-pointer px-3 py-2 text-sm text-zinc-400 transition hover:text-white"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Use 3–30 lowercase letters, numbers, or hyphens.
                  </p>

                  {subdomainMessage ? (
                    <p
                      className={`mt-2 text-sm ${
                        subdomainAvailable
                          ? "text-emerald-300"
                          : "text-red-300"
                      }`}
                    >
                      {subdomainMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </section>



            <section
              className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Cover Photo Showcase{" "}
                    <span className="text-red-300">*</span>
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    Upload up to three cover photos for the slideshow at the top
                    of your public profile. Cover 1 is used on the developer
                    directory.
                  </p>
                </div>

                <label
                  className={`cursor-pointer border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 ${
                    coverShowcaseImages.length >= 3
                      ? "pointer-events-none opacity-50"
                      : ""
                  }`}
                  style={{ borderRadius: 5 }}
                >
                  Add Cover Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={coverShowcaseImages.length >= 3}
                    onChange={(event) => {
                      openNewCoverCrop(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

              {coverShowcaseImages.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {coverShowcaseImages
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((cover, index, ordered) => (
                      <div
                        key={cover.id}
                        className="relative overflow-hidden border border-white/10 bg-black/20"
                        style={{ borderRadius: 8 }}
                      >
                        <div className="relative aspect-video">
                          <img
                            src={cover.url}
                            alt={`Cover ${cover.order}`}
                            className="h-full w-full object-cover"
                          />
                          <span
                            className="absolute left-2 top-2 bg-black/70 px-2 py-1 text-xs font-semibold text-white"
                            style={{ borderRadius: 5 }}
                          >
                            Cover {cover.order}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCoverImage(cover)}
                          disabled={deletingCoverId === cover.id}
                          className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/65 text-zinc-200 backdrop-blur-sm hover:bg-red-500/70 disabled:opacity-50"
                          aria-label="Delete cover photo"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        <div className="flex items-center justify-center gap-2 p-3">
                          <button
                            type="button"
                            onClick={() => moveCoverImage(cover.id, -1)}
                            disabled={index === 0}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-white/10 bg-white/[0.04] text-lg text-zinc-200 disabled:opacity-25"
                            style={{ borderRadius: 5 }}
                            aria-label="Move cover left"
                          >
                            ←
                          </button>

                          <button
                            type="button"
                            onClick={() => openExistingCoverCrop(cover)}
                            className="cursor-pointer border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-200"
                            style={{ borderRadius: 5 }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => moveCoverImage(cover.id, 1)}
                            disabled={index === ordered.length - 1}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-white/10 bg-white/[0.04] text-lg text-zinc-200 disabled:opacity-25"
                            style={{ borderRadius: 5 }}
                            aria-label="Move cover right"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div
                  className="mt-5 border border-dashed border-white/10 bg-black/10 p-6 text-center text-sm text-zinc-500"
                  style={{ borderRadius: 8 }}
                >
                  No cover photos uploaded yet.
                </div>
              )}
            </section>

            <section
              className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <h2 className="text-lg font-semibold text-white">
                Skills and Work Profile
              </h2>

              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div>
                  <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Skills
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {SKILL_OPTIONS.map((skill) => {
                      const selected =
                        parseSkills(
                          form.skillsText,
                        ).includes(skill);

                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() =>
                            toggleSkill(skill)
                          }
                          className={`cursor-pointer border px-3 py-2 text-sm transition ${
                            selected
                              ? "border-sky-300/45 bg-sky-400/15 text-sky-100"
                              : "border-white/10 bg-black/15 text-zinc-400 hover:border-white/20 hover:text-white"
                          }`}
                          style={{
                            borderRadius: 6,
                          }}
                          aria-pressed={selected}
                        >
                          {skill}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Select every skill that accurately reflects your work.
                  </p>

                  <div className="mt-6">
                    <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Genre Experience
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {GAME_GENRE_OPTIONS.map((genre) => {
                        const selected =
                          form.genreExperience.includes(
                            genre.value,
                          );

                        return (
                          <button
                            key={genre.value}
                            type="button"
                            onClick={() =>
                              toggleGenreExperience(
                                genre.value,
                              )
                            }
                            className={`cursor-pointer border px-3 py-2 text-sm transition ${
                              selected
                                ? "border-cyan-300/45 bg-cyan-400/15 text-cyan-100"
                                : "border-white/10 bg-black/15 text-zinc-400 hover:border-white/20 hover:text-white"
                            }`}
                            style={{
                              borderRadius: 6,
                            }}
                            aria-pressed={selected}
                          >
                            {genre.label}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      Optional. Select the Roblox genres you have worked with or understand well.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Availability
                  </label>

                  <select
                    value={form.availability}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        availability:
                          event.target.value,
                      }))
                    }
                    className="w-full appearance-none border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-blue-400 [color-scheme:dark] [&>option]:bg-[#071225] [&>option]:text-white"
                    style={{
                      borderRadius: 6,
                    }}
                  >
                    <option value="">
                      Prefer not to say
                    </option>
                    <option value="available">
                      Available for work
                    </option>
                    <option value="limited">
                      Limited availability
                    </option>
                    <option value="not_available">
                      Not currently available
                    </option>
                    <option value="collaborations_only">
                      Open to collaborations only
                    </option>
                  </select>
                </div>
              </div>


              <div className="mt-6 grid gap-5 border-t border-white/10 pt-6 lg:grid-cols-2">
                <div>
                  <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Experience Level <span className="text-red-300">*</span>
                  </label>

                  <select
                    value={form.experienceTier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        experienceTier:
                          event.target.value as
                            ExperienceTier | "",
                      }))
                    }
                    required
                    className="w-full appearance-none border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-blue-400 [color-scheme:dark] [&>option]:bg-[#071225] [&>option]:text-white"
                    style={{ borderRadius: 6 }}
                  >
                    <option value="">Select your level</option>
                    <option value="aspiring">Aspiring Developer</option>
                    <option value="emerging">Emerging Developer</option>
                    <option value="established">Established Developer</option>
                    <option value="experienced">Experienced Developer</option>
                  </select>

                  <div className="mt-3 space-y-2 text-xs leading-5 text-zinc-500">
                    <p><span className="font-semibold text-zinc-300">Aspiring:</span> Still learning and working toward a first substantial project.</p>
                    <p><span className="font-semibold text-zinc-300">Emerging:</span> Has completed prototypes, small projects, commissions, or team contributions.</p>
                    <p><span className="font-semibold text-zinc-300">Established:</span> Has released a substantial project or built a consistent body of work.</p>
                    <p><span className="font-semibold text-zinc-300">Experienced:</span> Has led or significantly contributed to multiple released projects.</p>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-sky-300/80">
                    Used internally by FRDA for opportunity matching. This will not appear publicly.
                  </p>
                </div>

                <div>
                  <label className="mb-3 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Development Capacity <span className="text-red-300">*</span>
                  </label>

                  <div className="space-y-2">
                    {[
                      {
                        value: "full_team",
                        label: "Full development team",
                        description:
                          "I represent a team that can deliver an entire project.",
                      },
                      {
                        value: "solo_full_project",
                        label: "Solo full-project developer",
                        description:
                          "I can independently build and complete an entire project.",
                      },
                      {
                        value: "specialist",
                        label: "Specialist",
                        description:
                          "I focus on one or several specific parts of a project.",
                      },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`block cursor-pointer border p-3 transition ${
                          form.deliveryScope === option.value
                            ? "border-sky-300/40 bg-sky-400/10"
                            : "border-white/10 bg-black/15 hover:border-white/20"
                        }`}
                        style={{ borderRadius: 6 }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="deliveryScope"
                            value={option.value}
                            checked={
                              form.deliveryScope ===
                              option.value
                            }
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                deliveryScope:
                                  option.value as
                                    DeliveryScope,
                              }))
                            }
                            required
                            className="mt-1"
                          />

                          <span>
                            <span className="block text-sm font-semibold text-white">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-zinc-500">
                              {option.description}
                            </span>
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    This appears publicly so potential collaborators can understand the kind of work you can take on.
                  </p>
                </div>
              </div>
            </section>

            

            <section
              className="border border-white/10 bg-white/[0.025] p-5 md:p-6"
              style={{ borderRadius: 8 }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Featured Work{" "}
                    <span className="text-red-300">*</span>
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    Add up to six games or projects. At least one item must include a title and your role.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addWorkSample}
                  disabled={workSamples.length >= 6}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: 6 }}
                >
                  <Plus className="h-4 w-4" />
                  Add Work Sample
                </button>
              </div>

              {workSamples.length === 0 ? (
                <div
                  className="mt-5 border border-dashed border-white/10 bg-black/10 p-6 text-center"
                  style={{ borderRadius: 8 }}
                >
                  <p className="text-sm text-zinc-400">
                    No work samples added yet.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {workSamples.map((item) => {
                    const firstImage =
                      item.images[0] || null;

                    const youtubeId =
                      getYouTubeVideoId(
                        item.youtubeVideoUrl,
                      );

                    const previewUrl =
                      firstImage?.showcaseUrl ||
                      firstImage?.url ||
                      item.thumbnailUrl ||
                      (
                        youtubeId
                          ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
                          : ""
                      );

                    return (
                      <div
                        key={item.id}
                        className="flex min-w-0 gap-4 border border-white/10 bg-black/15 p-3"
                        style={{
                          borderRadius: 8,
                        }}
                      >
                        <div
                          className="h-24 w-28 shrink-0 overflow-hidden border border-white/10 bg-black/25"
                          style={{
                            borderRadius: 6,
                          }}
                        >
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-600">
                              No media
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-white">
                                {item.title ||
                                  "Untitled work sample"}
                              </h3>

                              <p className="mt-1 truncate text-xs text-zinc-400">
                                {item.role ||
                                  "No role added"}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  editWorkSample(
                                    item.id,
                                  )
                                }
                                className="flex h-8 w-8 cursor-pointer items-center justify-center text-zinc-400 transition hover:text-sky-300"
                                aria-label="Edit work sample"
                                title="Edit work sample"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  removeWorkSample(
                                    item.id,
                                  )
                                }
                                className="flex h-8 w-8 cursor-pointer items-center justify-center text-zinc-500 transition hover:text-red-300"
                                aria-label="Delete work sample"
                                title="Delete work sample"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
                            {item.contribution ||
                              "No contribution details added."}
                          </p>

                          <p className="mt-2 text-[11px] text-zinc-600">
                            {getOrderedProjectMedia(
                              item,
                            ).length} media item
                            {getOrderedProjectMedia(
                              item,
                            ).length === 1
                              ? ""
                              : "s"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                className="mt-5 border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"
                style={{ borderRadius: 8 }}
              >
                By featuring a project, you confirm that your role and
                contributions are accurate and that you have permission to
                share the work.
              </div>
            </section>

            

            <div className="border-t border-white/10 pt-6">
              {publication.reviewerNote ? (
                <div
                  className="mb-5 border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-200"
                  style={{ borderRadius: 8 }}
                >
                  <p className="font-semibold">FRDA moderation note</p>

                  <p className="mt-2">{publication.reviewerNote}</p>
                </div>
              ) : null}

              {!publication.isPublished ? (
                <label
                  className="mb-5 flex cursor-pointer items-start gap-3 border border-white/10 bg-white/[0.025] p-4"
                  style={{ borderRadius: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={true}
                    readOnly
                    className="mt-1"
                  />

                  <span className="text-sm leading-6 text-zinc-300">
                    By publishing, I confirm that the information on this
                    profile is accurate, that I have permission to share the
                    work shown, and that my role in each project is described
                    truthfully.
                  </span>
                </label>
              ) : null}

              <p className="text-xs leading-5 text-zinc-500">
                Profile information is self-submitted. FRDA may hide misleading,
                inappropriate, or reported content.
              </p>
            </div>
          </div>
        </form>

      </section>


      <AnimatePresence>
      {editingWorkSampleId ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-3 sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeWorkSampleModal();
            }
          }}
        >
          {workSamples
            .filter(
              (item) =>
                item.id ===
                editingWorkSampleId,
            )
            .map((item) => (
              <motion.div
                key={item.id}
                initial={{
                  opacity: 0,
                  y: 18,
                  scale: 0.985,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: 12,
                  scale: 0.99,
                }}
                transition={{
                  duration: 0.22,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden border border-sky-300/15 bg-[#081426]/98 shadow-[0_0_48px_rgba(37,99,235,0.18),0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                style={{ borderRadius: 10 }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
                      Featured Work
                    </p>

                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {item.title
                        ? "Edit Work Sample"
                        : "Add Work Sample"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closeWorkSampleModal}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center text-zinc-400 transition hover:text-white"
                    aria-label="Close work sample editor"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Project or Game Title
                      </label>

                      <input
                        type="text"
                        value={item.title}
                        onChange={(event) =>
                          updateWorkSample(
                            item.id,
                            {
                              title:
                                event.target.value,
                            },
                          )
                        }
                        maxLength={120}
                        placeholder="Example — Overgeared"
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Roblox Experience Link
                      </label>

                      <input
                        type="url"
                        value={item.projectUrl}
                        onChange={(event) =>
                          updateWorkSample(
                            item.id,
                            {
                              projectUrl:
                                event.target.value,
                            },
                          )
                        }
                        placeholder="https://www.roblox.com/games/..."
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        YouTube Video
                      </label>

                      <input
                        id={`youtube-video-${item.id}`}
                        type="url"
                        value={item.youtubeVideoUrl}
                        onChange={(event) =>
                          updateYoutubeVideoUrl(
                            item.id,
                            event.target.value,
                          )
                        }
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />

                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        Optional. YouTube, Shorts, and youtu.be links are supported.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Project Type
                      </label>

                      <select
                        value={item.projectType}
                        onChange={(event) =>
                          updateWorkSample(
                            item.id,
                            {
                              projectType:
                                event.target
                                  .value as WorkSample["projectType"],
                            },
                          )
                        }
                        className="w-full appearance-none border border-white/10 bg-[#071225] px-4 py-3 text-sm text-white outline-none focus:border-blue-400 [color-scheme:dark] [&>option]:bg-[#071225] [&>option]:text-white"
                        style={{ borderRadius: 5 }}
                      >
                        <option value="owned">
                          My own project
                        </option>
                        <option value="team">
                          Team project
                        </option>
                        <option value="client">
                          Client work
                        </option>
                        <option value="other">
                          Other
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Team or Studio
                      </label>

                      <input
                        type="text"
                        value={item.teamName}
                        onChange={(event) =>
                          updateWorkSample(
                            item.id,
                            {
                              teamName:
                                event.target.value,
                            },
                          )
                        }
                        maxLength={120}
                        placeholder="Optional"
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Your Role
                      </label>

                      <input
                        type="text"
                        value={item.role}
                        onChange={(event) =>
                          updateWorkSample(
                            item.id,
                            {
                              role:
                                event.target.value,
                            },
                          )
                        }
                        maxLength={160}
                        placeholder="Example — Solo developer, lead scripter, UI designer"
                        className="w-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                          What You Contributed
                        </label>

                        <span className="text-xs text-zinc-600">
                          {item.contribution.length} / 1,200
                        </span>
                      </div>

                      <textarea
                        value={item.contribution}
                        onChange={(event) =>
                          updateWorkSample(
                            item.id,
                            {
                              contribution:
                                event.target.value,
                            },
                          )
                        }
                        rows={4}
                        maxLength={1200}
                        placeholder="Describe the parts you personally worked on."
                        className="w-full resize-y border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-600 focus:border-blue-400"
                        style={{ borderRadius: 5 }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                            Project Media
                          </label>

                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            Add up to five images. Dragging is not required; use the arrows to set the public order.
                          </p>
                        </div>

                        <label
                          className={`inline-flex w-fit cursor-pointer border border-blue-400/25 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 ${
                            (item.images?.length || 0) >= 5 ||
                            uploadingProjectId === item.id
                              ? "pointer-events-none opacity-50"
                              : ""
                          }`}
                          style={{ borderRadius: 5 }}
                        >
                          {uploadingProjectId === item.id ? (
                            <span className="inline-flex items-center gap-2">
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                              Processing images...
                            </span>
                          ) : (
                            "Upload Images"
                          )}

                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={
                              (item.images?.length || 0) >= 5 ||
                              uploadingProjectId === item.id
                            }
                            onChange={(event) => {
                              uploadProjectImages(
                                item.id,
                                event.target.files,
                              );

                              event.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {getOrderedProjectMedia(item).length > 0 ? (
                        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {getOrderedProjectMedia(item).map(
                            (
                              media,
                              mediaIndex,
                              orderedMedia,
                            ) => {
                              const image =
                                media.type ===
                                "image"
                                  ? item.images.find(
                                      (candidate) =>
                                        candidate.id ===
                                        media.id,
                                    )
                                  : null;

                              const videoId =
                                media.type ===
                                "youtube"
                                  ? getYouTubeVideoId(
                                      item.youtubeVideoUrl,
                                    )
                                  : "";

                              return (
                                <div
                                  key={`${media.type}-${media.id}`}
                                  className="overflow-hidden border border-white/10 bg-black/20"
                                  style={{
                                    borderRadius: 8,
                                  }}
                                >
                                  <div className="relative aspect-video bg-black/30">
                                    {image ? (
                                      <img
                                        src={image.url}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : videoId ? (
                                      <>
                                        <img
                                          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                                          alt="YouTube video thumbnail"
                                          className="h-full w-full object-cover"
                                        />

                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-xl text-white shadow-xl">
                                            ▶
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                                        Video preview unavailable
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        media.type ===
                                          "image" &&
                                        image
                                          ? removeProjectImage(
                                              item.id,
                                              image,
                                            )
                                          : removeYoutubeVideo(
                                              item.id,
                                            )
                                      }
                                      disabled={
                                        media.type ===
                                          "image" &&
                                        image
                                          ? deletingImageId ===
                                            image.id
                                          : false
                                      }
                                      className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/65 text-zinc-200 backdrop-blur-sm transition hover:bg-red-500/75 disabled:opacity-50"
                                      aria-label="Remove media"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-center gap-2 p-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveProjectMedia(
                                          item.id,
                                          media.type,
                                          media.id,
                                          -1,
                                        )
                                      }
                                      disabled={
                                        mediaIndex === 0
                                      }
                                      className="flex h-9 w-9 cursor-pointer items-center justify-center border border-white/10 bg-white/[0.04] text-lg text-zinc-200 disabled:opacity-25"
                                      style={{
                                        borderRadius: 5,
                                      }}
                                      aria-label="Move media left"
                                    >
                                      ←
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          media.type ===
                                            "image" &&
                                          image
                                        ) {
                                          openProjectImageCrop(
                                            item.id,
                                            image,
                                          );
                                        } else {
                                          document
                                            .getElementById(
                                              `youtube-video-${item.id}`,
                                            )
                                            ?.focus();
                                        }
                                      }}
                                      className="cursor-pointer border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200"
                                      style={{
                                        borderRadius: 5,
                                      }}
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveProjectMedia(
                                          item.id,
                                          media.type,
                                          media.id,
                                          1,
                                        )
                                      }
                                      disabled={
                                        mediaIndex ===
                                        orderedMedia.length -
                                          1
                                      }
                                      className="flex h-9 w-9 cursor-pointer items-center justify-center border border-white/10 bg-white/[0.04] text-lg text-zinc-200 disabled:opacity-25"
                                      style={{
                                        borderRadius: 5,
                                      }}
                                      aria-label="Move media right"
                                    >
                                      →
                                    </button>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      ) : (
                        <div
                          className="mt-4 border border-dashed border-white/10 bg-black/10 p-5 text-center"
                          style={{
                            borderRadius: 8,
                          }}
                        >
                          <p className="text-sm text-zinc-500">
                            No project media added.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <label className="mt-5 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={
                        item.isInDevelopment
                      }
                      onChange={(event) =>
                        updateWorkSample(
                          item.id,
                          {
                            isInDevelopment:
                              event.target.checked,
                          },
                        )
                      }
                      className="mt-1"
                    />

                    <span className="text-sm text-zinc-300">
                      This project is still in development.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() =>
                      removeWorkSample(item.id)
                    }
                    className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-red-300 transition hover:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>

                  <button
                    type="button"
                    onClick={closeWorkSampleModal}
                    className="cursor-pointer bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                    style={{ borderRadius: 6 }}
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            ))}
        </motion.div>
      ) : null}
      </AnimatePresence>

      {mediaCropTarget ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <div
            className="w-full max-w-3xl overflow-hidden border border-white/10 bg-[#0a172a] shadow-2xl"
            style={{ borderRadius: 8 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {mediaCropTarget.kind === "avatar"
                    ? "Crop Profile Photo"
                    : mediaCropTarget.kind === "project"
                      ? "Crop Project Image"
                      : "Crop Cover Photo"}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Drag the image and use the zoom control to choose the framing.
                </p>
              </div>
              <button
                type="button"
                onClick={closeMediaCrop}
                disabled={savingMediaCrop}
                className="cursor-pointer text-2xl text-zinc-400 hover:text-white disabled:opacity-50"
                aria-label="Close crop editor"
              >
                ×
              </button>
            </div>

            <div className="relative h-[55vh] min-h-[320px] bg-black">
              <Cropper
                image={mediaCropTarget.sourceUrl}
                crop={cropPosition}
                zoom={cropZoom}
                aspect={mediaCropTarget.kind === "avatar" ? 1 : 16 / 9}
                cropShape={mediaCropTarget.kind === "avatar" ? "round" : "rect"}
                showGrid={true}
                onCropChange={setCropPosition}
                onZoomChange={setCropZoom}
                onCropComplete={(_area: Area, pixels: Area) => {
                  setCroppedAreaPixels({
                    x: pixels.x,
                    y: pixels.y,
                    width: pixels.width,
                    height: pixels.height,
                  });
                }}
              />
            </div>

            <div className="border-t border-white/10 p-5">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeMediaCrop}
                  disabled={savingMediaCrop}
                  className="cursor-pointer border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-200 disabled:opacity-50"
                  style={{ borderRadius: 5 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveMediaCrop}
                  disabled={savingMediaCrop || !croppedAreaPixels}
                  className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  style={{ borderRadius: 5 }}
                >
                  {savingMediaCrop ? "Saving Image..." : "Use This Crop"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}