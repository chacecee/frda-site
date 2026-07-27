import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizeAdminRequest } from "@/lib/server/adminAuthorization";
import { createSlotId } from "@/lib/meetingPolls";

type MeetingSlot = {
    id: string;
    date: string;
    time: string;
};

type DiscordGuildMember = {
    user?: {
        id?: string;
        username?: string;
        global_name?: string | null;
        bot?: boolean;
    };
    nick?: string | null;
    roles?: string[];
};

type InvitedMember = {
    discordUserId: string;
    displayName: string;
};

type FailedDmMember = InvitedMember & {
    url: string;
    error: string;
};

function getDisplayName(
    member: DiscordGuildMember
) {
    return (
        member.nick?.trim() ||
        member.user?.global_name?.trim() ||
        member.user?.username?.trim() ||
        "Member"
    );
}

function createMeetingToken() {
    return randomBytes(24).toString("hex");
}

function getMemberTokenId(
    pollId: string,
    discordUserId: string
) {
    return `${pollId}_${discordUserId}`;
}

async function discordFetch(path: string, init?: RequestInit) {
    const token = process.env.DISCORD_SCHEDULER_BOT_TOKEN;

    if (!token) {
        throw new Error("Missing DISCORD_SCHEDULER_BOT_TOKEN.");
    }

    return fetch(`https://discord.com/api/v10${path}`, {
        ...init,
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });
}

