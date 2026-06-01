import {
	execAsync,
	execAsyncRemote,
} from "@dokploy/server/utils/process/execAsync";

export interface VpnInterface {
	name: string;
	ip: string;
	subnet: string;
	type: "tailscale" | "wireguard" | "zerotier" | "openvpn" | "unknown";
}

// Known VPN interface name patterns → type
const VPN_PATTERNS: [RegExp, VpnInterface["type"]][] = [
	[/^tailscale\d*$/, "tailscale"],
	[/^wg\d+$/, "wireguard"],
	[/^zt[a-z0-9]+$/, "zerotier"],
	[/^tun\d+$/, "openvpn"],
	[/^utun\d+$/, "openvpn"],
];

// Default subnets per type for the IP allowlist
const DEFAULT_SUBNET: Record<VpnInterface["type"], string> = {
	tailscale: "100.64.0.0/10",
	wireguard: "",   // filled from interface CIDR
	zerotier: "",
	openvpn: "",
	unknown: "",
};

export const detectVpnInterfaces = async (
	serverId?: string | null,
): Promise<VpnInterface[]> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	try {
		// ip addr output: lines like "2: tailscale0: ..."  "    inet 100.x.x.x/32 ..."
		const { stdout } = await exec(
			"ip -4 addr show 2>/dev/null || ifconfig 2>/dev/null || echo ''",
		);

		const results: VpnInterface[] = [];
		let currentIface = "";

		for (const rawLine of stdout.split("\n")) {
			const line = rawLine.trim();

			// New interface block (ip addr)
			const ifaceMatch = line.match(/^\d+:\s+([\w@.-]+):/);
			if (ifaceMatch?.[1]) {
				currentIface = ifaceMatch[1].split("@")[0] ?? "";
				continue;
			}

			// ip addr inet line
			const inetMatch = line.match(/^inet\s+([\d.]+)\/([\d]+)/);
			if (inetMatch && currentIface) {
				const ip = inetMatch[1] ?? "";
				const prefixLen = inetMatch[2] ?? "32";
				const subnet = `${cidrBase(ip, Number(prefixLen))}/${prefixLen}`;

				for (const [pattern, type] of VPN_PATTERNS) {
					if (pattern.test(currentIface)) {
						results.push({
							name: currentIface,
							ip,
							subnet: DEFAULT_SUBNET[type] || subnet,
							type,
						});
						break;
					}
				}
			}
		}

		return results;
	} catch {
		return [];
	}
};

// Convert IP + prefix length to network address string
function cidrBase(ip: string, prefix: number): string {
	const parts = ip.split(".").map(Number);
	const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
	const network = parts.reduce((acc, octet, i) => {
		return acc | ((octet & ((mask >> (24 - i * 8)) & 0xff)) << (24 - i * 8));
	}, 0) >>> 0;
	return [
		(network >>> 24) & 0xff,
		(network >>> 16) & 0xff,
		(network >>> 8) & 0xff,
		network & 0xff,
	].join(".");
}
