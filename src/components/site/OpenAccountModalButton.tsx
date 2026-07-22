"use client";

type AccountModalTab =
  | "signup"
  | "login";

type AccountPurpose =
  | "developer"
  | "talent_seeker"
  | "both";

export default function OpenAccountModalButton({
  children,
  tab = "signup",
  accountPurpose = "developer",
  className = "",
}: {
  children: React.ReactNode;
  tab?: AccountModalTab;
  accountPurpose?: AccountPurpose;
  className?: string;
}) {
  function openAccountModal() {
    window.dispatchEvent(
      new CustomEvent(
        "frda:open-account-modal",
        {
          detail: {
            tab,
            accountPurpose,
          },
        },
      ),
    );
  }

  return (
    <button
      type="button"
      onClick={openAccountModal}
      className={className}
    >
      {children}
    </button>
  );
}