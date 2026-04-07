"use client";

type AdminSidebarProps = {
  active: "applications" | "staff";
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  displayName: string;
  email?: string | null;
};

function SidebarLink({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full cursor-pointer px-5 py-4 text-left text-base font-medium transition ${
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
      }`}
      style={{ borderRadius: 0 }}
    >
      {label}
    </button>
  );
}

export default function AdminSidebar({
  active,
  sidebarOpen,
  onCloseSidebar,
  onNavigate,
  onSignOut,
  displayName,
  email,
}: AdminSidebarProps) {
  return (
    <>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseSidebar}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[250px] flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5">
          <div className="mb-8 flex items-center gap-3">
            <img
              src="/frda-logo.png"
              alt="FRDA logo"
              className="h-11 w-11 object-contain"
            />
            <div>
              <p className="text-2xl font-semibold leading-tight text-white">
                FRDA Portal
              </p>
              <p className="text-xs text-zinc-500">Admin Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="space-y-0">
          <SidebarLink
            label="Developer Applications"
            active={active === "applications"}
            onClick={() => {
              onCloseSidebar();
              onNavigate("/admin");
            }}
          />
          <SidebarLink
            label="Staff"
            active={active === "staff"}
            onClick={() => {
              onCloseSidebar();
              onNavigate("/admin/staff");
            }}
          />
        </nav>

        <div className="mt-auto border-t border-zinc-800 p-5">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Signed in as
          </p>
          <p className="mt-3 break-words text-base font-semibold text-white">
            {displayName}
          </p>
          <p className="mt-1 break-words text-sm text-zinc-400">{email || "—"}</p>

          <button
            onClick={onSignOut}
            className="mt-4 cursor-pointer text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}