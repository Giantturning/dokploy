import {
	detectVpnInterfaces,
	findApplicationById,
	getWebServerSettings,
	manageDomain,
	updateApplication,
	updateWebServerSettings,
} from "@dokploy/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const vpnRouter = createTRPCRouter({
	/** Detect VPN interfaces on the host running Dokploy */
	detectInterfaces: protectedProcedure
		.input(z.object({ serverId: z.string().optional() }))
		.query(async ({ input }) => {
			return detectVpnInterfaces(input.serverId);
		}),

	/** Return the currently stored VPN interface / subnet */
	getSettings: protectedProcedure.query(async () => {
		const s = await getWebServerSettings();
		return {
			vpnInterface: s?.vpnInterface ?? null,
			vpnSubnet: s?.vpnSubnet ?? null,
		};
	}),

	/** Persist a chosen VPN interface + subnet */
	saveVpnInterface: protectedProcedure
		.input(
			z.object({
				vpnInterface: z.string().min(1).max(64),
				vpnSubnet: z.string().min(1).max(50),
			}),
		)
		.mutation(async ({ input }) => {
			await updateWebServerSettings({
				vpnInterface: input.vpnInterface,
				vpnSubnet: input.vpnSubnet,
			});
			return { success: true };
		}),

	/** Clear stored VPN settings */
	clearVpnInterface: protectedProcedure.mutation(async () => {
		await updateWebServerSettings({ vpnInterface: null, vpnSubnet: null });
		return { success: true };
	}),

	/** Update an application's access mode and re-apply Traefik configs */
	setAccessMode: protectedProcedure
		.input(
			z.object({
				applicationId: z.string().min(1),
				accessMode: z.enum(["public", "tailscale", "both"]),
			}),
		)
		.mutation(async ({ input }) => {
			await updateApplication(input.applicationId, {
				accessMode: input.accessMode,
			});
			const app = await findApplicationById(input.applicationId);
			// Re-apply Traefik config for all domains so IP rules take effect immediately
			for (const domain of app.domains) {
				await manageDomain(app, domain);
			}
			return { success: true };
		}),
});
