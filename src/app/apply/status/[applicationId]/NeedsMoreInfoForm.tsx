"use client";

import { useState } from "react";
import { notify } from "@/components/ToastConfig";

type CorrectionFieldKey =
  | "roblox"
  | "placeLink"
  | "placeContribution"
  | "supportingLinks"
  | "facebookProfile"
  | "discordId"
  | "email";

type CorrectionRequest = {
  fieldKey: CorrectionFieldKey;
  label: string;
  note?: string;
};

type Props = {
  applicationId: string;
  token: string;
  correctionRequests: CorrectionRequest[];
  initialValues: {
    email: string;
    discordId: string;
    facebookProfile: string;
    roblox: string;
    placeLink: string;
    placeContribution: string;
    supportingLinks: string;
  };
};

const FIELD_WIDTH = 350;

export default function NeedsMoreInfoForm({
  applicationId,
  token,
  correctionRequests,
  initialValues,
}: Props) {
  const [email, setEmail] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [facebookProfile, setFacebookProfile] = useState("");
  const [roblox, setRoblox] = useState("");
  const [placeLink, setPlaceLink] = useState("");
  const [placeContribution, setPlaceContribution] = useState("");
  const [supportingLinks, setSupportingLinks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function fallbackValue(current: string, original: string) {
    return current.trim() ? current : original;
  }

  function getOriginalValue(fieldKey: CorrectionFieldKey) {
    switch (fieldKey) {
      case "email":
        return initialValues.email || "";
      case "discordId":
        return initialValues.discordId || "";
      case "facebookProfile":
        return initialValues.facebookProfile || "";
      case "roblox":
        return initialValues.roblox || "";
      case "placeLink":
        return initialValues.placeLink || "";
      case "placeContribution":
        return initialValues.placeContribution || "";
      case "supportingLinks":
        return initialValues.supportingLinks || "";
      default:
        return "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("applicationId", applicationId);
      formData.append("token", token);

      correctionRequests.forEach((item) => {
        switch (item.fieldKey) {
          case "email":
            formData.append("email", fallbackValue(email, initialValues.email));
            break;
          case "discordId":
            formData.append(
              "discordId",
              fallbackValue(discordId, initialValues.discordId)
            );
            break;
          case "facebookProfile":
            formData.append(
              "facebookProfile",
              fallbackValue(facebookProfile, initialValues.facebookProfile)
            );
            break;
          case "roblox":
            formData.append("roblox", fallbackValue(roblox, initialValues.roblox));
            break;
          case "placeLink":
            formData.append(
              "placeLink",
              fallbackValue(placeLink, initialValues.placeLink)
            );
            break;
          case "placeContribution":
            formData.append(
              "placeContribution",
              fallbackValue(placeContribution, initialValues.placeContribution)
            );
            break;
          case "supportingLinks":
            formData.append(
              "supportingLinks",
              fallbackValue(supportingLinks, initialValues.supportingLinks)
            );
            break;
        }
      });

      const response = await fetch("/api/apply/update", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Could not submit your updated information."
        );
      }

      notify.success("Your updated information has been sent.");

      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not submit your updated information.";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderInput(fieldKey: CorrectionFieldKey) {
    const inputClassName =
      "w-full border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500";
    const inputStyle = { borderRadius: 5 };

    if (fieldKey === "email") {
      return (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("email")}
        />
      );
    }

    if (fieldKey === "discordId") {
      return (
        <input
          type="text"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("discordId")}
        />
      );
    }

    if (fieldKey === "facebookProfile") {
      return (
        <input
          type="text"
          value={facebookProfile}
          onChange={(e) => setFacebookProfile(e.target.value)}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("facebookProfile")}
        />
      );
    }

    if (fieldKey === "roblox") {
      return (
        <input
          type="text"
          value={roblox}
          onChange={(e) => setRoblox(e.target.value)}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("roblox")}
        />
      );
    }

    if (fieldKey === "placeLink") {
      return (
        <input
          type="text"
          value={placeLink}
          onChange={(e) => setPlaceLink(e.target.value)}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("placeLink")}
        />
      );
    }

    if (fieldKey === "placeContribution") {
      return (
        <textarea
          value={placeContribution}
          onChange={(e) => setPlaceContribution(e.target.value)}
          rows={4}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("placeContribution")}
        />
      );
    }

    if (fieldKey === "supportingLinks") {
      return (
        <textarea
          value={supportingLinks}
          onChange={(e) => setSupportingLinks(e.target.value)}
          rows={4}
          className={inputClassName}
          style={inputStyle}
          placeholder={getOriginalValue("supportingLinks")}
        />
      );
    }

    return null;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        style={{
          marginTop: 28,
          marginBottom: 44,
          width: "100%",
          maxWidth: FIELD_WIDTH,
          marginLeft: "auto",
          marginRight: "auto",
          textAlign: "center",
        }}
      >
        <p className="text-sm leading-7 text-zinc-300">
          Please review the items below and send the corrected information back to our team.
        </p>
      </div>

      <div>
        {correctionRequests.map((request, index) => (
          <div
            key={request.fieldKey}
            style={{
              marginBottom: index === correctionRequests.length - 1 ? 0 : 42,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: FIELD_WIDTH,
                margin: "0 auto",
              }}
            >
              <div className="text-sm font-semibold uppercase tracking-wide text-white">
                {request.label}
              </div>

              {request.note?.trim() ? (
                <div
                  className="text-sm leading-7 text-zinc-400"
                  style={{ marginTop: 8 }}
                >
                  <span className="font-semibold text-zinc-300">Note:</span>{" "}
                  <span className="whitespace-pre-line">{request.note.trim()}</span>
                </div>
              ) : null}

              <div style={{ marginTop: 14 }}>
                {renderInput(request.fieldKey)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {errorMsg ? (
        <div
          className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          style={{ marginTop: 36 }}
        >
          {errorMsg}
        </div>
      ) : null}

      <div
        className="flex justify-center"
        style={{ marginTop: 54 }}
      >
        <button
          type="submit"
          disabled={submitting}
          className="cursor-pointer px-6 py-3 text-base font-semibold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-70"
          style={{
            borderRadius: 5,
            background: "rgb(59, 130, 246)",
            border: "1px solid rgba(96, 165, 250, 0.45)",
            minWidth: 220,
          }}
        >
          {submitting ? "Submitting..." : "Send Updated Information"}
        </button>
      </div>
    </form>
  );
}