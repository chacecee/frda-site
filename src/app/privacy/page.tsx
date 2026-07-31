import SiteHeader from "@/components/site/SiteHeader";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-6 pb-16 pt-[200px] text-sm leading-7 text-zinc-800 dark:text-zinc-200">
        <h1 className="mb-6 text-3xl font-semibold">
          FRDA Privacy Notice
        </h1>

        <p className="mb-4">
          The Filipino Roblox Developers Association (FRDA) respects your privacy and is committed to protecting personal data in accordance with applicable privacy laws and regulations.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Who we are
        </h2>

        <p>
          FRDA is the personal information controller for personal data collected through our website, membership system, developer directory, opportunity forms, moderation processes, and related administrative systems.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          What personal data we collect
        </h2>

        <p>
          Depending on the service you use, FRDA may collect your name or public alias, email address, account type, Roblox profile and experience links, portfolio details, skills, profile images, Discord information, optional social or portfolio links, messages sent through the platform, and information you submit for membership, opportunities, reports, or profile review.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Public developer profiles
        </h2>

        <p>
          Information a developer chooses to publish through the FRDA Developer Directory may be publicly visible. Draft profiles, unpublished changes, internal reviewer notes, security records, and account-administration information are not intended for public display.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Why we collect and use personal data
        </h2>

        <p>
          FRDA uses personal data to create and administer member accounts, review and publish developer profiles, moderate content, respond to reports, connect developers with opportunities, administer Discord access, communicate with members, maintain platform security, prevent spam and abuse, investigate incidents, and meet legal or organizational recordkeeping requirements.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Security and abuse-prevention records
        </h2>

        <p>
          To protect FRDA members and systems, we may record technical security information when sensitive actions are attempted, including account registration, profile submission, and other protected requests. This may include the date and time, browser or device information, security-check results, rate-limit events, and a one-way connection fingerprint derived from a network address.
        </p>

        <p className="mt-4">
          The connection fingerprint is used to identify repeated activity that appears to come from the same connection without routinely displaying the underlying network address to staff. A shared connection does not prove that accounts belong to the same person because households, schools, offices, public networks, mobile providers, and privacy services may share or change addresses. FRDA reviews other evidence before taking moderation or blocking action.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Automated security services
        </h2>

        <p>
          FRDA may use services such as Firebase App Check, Google reCAPTCHA Enterprise, and Cloudflare Turnstile to help distinguish legitimate website activity from automated or unauthorized requests. These services may process technical information according to their own privacy and security terms.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Who may access your data
        </h2>

        <p>
          Personal data is accessible only to authorized FRDA personnel who need it for membership administration, profile moderation, opportunity coordination, security, privacy compliance, or technical administration. Sensitive security controls are restricted to authorized administrators.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          How long we keep data
        </h2>

        <p>
          FRDA keeps personal data only for as long as reasonably necessary for the purposes in this notice, legitimate organizational recordkeeping, platform security, dispute handling, legal claims, or compliance obligations. Security and abuse-prevention records may be retained long enough to recognize repeated patterns and protect the platform.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          How we may share data
        </h2>

        <p>
          FRDA does not sell personal data. We may share information with service providers supporting our website, communications, hosting, security, authentication, storage, and moderation systems, subject to appropriate safeguards. Information may also be disclosed when required by law or valid legal process.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Your rights
        </h2>

        <p>
          You may request access to your personal data, correction of inaccurate data, deletion where applicable, or raise privacy-related concerns through our designated privacy contact. Some records may need to be retained where necessary for security, legal, or legitimate organizational purposes.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Contact us
        </h2>

        <p>
          Data Protection Officer
          <br />
          Daryll Pagsolingan
          <br />
          Chief Executive Director
          <br />
          Filipino Roblox Developers Association
          <br />
          privacy@frdaph.org
        </p>
      </main>
    </>
  );
}