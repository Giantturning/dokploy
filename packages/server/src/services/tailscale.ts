import {
	execAsync,
	execAsyncRemote,
} from "@dokploy/server/utils/process/execAsync";

const TS_IMAGE = "tailscale/tailscale:latest";
const TS_NETWORK = "dokploy-network";

const sidecarName = (appName: string) => `${appName}-ts`;
const stateVolume = (appName: string) => `${appName}-ts-state`;

export interface TailscaleStartOptions {
	appName: string;
	authKey: string;
	hostname?: string | null;
	targetPort?: number | null;
	serverId?: string | null;
}

export const startTailscaleSidecar = async ({
	appName,
	authKey,
	hostname,
	targetPort = 3000,
	serverId,
}: TailscaleStartOptions): Promise<void> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	const name = sidecarName(appName);
	const volume = stateVolume(appName);
	const tsHostname = (hostname || appName)
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.slice(0, 63);
	const port = targetPort ?? 3000;

	// Remove existing sidecar
	await exec(`docker rm -f ${name} 2>/dev/null || true`);

	const serveConfig = JSON.stringify({
		TCP: { "443": { HTTPS: true } },
		Web: {
			[`${tsHostname}:443`]: {
				Handlers: {
					"/": { Proxy: `http://${appName}:${port}` },
				},
			},
		},
	});

	// Write serve config via env var
	const cmd = [
		"docker run -d",
		`--name ${name}`,
		`--network ${TS_NETWORK}`,
		"--cap-add NET_ADMIN",
		"--cap-add SYS_MODULE",
		`-v ${volume}:/var/lib/tailscale`,
		`-e TS_AUTHKEY=${authKey}`,
		`-e TS_HOSTNAME=${tsHostname}`,
		`-e TS_STATE_DIR=/var/lib/tailscale`,
		`-e TS_EXTRA_ARGS=--accept-routes`,
		`-e TS_SERVE_CONFIG='${serveConfig}'`,
		"--restart unless-stopped",
		TS_IMAGE,
	].join(" ");

	await exec(cmd);
};

export const stopTailscaleSidecar = async (
	appName: string,
	serverId?: string | null,
): Promise<void> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	const name = sidecarName(appName);
	await exec(`docker rm -f ${name} 2>/dev/null || true`);
};

export const getTailscaleHostname = async (
	appName: string,
	serverId?: string | null,
): Promise<string | null> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	const name = sidecarName(appName);
	try {
		const { stdout } = await exec(
			`docker exec ${name} tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | cut -d'"' -f4`,
		);
		return stdout.trim() || null;
	} catch {
		return null;
	}
};

export const isTailscaleSidecarRunning = async (
	appName: string,
	serverId?: string | null,
): Promise<boolean> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	const name = sidecarName(appName);
	try {
		const { stdout } = await exec(
			`docker ps -q --filter "name=^${name}$"`,
		);
		return stdout.trim().length > 0;
	} catch {
		return false;
	}
};
