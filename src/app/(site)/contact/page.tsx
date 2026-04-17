import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="overflow-x-hidden bg-[#030b18]">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,15,43,0.92)_0%,rgba(3,15,43,0.96)_35%,rgba(3,15,43,0.985)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(59,130,246,0.15),transparent_24%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(96,165,250,0.10),transparent_26%)]" />
          <div className="absolute left-[-120px] top-24 h-[360px] w-[360px] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-[-120px] top-24 h-[360px] w-[360px] rounded-full bg-cyan-400/8 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-[120px] md:px-8 md:pb-28 md:pt-[200px]">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-[5px] bg-blue-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
              Contact
            </p>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-[1.12] text-white md:text-[46px]">
              Get in touch with FRDA
            </h1>

            <p className="mt-6 max-w-3xl text-[15px] leading-8 text-zinc-300 md:text-base">
              For general inquiries, official matters, partnerships, media, or
              community-related coordination, you may reach out through the
              appropriate contact below.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-[10px] border border-blue-300/14 bg-[#071327]/78 px-6 py-5">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-300/80 to-transparent" />

                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">
                  General inquiries
                </p>

                <h2 className="mt-3 text-[22px] font-semibold leading-tight text-white">
                  Official concerns and direct coordination
                </h2>

                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  For general concerns, official communication, and direct
                  coordination with FRDA leadership, please reach out to Berry.
                </p>

                <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/65">
                      Contact person
                    </p>
                    <p className="mt-0.5 text-zinc-200">Berry</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/65">
                      Email
                    </p>
                    <div className="mt-1 space-y-1">
                      <a
                        href="mailto:official@frdaph.org"
                        className="block break-all text-blue-100/90 transition hover:text-white"
                      >
                        official@frdaph.org
                      </a>
                      <a
                        href="mailto:frdaphofficial@gmail.com"
                        className="block break-all text-blue-100/90 transition hover:text-white"
                      >
                        frdaphofficial@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[10px] border border-blue-300/14 bg-[#071327]/78 px-6 py-5">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-300/80 to-transparent" />

                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">
                  Partnerships and media
                </p>

                <h2 className="mt-3 text-[22px] font-semibold leading-tight text-white">
                  Collaborations, partnerships, and external affairs
                </h2>

                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  For partnerships, collaborations, media-related inquiries, and
                  external coordination, please reach out to Vesper.
                </p>

                <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/65">
                      Contact person
                    </p>
                    <p className="mt-0.5 text-zinc-200">Vesper</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/65">
                      Email
                    </p>
                    <a
                      href="mailto:communications@frdaph.org"
                      className="mt-1 block break-all text-blue-100/90 transition hover:text-white"
                    >
                      communications@frdaph.org
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[10px] border border-blue-400/12 bg-[#071327]/72 px-6 py-6">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/35 to-transparent" />

              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">
                Community channel
              </p>

              <h2 className="mt-3 text-[22px] font-semibold leading-tight text-white">
                Follow FRDA on Facebook
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">
                For public updates, announcements, and official posts, you may
                also follow FRDA through our official Facebook page.
              </p>

              <div className="mt-6">
                <Link
                  href="https://www.facebook.com/Frdaofficial"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-[7px] border border-blue-300/18 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-100 transition hover:border-blue-200/30 hover:bg-blue-500/15 hover:text-white"
                >
                  Visit official Facebook page
                </Link>
              </div>

              <div className="mt-10 space-y-4 border-t border-blue-400/8 pt-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/65">
                    Reach out here for
                  </p>
                  <ul className="mt-2 space-y-2 text-sm leading-7 text-zinc-300">
                    <li>General concerns and official inquiries</li>
                    <li>Partnership and collaboration discussions</li>
                    <li>Media and external affairs coordination</li>
                    <li>Public updates and official announcements</li>
                  </ul>
                </div>
              </div>

              <div className="pointer-events-none absolute -right-16 top-10 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-cyan-400/8 blur-3xl" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}