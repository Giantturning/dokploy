import { AlertTriangle, Cpu, HardDrive, Network, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/utils/api";

interface Props {
	appName: string;
	serverId?: string | null;
	memoryLimit?: string | null;
	cpuLimit?: string | null;
}

const parsePercent = (s: string) =>
	Number.parseFloat(s.replace("%", "")) || 0;

const statusColor = (pct: number) => {
	if (pct >= 90) return "destructive";
	if (pct >= 70) return "warning";
	return "default";
};

const progressColor = (pct: number) => {
	if (pct >= 90) return "bg-red-500";
	if (pct >= 70) return "bg-yellow-500";
	return "bg-green-500";
};

export const ResourceGuard = ({ appName, serverId, memoryLimit, cpuLimit }: Props) => {
	const [autoRefresh, setAutoRefresh] = useState(true);

	const { data, isLoading, refetch, dataUpdatedAt } =
		api.docker.getAppResourceUsage.useQuery(
			{ appName, serverId: serverId ?? undefined },
			{ enabled: !!appName, refetchInterval: autoRefresh ? 10_000 : false },
		);

	const cpuPct = data ? parsePercent(data.CPUPerc) : 0;
	const memPct = data ? parsePercent(data.MemPerc) : 0;

	const noLimitsSet = !memoryLimit && !cpuLimit;

	const lastUpdated = dataUpdatedAt
		? new Date(dataUpdatedAt).toLocaleTimeString()
		: null;

	return (
		<Card className="bg-background">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-xl">Resource Guard</CardTitle>
						<CardDescription>
							Real-time container resource usage
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						{lastUpdated && (
							<span className="text-xs text-muted-foreground">
								Updated {lastUpdated}
							</span>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={() => setAutoRefresh((p) => !p)}
						>
							<RefreshCw
								className={`size-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`}
								style={autoRefresh ? { animationDuration: "3s" } : {}}
							/>
							{autoRefresh ? "Auto" : "Paused"}
						</Button>
						<Button variant="ghost" size="sm" onClick={() => refetch()}>
							Refresh
						</Button>
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex flex-col gap-6">
				{noLimitsSet && (
					<div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
						<AlertTriangle className="size-4 shrink-0" />
						<span>
							No CPU or memory limits set. One app can consume all server
							resources. Set limits in the Resources section below.
						</span>
					</div>
				)}

				{!data && !isLoading && (
					<div className="text-sm text-muted-foreground text-center py-4">
						Container is not running or no data available.
					</div>
				)}

				{data && (
					<>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{/* CPU */}
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Cpu className="size-4 text-muted-foreground" />
										<span className="text-sm font-medium">CPU</span>
									</div>
									<Badge variant={statusColor(cpuPct) as any}>
										{data.CPUPerc}
									</Badge>
								</div>
								<div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
									<div
										className={`h-full transition-all ${progressColor(cpuPct)}`}
										style={{ width: `${Math.min(cpuPct, 100)}%` }}
									/>
								</div>
								<div className="flex justify-between text-xs text-muted-foreground">
									<span>0%</span>
									{cpuLimit ? (
										<span>Limit: {Number(cpuLimit) / 1_000_000_000} CPU</span>
									) : (
										<span className="text-yellow-600">No limit</span>
									)}
								</div>
							</div>

							{/* Memory */}
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<HardDrive className="size-4 text-muted-foreground" />
										<span className="text-sm font-medium">Memory</span>
									</div>
									<Badge variant={statusColor(memPct) as any}>
										{data.MemPerc}
									</Badge>
								</div>
								<div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
									<div
										className={`h-full transition-all ${progressColor(memPct)}`}
										style={{ width: `${Math.min(memPct, 100)}%` }}
									/>
								</div>
								<div className="flex justify-between text-xs text-muted-foreground">
									<span>{data.MemUsage.split("/")[0]?.trim()}</span>
									<span>
										{memoryLimit
											? `Limit: ${Number(memoryLimit) / (1024 * 1024)} MB`
											: data.MemUsage.split("/")[1]?.trim() || "No limit"}
									</span>
								</div>
							</div>
						</div>

						{/* Network + Block I/O */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
							<div className="flex items-center gap-3">
								<Network className="size-4 text-muted-foreground shrink-0" />
								<div>
									<p className="text-xs font-medium text-muted-foreground">
										Network I/O
									</p>
									<p className="text-sm">{data.NetIO}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<HardDrive className="size-4 text-muted-foreground shrink-0" />
								<div>
									<p className="text-xs font-medium text-muted-foreground">
										Block I/O
									</p>
									<p className="text-sm">{data.BlockIO}</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<span className="text-muted-foreground text-xs font-mono shrink-0">
									PIDs
								</span>
								<div>
									<p className="text-xs font-medium text-muted-foreground">
										Processes
									</p>
									<p className="text-sm">{data.PIDs}</p>
								</div>
							</div>
						</div>

						{(cpuPct >= 90 || memPct >= 90) && (
							<div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200">
								<AlertTriangle className="size-4 shrink-0" />
								<span>
									<strong>Critical:</strong>{" "}
									{cpuPct >= 90 ? "CPU" : "Memory"} usage above 90%. Server
									stability may be at risk.
								</span>
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
};
