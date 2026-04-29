export type MeetingPollStatus = "open" | "finalized" | "cancelled";

export type MeetingInvitedMember = {
  discordUserId: string;
  displayName: string;
};

export type MeetingSlot = {
  id: string;
  date: string;
  time: string;
};

export type MeetingPoll = {
  id: string;
  title: string;
  description?: string;
  timezone: string;
  slots?: MeetingSlot[];
  dateOptions?: string[];
  timeOptions?: string[];
  deadline?: any;
  status: MeetingPollStatus;
  finalSlotId?: string | null;
  invitedMembers: MeetingInvitedMember[];
  targetRoleName?: string;
  createdAt?: any;
  updatedAt?: any;
  createdByEmail?: string;
  createdByName?: string;
};

export type MeetingPollResponse = {
  id: string;
  pollId: string;
  discordUserId: string;
  displayName: string;
  availability: Record<string, boolean>;
  submittedAt?: any;
  updatedAt?: any;
};

export type MeetingToken = {
  id: string;
  pollId: string;
  discordUserId: string;
  displayName: string;
  token: string;
  createdAt?: any;
  expiresAt?: any;
};

export type SlotScore = {
  slotId: string;
  date: string;
  time: string;
  label: string;
  availableCount: number;
  unavailableCount: number;
  noResponseCount: number;
  totalInvited: number;
  availableMembers: MeetingInvitedMember[];
  unavailableMembers: MeetingInvitedMember[];
  noResponseMembers: MeetingInvitedMember[];
  matchLabel: "Perfect match" | "Strong match" | "Possible" | "Weak match";
};

export function createSlotId(date: string, time: string) {
  return `${date}__${time}`;
}

export function parseSlotId(slotId: string) {
  const [date, time] = slotId.split("__");

  return {
    date: date || "",
    time: time || "",
  };
}

export function buildSlotsFromDateTimeRows(
  rows: {
    date: string;
    times: string[];
  }[]
): MeetingSlot[] {
  const slots: MeetingSlot[] = [];
  const usedSlotIds = new Set<string>();

  rows.forEach((row) => {
    const cleanDate = row.date.trim();

    if (!cleanDate) return;

    row.times.forEach((time) => {
      const cleanTime = time.trim();

      if (!cleanTime) return;

      const id = createSlotId(cleanDate, cleanTime);

      if (usedSlotIds.has(id)) return;

      usedSlotIds.add(id);

      slots.push({
        id,
        date: cleanDate,
        time: cleanTime,
      });
    });
  });

  return slots;
}

export function buildSlotIds(dateOptions: string[], timeOptions: string[]) {
  const slots: string[] = [];

  dateOptions.forEach((date) => {
    timeOptions.forEach((time) => {
      slots.push(createSlotId(date, time));
    });
  });

  return slots;
}

export function getMeetingSlots({
  slots,
  dateOptions,
  timeOptions,
}: {
  slots?: MeetingSlot[];
  dateOptions?: string[];
  timeOptions?: string[];
}) {
  if (slots && slots.length > 0) {
    return slots;
  }

  return buildSlotIds(dateOptions || [], timeOptions || []).map((slotId) => {
    const { date, time } = parseSlotId(slotId);

    return {
      id: slotId,
      date,
      time,
    };
  });
}

export function formatDateLabel(date: string) {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeLabel(time: string) {
  if (!time) return "—";

  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw || "0");

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return time;
  }

  const parsed = new Date();
  parsed.setHours(hour, minute, 0, 0);

  return parsed.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSlotLabel(slotId: string) {
  const { date, time } = parseSlotId(slotId);

  return `${formatDateLabel(date)} at ${formatTimeLabel(time)}`;
}

export function getMatchLabel(availableCount: number, totalInvited: number) {
  if (totalInvited <= 0) return "Weak match";

  const ratio = availableCount / totalInvited;

  if (ratio === 1) return "Perfect match";
  if (ratio >= 0.75) return "Strong match";
  if (ratio >= 0.5) return "Possible";
  return "Weak match";
}

export function calculateMeetingOverlaps({
  invitedMembers,
  responses,
  slots,
  dateOptions,
  timeOptions,
}: {
  invitedMembers: MeetingInvitedMember[];
  responses: MeetingPollResponse[];
  slots?: MeetingSlot[];
  dateOptions?: string[];
  timeOptions?: string[];
}) {
  const responseByDiscordUserId = new Map<string, MeetingPollResponse>();

  responses.forEach((response) => {
    responseByDiscordUserId.set(response.discordUserId, response);
  });

  const pollSlots = getMeetingSlots({
    slots,
    dateOptions,
    timeOptions,
  });

  const rankedSlots: SlotScore[] = pollSlots.map((slot) => {
    const availableMembers: MeetingInvitedMember[] = [];
    const unavailableMembers: MeetingInvitedMember[] = [];
    const noResponseMembers: MeetingInvitedMember[] = [];

    invitedMembers.forEach((member) => {
      const response = responseByDiscordUserId.get(member.discordUserId);

      if (!response) {
        noResponseMembers.push(member);
        return;
      }

      if (response.availability?.[slot.id]) {
        availableMembers.push(member);
      } else {
        unavailableMembers.push(member);
      }
    });

    return {
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      label: formatSlotLabel(slot.id),
      availableCount: availableMembers.length,
      unavailableCount: unavailableMembers.length,
      noResponseCount: noResponseMembers.length,
      totalInvited: invitedMembers.length,
      availableMembers,
      unavailableMembers,
      noResponseMembers,
      matchLabel: getMatchLabel(availableMembers.length, invitedMembers.length),
    };
  });

  rankedSlots.sort((a, b) => {
    if (b.availableCount !== a.availableCount) {
      return b.availableCount - a.availableCount;
    }

    if (a.noResponseCount !== b.noResponseCount) {
      return a.noResponseCount - b.noResponseCount;
    }

    return a.slotId.localeCompare(b.slotId);
  });

  const submittedDiscordUserIds = new Set(
    responses.map((response) => response.discordUserId)
  );

  const submittedMembers = invitedMembers.filter((member) =>
    submittedDiscordUserIds.has(member.discordUserId)
  );

  const waitingMembers = invitedMembers.filter(
    (member) => !submittedDiscordUserIds.has(member.discordUserId)
  );

  return {
    rankedSlots,
    submittedMembers,
    waitingMembers,
    bestSlot: rankedSlots[0] || null,
  };
}

export function parseInvitedMembersInput(value: string) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const members: MeetingInvitedMember[] = [];
  const errors: string[] = [];
  const usedIds = new Set<string>();

  lines.forEach((line, index) => {
    const parts = line
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      errors.push(
        `Line ${index + 1} needs this format: Display Name | Discord User ID`
      );
      return;
    }

    const displayName = parts[0];
    const discordUserId = parts[1];

    if (!displayName) {
      errors.push(`Line ${index + 1} is missing a display name.`);
      return;
    }

    if (!discordUserId) {
      errors.push(`Line ${index + 1} is missing a Discord user ID.`);
      return;
    }

    if (usedIds.has(discordUserId)) {
      errors.push(`Line ${index + 1} has a duplicate Discord user ID.`);
      return;
    }

    usedIds.add(discordUserId);

    members.push({
      displayName,
      discordUserId,
    });
  });

  return {
    members,
    errors,
  };
}

export function normalizeDateOptions(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeTimeOptions(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createMeetingToken() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
}

export function getMemberResponseId(pollId: string, discordUserId: string) {
  return `${pollId}_${discordUserId}`;
}

export function getMemberTokenId(pollId: string, discordUserId: string) {
  return `${pollId}_${discordUserId}`;
}