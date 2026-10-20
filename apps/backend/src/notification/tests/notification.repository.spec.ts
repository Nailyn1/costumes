import { createPrismaMock } from '../../test-utils';
import { NotificationRepository } from '../notification.repository';

const { prisma, reset } = createPrismaMock();
const repository = new NotificationRepository(prisma as never);

describe('NotificationRepository.findClientIdsWithConfirmedWhatsapp', () => {
  beforeEach(reset);

  it('accepts only confirmed delivery after the current client update', async () => {
    const changedAt = new Date('2026-10-20T10:00:00Z');
    prisma.notification.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-10-20T10:00:01Z'),
        visit: { clientId: 7, client: { updatedAt: changedAt } },
      },
      {
        createdAt: new Date('2026-10-20T09:59:59Z'),
        visit: { clientId: 8, client: { updatedAt: changedAt } },
      },
    ]);

    await expect(
      repository.findClientIdsWithConfirmedWhatsapp([7, 8]),
    ).resolves.toEqual(new Set([7]));
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['delivered', 'read', 'isConfirmed'] },
        visit: { clientId: { in: [7, 8] }, client: { deletedAt: null } },
      },
      select: {
        createdAt: true,
        visit: {
          select: {
            clientId: true,
            client: { select: { updatedAt: true } },
          },
        },
      },
    });
  });

  it('does not query the database for an empty batch', async () => {
    await expect(
      repository.findClientIdsWithConfirmedWhatsapp([]),
    ).resolves.toEqual(new Set());
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });
});
