// Общая загрузка env для integration-тестов (prepare-скрипт и jest setup).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

export const backendDir = resolve(__dirname, '../..');

export function loadTestEnv() {
  const local = resolve(backendDir, '.env.test');
  const example = resolve(backendDir, '.env.test.example');
  const file = existsSync(local) ? local : example;
  // override: true — dev DATABASE_URL из shell/.env не должен попасть в тесты.
  dotenv.config({ path: file, override: true, quiet: true });

  const dbName = new URL(process.env.DATABASE_URL ?? '').pathname.replace(
    /^\//,
    '',
  );
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Integration-тесты работают только с БД *_test, а DATABASE_URL указывает на "${dbName}". Проверь ${file}.`,
    );
  }
  process.env.TZ = 'UTC';
  return { file };
}
