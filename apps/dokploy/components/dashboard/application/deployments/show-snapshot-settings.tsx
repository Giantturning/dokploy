import { Camera, Info } from "lucide-react";
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

export const ShowSnapshotSettings = ({ applicationId }: Props) => {
	const { data, refetch } = api.application.one.useQuery(
		{ applicationId },
		{ enabled: !!applicationId },
	);

	const { mutateAsync } = api.application.update.useMutation();
	const [optimistic, setOptimistic] = useState<boolean | null>(null);

	useEffect(() => {
		if (data) setOptimistic(data.snapshotBeforeDeploy ?? false);
	}, [data]);

	const enabled = optimistic ?? false;

	const toggle = async (value: boolean) => {
		setOptimistic(value);
		await mutateAsync({ applicationId, snapshotBeforeDeploy: value })
			.then(async () => {
				toast.success(
					value
						? "Snapshot enabled. Databases will be dumped before each deploy."
						: "Snapshot disabled.",
				);
				await refetch();
			})
			.catch(() => {
				setOptimistic(!value);
				toast.error("Failed to update setting");
			});
	};

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Camera className="size-5" />
					<CardTitle className="text-xl">Pre-Deploy DB Snapshot</CardTitle>
				</div>
				<CardDescription>
					Automatically dump all databases in this environment before each
					deployment. Snapshots are saved to{" "}
					<code className="text-xs">/etc/dokploy/snapshots/&lt;deploymentId&gt;/</code>
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div className="flex flex-col gap-1">
						<Label htmlFor="snapshot-toggle" className="text-base">
							Snapshot before deploy
						</Label>
						<span className="text-sm text-muted-foreground">
							Dumps PostgreSQL, MySQL, MariaDB and MongoDB instances in this
							environment
						</span>
					</div>
					<Switch
						id="snapshot-toggle"
						checked={enabled}
						onCheckedChange={toggle}
					/>
				</div>

				{enabled && (
					<div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
						<Info className="size-4 shrink-0 mt-0.5" />
						<div className="flex flex-col gap-1">
							<span>
								<strong>What gets snapped:</strong> All databases in this
								environment that are currently running.
							</span>
							<span>
								<strong>Where:</strong>{" "}
								<code className="text-xs">
									/etc/dokploy/snapshots/&lt;deploymentId&gt;/
								</code>{" "}
								on your server.
							</span>
							<span>
								<strong>Restore:</strong> Snapshots are gzipped dumps. Use{" "}
								<code className="text-xs">pg_restore</code>,{" "}
								<code className="text-xs">mysql</code> or{" "}
								<code className="text-xs">mongorestore</code> to restore.
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
