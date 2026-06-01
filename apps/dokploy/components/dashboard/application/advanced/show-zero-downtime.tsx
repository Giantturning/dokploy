import { CheckCircle2, Info, Rocket, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/utils/api";

interface Props {
	applicationId: string;
}

export const ShowZeroDowntime = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);

	const { mutateAsync } = api.application.update.useMutation();
	const [optimistic, setOptimistic] = useState<boolean | null>(null);

	useEffect(() => {
		if (data) setOptimistic(data.zeroDowntime ?? true);
	}, [data]);

	const enabled = optimistic ?? true;

	const toggle = async (value: boolean) => {
		setOptimistic(value);
		await mutateAsync({ applicationId, zeroDowntime: value })
			.then(async () => {
				toast.success(
					value
						? "Zero-downtime enabled. Health check will run after next deploy."
						: "Zero-downtime disabled.",
				);
				await refetch();
			})
			.catch(() => {
				setOptimistic(!value);
				toast.error("Failed to update setting");
			});
	};

	const hasDomains = (data?.domains?.length ?? 0) > 0;

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Rocket className="size-5" />
					<CardTitle className="text-xl">Zero-Downtime Deploy</CardTitle>
				</div>
				<CardDescription>
					Docker Swarm's <code>start-first</code> strategy starts the new
					container before stopping the old one. When enabled, Dokploy also
					verifies your app responds after each deploy.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div className="flex flex-col gap-1">
						<Label htmlFor="zero-downtime-toggle" className="text-base">
							Enable zero-downtime deploys
						</Label>
						<span className="text-sm text-muted-foreground">
							Verifies the app is reachable after each deployment
						</span>
					</div>
					<Switch
						id="zero-downtime-toggle"
						checked={enabled}
						onCheckedChange={toggle}
					/>
				</div>

				{/* Strategy info */}
				<div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
					<p className="text-sm font-medium">Active strategy: Docker Swarm</p>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
						<div className="flex items-start gap-2">
							<CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
							<div>
								<p className="font-medium">Start-first</p>
								<p className="text-muted-foreground text-xs">
									New container starts before old one stops
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
							<div>
								<p className="font-medium">Auto-rollback</p>
								<p className="text-muted-foreground text-xs">
									Docker rolls back automatically on failure
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							{enabled && hasDomains ? (
								<CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
							) : (
								<XCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
							)}
							<div>
								<p className="font-medium">Health verification</p>
								<p className="text-muted-foreground text-xs">
									{!enabled
										? "Disabled"
										: !hasDomains
											? "Add a domain to enable"
											: "Polls your domain after deploy"}
								</p>
							</div>
						</div>
					</div>
				</div>

				{enabled && !hasDomains && (
					<div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
						<Info className="size-4 shrink-0" />
						<span>
							Health verification requires at least one domain. Add a domain in
							the Domains tab.
						</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
