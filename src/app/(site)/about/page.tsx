import Image from "next/image";
const leadershipMembers = [
  {
    nickname: "Berry",
    realName: "Daryll Pagsolingan",
    role: "Chief Executive Director",
    discord: "frdaphilippines",
    email: "official@frdaph.org",
    roblox: "",
  },
  {
    nickname: "Chace",
    realName: "Grace Pan",
    role: "Vice Executive Director and Head of ICT",
    discord: "chace_space",
    email: "admin@frdaph.org",
    roblox: "mad_vyntra",
  },
  {
    nickname: "Lord Vesper/Ari",
    realName: "Airelle Anne Nabuya",
    role: "Secretary and External Affairs",
    discord: "limbusemployer",
    email: "communications@frdaph.org",
    roblox: "09redlemon",
  },
];

const officerMembers = [
  {
    nickname: "Meru",
    realName: "Marcus Alejandro Y. Icalina",
    role: "External Affairs",
    discord: "meruisms",
    roblox: "Mar_Cause",
  },
  {
    nickname: "Oreo",
    realName: "Ron Harixx Gevera",
    role: "HRD SA",
    discord: "ro.0397_03790",
    roblox: "RONX23ron",
  },
  {
    nickname: "L11_hakari",
    realName: "Darius Sebastian Quitangon",
    role: "HRD RS",
    discord: "hakarimeow",
    roblox: "Hakari_sarashina24",
  },
  {
    nickname: "Astriel",
    realName: "John Noriel Peralta",
    role: "PIED EA",
    discord: "xvastriel",
    roblox: "VenomNLR",
  },
];


function DiscordIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 127.14 96.36"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83A97.68 97.68 0 0 0 49 6.83 72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.71 56.6.54 80.21h0A105.73 105.73 0 0 0 32.71 96.36a77.7 77.7 0 0 0 6.89-11.18 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.04a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2.04a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.17A105.25 105.25 0 0 0 126.6 80.22c2.64-27.29-4.5-51-18.9-72.15ZM42.45 65.69C36.18 65.69 31 59.93 31 52.85s5-12.84 11.45-12.84 11.57 5.81 11.46 12.84c0 7.08-5.08 12.84-11.46 12.84Zm42.24 0c-6.27 0-11.45-5.76-11.45-12.84S78.27 40 84.69 40s11.56 5.81 11.45 12.84c0 7.08-5.06 12.84-11.45 12.84Z" />
    </svg>
  );
}

