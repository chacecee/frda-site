"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CreditPreference = "name" | "alias" | "anonymous";
type LoopholeAnswer = "yes" | "no" | "unsure";

type SurveyFormState = {
  name: string;
  robloxAlias: string;
  contactInfo: string;
  contactPermission: boolean;
  creditPreference: CreditPreference;

  robloxExperience: string[];
  robloxExperienceOther: string;

  childSafetyRisks: string[];
  childSafetyRisksOther: string;
  riskPatternNotes: string;

  creatorActions: string[];
  creatorActionsOther: string;

  robloxResponsibilities: string[];
  robloxResponsibilitiesOther: string;

  hasSafetyLoophole: LoopholeAnswer | "";
  safetyLoopholeDetails: string;
  safetyImprovementIdea: string;

  practicalSolution: string;
  additionalInsight: string;

  publicationConsent: boolean;
};

const INITIAL_FORM: SurveyFormState = {
  name: "",
  robloxAlias: "",
  contactInfo: "",
  contactPermission: false,
  creditPreference: "anonymous",

  robloxExperience: [],
  robloxExperienceOther: "",

  childSafetyRisks: [],
  childSafetyRisksOther: "",
  riskPatternNotes: "",

  creatorActions: [],
  creatorActionsOther: "",

  robloxResponsibilities: [],
  robloxResponsibilitiesOther: "",

  hasSafetyLoophole: "",
  safetyLoopholeDetails: "",
  safetyImprovementIdea: "",

  practicalSolution: "",
  additionalInsight: "",

  publicationConsent: false,
};

const EXPERIENCE_OPTIONS = [
  {
    value: "published_experience",
    label: "I have published or helped create a public Roblox experience",
  },
  {
    value: "programming",
    label: "I script or program",
  },
  {
    value: "creative_assets",
    label: "I create maps, models, UI, art, animation, or audio",
  },
  {
    value: "game_design",
    label: "I design gameplay or game systems",
  },
  {
    value: "moderation",
    label: "I moderate or manage a Roblox experience or community",
  },
  {
    value: "learning",
    label: "I am currently learning Roblox development",
  },
  {
    value: "player",
    label: "I mainly play Roblox",
  },
];

const RISK_OPTIONS = [
  {
    value: "adults_pretending_to_be_children",
    label: "Adults or older users pretending to be children",
  },
  {
    value: "grooming",
    label: "Grooming or attempts to gain a child’s trust",
  },
  {
    value: "off_platform_contact",
    label:
      "Attempts to move children to Discord, Messenger, Telegram, or another platform",
  },
  {
    value: "bullying",
    label: "Bullying or harassment",
  },
  {
    value: "sexual_content",
    label: "Sexual or inappropriate content",
  },
  {
    value: "violent_content",
    label: "Violent or disturbing content",
  },
  {
    value: "scams",
    label: "Scams, account theft, or Robux-related manipulation",
  },
  {
    value: "personal_information",
    label: "Children sharing personal information",
  },
  {
    value: "bypassed_protections",
    label: "Age or account protections being bypassed",
  },
  {
    value: "parent_awareness",
    label: "Parents or guardians not knowing how to use available safety tools",
  },
  {
    value: "slow_serious_reports",
    label: "Serious reports not being handled quickly enough",
  },
  {
    value: "real_world_threats",
    label: "Threats involving possible real-world harm",
  },
  {
    value: "unsure",
    label: "I’m not sure",
  },
];

const CREATOR_ACTION_OPTIONS = [
  {
    value: "accurate_labels",
    label: "Label content and intended age groups honestly",
  },
  {
    value: "community_moderation",
    label: "Moderate behavior within their own experiences or communities",
  },
  {
    value: "safe_social_design",
    label: "Design social features with younger users in mind",
  },
  {
    value: "protect_personal_information",
    label: "Avoid features that encourage users to share personal information",
  },
  {
    value: "clear_reporting",
    label: "Make reporting instructions easy to find",
  },
  {
    value: "report_serious_concerns",
    label:
      "Report suspected grooming or credible threats through official channels",
  },
  {
    value: "preserve_evidence",
    label: "Preserve relevant usernames, screenshots, links, and timestamps",
  },
  {
    value: "parent_information",
    label: "Give parents clearer information about their experiences",
  },
  {
    value: "player_education",
    label: "Educate players about suspicious or unsafe contact",
  },
  {
    value: "none",
    label: "None of these",
  },
  {
    value: "unsure",
    label: "I’m not sure",
  },
];

