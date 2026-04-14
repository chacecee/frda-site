"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackApplicationPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        setSubmitting(true);
        setErrorMsg("");

        try {
            const response = await fetch("/api/apply/track", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email,
                    verificationCode,
                }),
            });

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    result?.error || "Could not find your application."
                );
            }

            router.push(
                `/apply/status/${result.applicationId}?token=${encodeURIComponent(
                    result.trackerToken
                )}`
            );
        } catch (error) {
            setErrorMsg(
                error instanceof Error
                    ? error.message
                    : "Could not find your application."
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
            <div className="pointer-events-none absolute inset-0">
                <div
                    className="absolute inset-0"
                    style={{
                        background: `
              radial-gradient(circle at 50% 0%, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0.20) 18%, rgba(59,130,246,0.08) 34%, rgba(59,130,246,0) 58%),
              radial-gradient(circle at 85% 8%, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0.10) 18%, rgba(37,99,235,0) 42%),
              radial-gradient(circle at 15% 10%, rgba(96,165,250,0.20) 0%, rgba(96,165,250,0.08) 16%, rgba(96,165,250,0) 40%)
            `,
                    }}
                />
            </div>

            <div className="relative mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-16">
                <div
                    className="w-full border border-zinc-700 bg-black/40 px-8 py-10 sm:px-10 sm:py-12"
                    style={{ borderRadius: 5 }}
                >
                    <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
                        Track Your Application
                    </h1>

                    <p className="mx-auto mt-4 max-w-md text-center text-sm leading-7 text-zinc-300">
                        Enter the email address you used in your application and your verification code to open your application status page.
                    </p>

                    <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-md space-y-5">
                        <div>
                            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                style={{ borderRadius: 5 }}
                                placeholder="Enter your email address"
                                disabled={submitting}
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                className="w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                                style={{ borderRadius: 5 }}
                                placeholder="Enter your verification code"
                                disabled={submitting}
                            />
                        </div>

                        {errorMsg ? (
                            <div
                                className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                                style={{ borderRadius: 5 }}
                            >
                                {errorMsg}
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full px-5 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                            style={{
                                borderRadius: 5,
                                background: "rgb(59, 130, 246)",
                                border: "1px solid rgba(96, 165, 250, 0.45)",
                                boxShadow: "0 10px 30px rgba(59,130,246,0.18)",
                            }}
                        >
                            <span className="inline-flex items-center justify-center gap-2">
                                {submitting ? (
                                    <>
                                        <span
                                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                                            aria-hidden="true"
                                        />
                                        <span>Opening Status Page...</span>
                                    </>
                                ) : (
                                    "Open My Status Page"
                                )}
                            </span>
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}