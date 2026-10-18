import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientChildService } from './client-child.service';
import { createPrismaMock, makeClient, makeChild } from '../test-utils';

const { prisma, reset } = createPrismaMock();

describe('ClientChildService', () => {
  let service: ClientChildService;

  beforeEach(() => {
    reset();
    service = new ClientChildService(prisma as never);
  });

  describe('createClient', () => {
    it('creates a client and returns the empty children list', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(makeClient());

      await expect(
        service.createClient({ name: 'Алия', phone: '+77071234567' }),
      ).resolves.toEqual({
        clientId: 7,
        name: 'Алия',
        phone: '+77071234567',
        children: [],
        isBlacklisted: false,
      });
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { phone: '+77071234567', deletedAt: null },
      });
      expect(prisma.client.create).toHaveBeenCalledWith({
        data: { name: 'Алия', phone: '+77071234567' },
      });
    });

    it('rejects a duplicate active phone number', async () => {
      prisma.client.findFirst.mockResolvedValue(makeClient());

      await expect(
        service.createClient({ name: 'Марина', phone: '+77071234567' }),
      ).rejects.toThrow(
        new BadRequestException('Client with this phone already exists'),
      );
      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('allows a phone number used only by a deleted client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(makeClient({ id: 8 }));

      await service.createClient({ name: 'Марина', phone: '+77071234567' });

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { phone: '+77071234567', deletedAt: null },
      });
      expect(prisma.client.create).toHaveBeenCalled();
    });
  });

  describe('createChild', () => {
    it('creates a child for an existing client', async () => {
      prisma.client.findUnique.mockResolvedValue(makeClient());
      prisma.child.create.mockResolvedValue(makeChild());

      await expect(
        service.createChild({ clientId: 7, name: 'Маша' }),
      ).resolves.toEqual({ childId: 1, name: 'Маша', clientId: 7 });
      expect(prisma.child.create).toHaveBeenCalledWith({
        data: { name: 'Маша', clientId: 7 },
      });
    });

    it('rejects a child whose client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.createChild({ clientId: 42, name: 'Маша' }),
      ).rejects.toThrow(new NotFoundException('Клиент с ID 42 не найден'));
      expect(prisma.child.create).not.toHaveBeenCalled();
    });

    // Для добавления deletedAt-фильтра заведена отдельная задача.
    it.todo('rejects creating a child for a deleted client (T-080)');
  });

  describe('soft deletion', () => {
    it('soft-deletes a client', async () => {
      prisma.client.update.mockResolvedValue(makeClient());

      await service.deleteClient(7);

      const [updateArgs] = prisma.client.update.mock.calls[0] as unknown as [
        { where: { id: number }; data: { deletedAt: Date } },
      ];
      expect(updateArgs).toMatchObject({ where: { id: 7 } });
      expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
    });

    it('soft-deletes a child', async () => {
      prisma.child.update.mockResolvedValue(makeChild());

      await service.deleteChild(1);

      const [updateArgs] = prisma.child.update.mock.calls[0] as unknown as [
        { where: { id: number }; data: { deletedAt: Date } },
      ];
      expect(updateArgs).toMatchObject({ where: { id: 1 } });
      expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
    });

    it('reports a missing child when the update fails', async () => {
      prisma.child.update.mockRejectedValue(new Error('missing'));

      await expect(service.deleteChild(99)).rejects.toThrow(
        new NotFoundException('Ребенок с этим ID 99 не найден'),
      );
    });

    it('reports a missing client when the update fails', async () => {
      prisma.client.update.mockRejectedValue(new Error('missing'));

      await expect(service.deleteClient(99)).rejects.toThrow(
        new NotFoundException('Client with ID 99 not found'),
      );
    });

    // Update/delete use id without a deletedAt filter; blacklist mutations share the issue.
    it.todo('treats already deleted clients and children as not found (T-081)');
    it.todo('does not change blacklist state for a deleted client (T-081)');
  });

  describe('client search', () => {
    it('returns no rows for queries shorter than two characters', async () => {
      await expect(service.searchClients(' А ')).resolves.toEqual([]);
      expect(prisma.client.findMany).not.toHaveBeenCalled();
    });

    it('searches active clients and children, returning active children and blacklist state', async () => {
      prisma.client.findMany.mockResolvedValue([
        {
          id: 7,
          name: 'Алия',
          phone: '+77071234567',
          isBlacklisted: true,
          children: [{ id: 1, name: 'Маша' }],
        },
      ]);

      await expect(service.searchClients('маш')).resolves.toEqual([
        {
          clientId: 7,
          name: 'Алия',
          phone: '+77071234567',
          isBlacklisted: true,
          children: [{ childId: 1, name: 'Маша' }],
        },
      ]);
      const [query] = prisma.client.findMany.mock.calls[0] as unknown as [
        {
          where: {
            deletedAt: null;
            OR: { children?: { some: { deletedAt: null } } }[];
          };
          select: {
            children: { where: { deletedAt: null } };
          };
          take: number;
        },
      ];
      expect(query.where.deletedAt).toBeNull();
      expect(
        query.where.OR.some(
          (filter) => filter.children?.some.deletedAt === null,
        ),
      ).toBe(true);
      expect(query.select.children.where).toEqual({ deletedAt: null });
      expect(query.take).toBe(30);
    });

    it('ranks exact client names ahead of prefix matches', async () => {
      prisma.client.findMany.mockResolvedValue([
        { ...makeClient({ id: 1, name: 'Алиясова' }), children: [] },
        { ...makeClient({ id: 2, name: 'Алия' }), children: [] },
      ]);

      const results = await service.searchClients('алия');

      expect(results.map((client) => client.clientId)).toEqual([2, 1]);
    });

    it('matches phone queries with country code and local digits', async () => {
      prisma.client.findMany.mockResolvedValue([
        { ...makeClient(), children: [] },
      ]);

      await service.searchClients('+7707');

      const [query] = prisma.client.findMany.mock.calls[0] as unknown as [
        { where: { deletedAt: null; OR: { phone?: object }[] } },
      ];
      expect(query.where.deletedAt).toBeNull();
      expect(query.where.OR).toContainEqual({ phone: { startsWith: '+7707' } });
      expect(query.where.OR).toContainEqual({ phone: { contains: '7707' } });
    });

    it.todo(
      'matches a phone query beginning with 8 against a stored +7 number (T-082)',
    );

    // Поведение поиска по подстроке имени зафиксировано в search.utils.spec.ts.
    it.todo('ranks "Арина" above "Марина" for query "Арина" (T-034)');
  });

  describe('listClients', () => {
    it('filters deleted clients and paginates the list', async () => {
      prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      );
      prisma.client.findMany.mockResolvedValue([
        { id: 9, name: 'Алия', phone: '+77071234567', isBlacklisted: false },
      ]);
      prisma.client.count.mockResolvedValue(21);
      prisma.order.count.mockResolvedValue(12);

      await expect(service.listClients(2, 10)).resolves.toEqual({
        items: [
          {
            clientId: 9,
            name: 'Алия',
            phone: '+77071234567',
            isBlacklisted: false,
          },
        ],
        totalOrders: 12,
        total: 21,
        page: 2,
        limit: 10,
        hasMore: true,
      });
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        skip: 10,
        take: 10,
        select: {
          id: true,
          name: true,
          phone: true,
          isBlacklisted: true,
        },
        orderBy: { id: 'desc' },
      });
      expect(prisma.client.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });
  });

  describe('detailedClient', () => {
    it('loads only active client children, visits, and orders', async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...makeClient(),
        children: [makeChild()],
        visits: [],
      });

      const result = await service.detailedClient(7);

      expect(result.client.children).toEqual([{ childId: 1, name: 'Маша' }]);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: 7, deletedAt: null },
        include: {
          children: { where: { deletedAt: null } },
          visits: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: {
              orders: {
                where: { deletedAt: null },
                include: { costume: true, child: true },
              },
            },
          },
        },
      });
    });

    it('returns not found for a deleted or missing client', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.detailedClient(7)).rejects.toThrow(
        new NotFoundException('Клиент с ID 7 не найден'),
      );
      expect(prisma.client.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 7, deletedAt: null } }),
      );
    });
  });

  describe('blacklist', () => {
    it('adds a reason and allows repeating the operation', async () => {
      prisma.client.update.mockResolvedValue(makeClient());

      await service.addClientToBlacklist(7, {
        blacklistReason: 'не вернула костюм',
      });
      await service.addClientToBlacklist(7, {
        blacklistReason: 'повторное нарушение',
      });

      expect(prisma.client.update).toHaveBeenNthCalledWith(1, {
        where: { id: 7 },
        data: { isBlacklisted: true, blacklistReason: 'не вернула костюм' },
      });
      expect(prisma.client.update).toHaveBeenNthCalledWith(2, {
        where: { id: 7 },
        data: { isBlacklisted: true, blacklistReason: 'повторное нарушение' },
      });
    });

    it('clears blacklist state and reason', async () => {
      prisma.client.update.mockResolvedValue(makeClient());

      await service.removeClientFromBlacklist(7);

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { isBlacklisted: false, blacklistReason: null },
      });
    });

    it.each([
      [
        'adds',
        (id: number) =>
          service.addClientToBlacklist(id, { blacklistReason: 'причина' }),
      ],
      ['removes', (id: number) => service.removeClientFromBlacklist(id)],
    ])(
      'reports a missing client when it %s blacklist state',
      async (_action, operation) => {
        prisma.client.update.mockRejectedValue(new Error('missing'));

        await expect(operation(99)).rejects.toThrow(
          new NotFoundException('Клиент с ID 99 не найден'),
        );
      },
    );
  });
});
