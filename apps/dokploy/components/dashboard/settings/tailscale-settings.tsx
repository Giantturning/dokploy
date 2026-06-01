import {
	CheckCircle2,
	Loader2,
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

const VPN_TYPE_LABEL: Record<string, string> = {
	tailscale: "Tailscale",
	wireguard: "WireGuard",
	zerotier: "ZeroTier",
	openvpn: "OpenVPN",
	unknown: "VPN",
};

export const TailscaleSettings = () => {
	const { data: vpnSettings, refetch: refetchSettings } =
		api.vpn.getSettings.useQuery();

	const {
		data: detectedInterfaces,
		isFetching: isDetecting,
		refetch: refetchInterfaces,
	} = api.vpn.detectInterfaces.useQuery(
		{ serverId: undefined },
		{ staleTime: 30_000 },
	);

	const { mutateAsync: saveVpnInterface, isPending: isSaving } =
		api.vpn.saveVpnInterface.useMutation();

	const { mutateAsync: clearVpnInterface, isPending: isClearing } =
		api.vpn.clearVpnInterface.useMutation();

	const handleSelect = async (iface: { name: string; subnet: string }) => {
		await saveVpnInterface({ vpnInterface: iface.name, vpnSubnet: iface.subnet })
			.then(async () => {
				toast.success(`VPN interface "${iface.name}" saved`);
				await refetchSettings();
			})
			.catch(() => toast.error("Failed to save VPN interface"));
	};

	const handleClear = async () => {
		await clearVpnInterface()
			.then(async () => {
				toast.success("VPN interface cleared");
				await refetchSettings();
			})
			.catch(() => toast.error("Failed to clear"));
	};

	const hasVpn = !!(vpnSettings?.vpnInterface && vpnSettings?.vpnSubnet);

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Shield className="size-5" />
					<CardTitle className="text-xl">VPN IP Binding</CardTitle>
				</div>
				<CardDescription>
					Dokploy detects VPN interfaces already running on this host (Tailscale,
					WireGuard, ZeroTier, OpenVPN). Select one to enable VPN-only access for
					your apps.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{/* Current status */}
				<div
					className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
						hasVpn
							? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 text-green-800 dark:text-green-200"
							: "border-border bg-muted/30 text-muted-foreground"
					}`}
				>
					<div
						className={`size-2 rounded-full shrink-0 ${hasVpn ? "bg-green-500" : "bg-gray-400"}`}
					/>
					{hasVpn ? (
						<>
							<CheckCircle2 className="size-4 shrink-0" />
							<span>
								Interface <strong>{vpnSettings.vpnInterface}</strong> bound —{" "}
								<code className="text-xs">{vpnSettings.vpnSubnet}</code>
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="ml-auto h-6 px-2 text-xs"
								onClick={handleClear}
								disabled={isClearing}
							>
								{isClearing ? (
									<Loader2 className="size-3 animate-spin" />
								) : (
									"Clear"
								)}
							</Button>
						</>
					) : (
						"No VPN interface configured"
					)}
				</div>

				{/* Detected interfaces */}
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<p className="text-sm font-medium">Detected interfaces</p>
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
							<span className="ml-1 text-xs">Scan</span>
						</Button>
					</div>

					{isDetecting ? (
						<p className="text-sm text-muted-foreground">Scanning…</p>
					) : detectedInterfaces && detectedInterfaces.length > 0 ? (
						<div className="flex flex-col gap-2">
							{detectedInterfaces.map((iface) => {
								const isActive = vpnSettings?.vpnInterface === iface.name;
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
													<Badge variant="secondary" className="ml-2 text-xs">
														{VPN_TYPE_LABEL[iface.type] ?? iface.type}
													</Badge>
												</p>
												<p className="text-xs text-muted-foreground">
													IP {iface.ip} — subnet{" "}
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
												disabled={isSaving}
												onClick={() => handleSelect(iface)}
											>
												{isSaving ? (
													<Loader2 className="size-4 animate-spin" />
												) : (
													"Use this"
												)}
											</Button>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<div className="rounded-lg border border-dashed p-4 text-center">
							<p className="text-sm text-muted-foreground">
								No VPN interfaces detected.
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								Install Tailscale, WireGuard, ZeroTier, or OpenVPN on this host,
								then click Scan.
							</p>
						</div>
					)}
				</div>

				{/* How it works */}
				<div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-2 text-sm">
					<p className="font-medium">How VPN IP binding works</p>
					<ol className="list-decimal list-inside text-muted-foreground flex flex-col gap-1 text-xs">
						<li>Install your VPN client on this host (Tailscale, WireGuard…)</li>
						<li>Click "Scan" — Dokploy detects the VPN interface automatically</li>
						<li>Click "Use this" to save the interface and subnet</li>
						<li>
							On any Application → Domains → set Access Mode to "VPN only"
						</li>
						<li>
							Traefik automatically restricts that app to your VPN subnet — no
							public access
						</li>
					</ol>
				</div>
			</CardContent>
		</Card>
	);
};