const ROBLOX_RESPONSIBILITY_OPTIONS = [
  {
    value: "age_identity_checks",
    label: "Age and identity checks",
  },
  {
    value: "platform_chat_controls",
    label: "Platform-wide chat and communication controls",
  },
  {
    value: "detect_adults_pretending",
    label: "Detecting adults who pretend to be children",
  },
  {
    value: "account_sharing",
    label: "Detecting account sharing, selling, or borrowing",
  },
  {
    value: "repeat_offenders",
    label: "Tracking repeat offenders across different experiences or accounts",
  },
  {
    value: "platform_suspensions",
    label: "Suspending or restricting accounts across Roblox",
  },
  {
    value: "experience_review",
    label: "Reviewing and classifying public experiences",
  },
  {
    value: "evidence_preservation",
    label: "Preserving platform records for investigations",
  },
  {
    value: "law_enforcement",
    label: "Responding to valid law-enforcement requests",
  },
  {
    value: "serious_report_response",
    label: "Acting more quickly on serious reports",
  },
  {
    value: "unsure",
    label: "I’m not sure",
  },
];

const STEP_DETAILS = [
  {
    title: "About You",
    description:
      "Tell us a little about your involvement with Roblox. Personal details are optional.",
  },
  {
    title: "What You’re Seeing",
    description:
      "Share the risks or patterns you have noticed within Roblox communities.",
  },
  {
    title: "Who Can Do What",
    description:
      "Help us distinguish what creators can handle from what requires Roblox-level action.",
  },
  {
    title: "Gaps and Better Ideas",
    description:
      "Point out possible loopholes and suggest practical ways to improve safety.",
  },
];

function toggleArrayValue(
  current: string[],
  value: string,
  maximum?: number,
): string[] {
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }

  if (maximum && current.length >= maximum) {
    return current;
  }

  return [...current, value];
}

function CheckboxOption({
  checked,
  label,
  onChange,
  invalid = false,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  invalid?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex w-full cursor-pointer items-start gap-3 border px-4 py-3 text-left text-sm leading-6 transition ${
        checked
          ? "border-blue-400/55 bg-blue-500/12 text-white"
          : invalid
            ? "border-red-400/70 bg-red-500/8 text-zinc-200"
            : "border-zinc-700/80 bg-zinc-950/30 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/70"
      }`}
      style={{ borderRadius: 8 }}
      aria-pressed={checked}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-xs ${
          checked
            ? "border-blue-400 bg-blue-500 text-white"
            : "border-zinc-600 bg-zinc-900 text-transparent"
        }`}
        style={{ borderRadius: 5 }}
      >
        ✓
      </span>

      <span>{label}</span>
    </button>
  );
}

function RadioOption({
  checked,
  label,
  onChange,
  invalid = false,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  invalid?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex w-full cursor-pointer items-center gap-3 border px-4 py-3 text-left text-sm transition ${
        checked
          ? "border-blue-400/55 bg-blue-500/12 text-white"
          : invalid
            ? "border-red-400/70 bg-red-500/8 text-zinc-200"
            : "border-zinc-700/80 bg-zinc-950/30 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/70"
      }`}
      style={{ borderRadius: 8 }}
      aria-pressed={checked}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          checked
            ? "border-blue-400 bg-blue-500/20"
            : "border-zinc-600 bg-zinc-900"
        }`}
      >
        {checked ? (
          <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
        ) : null}
      </span>

      <span>{label}</span>
    </button>
  );
}

