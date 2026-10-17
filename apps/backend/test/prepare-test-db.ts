// Подготовка тестовой БД перед integration-тестами (запускается из `test:int`).
//
//   tsx test/prepare-test-db.ts           → `prisma migrate deploy`: создаёт `costumes_test`, если её нет,
//                                           и накатывает недостающие миграции. Данные не удаляет
//                                           (таблицы чистятся самими тестами).
//   tsx test/prepare-test-db.ts --reset   → `prisma migrate reset --force`: пересоздаёт БД с нуля
//                                           (`pnpm test:db:reset`, запускает человек).
import { spawnSync } from 'node:child_process';
import { backendDir, loadTestEnv } from './support/load-test-env';

const { file } = loadTestEnv();
const reset = process.argv.includes('--reset');
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
