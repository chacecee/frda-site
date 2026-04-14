"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const regions = [
    "Region I – Ilocos Region",
    "Region II – Cagayan Valley",
    "Region III – Central Luzon",
    "Region IV-A – CALABARZON",
    "MIMAROPA Region",
    "Region V – Bicol Region",
    "Region VI – Western Visayas",
    "Region VII – Central Visayas",
    "Region VIII – Eastern Visayas",
    "Region IX – Zamboanga Peninsula",
    "Region X – Northern Mindanao",
    "Region XI – Davao Region",
    "Region XII – SOCCSKSARGEN",
    "Region XIII – Caraga",
    "NCR – National Capital Region",
    "CAR – Cordillera Administrative Region",
    "BARMM – Bangsamoro Autonomous Region in Muslim Mindanao",
    "NIR – Negros Island Region",
];

function SectionHeading({ title }: { title: string }) {
    return (
        <div className="mb-5">
            <h2
                className="text-2xl font-semibold tracking-tight"
                style={{ color: "var(--section-heading)" }}
            >
                {title}
            </h2>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: "0.375rem",
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    outline: "none",
    boxShadow: "var(--input-shadow)",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "0.5rem",
    fontSize: "11px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--label-text)",
};

const sectionCardStyle: React.CSSProperties = {
    borderRadius: "0.75rem",
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    padding: "1.25rem",
    boxShadow: "var(--card-shadow)",
    backdropFilter: "blur(8px)",
};

function isValidFacebookProfileUrl(value: string) {
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        const allowedHosts = new Set([
            "facebook.com",
            "www.facebook.com",
            "m.facebook.com",
            "web.facebook.com",
            "fb.com",
            "www.fb.com",
        ]);

        if (!allowedHosts.has(host)) {
            return false;
        }

        const path = url.pathname.trim();
        if (!path || path === "/") {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

export default function ApplyPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [ageError, setAgeError] = useState("");
    const [facebookError, setFacebookError] = useState("");
    const [idFileError, setIdFileError] = useState("");
    const [selectedIdFile, setSelectedIdFile] = useState<File | null>(null);
    const [idPreviewUrl, setIdPreviewUrl] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStageText, setUploadStageText] = useState("");
    const router = useRouter();

    useEffect(() => {
        return () => {
            if (idPreviewUrl) {
                URL.revokeObjectURL(idPreviewUrl);
            }
        };
    }, [idPreviewUrl]);

    function handleIdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] || null;

        setIdFileError("");

        if (idPreviewUrl) {
            URL.revokeObjectURL(idPreviewUrl);
            setIdPreviewUrl("");
        }

        if (!file) {
            setSelectedIdFile(null);
            return;
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(file.type)) {
            setSelectedIdFile(null);
            e.target.value = "";
            setIdFileError("Please upload a JPG, PNG, or WebP image file.");
            return;
        }

        const maxSizeInBytes = 5 * 1024 * 1024;

        if (file.size > maxSizeInBytes) {
            setSelectedIdFile(null);
            e.target.value = "";
            setIdFileError("Please upload an image that is 5 MB or smaller.");
            return;
        }

        setSelectedIdFile(file);
        setIdPreviewUrl(URL.createObjectURL(file));
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError("");
        setUploadProgress(0);
        setUploadStageText("Preparing upload...");

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const rawAge = String(formData.get("age") || "").trim();
            const parsedAge = rawAge ? Number(rawAge) : null;
            const facebookProfile = String(formData.get("facebookProfile") || "").trim();

            if (parsedAge === null || Number.isNaN(parsedAge) || parsedAge < 18) {
                setSubmitError("Applicants must be at least 18 years old.");
                setIsSubmitting(false);
                setUploadProgress(0);
                setUploadStageText("");
                return;
            }

            if (!selectedIdFile) {
                setSubmitError("Please upload a valid ID image before submitting.");
                setIsSubmitting(false);
                setUploadProgress(0);
                setUploadStageText("");
                return;
            }

            if (!isValidFacebookProfileUrl(facebookProfile)) {
                setFacebookError("Please enter a valid Facebook profile URL.");
                setSubmitError("Please enter a valid Facebook profile URL.");
                setIsSubmitting(false);
                setUploadProgress(0);
                setUploadStageText("");
                return;
            } else {
                setFacebookError("");
            }

            formData.set("idFile", selectedIdFile);

            const result = await new Promise<{
                success: boolean;
                applicationId?: string;
                verificationCode?: string;
                trackerToken?: string;
                error?: string;
            }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.open("POST", "/api/apply/submit");

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percent = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(percent);
                        setUploadStageText(`Uploading ID... ${percent}%`);
                    } else {
                        setUploadStageText("Uploading ID...");
                    }
                };

                xhr.onload = () => {
                    try {
                        const responseJson = JSON.parse(xhr.responseText || "{}");

                        if (xhr.status >= 200 && xhr.status < 300) {
                            setUploadProgress(100);
                            setUploadStageText("Upload complete. Finalizing application...");
                            resolve(responseJson);
                        } else {
                            reject(
                                new Error(
                                    responseJson?.error ||
                                    "Something went wrong while submitting your application."
                                )
                            );
                        }
                    } catch {
                        reject(new Error("The server returned an invalid response."));
                    }
                };

                xhr.onerror = () => {
                    reject(new Error("Network error while submitting your application."));
                };

                xhr.send(formData);
            });

            setUploadProgress(100);
            setUploadStageText("Application submitted.");
            setIsSubmitting(false);
            router.push(
                `/apply/submitted/${result.applicationId}?code=${encodeURIComponent(
                    result.verificationCode || ""
                )}&token=${encodeURIComponent(result.trackerToken || "")}`
            );
        } catch (error) {
            console.error("Error submitting application:", error);
            setSubmitError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong while submitting your application. Please try again."
            );
            setIsSubmitting(false);
        }
    }

    return (
        <>
        <style jsx global>{`
  :root {
    --page-bg: #dbeafe;
    --page-text: #18181b;
    --hero-title: #1d4ed8;
    --hero-copy: #3f3f46;
    --logo-wrap-bg: rgba(255, 255, 255, 0.3);
    --logo-wrap-ring: rgba(96, 165, 250, 0.55);

    --section-heading: #1d4ed8;
    --label-text: rgba(29, 78, 216, 0.78);

    --card-bg: rgba(255, 255, 255, 0.78);
    --card-border: #bfdbfe;
    --card-shadow: 0 10px 30px rgba(59, 130, 246, 0.1);

    --input-bg: #ffffff;
    --input-border: #bfdbfe;
    --input-text: #18181b;
    --input-placeholder: #9ca3af;
    --input-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

    --muted-text: #71717a;
    --help-text: #71717a;
    --details-summary: #2563eb;
    --details-text: #3f3f46;
    --details-strong: #1d4ed8;
    --notice-bg: #eff6ff;
    --notice-border: #bfdbfe;
    --notice-text: #3f3f46;

    --privacy-text: #71717a;
    --error-text: #dc2626;

    --button-bg: #2563eb;
    --button-bg-hover: #1d4ed8;
    --button-text: #ffffff;
    --button-shadow: 0 10px 30px rgba(59, 130, 246, 0.18);

    --focus-ring: #3b82f6;
  }

  @media (prefers-color-scheme: dark) {
  :root {
    --page-bg:
  radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.16) 0%, rgba(59, 130, 246, 0.09) 10%, rgba(59, 130, 246, 0.035) 18%, rgba(59, 130, 246, 0) 28%),
  radial-gradient(circle at 82% 10%, rgba(37, 99, 235, 0.06) 0%, rgba(37, 99, 235, 0.025) 10%, rgba(37, 99, 235, 0) 20%),
  radial-gradient(circle at 18% 10%, rgba(96, 165, 250, 0.05) 0%, rgba(96, 165, 250, 0.02) 9%, rgba(96, 165, 250, 0) 18%),
  linear-gradient(to bottom, #02040a 0%, #010309 32%, #000000 100%);

    --page-text: #ffffff;
    --hero-title: #ffffff;
    --hero-copy: #d4d4d8;
    --logo-wrap-bg: rgba(255, 255, 255, 0.05);
    --logo-wrap-ring: rgba(255, 255, 255, 0.1);

    --section-heading: #ffffff;
    --label-text: #a1a1aa;

    --card-bg: rgba(24, 24, 27, 0.75);
    --card-border: rgba(63, 63, 70, 0.8);
    --card-shadow: 0 8px 30px rgba(0, 0, 0, 0.22);

    --input-bg: rgba(39, 39, 42, 0.95);
    --input-border: rgba(82, 82, 91, 0.8);
    --input-text: #ffffff;
    --input-placeholder: #a1a1aa;
    --input-shadow: 0 0 0 1px rgba(255, 255, 255, 0.02);

    --muted-text: #a1a1aa;
    --help-text: #a1a1aa;
    --details-summary: #60a5fa;
    --details-text: #d4d4d8;
    --details-strong: #ffffff;
    --notice-bg: rgba(30, 58, 138, 0.22);
    --notice-border: rgba(59, 130, 246, 0.4);
    --notice-text: #e4e4e7;

    --privacy-text: #71717a;
    --error-text: #f87171;

    --button-bg: #3b82f6;
    --button-bg-hover: #60a5fa;
    --button-text: #ffffff;
    --button-shadow: 0 10px 30px rgba(59, 130, 246, 0.18);

    --focus-ring: #60a5fa;
  }
}
  }

  .apply-theme input::placeholder,
  .apply-theme textarea::placeholder {
    color: var(--input-placeholder);
  }

  .apply-theme input:focus,
  .apply-theme select:focus,
  .apply-theme textarea:focus {
    border-color: var(--focus-ring) !important;
    box-shadow: 0 0 0 1px var(--focus-ring);
  }

  .apply-theme button,
  .apply-theme a,
  .apply-theme summary {
    cursor: pointer;
  }
`}</style>

            <main
                className="apply-theme min-h-screen"
                style={{
                    background: "var(--page-bg)",
                    color: "var(--page-text)",
                }}
            >
                <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
                    <div className="mb-12 text-center">
                        <div className="mb-6 flex justify-center">
                            <div
                                className="rounded-full p-3 ring-1 backdrop-blur-sm"
                                style={{
                                    background: "var(--logo-wrap-bg)",
                                    boxShadow: `0 0 0 1px var(--logo-wrap-ring) inset`,
                                }}
                            >
                                <img
                                    src="/frda-logo.png"
                                    alt="FRDA logo"
                                    className="h-24 w-24 object-contain sm:h-32 sm:w-32"
                                />
                            </div>
                        </div>

                        <h1
                            className="text-3xl font-bold tracking-tight sm:text-5xl"
                            style={{ color: "var(--hero-title)" }}
                        >
                            FRDA Member Application Form
                        </h1>

                        <p
                            className="mx-auto mt-5 max-w-2xl text-sm leading-6 sm:text-base"
                            style={{ color: "var(--hero-copy)" }}
                        >
                            This form is for individuals applying to become a verified member of
                            the Filipino Roblox Developers Association. Please make sure all
                            submitted information is accurate and complete for proper review.
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <section style={sectionCardStyle}>
                            <SectionHeading title="Personal Details" />

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="firstName" style={labelStyle}>
                                        First Name
                                    </label>
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        required
                                        style={inputStyle}
                                        placeholder="Enter your first name"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="lastName" style={labelStyle}>
                                        Last Name
                                    </label>
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        required
                                        style={inputStyle}
                                        placeholder="Enter your last name"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email" style={labelStyle}>
                                        Email Address
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        style={inputStyle}
                                        placeholder="you@example.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="age" style={labelStyle}>
                                        Age
                                    </label>
                                    <input
                                        id="age"
                                        name="age"
                                        type="number"
                                        min="18"
                                        required
                                        style={inputStyle}
                                        placeholder="18 and above only"
                                        onChange={(e) => {
                                            const value = e.target.value.trim();

                                            if (!value) {
                                                setAgeError("");
                                                e.target.setCustomValidity("");
                                                return;
                                            }

                                            const age = Number(value);

                                            if (Number.isNaN(age) || age < 18) {
                                                const message = "Applicants must be at least 18 years old.";
                                                setAgeError(message);
                                                e.target.setCustomValidity(message);
                                            } else {
                                                setAgeError("");
                                                e.target.setCustomValidity("");
                                            }
                                        }}
                                    />

                                    {ageError ? (
                                        <p
                                            className="mt-2 text-[11px] leading-5"
                                            style={{ color: "var(--error-text)" }}
                                        >
                                            {ageError}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="region" style={labelStyle}>
                                        Region
                                    </label>
                                    <select
                                        id="region"
                                        name="region"
                                        defaultValue=""
                                        style={inputStyle}
                                    >
                                        <option value="" disabled>
                                            Select your region
                                        </option>
                                        {regions.map((region) => (
                                            <option key={region} value={region}>
                                                {region}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section style={sectionCardStyle}>
                            <SectionHeading title="Developer Background" />

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="skills" style={labelStyle}>
                                        Skills / Expertise
                                    </label>
                                    <input
                                        id="skills"
                                        name="skills"
                                        type="text"
                                        required
                                        style={inputStyle}
                                        placeholder="e.g. Builder, Scripter, UI Designer"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="organization" style={labelStyle}>
                                        Organization / Group
                                    </label>
                                    <input
                                        id="organization"
                                        name="organization"
                                        type="text"
                                        style={inputStyle}
                                        placeholder="Enter your organization or group if applicable"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="roblox" style={labelStyle}>
                                        Roblox Username or Profile Link
                                    </label>
                                    <input
                                        id="roblox"
                                        name="roblox"
                                        type="text"
                                        required
                                        style={inputStyle}
                                        placeholder="Enter your Roblox username or profile link"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="placeLink" style={labelStyle}>
                                        Roblox Place Link
                                    </label>
                                    <input
                                        id="placeLink"
                                        name="placeLink"
                                        type="url"
                                        required
                                        style={inputStyle}
                                        placeholder="Paste the Roblox place link you want us to verify"
                                    />
                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        After you submit, we’ll give you a verification code. You’ll be
                                        asked to place that code in your Roblox place description so we
                                        can confirm you own or manage the place you submitted.
                                    </p>
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="placeContribution" style={labelStyle}>
                                        What did you contribute to this experience?
                                    </label>
                                    <textarea
                                        id="placeContribution"
                                        name="placeContribution"
                                        required
                                        rows={5}
                                        style={inputStyle}
                                        placeholder="Please describe your role and specific work in this experience. For example, mention whether you handled scripting, building, modeling, UI, animation, VFX, audio, management, or other responsibilities. You may also mention which parts of the experience you worked on."
                                    />
                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        This field is important. It helps our reviewers understand your role in the submitted Roblox experience and assess your application more accurately.
                                    </p>
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="supportingLinks" style={labelStyle}>
                                        Supporting Links — Optional
                                    </label>
                                    <textarea
                                        id="supportingLinks"
                                        name="supportingLinks"
                                        rows={5}
                                        style={inputStyle}
                                        placeholder="Share any links that help verify your contribution. You can paste multiple links here, one per line. Examples include portfolio pages, GitHub, demo videos, screenshot folders, Google Drive links, or project documentation."
                                    />
                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        Strong supporting links can make your application easier and faster to review, especially if your contribution is not immediately obvious from the submitted experience alone.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section style={sectionCardStyle}>
                            <SectionHeading title="Identity Verification" />

                            <div className="grid gap-5">
                                <div>
                                    <label htmlFor="idFile" style={labelStyle}>
                                        Upload a Valid ID
                                    </label>

                                    <input
                                        id="idFile"
                                        name="idFile"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        required
                                        onChange={handleIdFileChange}
                                        className="block w-full cursor-pointer rounded-md border border-zinc-600 bg-zinc-900/40 px-4 py-3 text-sm text-white file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-950"
                                    />

                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        We accept valid government-issued or school-issued IDs that
                                        clearly show your full name, photo, age, and address when
                                        applicable. Examples include PhilSys ID, driver’s license,
                                        PhilHealth ID, passport, UMID, postal ID, voter’s ID, or school
                                        ID.
                                    </p>

                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        Accepted image types are JPG, PNG, and WebP. Maximum file size is
                                        5 MB.
                                    </p>

                                    {idFileError ? (
                                        <p
                                            className="mt-2 text-[11px] leading-5"
                                            style={{ color: "var(--error-text)" }}
                                        >
                                            {idFileError}
                                        </p>
                                    ) : null}

                                    {selectedIdFile && idPreviewUrl ? (
                                        <div className="mt-4 rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4">
                                            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
                                                ID Preview
                                            </p>

                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={idPreviewUrl}
                                                    alt="Selected ID preview"
                                                    className="h-24 w-36 rounded-md border border-zinc-700 object-cover"
                                                />

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-white">
                                                        {selectedIdFile.name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-zinc-400">
                                                        {(selectedIdFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                    <p className="mt-2 text-xs text-zinc-500">
                                                        This image will only be sent when you officially submit
                                                        your application.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        <section style={sectionCardStyle}>
                            <SectionHeading title="Contact Information" />

                            <div className="grid gap-5">
                                <div>
                                    <label htmlFor="discordId" style={labelStyle}>
                                        Discord User ID
                                    </label>
                                    <input
                                        id="discordId"
                                        name="discordId"
                                        type="text"
                                        required
                                        inputMode="numeric"
                                        pattern="[0-9]{17,19}"
                                        minLength={17}
                                        maxLength={19}
                                        title="Please enter a valid Discord User ID."
                                        style={inputStyle}
                                        placeholder="Enter your Discord User ID"
                                    />
                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        Please enter the Discord User ID of the account you intend to use
                                        when joining the FRDA server. Make sure it is correct before
                                        submitting.
                                    </p>

                                    <details className="mt-3">
                                        <summary
                                            className="cursor-pointer text-xs font-medium"
                                            style={{ color: "var(--details-summary)" }}
                                        >
                                            Need help finding your Discord User ID?
                                        </summary>

                                        <div
                                            className="mt-4 space-y-5 pl-1 text-sm"
                                            style={{ color: "var(--details-text)" }}
                                        >
                                            <div>
                                                <h3
                                                    className="mb-2 font-semibold"
                                                    style={{ color: "var(--details-strong)" }}
                                                >
                                                    Desktop
                                                </h3>
                                                <ol className="list-decimal space-y-1 pl-5">
                                                    <li>Open Discord</li>
                                                    <li>Go to <strong>User Settings</strong></li>
                                                    <li>Open <strong>Advanced</strong></li>
                                                    <li>Turn on <strong>Developer Mode</strong></li>
                                                    <li>Click your profile picture or name in the bottom-left corner</li>
                                                    <li>In the panel that opens, click <strong>Copy User ID</strong></li>
                                                </ol>
                                            </div>

                                            <div>
                                                <h3
                                                    className="mb-2 font-semibold"
                                                    style={{ color: "var(--details-strong)" }}
                                                >
                                                    Mobile
                                                </h3>
                                                <ol className="list-decimal space-y-1 pl-5">
                                                    <li>Open Discord</li>
                                                    <li>Go to <strong>You</strong> or <strong>Settings</strong></li>
                                                    <li>Turn on <strong>Developer Mode</strong></li>
                                                    <li>Tap your profile picture to open your profile</li>
                                                    <li>Tap the <strong>three dots</strong> in the upper-right corner</li>
                                                    <li>Tap <strong>Copy User ID</strong></li>
                                                </ol>
                                            </div>

                                            <div
                                                className="rounded-md border p-3"
                                                style={{
                                                    borderColor: "var(--notice-border)",
                                                    background: "var(--notice-bg)",
                                                    color: "var(--notice-text)",
                                                }}
                                            >
                                                <p>
                                                    <strong>Important</strong> — Please submit the User ID of the same
                                                    Discord account you intend to use for your FRDA application and
                                                    server access.
                                                </p>
                                            </div>
                                        </div>
                                    </details>
                                </div>

                                <div>
                                    <label htmlFor="facebookProfile" style={labelStyle}>
                                        Facebook Profile URL
                                    </label>
                                    <input
                                        id="facebookProfile"
                                        name="facebookProfile"
                                        type="url"
                                        required
                                        style={inputStyle}
                                        placeholder="https://www.facebook.com/your.profile"
                                        onChange={(e) => {
                                            const value = e.target.value.trim();

                                            if (!value) {
                                                setFacebookError("");
                                                e.target.setCustomValidity("");
                                                return;
                                            }

                                            if (!isValidFacebookProfileUrl(value)) {
                                                const message = "Please enter a valid Facebook profile URL.";
                                                setFacebookError(message);
                                                e.target.setCustomValidity(message);
                                            } else {
                                                setFacebookError("");
                                                e.target.setCustomValidity("");
                                            }
                                        }}
                                    />
                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        Please provide your Facebook profile link so we have another way to reach you if we need to clarify submitted details.
                                    </p>

                                    {facebookError ? (
                                        <p
                                            className="mt-2 text-[11px] leading-5"
                                            style={{ color: "var(--error-text)" }}
                                        >
                                            {facebookError}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        <p
                            className="text-[13px] leading-5"
                            style={{ color: "var(--privacy-text)" }}
                        >
                            By submitting this form, you acknowledge that your information will
                            only be used for application review, verification, and registration
                            records. It will remain confidential and will not be republished or
                            used for unrelated purposes, except where disclosure is required for
                            official legal compliance.
                        </p>

                        {submitError ? (
                            <p className="text-sm" style={{ color: "var(--error-text)" }}>
                                {submitError}
                            </p>
                        ) : null}

                        {isSubmitting ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-zinc-400">
                                    <span>{uploadStageText || "Submitting..."}</span>
                                    <span>{uploadProgress}%</span>
                                </div>

                                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: `${uploadProgress}%`,
                                            background:
                                                "linear-gradient(90deg, rgba(16,185,129,1) 0%, rgba(52,211,153,1) 100%)",
                                        }}
                                    />
                                </div>
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-md px-5 py-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 sm:text-lg"
                            style={{
                                background: "var(--button-bg)",
                                color: "var(--button-text)",
                                boxShadow: "var(--button-shadow)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "var(--button-bg-hover)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "var(--button-bg)";
                            }}
                        >
                            {isSubmitting ? "Submitting..." : "Submit Application"}
                        </button>
                    </form>
                </div>
            </main>
        </>
    );
}