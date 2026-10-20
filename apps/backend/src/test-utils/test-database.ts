export interface TestDatabaseTarget {
  databaseName: string;
  maintenanceUrl: string;
}

export function getTestDatabaseTarget(databaseUrl: string): TestDatabaseTarget {
  const targetUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(targetUrl.pathname.slice(1));

  if (
    !['postgres:', 'postgresql:'].includes(targetUrl.protocol) ||
    !databaseName.endsWith('_test')
  ) {
    throw new Error(
      `Автоматическое создание разрешено только для PostgreSQL БД с суффиксом _test: "${databaseName}".`,
    );
  }

  targetUrl.pathname = '/postgres';
  return { databaseName, maintenanceUrl: targetUrl.toString() };
}

export async function ensureTestDatabaseExists(
  databaseUrl: string,
  databaseExists: (
    databaseName: string,
    maintenanceUrl: string,
  ) => Promise<boolean>,
  createDatabase: (
    databaseName: string,
    maintenanceUrl: string,
  ) => Promise<void>,
): Promise<boolean> {
  const { databaseName, maintenanceUrl } = getTestDatabaseTarget(databaseUrl);
  if (await databaseExists(databaseName, maintenanceUrl)) return false;

  try {
    await createDatabase(databaseName, maintenanceUrl);
    return true;
  } catch (error) {
    // Параллельный запуск мог создать БД после нашей проверки.
    if (await databaseExists(databaseName, maintenanceUrl)) return false;
    throw error;
  }
}

export function quotePostgresIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
