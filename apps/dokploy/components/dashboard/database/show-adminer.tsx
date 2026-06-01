import { Database, ExternalLink, Loader2, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/utils/api";

type DBType = "postgres" | "mysql" | "mariadb" | "mongo";

interface Props {
	resourceId: string;
	type: DBType;
	serverId?: string | null;
}

const TYPE_LABELS: Record<DBType, string> = {
	postgres: "PostgreSQL",
	mysql: "MySQL",
	mariadb: "MariaDB",
	mongo: "MongoDB",
};

export const ShowAdminer = ({ resourceId, type, serverId }: Props) => {
	const [adminerInfo, setAdminerInfo] = useState<{
		url: string;
		port: number;
		user: string;
		password: string;
		database: string;
	} | null>(null);

	const { data: status, refetch: refetchStatus } = api.adminer.status.useQuery(
		{ serverId: serverId ?? undefined },
		{ refetchInterval: adminerInfo ? 15_000 : false },
	);

	const { mutateAsync: start, isPending: isStarting } =
		api.adminer.start.useMutation();

	const { mutateAsync: stop, isPending: isStopping } =
		api.adminer.stop.useMutation();

	const handleStart = async () => {
		await start({ resourceId, type })
			.then(async (result) => {
				setAdminerInfo(result);
				await refetchStatus();
				toast.success("Adminer started!");
			})
			.catch((e) => {
				toast.error(e.message ?? "Failed to start Adminer");
			});
	};

	const handleStop = async () => {
		await stop({ serverId: serverId ?? undefined })
			.then(async () => {
				setAdminerInfo(null);
				await refetchStatus();
				toast.success("Adminer stopped");
			})
			.catch(() => {
				toast.error("Failed to stop Adminer");
			});
	};

	const isRunning = status?.running ?? false;

	const openUrl = adminerInfo
		? `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:${adminerInfo.port}`
		: null;

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Database className="size-5" />
					<CardTitle className="text-xl">Database GUI</CardTitle>
				</div>
				<CardDescription>
					One-click Adminer for {TYPE_LABELS[type]}. Runs as a temporary
					container on port 8091.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<AlertBlock type="info">
					Adminer is exposed on port <strong>8091</strong>. Make sure this port
					is open in your server's firewall, or use an SSH tunnel:{" "}
					<code className="text-xs">ssh -L 8091:localhost:8091 user@server</code>
				</AlertBlock>

				<div className="flex items-center gap-3">
					{!isRunning ? (
						<Button
							onClick={handleStart}
							disabled={isStarting}
							className="gap-2"
						>
							{isStarting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Database className="size-4" />
							)}
							Launch Adminer
						</Button>
					) : (
						<>
							{openUrl && (
								<Button asChild variant="default" className="gap-2">
									<a href={openUrl} target="_blank" rel="noopener noreferrer">
										<ExternalLink className="size-4" />
										Open Adminer
									</a>
								</Button>
							)}
							<Button
								onClick={handleStop}
								disabled={isStopping}
								variant="destructive"
								className="gap-2"
							>
								{isStopping ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Square className="size-4" />
								)}
								Stop
							</Button>
						</>
					)}

					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<div
							className={`size-2 rounded-full ${isRunning ? "bg-green-500" : "bg-gray-400"}`}
						/>
						{isRunning ? "Running" : "Stopped"}
					</div>
				</div>

				{adminerInfo && isRunning && (
					<div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-2 text-sm font-mono">
						<div className="flex gap-2">
							<span className="text-muted-foreground w-20">User</span>
							<span>{adminerInfo.user}</span>
						</div>
						<div className="flex gap-2">
							<span className="text-muted-foreground w-20">Password</span>
							<span className="select-all">{adminerInfo.password}</span>
						</div>
						<div className="flex gap-2">
							<span className="text-muted-foreground w-20">Database</span>
							<span>{adminerInfo.database}</span>
						</div>
						<div className="flex gap-2">
							<span className="text-muted-foreground w-20">Port</span>
							<span>{adminerInfo.port}</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