function QuestionTitle({
  number,
  children,
  optional,
}: {
  number: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-300">
          {number}
        </span>

        <div>
          <h3 className="text-base font-semibold leading-6 text-white">
            {children}
          </h3>

          {optional ? (
            <p className="mt-1 text-xs text-zinc-500">Optional</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CommunitySafetySurveyPage() {
  const [form, setForm] = useState<SurveyFormState>(INITIAL_FORM);
  const [step, setStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const formStartedAtRef = useRef(Date.now());
  const experienceRef = useRef<HTMLElement | null>(null);
  const risksRef = useRef<HTMLElement | null>(null);
  const creatorActionsRef = useRef<HTMLElement | null>(null);
  const robloxResponsibilitiesRef = useRef<HTMLElement | null>(null);
  const loopholeRef = useRef<HTMLElement | null>(null);
  const practicalSolutionRef = useRef<HTMLElement | null>(null);
  const consentRef = useRef<HTMLLabelElement | null>(null);

  const progress = ((step + 1) / STEP_DETAILS.length) * 100;

  const selectedRiskCount = form.childSafetyRisks.filter(
    (item) => item !== "unsure",
  ).length;

  const currentStepDetails = STEP_DETAILS[step];

  const canContinue = useMemo(() => {
    if (step === 0) {
      return form.robloxExperience.length > 0;
    }

    if (step === 1) {
      return form.childSafetyRisks.length > 0;
    }

    if (step === 2) {
      return (
        form.creatorActions.length > 0 && form.robloxResponsibilities.length > 0
      );
    }

    if (step === 3) {
      return (
        !!form.hasSafetyLoophole &&
        !!form.practicalSolution.trim() &&
        form.publicationConsent
      );
    }

    return false;
  }, [form, step]);

  function getMissingFields() {
    if (step === 0) {
      return form.robloxExperience.length > 0 ? [] : ["experience"];
    }

    if (step === 1) {
      return form.childSafetyRisks.length > 0 ? [] : ["risks"];
    }

    if (step === 2) {
      const missing: string[] = [];

      if (form.creatorActions.length === 0) {
        missing.push("creatorActions");
      }

      if (form.robloxResponsibilities.length === 0) {
        missing.push("robloxResponsibilities");
      }

      return missing;
    }

    const missing: string[] = [];

    if (!form.hasSafetyLoophole) {
      missing.push("loophole");
    }

    if (!form.practicalSolution.trim()) {
      missing.push("practicalSolution");
    }

    if (!form.publicationConsent) {
      missing.push("consent");
    }

    return missing;
  }

  function scrollToFirstMissingField(firstMissing: string) {
    const refs: Record<string, React.RefObject<HTMLElement | null>> = {
      experience: experienceRef,
      risks: risksRef,
      creatorActions: creatorActionsRef,
      robloxResponsibilities: robloxResponsibilitiesRef,
      loophole: loopholeRef,
      practicalSolution: practicalSolutionRef,
      consent: consentRef,
    };

    window.setTimeout(() => {
      refs[firstMissing]?.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }

  function showMissingFields() {
    const missing = getMissingFields();
    setInvalidFields(missing);
    setShowValidationModal(true);

    if (missing[0]) {
      scrollToFirstMissingField(missing[0]);
    }

    if (step === 0) {
      setErrorMessage(
        "Please select at least one option describing your Roblox experience.",
      );
    } else if (step === 1) {
      setErrorMessage(
        "Please choose at least one issue, or select “I’m not sure.”",
      );
    } else if (step === 2) {
      setErrorMessage(
        "Please answer both required questions before continuing. “I’m not sure” is available.",
      );
    } else {
      setErrorMessage(
        "Please complete the highlighted required questions before submitting.",
      );
    }
  }

  useEffect(() => {
    if (!showValidationModal) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowValidationModal(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showValidationModal]);

  function updateField<K extends keyof SurveyFormState>(
    key: K,
    value: SurveyFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setInvalidFields([]);
    setErrorMessage("");
  }

  function goNext() {
    setErrorMessage("");

    if (!canContinue) {
      showMissingFields();
      return;
    }

    setInvalidFields([]);
    setShowValidationModal(false);
    setStep((current) => Math.min(current + 1, STEP_DETAILS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setErrorMessage("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitSurvey() {
    if (isSubmitting) return;

    if (!canContinue) {
      showMissingFields();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          formStartedAt: formStartedAtRef.current,
          companyWebsite: "",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            "Something went wrong while submitting your response.",
        );
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Survey submission error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your response.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#02040a_0%,#010309_45%,#000_100%)] px-5 pb-20 pt-40 text-white sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div
            className="border border-zinc-700/70 bg-zinc-900/75 p-7 text-center shadow-2xl backdrop-blur sm:p-10"
            style={{ borderRadius: 12 }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/15 text-2xl text-blue-300">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight">
              Thank you for contributing
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
              Your response has been received. FRDA will review the submissions
              and use valid responses to help represent the Roblox community’s
              concerns, experiences, and ideas during the Senate committee
              hearing and in our public findings report.
            </p>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Individual contact details will not be published without the
              respondent’s permission.
            </p>

            <a
              href="/"
              className="mt-7 inline-flex cursor-pointer items-center justify-center bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              style={{ borderRadius: 7 }}
            >
              Return to FRDA
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        .survey-input::placeholder,
        .survey-textarea::placeholder {
          color: rgb(113 113 122);
        }

        .survey-input:focus,
        .survey-textarea:focus {
          border-color: rgb(96 165 250) !important;
          box-shadow: 0 0 0 1px rgb(96 165 250 / 0.45);
        }
      `}</style>

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_right,rgba(168,85,247,0.07),transparent_23%),linear-gradient(180deg,#02040a_0%,#010309_42%,#000_100%)] px-5 pb-44 pt-36 text-white sm:px-6 sm:pb-20 sm:pt-40">
        <input
          type="text"
          name="companyWebsite"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] top-auto h-px w-px opacity-0"
        />

        <div className="mx-auto max-w-3xl">
          <header className="mb-8 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-blue-200">
              FRDA Community Consultation
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">
              Help bring the Roblox developer community’s voice to the Senate
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              FRDA has been invited to participate in a Senate committee hearing
              concerning Roblox, online child safety, violent game content,
              grooming, and the recent school shooting in Tacloban.
            </p>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              We want to bring forward the experiences, concerns, and ideas of
              people who create, manage, moderate, and participate in Roblox
              communities—not only the views of FRDA’s core group.
            </p>

            <div className="mx-auto mt-5 flex max-w-xl flex-col items-center justify-center gap-2 text-sm text-zinc-400 sm:flex-row sm:gap-5">
              <span>About 5 minutes</span>
              <span className="hidden text-zinc-700 sm:inline">•</span>
              <span>English, Tagalog, or Taglish welcome</span>
              <span className="hidden text-zinc-700 sm:inline">•</span>
              <span>Identity is optional</span>
            </div>
          </header>

          <section
            className="overflow-hidden border border-zinc-700/75 bg-zinc-900/80 shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur"
            style={{ borderRadius: 14 }}
          >
            <div className="border-b border-zinc-800 px-5 py-5 sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-blue-300">
                    Step {step + 1} of {STEP_DETAILS.length}
                  </p>

                  <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                    {currentStepDetails.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {currentStepDetails.description}
                  </p>
                </div>

                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/50 text-sm font-semibold text-zinc-300 sm:flex">
                  {Math.round(progress)}%
                </div>
              </div>

              <div className="mt-5 hidden h-2 overflow-hidden rounded-full bg-zinc-800 sm:block">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="px-5 py-7 sm:px-7 sm:py-8">
              {step === 0 ? (
                <div className="space-y-8">
                  <section>
                    <QuestionTitle number="1" optional>
                      Your name and contact details
                    </QuestionTitle>

                    <p className="mb-5 text-sm leading-6 text-zinc-400">
                      You may answer anonymously. Contact information will only
                      be used if FRDA needs to clarify one of your responses.
                    </p>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="name"
                          className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                        >
                          Name
                        </label>

                        <input
                          id="name"
                          value={form.name}
                          onChange={(event) =>
                            updateField("name", event.target.value)
                          }
                          placeholder="Optional"
                          maxLength={100}
                          className="survey-input w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                          style={{ borderRadius: 8 }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="robloxAlias"
                          className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                        >
                          Roblox username or creator alias
                        </label>

                        <input
                          id="robloxAlias"
                          value={form.robloxAlias}
                          onChange={(event) =>
                            updateField("robloxAlias", event.target.value)
                          }
                          placeholder="Optional"
                          maxLength={100}
                          className="survey-input w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                          style={{ borderRadius: 8 }}
                        />
                      </div>
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor="contactInfo"
                        className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                      >
                        Email or Facebook Messenger profile link
                      </label>

                      <input
                        id="contactInfo"
                        value={form.contactInfo}
                        onChange={(event) =>
                          updateField("contactInfo", event.target.value)
                        }
                        placeholder="Optional"
                        maxLength={250}
                        className="survey-input w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                        style={{ borderRadius: 8 }}
                      />
                    </div>

                    {form.contactInfo.trim() ? (
                      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-zinc-300">
                        <input
                          type="checkbox"
                          checked={form.contactPermission}
                          onChange={(event) =>
                            updateField(
                              "contactPermission",
                              event.target.checked,
                            )
                          }
                          className="mt-1 h-4 w-4 accent-blue-500"
                        />

                        <span>
                          FRDA may contact me to better understand one of my
                          answers.
                        </span>
                      </label>
                    ) : null}
                  </section>

                  <section
                    ref={experienceRef}
                    className={`border-t pt-8 transition ${
                      invalidFields.includes("experience")
                        ? "border-red-400/70 rounded-[10px] bg-red-500/5 px-4 pb-4"
                        : "border-zinc-800"
                    }`}
                  >
                    <QuestionTitle number="2">
                      What best describes your experience with Roblox?
                    </QuestionTitle>

                    <p className="mb-4 text-sm text-zinc-500">
                      Choose all that apply.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {EXPERIENCE_OPTIONS.map((option) => (
                        <CheckboxOption
                          key={option.value}
                          checked={form.robloxExperience.includes(option.value)}
                          label={option.label}
                          invalid={invalidFields.includes("experience")}
                          onChange={() =>
                            updateField(
                              "robloxExperience",
                              toggleArrayValue(
                                form.robloxExperience,
                                option.value,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>

                    <input
                      value={form.robloxExperienceOther}
                      onChange={(event) =>
                        updateField("robloxExperienceOther", event.target.value)
                      }
                      placeholder="Other Roblox experience, if any"
                      maxLength={250}
                      className="survey-input mt-4 w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                      style={{ borderRadius: 8 }}
                    />
                  </section>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-8">
                  <section
                    ref={risksRef}
                    className={`transition ${
                      invalidFields.includes("risks")
                        ? "rounded-[10px] border border-red-400/70 bg-red-500/5 p-4"
                        : ""
                    }`}
                  >
                    <QuestionTitle number="3">
                      Based on what you have seen or experienced, which issues
                      genuinely place younger Roblox users at risk?
                    </QuestionTitle>

                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-zinc-500">
                        Choose up to three.
                      </p>

                      <span
                        className={`text-xs ${
                          selectedRiskCount >= 3
                            ? "text-amber-300"
                            : "text-zinc-500"
                        }`}
                      >
                        {selectedRiskCount}/3 selected
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {RISK_OPTIONS.map((option) => {
                        const checked = form.childSafetyRisks.includes(
                          option.value,
                        );

                        return (
                          <CheckboxOption
                            key={option.value}
                            checked={checked}
                            label={option.label}
                            invalid={invalidFields.includes("risks")}
                            onChange={() => {
                              if (option.value === "unsure") {
                                updateField(
                                  "childSafetyRisks",
                                  checked ? [] : ["unsure"],
                                );
                                return;
                              }

                              const withoutUnsure =
                                form.childSafetyRisks.filter(
                                  (item) => item !== "unsure",
                                );

                              updateField(
                                "childSafetyRisks",
                                toggleArrayValue(
                                  withoutUnsure,
                                  option.value,
                                  3,
                                ),
                              );
                            }}
                          />
                        );
                      })}
                    </div>

                    <input
                      value={form.childSafetyRisksOther}
                      onChange={(event) =>
                        updateField("childSafetyRisksOther", event.target.value)
                      }
                      placeholder="Another risk not listed above"
                      maxLength={250}
                      className="survey-input mt-4 w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                      style={{ borderRadius: 8 }}
                    />
                  </section>

                  <section className="border-t border-zinc-800 pt-8">
                    <QuestionTitle number="4" optional>
                      Is there a particular situation or pattern FRDA should
                      examine more closely?
                    </QuestionTitle>

                    <textarea
                      value={form.riskPatternNotes}
                      onChange={(event) =>
                        updateField("riskPatternNotes", event.target.value)
                      }
                      placeholder="A short or casual answer is fine. Please do not name or identify anyone involved."
                      rows={5}
                      maxLength={1500}
                      className="survey-textarea w-full resize-y border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm leading-6 text-white outline-none"
                      style={{ borderRadius: 8 }}
                    />

                    <p className="mt-2 text-right text-xs text-zinc-600">
                      {form.riskPatternNotes.length}/1500
                    </p>
                  </section>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-8">
                  <section
                    ref={creatorActionsRef}
                    className={`transition ${
                      invalidFields.includes("creatorActions")
                        ? "rounded-[10px] border border-red-400/70 bg-red-500/5 p-4"
                        : ""
                    }`}
                  >
                    <QuestionTitle number="5">
                      What can independent Roblox creators, game owners, or
                      community moderators realistically do?
                    </QuestionTitle>

                    <p className="mb-4 text-sm text-zinc-500">
                      Choose all that apply.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {CREATOR_ACTION_OPTIONS.map((option) => (
                        <CheckboxOption
                          key={option.value}
                          checked={form.creatorActions.includes(option.value)}
                          label={option.label}
                          invalid={invalidFields.includes("creatorActions")}
                          onChange={() => {
                            if (
                              option.value === "none" ||
                              option.value === "unsure"
                            ) {
                              updateField(
                                "creatorActions",
                                form.creatorActions.includes(option.value)
                                  ? []
                                  : [option.value],
                              );
                              return;
                            }

                            const filtered = form.creatorActions.filter(
                              (item) => item !== "none" && item !== "unsure",
                            );

                            updateField(
                              "creatorActions",
                              toggleArrayValue(filtered, option.value),
                            );
                          }}
                        />
                      ))}
                    </div>

                    <input
                      value={form.creatorActionsOther}
                      onChange={(event) =>
                        updateField("creatorActionsOther", event.target.value)
                      }
                      placeholder="Something else creators could realistically do"
                      maxLength={500}
                      className="survey-input mt-4 w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                      style={{ borderRadius: 8 }}
                    />
                  </section>

                  <section
                    ref={robloxResponsibilitiesRef}
                    className={`border-t pt-8 transition ${
                      invalidFields.includes("robloxResponsibilities")
                        ? "border-red-400/70 rounded-[10px] bg-red-500/5 px-4 pb-4"
                        : "border-zinc-800"
                    }`}
                  >
                    <QuestionTitle number="6">
                      Which safety problems mainly require action from Roblox
                      itself?
                    </QuestionTitle>

                    <p className="mb-4 text-sm text-zinc-500">
                      Choose all that apply.
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {ROBLOX_RESPONSIBILITY_OPTIONS.map((option) => (
                        <CheckboxOption
                          key={option.value}
                          checked={form.robloxResponsibilities.includes(
                            option.value,
                          )}
                          label={option.label}
                          invalid={invalidFields.includes(
                            "robloxResponsibilities",
                          )}
                          onChange={() => {
                            if (option.value === "unsure") {
                              updateField(
                                "robloxResponsibilities",
                                form.robloxResponsibilities.includes("unsure")
                                  ? []
                                  : ["unsure"],
                              );
                              return;
                            }

                            const filtered = form.robloxResponsibilities.filter(
                              (item) => item !== "unsure",
                            );

                            updateField(
                              "robloxResponsibilities",
                              toggleArrayValue(filtered, option.value),
                            );
                          }}
                        />
                      ))}
                    </div>

                    <input
                      value={form.robloxResponsibilitiesOther}
                      onChange={(event) =>
                        updateField(
                          "robloxResponsibilitiesOther",
                          event.target.value,
                        )
                      }
                      placeholder="Another issue that mainly requires Roblox-level action"
                      maxLength={500}
                      className="survey-input mt-4 w-full border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm text-white outline-none"
                      style={{ borderRadius: 8 }}
                    />
                  </section>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-8">
                  <section
                    ref={loopholeRef}
                    className={`transition ${
                      invalidFields.includes("loophole")
                        ? "rounded-[10px] border border-red-400/70 bg-red-500/5 p-4"
                        : ""
                    }`}
                  >
                    <QuestionTitle number="7">
                      Could any existing or proposed safety measure be easy to
                      bypass, create a new problem, or give people a false sense
                      of security?
                    </QuestionTitle>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <RadioOption
                        checked={form.hasSafetyLoophole === "yes"}
                        invalid={invalidFields.includes("loophole")}
                        label="Yes"
                        onChange={() => updateField("hasSafetyLoophole", "yes")}
                      />

                      <RadioOption
                        checked={form.hasSafetyLoophole === "no"}
                        invalid={invalidFields.includes("loophole")}
                        label="No"
                        onChange={() => updateField("hasSafetyLoophole", "no")}
                      />

                      <RadioOption
                        checked={form.hasSafetyLoophole === "unsure"}
                        invalid={invalidFields.includes("loophole")}
                        label="I’m not sure"
                        onChange={() =>
                          updateField("hasSafetyLoophole", "unsure")
                        }
                      />
                    </div>

                    {form.hasSafetyLoophole === "yes" ? (
                      <div className="mt-5 space-y-5">
                        <div>
                          <label
                            htmlFor="safetyLoopholeDetails"
                            className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                          >
                            What is the possible loophole or unintended problem?
                          </label>

                          <textarea
                            id="safetyLoopholeDetails"
                            value={form.safetyLoopholeDetails}
                            onChange={(event) =>
                              updateField(
                                "safetyLoopholeDetails",
                                event.target.value,
                              )
                            }
                            placeholder="You may mention age checks, account restrictions, parental controls, game reviews, reporting systems, or another measure."
                            rows={4}
                            maxLength={1500}
                            className="survey-textarea w-full resize-y border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm leading-6 text-white outline-none"
                            style={{ borderRadius: 8 }}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="safetyImprovementIdea"
                            className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400"
                          >
                            Do you have any ideas that could make that safety
                            measure work better?
                          </label>

                          <textarea
                            id="safetyImprovementIdea"
                            value={form.safetyImprovementIdea}
                            onChange={(event) =>
                              updateField(
                                "safetyImprovementIdea",
                                event.target.value,
                              )
                            }
                            placeholder="Optional — a short suggestion is enough."
                            rows={4}
                            maxLength={1500}
                            className="survey-textarea w-full resize-y border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm leading-6 text-white outline-none"
                            style={{ borderRadius: 8 }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </section>

                  <section
                    ref={practicalSolutionRef}
                    className={`border-t pt-8 transition ${
                      invalidFields.includes("practicalSolution")
                        ? "border-red-400/70 rounded-[10px] bg-red-500/5 px-4 pb-4"
                        : "border-zinc-800"
                    }`}
                  >
                    <QuestionTitle number="8">
                      What is one practical action that could make Roblox safer
                      for children without completely taking away access to
                      games, creativity, or social experiences?
                    </QuestionTitle>

                    <textarea
                      value={form.practicalSolution}
                      onChange={(event) =>
                        updateField("practicalSolution", event.target.value)
                      }
                      placeholder="Your idea does not need to sound formal. We are interested in practical solutions."
                      rows={5}
                      maxLength={1500}
                      className={`survey-textarea w-full resize-y border bg-zinc-950/55 px-4 py-3 text-sm leading-6 text-white outline-none ${
                        invalidFields.includes("practicalSolution")
                          ? "border-red-400/70"
                          : "border-zinc-700"
                      }`}
                      style={{ borderRadius: 8 }}
                    />

                    <p className="mt-2 text-right text-xs text-zinc-600">
                      {form.practicalSolution.length}/1500
                    </p>
                  </section>

                  <section className="border-t border-zinc-800 pt-8">
                    <QuestionTitle number="9" optional>
                      Is there an important concern, experience, or possible
                      solution we did not ask about?
                    </QuestionTitle>

                    <textarea
                      value={form.additionalInsight}
                      onChange={(event) =>
                        updateField("additionalInsight", event.target.value)
                      }
                      placeholder="Optional"
                      rows={4}
                      maxLength={1500}
                      className="survey-textarea w-full resize-y border border-zinc-700 bg-zinc-950/55 px-4 py-3 text-sm leading-6 text-white outline-none"
                      style={{ borderRadius: 8 }}
                    />
                  </section>

                  <section className="border-t border-zinc-800 pt-8">
                    <QuestionTitle number="10">
                      If FRDA publishes or refers to one of your specific ideas,
                      how would you like to be credited?
                    </QuestionTitle>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <RadioOption
                        checked={form.creditPreference === "name"}
                        label="Use my name"
                        onChange={() => updateField("creditPreference", "name")}
                      />

                      <RadioOption
                        checked={form.creditPreference === "alias"}
                        label="Use my Roblox username or alias"
                        onChange={() =>
                          updateField("creditPreference", "alias")
                        }
                      />

                      <RadioOption
                        checked={form.creditPreference === "anonymous"}
                        label="Keep my response anonymous"
                        onChange={() =>
                          updateField("creditPreference", "anonymous")
                        }
                      />
                    </div>

                    {form.creditPreference === "name" && !form.name.trim() ? (
                      <p className="mt-3 text-xs text-amber-300">
                        You selected name credit but did not enter a name. Your
                        response will be treated as anonymous unless you add one
                        in Step 1.
                      </p>
                    ) : null}

                    {form.creditPreference === "alias" &&
                    !form.robloxAlias.trim() ? (
                      <p className="mt-3 text-xs text-amber-300">
                        You selected alias credit but did not enter an alias.
                        Your response will be treated as anonymous unless you
                        add one in Step 1.
                      </p>
                    ) : null}
                  </section>

                  <label
                    ref={consentRef}
                    className={`flex cursor-pointer items-start gap-3 border bg-zinc-950/40 p-4 text-sm leading-6 text-zinc-300 transition ${
                      invalidFields.includes("consent")
                        ? "border-red-400/70 bg-red-500/5"
                        : "border-zinc-700"
                    }`}
                    style={{ borderRadius: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={form.publicationConsent}
                      onChange={(event) =>
                        updateField("publicationConsent", event.target.checked)
                      }
                      className="mt-1 h-4 w-4 accent-blue-500"
                    />

                    <span>
                      I understand that FRDA may summarize my response for the
                      Senate committee hearing and in a public report. My name
                      and contact information will not be published unless I
                      have chosen to be credited.
                    </span>
                  </label>
                </div>
              ) : null}

              {errorMessage ? (
                <div
                  className="mt-7 border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
                  style={{ borderRadius: 8 }}
                >
                  {errorMessage}
                </div>
              ) : null}

              <div className="mt-8 hidden items-center justify-between gap-3 border-t border-zinc-800 pt-6 sm:flex">
                <div>
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={isSubmitting}
                      className="cursor-pointer border border-zinc-700 bg-transparent px-5 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800/50 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderRadius: 7 }}
                    >
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                </div>

                {step < STEP_DETAILS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="cursor-pointer bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                    style={{ borderRadius: 7 }}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitSurvey}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="cursor-pointer bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-80"
                    style={{ borderRadius: 7, minWidth: 190 }}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      {isSubmitting ? (
                        <>
                          <span
                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                            aria-hidden="true"
                          />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        "Submit My Response"
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </section>

          <div
            className="mt-6 border border-zinc-800 bg-zinc-950/35 p-4 text-xs leading-6 text-zinc-500"
            style={{ borderRadius: 9 }}
          >
            FRDA welcomes disagreement and critical feedback. Duplicate
            submissions, spam, harassment, threats, impersonation, personal
            attacks, and responses containing private information about other
            people may be excluded from the published findings. Basic technical
            information may be processed to prevent spam and coordinated abuse.
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07101f]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_35px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:hidden">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                <span>
                  Step {step + 1} of {STEP_DETAILS.length}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isSubmitting}
                  className="cursor-pointer border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderRadius: 7 }}
                >
                  Back
                </button>
              ) : (
                <a
                  href="/"
                  className="flex items-center justify-center border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-300"
                  style={{ borderRadius: 7 }}
                >
                  Exit
                </a>
              )}

              {step < STEP_DETAILS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                  style={{ borderRadius: 7 }}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitSurvey}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-80"
                  style={{ borderRadius: 7 }}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <>
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                          aria-hidden="true"
                        />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      "Submit"
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {showValidationModal ? (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-validation-title"
            onClick={() => setShowValidationModal(false)}
          >
            <div
              className="w-full max-w-md border border-red-400/30 bg-zinc-900 p-6 shadow-2xl"
              style={{ borderRadius: 12 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-xl text-red-300">
                !
              </div>

              <h2
                id="survey-validation-title"
                className="mt-5 text-xl font-semibold text-white"
              >
                Please complete the highlighted question
              </h2>

              <p className="mt-3 text-sm leading-6 text-zinc-300">
                One or more required answers are still missing. We highlighted
                them in red and moved you to the first one that needs attention.
              </p>

              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="mt-6 w-full cursor-pointer bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                style={{ borderRadius: 7 }}
              >
                Okay, got it
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