async function fetchMeetingRoleMembers() {
    const guildId = process.env.DISCORD_GUILD_ID;
    const roleId = process.env.DISCORD_MEETING_ROLE_ID;

    if (!guildId || !roleId) {
        throw new Error("Missing Discord guild or meeting role environment variables.");
    }

    const members: DiscordGuildMember[] = [];
    let after = "";

    for (let page = 0; page < 10; page += 1) {
        const url = `/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ""
            }`;

        const response = await discordFetch(url, {
            method: "GET",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            console.error("Discord role member fetch failed:", data);
            throw new Error(data?.message || "Could not fetch Discord role members.");
        }

        const batch = Array.isArray(data) ? (data as DiscordGuildMember[]) : [];

        members.push(...batch);

        if (batch.length < 1000) break;

        const lastUserId = batch[batch.length - 1]?.user?.id;
        if (!lastUserId) break;

        after = lastUserId;
    }

    const roleMembers = members
        .filter((member) => {
            const userId = member.user?.id;
            const isBot = Boolean(member.user?.bot);
            const hasRole = member.roles?.includes(roleId);

            return Boolean(userId) && !isBot && hasRole;
        })
        .map((member) => ({
            discordUserId: member.user?.id || "",
            displayName: getDisplayName(member),
        }))
        .filter((member) => member.discordUserId);

    const uniqueMembers = new Map<string, InvitedMember>();

    roleMembers.forEach((member) => {
        uniqueMembers.set(member.discordUserId, member);
    });

    return Array.from(uniqueMembers.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
    );
}

async function createDmChannel(discordUserId: string) {
    const response = await discordFetch("/users/@me/channels", {
        method: "POST",
        body: JSON.stringify({
            recipient_id: discordUserId,
        }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message || "Could not open DM channel.");
    }

    return data?.id as string;
}

async function sendDiscordMessage(channelId: string, body: Record<string, any>) {
    const response = await discordFetch(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        console.error("Discord message failed:", data);
        throw new Error(data?.message || "Could not send Discord message.");
    }

    return data;
}

export async function POST(request: NextRequest) {
    try {
        const authorization = await authorizeAdminRequest(
            request,
            undefined,
            true
        );

        if (!authorization.ok) {
            return authorization.response;
        }

        const channelId = process.env.DISCORD_MEETING_CHANNEL_ID;
        const roleId = process.env.DISCORD_MEETING_ROLE_ID;

        if (!channelId || !roleId) {
            return NextResponse.json(
                { error: "Missing Discord meeting channel or role environment variables." },
                { status: 500 }
            );
        }

        const body = await request.json();

        const title = typeof body.title === "string" ? body.title.trim() : "";
        const description =
            typeof body.description === "string" ? body.description.trim() : "";
        const slots = Array.isArray(body.slots) ? (body.slots as MeetingSlot[]) : [];
        const deadlineIso =
            typeof body.deadlineIso === "string" ? body.deadlineIso.trim() : "";

        if (!title) {
            return NextResponse.json(
                { error: "Please add a meeting title." },
                { status: 400 }
            );
        }

        const usedSlotIds = new Set<string>();

        const cleanSlots = slots
            .map((slot) => {
                const date = String(slot.date || "").trim();
                const time = String(slot.time || "").trim();

                return {
                    id: createSlotId(date, time),
                    date,
                    time,
                };
            })
            .filter((slot) => {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) return false;
                if (!/^\d{2}:\d{2}$/.test(slot.time)) return false;
                if (usedSlotIds.has(slot.id)) return false;

                const slotDate = new Date(`${slot.date}T${slot.time}:00+08:00`);

                if (
                    Number.isNaN(slotDate.getTime()) ||
                    slotDate.getTime() <= Date.now()
                ) {
                    return false;
                }

                usedSlotIds.add(slot.id);
                return true;
            })
            .slice(0, 100);

        if (cleanSlots.length === 0) {
            return NextResponse.json(
                { error: "Please add at least one date and time option." },
                { status: 400 }
            );
        }

        const deadlineDate = deadlineIso ? new Date(deadlineIso) : null;

        if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) {
            return NextResponse.json(
                { error: "Please add a valid response deadline." },
                { status: 400 }
            );
        }

        if (deadlineDate.getTime() < Date.now()) {
            return NextResponse.json(
                { error: "Please set the response deadline in the future." },
                { status: 400 }
            );
        }

        const invitedMembers = await fetchMeetingRoleMembers();

        if (invitedMembers.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "No members were found with the Meeting Participants role. Please check the role and bot permissions.",
                },
                { status: 400 }
            );
        }

        const pollRef = adminDb.collection("meetingPolls").doc();
        const siteUrl = (
            process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.SITE_URL ||
            request.nextUrl.origin
        ).replace(/\/$/, "");

        const linksByUserId = new Map<string, string>();
        const batch = adminDb.batch();

        batch.set(pollRef, {
            title,
            description,
            timezone: "Asia/Manila",
            slots: cleanSlots,
            deadline: Timestamp.fromDate(deadlineDate),
            status: "open",
            finalSlotId: null,
            invitedMembers,
            targetRoleId: roleId,
            targetRoleName: "Meeting Participants",
            discordMeetingChannelId: channelId,
            createdByUid: authorization.staff.uid,
            createdByEmail: authorization.staff.emailAddress,
            createdByName:
                authorization.staff.displayName ||
                authorization.staff.emailAddress,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        invitedMembers.forEach((member) => {
            const token = createMeetingToken();
            const tokenDocId = getMemberTokenId(pollRef.id, member.discordUserId);
            const tokenRef = adminDb.collection("meetingPollTokens").doc(tokenDocId);
            const url = `${siteUrl}/meeting/${pollRef.id}?token=${token}`;

            linksByUserId.set(member.discordUserId, url);

            batch.set(tokenRef, {
                pollId: pollRef.id,
                discordUserId: member.discordUserId,
                displayName: member.displayName,
                token,
                createdAt: Timestamp.now(),
                expiresAt: Timestamp.fromDate(deadlineDate),
            });
        });

        await batch.commit();

        const channelMessage = await sendDiscordMessage(channelId, {
            content: `<@&${roleId}>`,
            allowed_mentions: {
                roles: [roleId],
                parse: [],
            },
            embeds: [
                {
                    title: "📅 FRDA is checking meeting availability",
                    description: [
                        `**${title}**`,
                        description ? `\n${description}` : "",
                        "",
                        "Please expect a DM from **FRDA Scheduler** shortly with your private availability form.",
                        "",
                        `**Response deadline:** ${deadlineDate.toLocaleString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                        })}`,
                    ].join("\n"),
                    color: 3447003,
                    footer: {
                        text: "FRDA Scheduler",
                    },
                    timestamp: new Date().toISOString(),
                },
            ],
        });

        const failedDmMembers: FailedDmMember[] = [];
        let dmSentCount = 0;

        for (const member of invitedMembers) {
            const url = linksByUserId.get(member.discordUserId) || "";

            try {
                const dmChannelId = await createDmChannel(member.discordUserId);

                await sendDiscordMessage(dmChannelId, {
                    embeds: [
                        {
                            title: "📅 Submit your meeting availability",
                            description: [
                                `Hi ${member.displayName}, FRDA is checking availability for:`,
                                "",
                                `**${title}**`,
                                "",
                                "Please open your private availability form and select all times you are available.",
                            ].join("\n"),
                            color: 3447003,
                            footer: {
                                text: "FRDA Scheduler",
                            },
                            timestamp: new Date().toISOString(),
                        },
                    ],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 5,
                                    label: "Open Availability Form",
                                    url,
                                },
                            ],
                        },
                    ],
                });

                dmSentCount += 1;
            } catch (error) {
                console.error(`DM failed for ${member.displayName}:`, error);

                failedDmMembers.push({
                    ...member,
                    url,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Could not send this member a DM.",
                });
            }
        }

        await pollRef.set(
            {
                discordAvailabilityAnnouncementMessageId: channelMessage?.id || "",
                discordAvailabilityAnnouncementChannelId: channelId,
                discordAvailabilityDmSentCount: dmSentCount,
                discordAvailabilityDmFailedCount: failedDmMembers.length,
                discordAvailabilityDmFailedMembers: failedDmMembers.map((member) => ({
                    discordUserId: member.discordUserId,
                    displayName: member.displayName,
                    error: member.error,
                })),
                updatedAt: Timestamp.now(),
            },
            { merge: true }
        );

        return NextResponse.json({
            ok: true,
            pollId: pollRef.id,
            participantCount: invitedMembers.length,
            dmSentCount,
            failedDmMembers,
        });
    } catch (error) {
        console.error("Error creating Discord meeting poll:", error);

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not create the Discord meeting poll.",
            },
            { status: 500 }
        );
    }
}