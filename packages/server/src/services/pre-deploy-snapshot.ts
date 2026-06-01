import { paths } from "@dokploy/server/constants";
import { db } from "@dokploy/server/db";
import {
	environments,
	mariadb,
	mongo,
	mysql,
	postgres,
} from "@dokploy/server/db/schema";
import {
	getMariadbBackupCommand,
	getMongoBackupCommand,
	getMysqlBackupCommand,
	getPostgresBackupCommand,
	getServiceContainerCommand,
} from "@dokploy/server/utils/backups/utils";
import {
	execAsync,
	execAsyncRemote,
} from "@dokploy/server/utils/process/execAsync";
import { eq } from "drizzle-orm";

export interface SnapshotResult {
	type: string;
	name: string;
	path: string;
	sizeHuman: string;
}

export const runPreDeploySnapshot = async ({
	environmentId,
	deploymentId,
	logPath,
	serverId,
}: {
	environmentId: string;
	deploymentId: string;
	logPath: string;
	serverId?: string | null;
}): Promise<SnapshotResult[]> => {
	const exec = (cmd: string) =>
		serverId ? execAsyncRemote(serverId, cmd) : execAsync(cmd);

	const { BASE_PATH } = paths(!!serverId);
	const snapshotDir = `${BASE_PATH}/snapshots/${deploymentId}`;

	await exec(`mkdir -p "${snapshotDir}"`);
	await exec(
		`echo "\\n📦 Pre-deploy snapshot started → ${snapshotDir}" >> "${logPath}"`,
	);

	const env = await db.query.environments.findFirst({
		where: eq(environments.environmentId, environmentId),
		with: {
			postgres: true,
			mysql: true,
			mariadb: true,
			mongo: true,
		},
	});

	const results: SnapshotResult[] = [];

	// PostgreSQL
	for (const pg of env?.postgres ?? []) {
		const fileName = `${pg.appName}-${Date.now()}.dump.gz`;
		const filePath = `${snapshotDir}/${fileName}`;
		const containerCmd = getServiceContainerCommand(pg.appName);
		const dumpCmd = getPostgresBackupCommand(
			pg.databaseName,
			pg.databaseUser,
		);
		const fullCmd = `CONTAINER_ID=$(${containerCmd}) && ${dumpCmd} > "${filePath}" 2>>"${logPath}"`;
		try {
			await exec(fullCmd);
			const { stdout: size } = await exec(
				`du -sh "${filePath}" 2>/dev/null | cut -f1`,
			);
			results.push({
				type: "postgres",
				name: pg.databaseName,
				path: filePath,
				sizeHuman: size.trim() || "?",
			});
			await exec(
				`echo "  ✅ postgres/${pg.databaseName} → ${fileName} (${size.trim()})" >> "${logPath}"`,
			);
		} catch {
			await exec(
				`echo "  ⚠️  postgres/${pg.databaseName} snapshot failed (skipped)" >> "${logPath}"`,
			);
		}
	}

	// MySQL
	for (const db_ of env?.mysql ?? []) {
		const fileName = `${db_.appName}-${Date.now()}.sql.gz`;
		const filePath = `${snapshotDir}/${fileName}`;
		const containerCmd = getServiceContainerCommand(db_.appName);
		const dumpCmd = getMysqlBackupCommand(
			db_.databaseName,
			db_.databasePassword,
		);
		const fullCmd = `CONTAINER_ID=$(${containerCmd}) && ${dumpCmd} > "${filePath}" 2>>"${logPath}"`;
		try {
			await exec(fullCmd);
			const { stdout: size } = await exec(
				`du -sh "${filePath}" 2>/dev/null | cut -f1`,
			);
			results.push({
				type: "mysql",
				name: db_.databaseName,
				path: filePath,
				sizeHuman: size.trim() || "?",
			});
			await exec(
				`echo "  ✅ mysql/${db_.databaseName} → ${fileName} (${size.trim()})" >> "${logPath}"`,
			);
		} catch {
			await exec(
				`echo "  ⚠️  mysql/${db_.databaseName} snapshot failed (skipped)" >> "${logPath}"`,
			);
		}
	}

	// MariaDB
	for (const db_ of env?.mariadb ?? []) {
		const fileName = `${db_.appName}-${Date.now()}.sql.gz`;
		const filePath = `${snapshotDir}/${fileName}`;
		const containerCmd = getServiceContainerCommand(db_.appName);
		const dumpCmd = getMariadbBackupCommand(
			db_.databaseName,
			db_.databaseUser,
			db_.databasePassword,
		);
		const fullCmd = `CONTAINER_ID=$(${containerCmd}) && ${dumpCmd} > "${filePath}" 2>>"${logPath}"`;
		try {
			await exec(fullCmd);
			const { stdout: size } = await exec(
				`du -sh "${filePath}" 2>/dev/null | cut -f1`,
			);
			results.push({
				type: "mariadb",
				name: db_.databaseName,
				path: filePath,
				sizeHuman: size.trim() || "?",
			});
			await exec(
				`echo "  ✅ mariadb/${db_.databaseName} → ${fileName} (${size.trim()})" >> "${logPath}"`,
			);
		} catch {
			await exec(
				`echo "  ⚠️  mariadb/${db_.databaseName} snapshot failed (skipped)" >> "${logPath}"`,
			);
		}
	}

	// MongoDB
	for (const db_ of env?.mongo ?? []) {
		const fileName = `${db_.appName}-${Date.now()}.archive.gz`;
		const filePath = `${snapshotDir}/${fileName}`;
		const containerCmd = getServiceContainerCommand(db_.appName);
		const dumpCmd = getMongoBackupCommand(
			db_.databaseName,
			db_.databaseUser,
			db_.databasePassword,
		);
		const fullCmd = `CONTAINER_ID=$(${containerCmd}) && ${dumpCmd} > "${filePath}" 2>>"${logPath}"`;
		try {
			await exec(fullCmd);
			const { stdout: size } = await exec(
				`du -sh "${filePath}" 2>/dev/null | cut -f1`,
			);
			results.push({
				type: "mongo",
				name: db_.databaseName,
				path: filePath,
				sizeHuman: size.trim() || "?",
			});
			await exec(
				`echo "  ✅ mongo/${db_.databaseName} → ${fileName} (${size.trim()})" >> "${logPath}"`,
			);
		} catch {
			await exec(
				`echo "  ⚠️  mongo/${db_.databaseName} snapshot failed (skipped)" >> "${logPath}"`,
			);
		}
	}

	const count = results.length;
	if (count === 0) {
		await exec(
			`echo "  ℹ️  No databases found in this environment to snapshot." >> "${logPath}"`,
		);
	} else {
		await exec(
			`echo "📦 Snapshot complete: ${count} database(s) saved to ${snapshotDir}\\n" >> "${logPath}"`,
		);
	}

	return results;
};
