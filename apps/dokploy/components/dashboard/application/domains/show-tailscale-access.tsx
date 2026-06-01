import {
	AlertTriangle,
	CheckCircle2,
	Globe,
	Loader2,
	Lock,
	RefreshCw,
	Shield,
	Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/utils/api";

type AccessMode = "public" | "tailscale" | "both";

interface Props {
	applicationId: string;
}

const MODE_CONFIG: Record<
	AccessMode,
	{ label: string; icon: React.ReactNode; description: string }
> = {
	public: {
		label: "Public only",
		icon: <Globe className="size-4" />,
		description: "Accessible from the public internet via Traefik. No IP restriction.",
	},
	tailscale: {
		label: "VPN only",
		icon: <Lock className="size-4" />,
		description:
			"Traefik restricts access to your VPN subnet. No public exposure.",
	},
	both: {
		label: "Public + VPN",
		icon: <Shield className="size-4" />,
		description:
			"Public internet access. VPN members can also reach it via the VPN IP.",
	},
};

const VPN_TYPE_LABEL: Record<string, string> = {
	tailscale: "Tailscale",
	wireguard: "WireGuard",
	zerotier: "ZeroTier",
	openvpn: "OpenVPN",
	unknown: "VPN",
};

export const ShowTailscaleAccess = ({ applicationId }: Props) => {
	const { data: app, refetch: refetchApp } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);

	const { data: vpnSettings } = api.vpn.getSettings.useQuery();

	const {
		data: detectedInterfaces,
		isFetching: isDetecting,
		refetch: refetchInterfaces,
	} = api.vpn.detectInterfaces.useQuery(
		{ serverId: app?.serverId ?? undefined },
		{ enabled: !!app, staleTime: 30_000 },
	);

	const { mutateAsync: setAccessMode, isPending: isSaving } =
		api.vpn.setAccessMode.useMutation();

	const { mutateAsync: saveVpnInterface, isPending: isSavingVpn } =
		api.vpn.saveVpnInterface.useMutation();

	const { mutateAsync: clearVpnInterface } =
		api.vpn.clearVpnInterface.useMutation();

	const currentMode = (app?.accessMode ?? "public") as AccessMode;

	const handleModeChange = async (mode: AccessMode) => {
		await setAccessMode({ applicationId, accessMode: mode })
			.then(async () => {
				toast.success("Access mode updated");
				await refetchApp();
			})
			.catch(() => toast.error("Failed to update access mode"));
	};

	const handleSelectInterface = async (iface: {
		name: string;
		subnet: string;
	}) => {
		await saveVpnInterface({
			vpnInterface: iface.name,
			vpnSubnet: iface.subnet,
		})
			.then(async () => {
				toast.success(`VPN interface "${iface.name}" saved`);
				await refetchApp();
			})
			.catch(() => toast.error("Failed to save VPN interface"));
	};

	const handleClearInterface = async () => {
		await clearVpnInterface()
			.then(() => toast.success("VPN interface cleared"))
			.catch(() => toast.error("Failed to clear"));
	};

	const hasVpnConfigured = !!(vpnSettings?.vpnInterface && vpnSettings?.vpnSubnet);

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Shield className="size-5" />
					<CardTitle className="text-xl">Access Mode</CardTitle>
				</div>
				<CardDescription>
					Bind this app to your VPN interface for private access. Dokploy detects
					VPN interfaces already installed on the host (Tailscale, WireGuard,
					ZeroTier, OpenVPN).
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-6">
				{/* VPN interface status */}
				<div
					className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
						hasVpnConfigured
							? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 text-green-800 dark:text-green-200"
							: "border-border bg-muted/30 text-muted-foreground"
					}`}
				>
					<div
						className={`size-2 rounded-full shrink-0 ${hasVpnConfigured ? "bg-green-500" : "bg-gray-400"}`}
					/>
					{hasVpnConfigured ? (
						<>
							<CheckCircle2 className="size-4 shrink-0" />
							<span>
								VPN interface <strong>{vpnSettings.vpnInterface}</strong> bound —
								subnet <code className="text-xs">{vpnSettings.vpnSubnet}</code>
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="ml-auto h-6 px-2 text-xs"
								onClick={handleClearInterface}
							>
								Clear
							</Button>
						</>
					) : (
						<span>No VPN interface configured — detect one below</span>
					)}
				</div>

				{/* Detected interfaces */}
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<p className="text-sm font-medium">Detected VPN interfaces</p>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => refetchInterfaces()}
							disabled={isDetecting}
						>
							{isDetecting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<RefreshCw className="size-4" />
							)}
							<span className="ml-1 text-xs">Refresh</span>
						</Button>
					</div>

					{isDetecting ? (
						<p className="text-sm text-muted-foreground">Scanning interfaces…</p>
					) : detectedInterfaces && detectedInterfaces.length > 0 ? (
						<div className="flex flex-col gap-2">
							{detectedInterfaces.map((iface) => {
								const isActive =
									vpnSettings?.vpnInterface === iface.name;
								return (
									<div
										key={iface.name}
										className={`flex items-center justify-between rounded-lg border p-3 ${
											isActive
												? "border-primary bg-primary/5"
												: "border-border bg-muted/20"
										}`}
									>
										<div className="flex items-center gap-3">
											<Wifi className="size-4 text-muted-foreground shrink-0" />
											<div>
												<p className="text-sm font-medium">
													{iface.name}
													<Badge
														variant="secondary"
														className="ml-2 text-xs"
													>
														{VPN_TYPE_LABEL[iface.type] ?? iface.type}
													</Badge>
												</p>
												<p className="text-xs text-muted-foreground">
													{iface.ip} — subnet{" "}
													<code className="text-xs">{iface.subnet}</code>
												</p>
											</div>
										</div>
										{isActive ? (
											<Badge variant="default" className="text-xs">
												Active
											</Badge>
										) : (
											<Button
												size="sm"
												variant="outline"
												disabled={isSavingVpn}
												onClick={() => handleSelectInterface(iface)}
											>
												Use this
											</Button>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="rounded-lg border border-dashed p-4 text-center">
							<p className="text-sm text-muted-foreground">
								No VPN interfaces found.
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								Install Tailscale, WireGuard, ZeroTier, or OpenVPN on the host
								first, then refresh.
							</p>
						</div>
					)}
				</div>

				{/* Mode selector */}
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Access restriction</p>

					{currentMode === "tailscale" && !hasVpnConfigured && (
						<div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
							<AlertTriangle className="size-4 shrink-0" />
							<span>
								VPN-only mode active but no interface is configured above. Traefik
								will block all traffic until you select a VPN interface.
							</span>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						{(
							Object.entries(MODE_CONFIG) as [
								AccessMode,
								(typeof MODE_CONFIG)[AccessMode],
							][]
						).map(([mode, cfg]) => (
							<button
								key={mode}
								type="button"
								disabled={isSaving}
								onClick={() => handleModeChange(mode)}
								className={`rounded-lg border-2 p-4 text-left transition-all disabled:opacity-50 ${
									currentMode === mode
										? "border-primary ring-2 ring-primary/20"
										: "border-border hover:border-muted-foreground"
								}`}
							>
								<div className="flex items-center gap-2 mb-1 font-medium text-sm">
									{cfg.icon}
									{cfg.label}
									{currentMode === mode && (
										<Badge variant="default" className="ml-auto text-xs">
											Active
										</Badge>
									)}
								</div>
								<p className="text-xs text-muted-foreground">{cfg.description}</p>
							</button>
						))}
					</div>
				</div>

				{isSaving && (
					<p className="text-xs text-muted-foreground flex items-center gap-1">
						<Loader2 className="size-3 animate-spin" /> Applying…
					</p>
				)}
			</CardContent>
		</Card>
	);
};
