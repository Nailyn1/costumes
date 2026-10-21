import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

describe('word-start search and ranking (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  const dates = {
    startDateTime: new Date('2026-12-20T10:00:00.000Z'),
    endDateTime: new Date('2026-12-21T10:00:00.000Z'),
  };
  let nextCode = 9000;
  let nextPhone = 77070000000;

  async function createClient(name: string) {
    return t.prisma.client.create({
      data: { name, phone: `+${nextPhone++}` },
    });
  }

  async function createVisit(clientId: number) {
    return t.prisma.visit.create({
      data: {
        clientId,
        visitCode: String(nextCode++),
        ...dates,
        issueTimeFrom: '10:00',
        issueTimeTo: '19:00',
        returnTimeUntil: '19:00',
      },
    });
  }

  it('finds exact client, child, costume and visit names before prefixes, without matching Марина', async () => {
    const marina = await createClient('Марина');
    const prefix = await createClient('Арина старшая');
    const exact = await createClient('Арина');
    const childParent = await createClient('Родитель Арины');
    const marinaParent = await createClient('Родитель Марины');
    await t.prisma.child.create({
      data: { clientId: marinaParent.id, name: 'Марина ребёнок' },
    });
    await t.prisma.child.create({
      data: { clientId: childParent.id, name: 'Арина ребёнок младшая' },
    });
    await t.prisma.child.create({
      data: { clientId: exact.id, name: 'Арина ребёнок' },
    });
    const marinaCostume = await t.prisma.costume.create({
      data: { name: 'Марина' },
    });
    const prefixCostume = await t.prisma.costume.create({
      data: { name: 'Арина праздничная' },
    });
    const exactCostume = await t.prisma.costume.create({
      data: { name: 'Арина' },
    });
    const marinaVisit = await createVisit(marina.id);
    const prefixVisit = await createVisit(prefix.id);
    const exactVisit = await createVisit(exact.id);

    const clients = await api
      .get('/clients/search')
      .query({ q: 'Арина' })
      .expect(200);
    const clientIds = (clients.body as { clientId: number }[]).map(
      (c) => c.clientId,
    );
    expect(clientIds[0]).toBe(exact.id);
    expect(clientIds).toContain(prefix.id);
    expect(clientIds).toContain(childParent.id);
    expect(clientIds).not.toContain(marina.id);
    expect(clientIds).not.toContain(marinaParent.id);

    const children = await api
      .get('/clients/search')
      .query({ q: 'Арина ребёнок' })
      .expect(200);
    const childClientIds = (children.body as { clientId: number }[]).map(
      (c) => c.clientId,
    );
    expect(childClientIds[0]).toBe(exact.id);
    expect(childClientIds).toContain(childParent.id);
    expect(childClientIds).not.toContain(marinaParent.id);

    const costumes = await api
      .get('/costumes/search')
      .query({ q: 'Арина' })
      .expect(200);
    const costumeIds = (costumes.body as { costumeId: number }[]).map(
      (c) => c.costumeId,
    );
    expect(costumeIds[0]).toBe(exactCostume.id);
    expect(costumeIds).toContain(prefixCostume.id);
    expect(costumeIds).not.toContain(marinaCostume.id);

    const visits = await api
      .get('/visits/search')
      .query({ q: 'Арина' })
      .expect(200);
    const visitIds = (visits.body as { visitId: number }[]).map(
      (v) => v.visitId,
    );
    expect(visitIds[0]).toBe(exactVisit.id);
    expect(visitIds).toContain(prefixVisit.id);
    expect(visitIds).not.toContain(marinaVisit.id);
  });

  it('keeps exact matches after more candidates than each database take limit', async () => {
    const clientPrefixes = await Promise.all(
      Array.from({ length: 31 }, (_, i) =>
        createClient(`Арина лимит ${i + 1}`),
      ),
    );
    const exactClient = await createClient('Арина лимит');
    const costumePrefixes = await Promise.all(
      Array.from({ length: 21 }, (_, i) =>
        t.prisma.costume.create({ data: { name: `Арина лимит ${i + 1}` } }),
      ),
    );
    const exactCostume = await t.prisma.costume.create({
      data: { name: 'Арина лимит' },
    });
    const visitPrefixes = await Promise.all(
      Array.from({ length: 51 }, (_, i) =>
        createClient(`Арина визит ${i + 1}`),
      ),
    );
    await Promise.all(visitPrefixes.map((client) => createVisit(client.id)));
    const exactVisitClient = await createClient('Арина визит');
    const exactVisit = await createVisit(exactVisitClient.id);

    expect(clientPrefixes).toHaveLength(31);
    expect(costumePrefixes).toHaveLength(21);

    const clients = await api
      .get('/clients/search')
      .query({ q: 'Арина лимит' })
      .expect(200);
    expect((clients.body as { clientId: number }[])[0]?.clientId).toBe(
      exactClient.id,
    );

    const costumes = await api
      .get('/costumes/search')
      .query({ q: 'Арина лимит' })
      .expect(200);
    expect((costumes.body as { costumeId: number }[])[0]?.costumeId).toBe(
      exactCostume.id,
    );

    const visits = await api
      .get('/visits/search')
      .query({ q: 'Арина визит' })
      .expect(200);
    expect((visits.body as { visitId: number }[])[0]?.visitId).toBe(
      exactVisit.id,
    );
  });
});
