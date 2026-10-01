import path from "node:path";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { IS_CLOUD, paths } from "../constants";
import { db } from "../db";
import type {
	createScheduleSchema,
	updateScheduleSchema,
} from "../db/schema/schedule";
import { type Schedule, schedules } from "../db/schema/schedule";
import { encodeBase64 } from "../utils/docker/utils";
import { execAsync, execAsyncRemote } from "../utils/process/execAsync";
import { findMemberByUserId } from "./permission";
import { findServerById } from "./server";

export type ScheduleExtended = Awaited<ReturnType<typeof findScheduleById>>;

// Host-level schedules (server / dokploy-server) run their script as root on the
// host and must stay restricted to owners/admins, regardless of whether the
// request is also tied to a service. Attaching an accessible applicationId must
// not downgrade this to a service-access check.
export const assertHostScheduleAccess = async (
	ctx: { user: { id: string }; session: { activeOrganizationId: string } },
	scheduleType: Schedule["scheduleType"] | null | undefined,
	serverId: string | null | undefined,
	// Pass the stored organizationId when checking an existing schedule so
	// host-level schedules of other organizations stay out of reach.
	organizationId?: string | null,
) => {
	if (scheduleType !== "server" && scheduleType !== "dokploy-server") return;

	if (scheduleType === "dokploy-server" && IS_CLOUD) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Host-level schedules are not available in the cloud version.",
		});
	}

	const member = await findMemberByUserId(
		ctx.user.id,
		ctx.session.activeOrganizationId,
	);
	if (member.role !== "owner" && member.role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only owners and admins can manage server-level schedules.",
		});
	}

	if (scheduleType === "server" && serverId) {
		const targetServer = await findServerById(serverId);
		if (targetServer.organizationId !== ctx.session.activeOrganizationId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "You don't have access to this server.",
			});
		}
	}

	if (
		scheduleType === "dokploy-server" &&
		organizationId !== undefined &&
		organizationId !== ctx.session.activeOrganizationId
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "You don't have access to this schedule.",
		});
	}
};

// Only keep the target id that matches the schedule type. Permission checks run
// against that id, so a second, unchecked id (e.g. someone else's composeId next
// to an accessible applicationId) must never reach the database.
export const normalizeScheduleTarget = <
	T extends z.infer<typeof createScheduleSchema>,
>(
	input: T,
): T => {
	const scheduleType = input.scheduleType ?? "application";
	const target = {
		applicationId: scheduleType === "application" ? input.applicationId : null,
		composeId: scheduleType === "compose" ? input.composeId : null,
		serverId: scheduleType === "server" ? input.serverId : null,
	};
	const required = {
		application: target.applicationId,
		compose: target.composeId,
		server: target.serverId,
		"dokploy-server": "host",
	}[scheduleType];

	if (!required) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `A ${scheduleType} schedule needs a matching target id.`,
		});
	}

	return { ...input, ...target, scheduleType };
};

export const createSchedule = async (
	input: z.infer<typeof createScheduleSchema> & {
		organizationId?: string | null;
	},
) => {
	const { scheduleId, ...rest } = input;
	const [newSchedule] = await db
		.insert(schedules)
		.values(rest as typeof schedules.$inferInsert)
		.returning();

	if (
		newSchedule &&
		(newSchedule.scheduleType === "dokploy-server" ||
			newSchedule.scheduleType === "server")
	) {
		await handleScript(newSchedule);
	}

	return newSchedule;
};

export const findScheduleById = async (scheduleId: string) => {
	const schedule = await db.query.schedules.findFirst({
		where: eq(schedules.scheduleId, scheduleId),
		with: {
			application: {
				columns: {
					applicationId: true,
					appName: true,
					serverId: true,
				},
				with: {
					environment: {
						with: {
							project: true,
						},
					},
				},
			},
			compose: {
				with: {
					environment: {
						with: {
							project: true,
						},
					},
				},
			},
			server: {
				with: {
					organization: true,
				},
			},
		},
	});

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Schedule not found",
		});
	}
	return schedule;
};

export const findScheduleOrganizationId = async (scheduleId: string) => {
	const schedule = await findScheduleById(scheduleId);

	if (schedule?.application) {
		return schedule?.application?.environment?.project?.organizationId;
	}
	if (schedule?.compose) {
		return schedule?.compose?.environment?.project?.organizationId;
	}
	if (schedule?.server) {
		return schedule?.server?.organization?.id;
	}
	if (schedule?.organizationId) {
		return schedule.organizationId;
	}
	return null;
};

export const deleteSchedule = async (scheduleId: string) => {
	const schedule = await findScheduleById(scheduleId);
	const serverId =
		schedule?.serverId ||
		schedule?.application?.serverId ||
		schedule?.compose?.serverId;
	const { SCHEDULES_PATH } = paths(!!serverId);

	const fullPath = path.join(SCHEDULES_PATH, schedule?.appName || "");
	const command = `rm -rf ${fullPath}`;
	if (serverId) {
		await execAsyncRemote(serverId, command);
	} else {
		await execAsync(command);
	}

	const scheduleResult = await db
		.delete(schedules)
		.where(eq(schedules.scheduleId, scheduleId));
	if (!scheduleResult) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Schedule not found",
		});
	}

	return true;
};

export const updateSchedule = async (
	input: z.infer<typeof updateScheduleSchema>,
) => {
	const { scheduleId, ...rest } = input;
	const [updatedSchedule] = await db
		.update(schedules)
		.set(rest as Partial<typeof schedules.$inferInsert>)
		.where(eq(schedules.scheduleId, scheduleId))
		.returning();

	if (!updatedSchedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Schedule not found",
		});
	}

	if (
		updatedSchedule?.scheduleType === "dokploy-server" ||
		updatedSchedule?.scheduleType === "server"
	) {
		await handleScript(updatedSchedule);
	}

	return updatedSchedule;
};

const handleScript = async (schedule: Schedule) => {
	const { SCHEDULES_PATH } = paths(!!schedule?.serverId);
	const fullPath = path.join(SCHEDULES_PATH, schedule?.appName || "");

	// Add PID and Schedule ID echo by default to all scripts
	const scriptWithPid = `echo "PID: $$ | Schedule ID: ${schedule.scheduleId}"
${schedule?.script || ""}`;

	const encodedContent = encodeBase64(scriptWithPid);
	const script = `
	 	 mkdir -p ${fullPath}
	 	 rm -f ${fullPath}/script.sh
		 touch ${fullPath}/script.sh
		 chmod +x ${fullPath}/script.sh
		 echo "${encodedContent}" | base64 -d > ${fullPath}/script.sh
	`;

	if (schedule?.scheduleType === "dokploy-server") {
		await execAsync(script);
	} else if (schedule?.scheduleType === "server") {
		await execAsyncRemote(schedule?.serverId || "", script);
	}
};
