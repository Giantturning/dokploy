import {
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	Globe,
	Loader2,
	Lock,
	RefreshCw,
	Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";

type AccessMode = "public" | "tailscale" | "both";

interface Props {
	applicationId: string;
}

const MODE_CONFIG: Record<
	AccessMode,
	{ label: string; icon: React.ReactNode; description: string; color: string }
> = {
	public: {
		label: "Public only",
		icon: <Globe className="size-4" />,
		description: "Reachable via Traefik + public internet. No Tailscale.",
		color: "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800",
	},
	tailscale: {
		label: "Tailscale only",
		icon: <Lock className="size-4" />,
		description:
			"Only accessible via your Tailnet. No public exposure at all.",
		color:
			"border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800",
	},
	both: {
		label: "Public + Tailscale",
		icon: <Shield className="size-4" />,
		description:
			"Reachable publicly via Traefik AND within your Tailnet.",
		color:
			"border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800",
	},
};

export const ShowTailscaleAccess = ({ applicationId }: Props) => {
	const [tailscalePort, setTailscalePort] = useState<string>("3000");
	const [tailscaleHostname, setTailscaleHostname] = useState<string>("");

	const { data: app, refetch: refetchApp } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);

	const { data: tsSettings } = api.tailscale.getSettings.useQuery();

	const { data: sidecarStatus, refetch: refetchStatus } =
		api.tailscale.getSidecarStatus.useQuery(
			{ applicationId },
			{ enabled: !!applicationId, refetchInterval: 15_000 },
		);

	useEffect(() => {
		if (app) {
			setTailscalePort(String(app.tailscalePort ?? 3000));
			setTailscaleHostname(app.tailscaleHostname ?? "");
		}
	}, [app]);

	const { mutateAsync: updateApp, isPending: isSaving } =
		api.application.update.useMutation();

	const { mutateAsync: startSidecar, isPending: isStarting } =
		api.tailscale.startSidecar.useMutation();

	const { mutateAsync: stopSidecar, isPending: isStopping } =
		api.tailscale.stopSidecar.useMutation();

	const currentMode = (app?.accessMode ?? "public") as AccessMode;

	const setMode = async (mode: AccessMode) => {
		await updateApp({
			applicationId,
			accessMode: mode,
			tailscalePort: Number(tailscalePort) || 3000,
			tailscaleHostname: tailscaleHostname || null,
		})
			.then(async () => {
				toast.success("Access mode saved");
				await refetchApp();
			})
			.catch(() => toast.error("Failed to save"));
	};

	const handleStart = async () => {
		await updateApp({
			applicationId,
			tailscalePort: Number(tailscalePort) || 3000,
			tailscaleHostname: tailscaleHostname || null,
		});
		await startSidecar({ applicationId })
			.then(async () => {
				toast.success("Tailscale sidecar started!");
				await refetchStatus();
			})
			.catch((e) => toast.error(e.message ?? "Failed to start Tailscale"));
	};

	const handleStop = async () => {
		await stopSidecar({ applicationId })
			.then(async () => {
				toast.success("Tailscale sidecar stopped");
				await refetchStatus();
			})
			.catch(() => toast.error("Failed to stop"));
	};

	const authKeyMissing = !tsSettings?.authKeySet;

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Shield className="size-5" />
					<CardTitle className="text-xl">Access Mode</CardTitle>
				</div>
				<CardDescription>
					Choose how this app is reachable — public internet, Tailscale only, or
					both.
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-6">
				{authKeyMissing && (
					<div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
						<AlertTriangle className="size-4 shrink-0" />
						<span>
							No Tailscale auth key configured.{" "}
							<strong>Settings → Tailscale</strong> to add one.
						</span>
					</div>
				)}

				{/* Mode selector */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					{(Object.entries(MODE_CONFIG) as [AccessMode, (typeof MODE_CONFIG)[AccessMode]][]).map(
						([mode, cfg]) => (
							<button
								key={mode}
								type="button"
								onClick={() => setMode(mode)}
								className={`rounded-lg border-2 p-4 text-left transition-all ${
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
						),
					)}
				</div>

				{/* Tailscale config — show when mode is tailscale or both */}
				{(currentMode === "tailscale" || currentMode === "both") && (
					<div className="rounded-lg border p-4 flex flex-col gap-4">
						<p className="text-sm font-medium">Tailscale Configuration</p>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="ts-port">App port (internal)</Label>
								<Input
									id="ts-port"
									type="number"
									min={1}
									max={65535}
									value={tailscalePort}
									onChange={(e) => setTailscalePort(e.target.value)}
									placeholder="3000"
								/>
								<p className="text-xs text-muted-foreground">
									Port your app listens on inside the container
								</p>
							</div>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="ts-hostname">Tailscale hostname</Label>
								<Input
									id="ts-hostname"
									value={tailscaleHostname}
									onChange={(e) => setTailscaleHostname(e.target.value)}
									placeholder={app?.appName ?? "my-app"}
								/>
								<p className="text-xs text-muted-foreground">
									Becomes{" "}
									<code className="text-xs">
										{tailscaleHostname || app?.appName || "my-app"}
										.tailnet.ts.net
									</code>
								</p>
							</div>
						</div>

						{/* Sidecar status */}
						<div className="flex items-center justify-between border-t pt-4">
							<div className="flex items-center gap-3">
								<div
									className={`size-2.5 rounded-full ${
										sidecarStatus?.running ? "bg-green-500" : "bg-gray-400"
									}`}
								/>
								<div>
									<p className="text-sm font-medium">
										Sidecar:{" "}
										{sidecarStatus?.running ? "Running" : "Stopped"}
									</p>
									{sidecarStatus?.dnsName && (
										<a
											href={`https://${sidecarStatus.dnsName}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
										>
											{sidecarStatus.dnsName}
											<ExternalLink className="size-3" />
										</a>
									)}
								</div>
							</div>

							<div className="flex gap-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => refetchStatus()}
								>
									<RefreshCw className="size-4" />
								</Button>
								{sidecarStatus?.running ? (
									<Button
										variant="destructive"
										size="sm"
										onClick={handleStop}
										disabled={isStopping}
									>
										{isStopping && (
											<Loader2 className="size-4 mr-1 animate-spin" />
										)}
										Stop sidecar
									</Button>
								) : (
									<Button
										size="sm"
										onClick={handleStart}
										disabled={isStarting || authKeyMissing}
									>
										{isStarting ? (
											<Loader2 className="size-4 mr-1 animate-spin" />
										) : (
											<CheckCircle2 className="size-4 mr-1" />
										)}
										Start sidecar
									</Button>
								)}
							</div>
						</div>
					</div>
				)}

				{isSaving && (
					<p className="text-xs text-muted-foreground flex items-center gap-1">
						<Loader2 className="size-3 animate-spin" /> Saving...
					</p>
				)}
			</CardContent>
		</Card>
	);
};
