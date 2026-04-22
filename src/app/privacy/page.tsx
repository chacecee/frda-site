import SiteHeader from "@/components/site/SiteHeader";

export default function PrivacyPage() {
    return (
        <>
            <SiteHeader />
            <main className="mx-auto max-w-4xl px-6 pb-16 pt-[200px] text-sm leading-7 text-zinc-800 dark:text-zinc-200">
                <h1 className="mb-6 text-3xl font-semibold">FRDA Privacy Notice</h1>

                <p className="mb-4">
                    The Filipino Roblox Developers Association (FRDA) respects your right to privacy and is committed to protecting your personal data in accordance with applicable privacy laws and regulations.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">Who we are</h2>
                <p>
                    FRDA is the personal information controller for the personal data collected through this registration form.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">What personal data we collect</h2>
                <p>
                    Depending on what you provide, FRDA may collect your first name, last name, email address, birth year, region, Roblox username or profile, Roblox place link, contribution details, Discord User ID, optional supporting links, optional Facebook profile URL, and uploaded ID image.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">Why we collect your personal data</h2>
                <p>
                    FRDA collects and uses your personal data for application review, identity verification, evaluation of claimed Roblox development involvement, membership administration, communication regarding your application, and Discord server access coordination for accepted applicants.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">Why we collect your ID image</h2>
                <p>
                    Your uploaded ID image is collected solely to verify that the name you submitted in your application matches the name on your uploaded ID. Once this verification is completed, your uploaded ID image will be deleted. FRDA may retain a minimal verification log showing that verification was completed, who performed it, and when the ID image was deleted.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">Who may access your data</h2>
                <p>
                    Your personal data will only be accessed by authorized FRDA personnel who need it for application review, identity verification, privacy compliance, or technical administration. Access to uploaded ID images is limited to specifically authorized persons only.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">How long we keep your data</h2>
                <p>
                    FRDA keeps personal data only for as long as necessary for the purposes stated in this notice, for legitimate organizational recordkeeping, for legal claims, or as otherwise required by law. Uploaded ID images are deleted after identity verification is completed.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">How we may share your data</h2>
                <p>
                    FRDA does not publicly disclose your personal data. We may share personal data only with service providers supporting our systems, subject to appropriate safeguards, or when disclosure is required by law or valid legal process.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">Your rights</h2>
                <p>
                    You may request access to your personal data, correction of inaccurate data, or raise privacy-related concerns through our designated privacy contact.
                </p>

                <h2 className="mt-8 mb-3 text-xl font-semibold">Contact us</h2>
                <p>
                    Data Protection Officer<br />
                    Daryll Pagsolingan<br />
                    Chief Executive Director<br />
                    Filipino Roblox Developers Association<br />
                    privacy@frdaph.org
                </p>
            </main>
        </>
    );
}