import {
	findApplicationById,
	getWebServerSettings,
	isTailscaleSidecarRunning,
	startTailscaleSidecar,
	stopTailscaleSidecar,
	getTailscaleHostname,
	updateWebServerSettings,
} from "@dokploy/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const tailscaleRouter = createTRPCRouter({
	getSettings: protectedProcedure.query(async () => {
		const settings = await getWebServerSettings();
		return {
			authKeySet: !!(settings?.tailscaleAuthKey),
		};
	}),

	saveAuthKey: protectedProcedure
		.input(z.object({ authKey: z.string().min(1).max(200) }))
		.mutation(async ({ input }) => {
			await updateWebServerSettings({ tailscaleAuthKey: input.authKey });
			return { success: true };
		}),

	clearAuthKey: protectedProcedure.mutation(async () => {
		await updateWebServerSettings({ tailscaleAuthKey: null });
		return { success: true };
	}),

	getSidecarStatus: protectedProcedure
		.input(
			z.object({
				applicationId: z.string().min(1),
			}),
		)
		.query(async ({ input }) => {
			const app = await findApplicationById(input.applicationId);
			const running = await isTailscaleSidecarRunning(
				app.appName,
				app.serverId,
			);
			const dnsName = running
				? await getTailscaleHostname(app.appName, app.serverId)
				: null;
			return { running, dnsName, accessMode: app.accessMode };
		}),

	startSidecar: protectedProcedure
		.input(z.object({ applicationId: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const app = await findApplicationById(input.applicationId);
			const settings = await getWebServerSettings();
			const authKey = settings?.tailscaleAuthKey;
			if (!authKey) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Tailscale auth key not configured. Add it in Settings → Tailscale.",
				});
			}
			await startTailscaleSidecar({
				appName: app.appName,
				authKey,
				hostname: app.tailscaleHostname,
				targetPort: app.tailscalePort,
				serverId: app.serverId,
			});
			return { success: true };
		}),

	stopSidecar: protectedProcedure
		.input(z.object({ applicationId: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const app = await findApplicationById(input.applicationId);
			await stopTailscaleSidecar(app.appName, app.serverId);
			return { success: true };
		}),
});
