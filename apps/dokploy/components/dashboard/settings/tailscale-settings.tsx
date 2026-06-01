import { CheckCircle2, ExternalLink, Eye, EyeOff, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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

export const TailscaleSettings = () => {
	const [authKey, setAuthKey] = useState("");
	const [showKey, setShowKey] = useState(false);

	const { data, refetch } = api.tailscale.getSettings.useQuery();
	const { mutateAsync: save, isPending: isSaving } =
		api.tailscale.saveAuthKey.useMutation();
	const { mutateAsync: clear, isPending: isClearing } =
		api.tailscale.clearAuthKey.useMutation();

	const handleSave = async () => {
		if (!authKey.trim()) return;
		await save({ authKey: authKey.trim() })
			.then(async () => {
				setAuthKey("");
				toast.success("Tailscale auth key saved");
				await refetch();
			})
			.catch(() => toast.error("Failed to save auth key"));
	};

	const handleClear = async () => {
		await clear()
			.then(async () => {
				toast.success("Tailscale auth key removed");
				await refetch();
			})
			.catch(() => toast.error("Failed to remove auth key"));
	};

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Shield className="size-5" />
					<CardTitle className="text-xl">Tailscale</CardTitle>
				</div>
				<CardDescription>
					Configure your Tailscale auth key to enable Tailscale sidecar
					containers for your applications.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{/* Status */}
				<div
					className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
						data?.authKeySet
							? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 text-green-800 dark:text-green-200"
							: "border-border bg-muted/30 text-muted-foreground"
					}`}
				>
					<div
						className={`size-2 rounded-full ${data?.authKeySet ? "bg-green-500" : "bg-gray-400"}`}
					/>
					{data?.authKeySet ? (
						<>
							<CheckCircle2 className="size-4" />
							Auth key configured
						</>
					) : (
						"No auth key configured"
					)}
				</div>

				{/* Auth key input */}
				<div className="flex flex-col gap-2">
					<Label htmlFor="ts-auth-key">
						{data?.authKeySet ? "Replace auth key" : "Auth key"}
					</Label>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Input
								id="ts-auth-key"
								type={showKey ? "text" : "password"}
								value={authKey}
								onChange={(e) => setAuthKey(e.target.value)}
								placeholder="tskey-auth-..."
								className="pr-10"
							/>
							<button
								type="button"
								className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								onClick={() => setShowKey((p) => !p)}
							>
								{showKey ? (
									<EyeOff className="size-4" />
								) : (
									<Eye className="size-4" />
								)}
							</button>
						</div>
						<Button
							onClick={handleSave}
							disabled={isSaving || !authKey.trim()}
							isLoading={isSaving}
						>
							Save
						</Button>
						{data?.authKeySet && (
							<Button
								variant="destructive"
								onClick={handleClear}
								disabled={isClearing}
								isLoading={isClearing}
							>
								Remove
							</Button>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Generate a reusable auth key at{" "}
						<a
							href="https://login.tailscale.com/admin/settings/keys"
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-600 hover:underline inline-flex items-center gap-1"
						>
							tailscale.com/admin/settings/keys
							<ExternalLink className="size-3" />
						</a>
						. Use an ephemeral key for dynamic sidecars.
					</p>
				</div>

				{/* How it works */}
				<div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-2 text-sm">
					<p className="font-medium">How Tailscale sidecars work</p>
					<ol className="list-decimal list-inside text-muted-foreground flex flex-col gap-1 text-xs">
						<li>Set your auth key here (once, globally)</li>
						<li>
							Go to any Application → Domains → Access Mode → select
							"Tailscale only" or "Public + Tailscale"
						</li>
						<li>Click "Start sidecar" or redeploy</li>
						<li>
							App becomes reachable as{" "}
							<code>appname.tailnet.ts.net</code> in your Tailnet
						</li>
					</ol>
				</div>
			</CardContent>
		</Card>
	);
};
