import SiteHeader from "@/components/site/SiteHeader";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-16 pt-[200px] text-sm leading-7 text-zinc-800 dark:text-zinc-200">
        <h1 className="mb-6 text-3xl font-semibold">FRDA Privacy Notice</h1>

        <p className="mb-4">
          The Filipino Roblox Developers Association (FRDA) respects your right
          to privacy and is committed to protecting your personal data in
          accordance with applicable privacy laws and regulations.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">Who we are</h2>
        <p>
          FRDA is the personal information controller for the personal data
          collected through our developer registration form and related
          application review systems.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          What personal data we collect
        </h2>
        <p>
          Depending on what you provide, FRDA may collect your first name, last
          name, email address, birth year, region, Roblox username or profile,
          Roblox experience or place link, contribution details, Discord User
          ID, optional supporting links, and optional Facebook profile URL.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Why we collect your personal data
        </h2>
        <p>
          FRDA collects and uses your personal data to review developer
          registration applications, verify ownership or control of submitted
          Roblox work, evaluate claimed Roblox development involvement,
          administer membership records, communicate with applicants, and
          coordinate Discord server access for accepted applicants.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          How developer ownership is reviewed
        </h2>
        <p>
          As part of the registration process, applicants may be asked to place
          a unique FRDA verification code in or around the submitted Roblox work.
          This helps FRDA confirm that the applicant owns, controls, or has
          authorized access to the Roblox work submitted for review.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Optional future identity verification
        </h2>
        <p>
          Approved applicants are recognized as FRDA Registered Developers once
          FRDA verifies ownership or control of their submitted Roblox work.
          Some future opportunities, such as job board access, client-facing
          developer profiles, or similar higher-trust features, may require a
          separate optional identity verification step. FRDA will provide
          additional details before collecting any additional information for
          that purpose.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          Who may access your data
        </h2>
        <p>
          Your personal data will only be accessed by authorized FRDA personnel
          who need it for application review, developer ownership verification,
          membership administration, privacy compliance, or technical
          administration.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          How long we keep your data
        </h2>
        <p>
          FRDA keeps personal data only for as long as necessary for the
          purposes stated in this notice, for legitimate organizational
          recordkeeping, for legal claims, or as otherwise required by law.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">
          How we may share your data
        </h2>
        <p>
          FRDA does not publicly disclose your personal data. We may share
          personal data only with service providers supporting our systems,
          subject to appropriate safeguards, or when disclosure is required by
          law or valid legal process.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">Your rights</h2>
        <p>
          You may request access to your personal data, correction of inaccurate
          data, deletion of data where applicable, or raise privacy-related
          concerns through our designated privacy contact.
        </p>

        <h2 className="mb-3 mt-8 text-xl font-semibold">Contact us</h2>
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