export default function AboutPage() {
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

        <div className="relative mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-28">
          <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch lg:gap-16">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-[5px] bg-blue-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
                Who we are
              </p>

              <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-[1.12] text-white md:text-[46px]">
                About FRDA
              </h1>

              <div className="mt-5 max-w-2xl text-[25px] font-semibold leading-[1.24] text-blue-100 md:text-[30px]">
                <p>Stronger representation.</p>
                <p>Responsible development.</p>
                <p>Meaningful opportunities.</p>
              </div>

              <div className="mt-8 max-w-2xl space-y-5 text-[15px] leading-8 text-zinc-300 md:text-base">
                <p>
                  The Filipino Roblox Developers Association exists to support
                  stronger representation, responsible development, and
                  meaningful opportunities for Filipino Roblox developers.
                </p>

                <p>
                  We believe Roblox development deserves to be taken seriously —
                  not only as a creative outlet, but as a space where design,
                  scripting, digital citizenship, and real technical skill come
                  together.
                </p>

                <p>
                  FRDA was created to help address a gap many developers have
                  long felt. Talent exists, but the community has often been
                  scattered, underrepresented, and left out of larger
                  conversations that affect the ecosystem. Our role is to help
                  change that by bringing people together, encouraging higher
                  standards, and helping developer perspectives be heard.
                </p>

                <p>
                  We aim to serve as a thoughtful bridge between the community
                  and the wider public — including partners, institutions, and
                  stakeholders looking for a more grounded understanding of the
                  Roblox space in the Philippines.
                </p>

                <p>
                  At our core, we value integrity, responsibility,
                  professionalism, and accountability. We want to help build a
                  developer community that is not only creative, but also
                  credible, constructive, and ready to grow.
                </p>
              </div>
            </div>

            <div className="relative min-h-[340px] md:min-h-[460px] lg:h-full lg:min-h-[820px]">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_40%,rgba(59,130,246,0.22),transparent_30%),radial-gradient(circle_at_50%_76%,rgba(59,130,246,0.18),transparent_18%),linear-gradient(180deg,rgba(4,17,42,0.25)_0%,rgba(4,17,42,0.05)_30%,rgba(4,17,42,0.22)_100%)]" />

                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,21,53,0.45)_0%,rgba(3,11,24,0.18)_35%,rgba(3,11,24,0)_60%)]" />

                <div className="absolute inset-x-[6%] bottom-0 h-[56%] bg-[linear-gradient(to_top,rgba(59,130,246,0.07),transparent_48%)]" />

                <div className="absolute inset-0 opacity-60">
                  <div className="absolute inset-x-[8%] bottom-0 top-[18%] bg-[linear-gradient(to_right,rgba(59,130,246,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.08)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,transparent_0%,black_16%,black_88%,transparent_100%)]" />
                </div>

                <div className="absolute inset-x-[7%] bottom-0 h-[48%] [perspective:900px]">
                  <div className="absolute inset-0 origin-bottom rotate-x-[72deg] bg-[linear-gradient(to_right,rgba(59,130,246,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.16)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_top,black_0%,black_55%,transparent_100%)]" />
                </div>

                <div className="absolute bottom-[18%] left-[16%] h-[1px] w-[28%] rotate-[28deg] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                <div className="absolute bottom-[18%] right-[14%] h-[1px] w-[26%] -rotate-[24deg] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

                <div className="absolute bottom-[10%] left-[20%] h-2 w-2 rounded-full bg-blue-400/90 shadow-[0_0_18px_rgba(96,165,250,0.9)]" />
                <div className="absolute bottom-[24%] left-[10%] h-2 w-2 rounded-full bg-blue-400/85 shadow-[0_0_18px_rgba(96,165,250,0.85)]" />
                <div className="absolute top-[22%] left-[26%] h-2 w-2 rounded-full bg-blue-400/90 shadow-[0_0_18px_rgba(96,165,250,0.9)]" />
                <div className="absolute top-[12%] right-[12%] h-2 w-2 rounded-full bg-blue-400/85 shadow-[0_0_18px_rgba(96,165,250,0.85)]" />
                <div className="absolute top-[24%] right-[6%] h-1.5 w-1.5 rounded-full bg-blue-400/80 shadow-[0_0_16px_rgba(96,165,250,0.8)]" />

                <div className="absolute bottom-0 left-[14%] h-[54%] w-px bg-gradient-to-t from-blue-400/0 via-blue-400/25 to-blue-400/70" />
                <div className="absolute bottom-0 left-[18%] h-[76%] w-px bg-gradient-to-t from-blue-400/0 via-blue-400/15 to-blue-400/45" />
                <div className="absolute bottom-0 left-[22%] h-[46%] w-px bg-gradient-to-t from-blue-400/0 via-blue-400/12 to-blue-400/30" />

                <div className="absolute bottom-0 right-[10%] h-[80%] w-px bg-gradient-to-t from-blue-400/0 via-blue-400/18 to-blue-400/65" />
                <div className="absolute bottom-0 right-[15%] h-[60%] w-px bg-gradient-to-t from-blue-400/0 via-blue-400/14 to-blue-400/42" />
                <div className="absolute bottom-0 right-[19%] h-[40%] w-px bg-gradient-to-t from-blue-400/0 via-blue-400/10 to-blue-400/28" />

                <div className="absolute bottom-0 left-[14%] h-[17%] w-[10%] border-l border-t border-blue-400/22" />
                <div className="absolute bottom-0 left-[18%] h-[30%] w-[12%] border-l border-t border-blue-400/14" />
                <div className="absolute bottom-0 left-[22%] h-[10%] w-[9%] border-l border-t border-blue-400/10" />

                <div className="absolute bottom-0 right-[10%] h-[28%] w-[11%] border-r border-t border-blue-400/18" />
                <div className="absolute bottom-0 right-[15%] h-[17%] w-[9%] border-r border-t border-blue-400/12" />
                <div className="absolute bottom-0 right-[19%] h-[8%] w-[7%] border-r border-t border-blue-400/10" />
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-[10%] md:pt-[8%] lg:pt-[6%]">
                <div className="relative h-[240px] w-[240px] md:h-[340px] md:w-[340px] lg:h-[460px] lg:w-[460px]">
                  <div className="absolute inset-0 rounded-full bg-blue-500/15 blur-3xl" />
                  <div className="absolute inset-[18%] rounded-full bg-blue-400/10 blur-2xl" />
                  <Image
                    src="/frda-logo.png"
                    alt="FRDA logo watermark"
                    fill
                    className="object-contain opacity-[0.12] blur-[0.2px] saturate-0 brightness-[1.35]"
                    priority
                  />
                </div>
              </div>


            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[linear-gradient(180deg,#04112a_0%,#030b18_100%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-blue-400/10" />
        <div className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

        <div className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-[5px] bg-blue-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200">
              Our team
            </p>

            <h2 className="mt-5 text-3xl font-semibold leading-[1.12] text-white md:text-[40px]">
              The people helping carry FRDA forward
            </h2>

            <p className="mt-5 max-w-3xl text-[15px] leading-8 text-zinc-300 md:text-base">
              The following team members currently support FRDA’s leadership,
              outreach, and coordination efforts. Public-facing names are included
              because these are often the names our representatives are known by
              across Roblox and Discord communities.
            </p>
          </div>

          <div className="mt-12">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">
              Leadership
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {leadershipMembers.map((member, index) => (
                <div
                  key={`${member.nickname}-${member.discord}-${index}`}
                  className="relative overflow-hidden rounded-[8px] border border-blue-300/14 bg-[#071327]/78 px-5 py-4"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-300/80 to-transparent" />

                  <h3 className="text-[18px] font-semibold leading-tight text-white md:text-[19px]">
                    {member.nickname}
                  </h3>

                  <p className="mt-1 text-[12px] text-zinc-500 md:text-[13px]">
                    {member.realName}
                  </p>

                  <p className="mt-3 text-sm font-medium leading-6 text-zinc-200">
                    {member.role}
                  </p>

                  <div className="mt-4 space-y-1.5 text-sm leading-6 text-zinc-300">
                    <p className="break-all">{member.email}</p>

                    <div className="flex items-start gap-2 text-blue-100/90">
                      <DiscordIcon className="mt-[4px] h-[14px] w-[14px] shrink-0 text-blue-200/70" />
                      <p className="break-all">{member.discord}</p>
                    </div>

                    {/*
              <p className="break-all text-zinc-400">{member.roblox}</p>
              */}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/80">
              Officers
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {officerMembers.map((member, index) => (
                <div
                  key={`${member.nickname}-${member.discord || member.realName}-${index}`}
                  className="relative overflow-hidden rounded-[8px] border border-blue-400/12 bg-[#071327]/72 px-5 py-4"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/35 to-transparent" />

                  <h3 className="text-[18px] font-semibold leading-tight text-white md:text-[19px]">
                    {member.nickname}
                  </h3>

                  <p className="mt-1 text-[12px] text-zinc-500 md:text-[13px]">
                    {member.realName}
                  </p>

                  <p className="mt-3 text-sm font-medium leading-6 text-zinc-200">
                    {member.role}
                  </p>

                  <div className="mt-4 space-y-1.5 text-sm leading-6 text-zinc-300">
                    {member.discord ? (
                      <div className="flex items-start gap-2 text-blue-100/90">
                        <DiscordIcon className="mt-[4px] h-[14px] w-[14px] shrink-0 text-blue-200/70" />
                        <p className="break-all">{member.discord}</p>
                      </div>
                    ) : null}

                    {/*
              <p className="break-all text-zinc-400">{member.roblox}</p>
              */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}