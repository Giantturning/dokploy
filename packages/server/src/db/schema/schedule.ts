import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { applications } from "./application";
import { compose } from "./compose";
import { deployments } from "./deployment";
import { server } from "./server";
import { generateAppName } from "./utils";
export const shellTypes = pgEnum("shellType", ["bash", "sh"]);

export const scheduleType = pgEnum("scheduleType", [
	"application",
	"compose",
	"server",
	"dokploy-server",
]);

export const schedules = pgTable("schedule", {
	scheduleId: text("scheduleId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	description: text("description"),
	cronExpression: text("cronExpression").notNull(),
	appName: text("appName")
		.notNull()
		.$defaultFn(() => generateAppName("schedule")),
	serviceName: text("serviceName"),
	shellType: shellTypes("shellType").notNull().default("bash"),
	scheduleType: scheduleType("scheduleType").notNull().default("application"),
	command: text("command").notNull(),
	script: text("script"),
	applicationId: text("applicationId").references(
		() => applications.applicationId,
		{
			onDelete: "cascade",
		},
	),
	composeId: text("composeId").references(() => compose.composeId, {
		onDelete: "cascade",
	}),
	serverId: text("serverId").references(() => server.serverId, {
		onDelete: "cascade",
	}),
	organizationId: text("organizationId").references(() => organization.id, {
		onDelete: "cascade",
	}),
	enabled: boolean("enabled").notNull().default(true),
	timezone: text("timezone"),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export type Schedule = typeof schedules.$inferSelect;
export type ScheduleType = Schedule["scheduleType"];

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
	application: one(applications, {
		fields: [schedules.applicationId],
		references: [applications.applicationId],
	}),
	compose: one(compose, {
		fields: [schedules.composeId],
		references: [compose.composeId],
	}),
	server: one(server, {
		fields: [schedules.serverId],
		references: [server.serverId],
	}),
	organization: one(organization, {
		fields: [schedules.organizationId],
		references: [organization.id],
	}),
	deployments: many(deployments),
}));

// appName is interpolated into shell commands and organizationId is derived from
// the session, so neither may be supplied by the client.
export const createScheduleSchema = createInsertSchema(schedules, {
	scheduleType: z.enum(["application", "compose", "server", "dokploy-server"]),
}).omit({
	appName: true,
	organizationId: true,
	createdAt: true,
});

// The target of a schedule (service / server) is fixed after creation, otherwise
// a schedule could be re-pointed at a resource the caller was never checked for.
export const updateScheduleSchema = createScheduleSchema
	.omit({
		applicationId: true,
		composeId: true,
		serverId: true,
	})
	.extend({
		scheduleId: z.string().min(1),
	});
