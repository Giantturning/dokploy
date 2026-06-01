import {
	execAsync,
	execAsyncRemote,
} from "@dokploy/server/utils/process/execAsync";

export type DatabaseType = "postgres" | "mysql" | "mariadb" | "mongo";

const ADMINER_IMAGE = "adminer:latest";
const ADMINER_PORT = 8091;
const ADMINER_CONTAINER = "dokploy-adminer";
const ADMINER_NETWORK = "dokploy-network";

export interface AdminerConnectionInfo {
	type: DatabaseType;
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	serverId?: string | null;
}

export const startAdminer = async (
	info: AdminerConnectionInfo,
): Promise<{ url: string; port: number }> => {
	const exec = (cmd: string) =>
		info.serverId
			? execAsyncRemote(info.serverId, cmd)
			: execAsync(cmd);

	// Stop any existing Adminer container
	await exec(
		`docker rm -f ${ADMINER_CONTAINER} 2>/dev/null || true`,
	);

	const dbSystemMap: Record<DatabaseType, string> = {
		postgres: "pgsql",
		mysql: "mysql",
		mariadb: "mysql",
		mongo: "mongo",
	};
	const adminerSystem = dbSystemMap[info.type];

	const envFlags = [
		`-e ADMINER_DEFAULT_SERVER=${info.host}`,
		`-e ADMINER_DESIGN=flat`,
	].join(" ");

	const cmd = [
		"docker run -d",
		`--name ${ADMINER_CONTAINER}`,
		`--network ${ADMINER_NETWORK}`,
		`-p ${ADMINER_PORT}:8080`,
		envFlags,
		"--restart unless-stopped",
		ADMINER_IMAGE,
	].join(" ");

	await exec(cmd);

	const loginParams = new URLSearchParams({
		server: info.host,
		username: info.user,
		db: info.database,
		pgsql: adminerSystem === "pgsql" ? "1" : "",
	});

	return {
		url: `http://localhost:${ADMINER_PORT}/?${loginParams.toString()}`,
		port: ADMINER_PORT,
	};
};

export const stopAdminer = async (serverId?: string | null): Promise<void> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	await exec(`docker rm -f ${ADMINER_CONTAINER} 2>/dev/null || true`);
};

export const getAdminerStatus = async (
	serverId?: string | null,
): Promise<boolean> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	try {
		const { stdout } = await exec(
			`docker ps -q --filter "name=^${ADMINER_CONTAINER}$"`,
		);
		return stdout.trim().length > 0;
	} catch {
		return false;
	}
};
