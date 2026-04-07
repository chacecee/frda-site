"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";

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

export default function ApplyPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [ageError, setAgeError] = useState("");
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError("");

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {

            const rawAge = String(formData.get("age") || "").trim();
            const parsedAge = rawAge ? Number(rawAge) : null;

            if (parsedAge === null || Number.isNaN(parsedAge) || parsedAge < 18) {
                setSubmitError("Applicants must be at least 18 years old.");
                setIsSubmitting(false);
                return;
            }

            await addDoc(collection(db, "applications"), {
                firstName: String(formData.get("firstName") || "").trim(),
                lastName: String(formData.get("lastName") || "").trim(),
                email: String(formData.get("email") || "").trim(),
                age: parsedAge,
                region: String(formData.get("region") || "").trim(),
                skills: String(formData.get("skills") || "").trim(),
                organization: String(formData.get("organization") || "").trim(),
                roblox: String(formData.get("roblox") || "").trim(),
                discordId: String(formData.get("discordId") || "").trim(),
                viber: String(formData.get("viber") || "").trim(),
                status: "in_queue",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            router.push("/apply/thank-you");
        } catch (error) {
            console.error("Error submitting application:", error);
            setSubmitError(
                "Something went wrong while submitting your application. Please try again."
            );
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <style jsx global>{`
        :root {
          --page-bg: #d2ded7;
          --page-text: #18181b;
          --hero-title: #052e16;
          --hero-copy: #3f3f46;
          --logo-wrap-bg: rgba(255, 255, 255, 0.3);
          --logo-wrap-ring: rgba(167, 243, 208, 0.6);

          --section-heading: #052e16;
          --label-text: rgba(6, 78, 59, 0.75);

          --card-bg: rgba(255, 255, 255, 0.78);
          --card-border: #b7e4cc;
          --card-shadow: 0 10px 30px rgba(16, 185, 129, 0.08);

          --input-bg: #ffffff;
          --input-border: #b7e4cc;
          --input-text: #18181b;
          --input-placeholder: #9ca3af;
          --input-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

          --muted-text: #71717a;
          --help-text: #71717a;
          --details-summary: #047857;
          --details-text: #3f3f46;
          --details-strong: #052e16;
          --notice-bg: #ecfdf5;
          --notice-border: #b7e4cc;
          --notice-text: #3f3f46;

          --privacy-text: #71717a;
          --error-text: #dc2626;

          --button-bg: #059669;
          --button-bg-hover: #047857;
          --button-text: #ffffff;
          --button-shadow: 0 10px 30px rgba(16, 185, 129, 0.16);

          --focus-ring: #10b981;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --page-bg:
              radial-gradient(circle at top, rgba(16, 185, 129, 0.24), transparent 22%),
              radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 20%),
              radial-gradient(circle at top left, rgba(6, 182, 212, 0.08), transparent 18%),
              linear-gradient(to bottom, #0b100d, #09090b 34%, #09090b);
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
            --details-summary: #34d399;
            --details-text: #d4d4d8;
            --details-strong: #ffffff;
            --notice-bg: rgba(46, 16, 101, 0.2);
            --notice-border: rgba(76, 29, 149, 0.5);
            --notice-text: #e4e4e7;

            --privacy-text: #71717a;
            --error-text: #f87171;

            --button-bg: #10b981;
            --button-bg-hover: #34d399;
            --button-text: #09090b;
            --button-shadow: 0 10px 30px rgba(16, 185, 129, 0.18);

            --focus-ring: #10b981;
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
                                        <p className="mt-2 text-[11px] leading-5" style={{ color: "var(--error-text)" }}>
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
                                        when joining the FRDA server. Make sure it is correct before submitting.
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
                                    <label htmlFor="viber" style={labelStyle}>
                                        Viber / Contact Number
                                    </label>
                                    <input
                                        id="viber"
                                        name="viber"
                                        type="text"
                                        required
                                        style={inputStyle}
                                        placeholder="Enter your Viber or contact number"
                                    />
                                    <p
                                        className="mt-2 text-[11px] leading-5"
                                        style={{ color: "var(--help-text)" }}
                                    >
                                        This will only be used if we need to contact you regarding your
                                        application or to clarify submitted details.
                                    </p>
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

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full rounded-md px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
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