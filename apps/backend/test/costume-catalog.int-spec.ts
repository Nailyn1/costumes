import { TestApp, createTestApp } from './support/test-app';
import { authed, login } from './support/http';

interface CostumeBody {
  costumeId: number;
  name: string;
  category: {
    id: number;
    name: string;
    parentId: number | null;
    parentName: string | null;
  } | null;
  gender: string | null;
  heightFrom: number | null;
  heightTo: number | null;
  sizeLabel: string | null;
}

describe('costume catalog (integration)', () => {
  let t: TestApp;
  let api: ReturnType<typeof authed>;

  beforeAll(async () => {
    t = await createTestApp();
    api = authed(t.app, await login(t.app, t.user));
  });

  afterAll(async () => {
    await t.close();
  });

  async function createCategory(name: string, parentId?: number) {
    const res = await api
      .post('/costume-categories')
      .send({ name, parentId })
      .expect(201);
    return res.body as { id: number; name: string; parentId: number | null };
  }

  async function createCostume(body: Record<string, unknown>) {
    const res = await api.post('/costumes').send(body).expect(201);
    return res.body as CostumeBody;
  }

  it('finds a costume of a subcategory by its main category and keeps the search ranking', async () => {
    const national = await createCategory('Национальные');
    const caucasian = await createCategory('Кавказские', national.id);
    const christmas = await createCategory('Новогодние');

    const created = await createCostume({
      name: 'Кавказский дев.',
      categoryId: caucasian.id,
      gender: 'girl',
      heightFrom: 104,
      heightTo: 116,
      sizeLabel: 'Р32',
    });
    expect(created).toMatchObject({
      category: {
        id: caucasian.id,
        name: 'Кавказские',
        parentId: national.id,
        parentName: 'Национальные',
      },
      gender: 'girl',
      heightFrom: 104,
      heightTo: 116,
      sizeLabel: 'Р32',
    });
    const exact = await createCostume({
      name: 'Эльза',
      categoryId: christmas.id,
    });
    await createCostume({ name: 'Эльза снежная', gender: 'girl' });
    await createCostume({ name: 'Платье Эльза', categoryId: christmas.id });
    const plain = await createCostume({ name: 'Просто костюм' });
    expect(plain.category).toBeNull();

    const list = await api
      .get('/costumes/list')
      .query({ categoryId: national.id })
      .expect(200);
    expect(list.body).toMatchObject({
      total: 1,
      items: [{ costumeId: created.costumeId, gender: 'girl' }],
    });

    const bySubcategory = await api
      .get('/costumes/list')
      .query({ categoryId: caucasian.id })
      .expect(200);
    expect((bySubcategory.body as { total: number }).total).toBe(1);

    const uncategorized = await api
      .get('/costumes/list')
      .query({ withoutCategory: 'true' })
      .expect(200);
    expect(
      (uncategorized.body as { items: CostumeBody[] }).items.map(
        (item) => item.name,
      ),
    ).toEqual(['Просто костюм', 'Эльза снежная']);

    // Точное совпадение остаётся первым, фильтр сужает выдачу
    const search = await api
      .get('/costumes/search')
      .query({ q: 'Эльза', categoryId: christmas.id })
      .expect(200);
    expect((search.body as CostumeBody[]).map((item) => item.name)).toEqual([
      'Эльза',
      'Платье Эльза',
    ]);
    expect((search.body as CostumeBody[])[0].costumeId).toBe(exact.costumeId);
    expect((search.body as CostumeBody[])[0].category).toMatchObject({
      name: 'Новогодние',
      parentName: null,
    });

    const girls = await api
      .get('/costumes/search')
      .query({ q: 'Эльза', gender: 'girl' })
      .expect(200);
    expect((girls.body as CostumeBody[]).map((item) => item.name)).toEqual([
      'Эльза снежная',
    ]);

    const available = await api
      .get('/costumes/search-available')
      .query({
        q: 'Кавказский',
        startDate: '2026-12-20',
        endDate: '2026-12-21',
        categoryId: national.id,
      })
      .expect(200);
    expect(available.body).toMatchObject([
      { costumeId: created.costumeId, status: 'available' },
    ]);
  });

  it('matches a child height against the costume height range', async () => {
    await createCostume({
      name: 'Рост 104-116',
      heightFrom: 104,
      heightTo: 116,
    });
    await createCostume({ name: 'Рост 120', heightFrom: 120 });

    const names = async (height: number) => {
      const res = await api.get('/costumes/list').query({ height }).expect(200);
      return (res.body as { items: CostumeBody[] }).items.map((i) => i.name);
    };
    expect(await names(110)).toContain('Рост 104-116');
    expect(await names(116)).toContain('Рост 104-116');
    expect(await names(117)).not.toContain('Рост 104-116');
    expect(await names(120)).toContain('Рост 120');
    expect(await names(121)).not.toContain('Рост 120');
  });

  it('rejects invalid catalog fields and filters', async () => {
    await api
      .post('/costumes')
      .send({ name: 'Неверный рост', heightFrom: 120, heightTo: 104 })
      .expect(400);
    await api
      .post('/costumes')
      .send({ name: 'Рост 30', heightFrom: 30 })
      .expect(400);
    await api
      .post('/costumes')
      .send({ name: 'Длинный размер', sizeLabel: 'Р'.repeat(21) })
      .expect(400);
    await api
      .post('/costumes')
      .send({ name: 'Нет категории', categoryId: 99999 })
      .expect(400);
    await api.get('/costumes/list').query({ gender: 'robot' }).expect(400);
    await api.get('/costumes/list').query({ height: 'abc' }).expect(400);

    const costume = await createCostume({
      name: 'Рост проверка',
      heightFrom: 104,
      heightTo: 116,
    });
    await api
      .patch(`/costumes/${costume.costumeId}`)
      .send({ heightTo: 100 })
      .expect(400);
    const cleared = await api
      .patch(`/costumes/${costume.costumeId}`)
      .send({ heightFrom: null, heightTo: null })
      .expect(200);
    expect(cleared.body).toMatchObject({ heightFrom: null, heightTo: null });
  });

  it('keeps the category tree to two levels with unique sibling names', async () => {
    const main = await createCategory('Сказочные');
    const sub = await createCategory('Феи', main.id);

    await api
      .post('/costume-categories')
      .send({ name: 'сказочные' })
      .expect(409);
    await api
      .post('/costume-categories')
      .send({ name: 'Глубже', parentId: sub.id })
      .expect(400);
    await api
      .post('/costume-categories')
      .send({ name: 'Сирота', parentId: 99999 })
      .expect(404);
    // Такое же имя в другой ветке допустимо
    const other = await createCategory('Другие');
    await createCategory('Феи', other.id);

    const tree = await api.get('/costume-categories').expect(200);
    expect(tree.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: main.id,
          children: [expect.objectContaining({ id: sub.id, name: 'Феи' })],
        }),
      ]),
    );

    const renamed = await api
      .patch(`/costume-categories/${sub.id}`)
      .send({ name: 'Волшебные', sortOrder: 5 })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Волшебные', sortOrder: 5 });
  });

  it('blocks deleting a category with subcategories and detaches costumes from a deleted one', async () => {
    const main = await createCategory('Удаляемая основная');
    const sub = await createCategory('Удаляемая под', main.id);
    const costume = await createCostume({
      name: 'Костюм удаляемой',
      categoryId: sub.id,
    });

    await api.delete(`/costume-categories/${main.id}`).expect(409);

    await api.delete(`/costume-categories/${sub.id}`).expect(204);
    expect(
      await t.prisma.costume.findUnique({ where: { id: costume.costumeId } }),
    ).toMatchObject({ categoryId: null });
    expect(
      await t.prisma.costumeCategory.findUnique({ where: { id: sub.id } }),
    ).toMatchObject({ deletedAt: expect.any(Date) as never });

    await api.delete(`/costume-categories/${sub.id}`).expect(404);
    await api
      .patch(`/costumes/${costume.costumeId}`)
      .send({ categoryId: sub.id })
      .expect(400);

    await api.delete(`/costume-categories/${main.id}`).expect(204);
    const tree = await api.get('/costume-categories').expect(200);
    expect(
      (tree.body as { id: number }[]).map((node) => node.id),
    ).not.toContain(main.id);
  });
});
