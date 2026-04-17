export default function RegisterPage() {
    return (
        <section className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(113,92,255,0.14),transparent_30%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(54,189,248,0.10),transparent_20%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(236,72,153,0.10),transparent_22%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,#07152f_0%,#071b46_40%,#05163b_100%)]" />

                <div className="absolute left-[-120px] top-24 h-[360px] w-[360px] rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute right-[-100px] top-16 h-[340px] w-[340px] rounded-full bg-fuchsia-400/10 blur-3xl" />
                <div className="absolute left-1/2 top-[420px] h-[220px] w-[760px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-14 md:px-8 md:pb-24 md:pt-20">
                {/* keep your existing hero content here exactly as it already is */}
            </div>
        </section>
    );
}