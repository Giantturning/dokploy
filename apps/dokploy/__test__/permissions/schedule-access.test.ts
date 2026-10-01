import { beforeEach, describe, expect, it, vi } from "vitest";

let memberRole = "admin";

vi.mock("@dokploy/server/db", () => ({ db: {} }));

vi.mock("@dokploy/server/services/permission", () => ({
	findMemberByUserId: vi.fn(() => Promise.resolve({ role: memberRole })),
}));

vi.mock("@dokploy/server/services/server", () => ({
	findServerById: vi.fn((serverId: string) =>
		Promise.resolve({
			serverId,
			organizationId: serverId === "server-org-1" ? "org-1" : "org-2",
		}),
	),
}));

const { createScheduleSchema, updateScheduleSchema } = await import(
	"@dokploy/server/db/schema/schedule"
);
const { assertHostScheduleAccess, normalizeScheduleTarget } = await import(
	"@dokploy/server/services/schedule"
);

const ctx = {
	user: { id: "user-1" },
	session: { activeOrganizationId: "org-1" },
};

const baseInput = {
	name: "job",
	cronExpression: "* * * * *",
	command: "echo hi",
};

describe("schedule input schemas", () => {
	it("drops client supplied appName and organizationId on create", () => {
		const parsed = createScheduleSchema.parse({
			...baseInput,
			scheduleType: "application",
			applicationId: "app-1",
			appName: "x; id",
			organizationId: "org-2",
		});
		expect(parsed).not.toHaveProperty("appName");
		expect(parsed).not.toHaveProperty("organizationId");
	});

	it("does not allow re-targeting a schedule on update", () => {
		const parsed = updateScheduleSchema.parse({
			...baseInput,
			scheduleId: "schedule-1",
			applicationId: "app-2",
			composeId: "compose-2",
			serverId: "server-2",
			appName: "../../etc",
		});
		expect(parsed).not.toHaveProperty("applicationId");
		expect(parsed).not.toHaveProperty("composeId");
		expect(parsed).not.toHaveProperty("serverId");
		expect(parsed).not.toHaveProperty("appName");
	});
});

describe("normalizeScheduleTarget", () => {
	it("keeps only the id matching the schedule type", () => {
		const result = normalizeScheduleTarget({
			...baseInput,
			scheduleType: "compose",
			applicationId: "my-app",
			composeId: "compose-1",
			serverId: "server-1",
		});
		expect(result.applicationId).toBeNull();
		expect(result.serverId).toBeNull();
		expect(result.composeId).toBe("compose-1");
	});

	it("rejects a compose schedule that only carries an applicationId", () => {
		expect(() =>
			normalizeScheduleTarget({
				...baseInput,
				scheduleType: "compose",
				applicationId: "my-app",
			}),
		).toThrow();
	});

	it("rejects a server schedule without serverId", () => {
		expect(() =>
			normalizeScheduleTarget({ ...baseInput, scheduleType: "server" }),
		).toThrow();
	});

	it("accepts a dokploy-server schedule without target ids", () => {
		const result = normalizeScheduleTarget({
			...baseInput,
			scheduleType: "dokploy-server",
			applicationId: "my-app",
		});
		expect(result.applicationId).toBeNull();
	});
});

describe("assertHostScheduleAccess", () => {
	beforeEach(() => {
		memberRole = "admin";
	});

	it("ignores service schedules", async () => {
		memberRole = "member";
		await expect(
			assertHostScheduleAccess(ctx, "application", null),
		).resolves.toBeUndefined();
	});

	it("rejects members for host schedules", async () => {
		memberRole = "member";
		await expect(
			assertHostScheduleAccess(ctx, "dokploy-server", null, "org-1"),
		).rejects.toThrow();
	});

	it("allows admins on host schedules of their organization", async () => {
		await expect(
			assertHostScheduleAccess(ctx, "dokploy-server", null, "org-1"),
		).resolves.toBeUndefined();
	});

	it("rejects host schedules of another organization", async () => {
		await expect(
			assertHostScheduleAccess(ctx, "dokploy-server", null, "org-2"),
		).rejects.toThrow("You don't have access to this schedule.");
	});

	it("rejects host schedules without organization", async () => {
		await expect(
			assertHostScheduleAccess(ctx, "dokploy-server", null, null),
		).rejects.toThrow();
	});

	it("rejects servers of another organization", async () => {
		await expect(
			assertHostScheduleAccess(ctx, "server", "server-org-2"),
		).rejects.toThrow("You don't have access to this server.");
		await expect(
			assertHostScheduleAccess(ctx, "server", "server-org-1"),
		).resolves.toBeUndefined();
	});
});
