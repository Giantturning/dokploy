import {
	findMariadbById,
	findMongoById,
	findMySqlById,
	findPostgresById,
	getAdminerStatus,
	startAdminer,
	stopAdminer,
} from "@dokploy/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const adminerRouter = createTRPCRouter({
	start: protectedProcedure
		.input(
			z.object({
				resourceId: z.string().min(1),
				type: z.enum(["postgres", "mysql", "mariadb", "mongo"]),
			}),
		)
		.mutation(async ({ input }) => {
			let host = "";
			let port = 5432;
			let user = "";
			let password = "";
			let database = "";
			let serverId: string | null = null;

			if (input.type === "postgres") {
				const db = await findPostgresById(input.resourceId);
				if (!db)
					throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
				host = db.appName;
				port = 5432;
				user = db.databaseUser;
				password = db.databasePassword;
				database = db.databaseName;
				serverId = db.serverId ?? null;
			} else if (input.type === "mysql") {
				const db = await findMySqlById(input.resourceId);
				if (!db)
					throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
				host = db.appName;
				port = 3306;
				user = db.databaseUser;
				password = db.databasePassword;
				database = db.databaseName;
				serverId = db.serverId ?? null;
			} else if (input.type === "mariadb") {
				const db = await findMariadbById(input.resourceId);
				if (!db)
					throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
				host = db.appName;
				port = 3306;
				user = db.databaseUser;
				password = db.databasePassword;
				database = db.databaseName;
				serverId = db.serverId ?? null;
			} else if (input.type === "mongo") {
				const db = await findMongoById(input.resourceId);
				if (!db)
					throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
				host = db.appName;
				port = 27017;
				user = db.databaseUser;
				password = db.databasePassword;
				database = db.databaseName;
				serverId = db.serverId ?? null;
			}

			const result = await startAdminer({
				type: input.type,
				host,
				port,
				user,
				password,
				database,
				serverId,
			});

			return { ...result, user, password, database };
		}),

	stop: protectedProcedure
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			await stopAdminer(input.serverId ?? null);
			return { success: true };
		}),

	status: protectedProcedure
		.input(
			z.object({
				serverId: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			const running = await getAdminerStatus(input.serverId ?? null);
			return { running };
		}),
});
