import { Suspense } from "react";
import MemberRegistrationClient from "./MemberRegistrationClient";

export default function MemberRegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#061533] px-5 py-12 text-white">
          <div className="mx-auto max-w-xl text-center">
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="mx-auto h-20 w-20 object-contain"
            />

            <p className="mt-6 text-sm text-zinc-400">
              Loading membership invitation...
            </p>
          </div>
        </main>
      }
    >
      <MemberRegistrationClient />
    </Suspense>
  );
}