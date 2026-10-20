// Подготовка тестовой БД перед integration-тестами (запускается из `test:int`).
//
//   tsx test/prepare-test-db.ts           → `prisma migrate deploy`: создаёт `costumes_test`, если её нет,
//                                           и накатывает недостающие миграции. Данные не удаляет
//                                           (таблицы чистятся самими тестами).
//   tsx test/prepare-test-db.ts --reset   → `prisma migrate reset --force`: пересоздаёт БД с нуля
//                                           (`pnpm test:db:reset`, запускает человек).
import { spawnSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/prisma/generated/client';
import { backendDir, loadTestEnv } from './support/load-test-env';
import {
  ensureTestDatabaseExists,
  getTestDatabaseTarget,
  quotePostgresIdentifier,
} from '../src/test-utils/test-database';

const { file } = loadTestEnv();
const reset = process.argv.includes('--reset');

async function prepareDatabase() {
  if (reset) return;

  const { databaseName: targetDatabaseName, maintenanceUrl } =
    getTestDatabaseTarget(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({
    adapter: new PrismaPg(maintenanceUrl),
  });

  try {
    await ensureTestDatabaseExists(
      process.env.DATABASE_URL as string,
      async (databaseName) => {
        const databases = await prisma.$queryRaw<Array<{ name: string }>>`
          SELECT datname AS name FROM pg_database WHERE datname = ${databaseName}
        `;
        return databases.length > 0;
      },
      async (databaseName) => {
        await prisma.$executeRawUnsafe(
          `CREATE DATABASE ${quotePostgresIdentifier(databaseName)}`,
        );
      },
    );
    console.log(`[test:int] database ready: ${targetDatabaseName}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await prepareDatabase();
  console.log(
    `[test:int] env: ${file} (${reset ? 'migrate reset' : 'migrate deploy'})`,
  );

  const args = reset
    ? ['exec', 'prisma', 'migrate', 'reset', '--force']
    : ['exec', 'prisma', 'migrate', 'deploy'];

  const result = spawnSync('pnpm', args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  process.exit(result.status ?? 1);
}

void main();
