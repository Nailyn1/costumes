import {
  ensureTestDatabaseExists,
  getTestDatabaseTarget,
  quotePostgresIdentifier,
} from '../../test/support/test-database';

describe('test database preparation', () => {
  it('targets the postgres maintenance database for a test database', () => {
    expect(
      getTestDatabaseTarget(
        'postgresql://user:pass@localhost:5432/costumes_test?schema=public',
      ),
    ).toEqual({
      databaseName: 'costumes_test',
      maintenanceUrl:
        'postgresql://user:pass@localhost:5432/postgres?schema=public',
    });
  });

  it('rejects database names without the test suffix', () => {
    expect(() =>
      getTestDatabaseTarget('postgresql://localhost:5432/costumes'),
    ).toThrow('Автоматическое создание разрешено только для PostgreSQL');
  });

  it('creates only a missing test database and tolerates a creation race', async () => {
    const knownDatabases = new Set<string>();
    const databaseExists = jest.fn((name: string) =>
      Promise.resolve(knownDatabases.has(name)),
    );
    const createDatabase = jest.fn((name: string) => {
      if (knownDatabases.has(name)) throw new Error('already exists');
      knownDatabases.add(name);
      return Promise.resolve();
    });
    const databaseUrl = 'postgresql://localhost:5432/costumes_test';

    await expect(
      ensureTestDatabaseExists(databaseUrl, databaseExists, createDatabase),
    ).resolves.toBe(true);
    await expect(
      ensureTestDatabaseExists(databaseUrl, databaseExists, createDatabase),
    ).resolves.toBe(false);
    expect(createDatabase).toHaveBeenCalledTimes(1);

    knownDatabases.delete('costumes_test');
    const racedExists = jest
      .fn<Promise<boolean>, [string, string]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await expect(
      ensureTestDatabaseExists(databaseUrl, racedExists, () => {
        knownDatabases.add('costumes_test');
        return Promise.reject(new Error('already exists'));
      }),
    ).resolves.toBe(false);
  });

  it('escapes quoted database identifiers', () => {
    expect(quotePostgresIdentifier('costumes"_test')).toBe('"costumes""_test"');
  });
});
