import type {
  Child,
  Client,
  Costume,
  Deposit,
  Order,
  Visit,
} from '../prisma/generated/client';

// Фабрики тестовых данных: валидный объект «по умолчанию» + точечные переопределения.
// Даты — местное время точки как UTC (см. domain.md «Время и даты»).

export const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 7,
  name: 'Алия',
  phone: '+77071234567',
  notes: null,
  isBlacklisted: false,
  blacklistReason: null,
  createdAt: new Date('2026-12-01T10:00:00Z'),
  updatedAt: new Date('2026-12-01T10:00:00Z'),
  deletedAt: null,
  ...overrides,
});

export const makeChild = (overrides: Partial<Child> = {}): Child => ({
  id: 1,
  name: 'Маша',
  clientId: 7,
  createdAt: new Date('2026-12-01T10:00:00Z'),
  updatedAt: new Date('2026-12-01T10:00:00Z'),
  deletedAt: null,
  ...overrides,
});

export const makeCostume = (overrides: Partial<Costume> = {}): Costume => ({
  id: 1,
  inventoryCode: 'C-0001',
  name: 'Эльза',
  notes: null,
  categoryId: null,
  gender: null,
  heightFrom: null,
  heightTo: null,
  sizeLabel: null,
  parts: [],
  createdAt: new Date('2026-12-01T10:00:00Z'),
  updatedAt: new Date('2026-12-01T10:00:00Z'),
  deletedAt: null,
  ...overrides,
});

export const makeVisit = (overrides: Partial<Visit> = {}): Visit => ({
  id: 1,
  visitCode: '1234',
  clientId: 7,
  startDateTime: new Date('2026-12-20T00:00:00Z'),
  endDateTime: new Date('2026-12-21T00:00:00Z'),
  issueTimeFrom: '10:00',
  issueTimeTo: '19:00',
  returnTimeUntil: '19:00',
  status: 'reserved',
  version: 1,
  notes: null,
  createdAt: new Date('2026-12-01T10:00:00Z'),
  updatedAt: new Date('2026-12-01T10:00:00Z'),
  deletedAt: null,
  ...overrides,
});

export const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 1,
  visitId: 1,
  clientId: 7,
  childId: 1,
  costumeId: 1,
  startDateTime: new Date('2026-12-20T00:00:00Z'),
  endDateTime: new Date('2026-12-21T00:00:00Z'),
  rentPrice: 5000,
  prepaymentAmount: 1000,
  finalPayment: null,
  issuedParts: null,
  tagStatus: 'not_written',
  status: 'reserved',
  notes: null,
  createdAt: new Date('2026-12-01T10:00:00Z'),
  updatedAt: new Date('2026-12-01T10:00:00Z'),
  deletedAt: null,
  ...overrides,
});

export const makeDeposit = (overrides: Partial<Deposit> = {}): Deposit => ({
  id: 1,
  visitId: 1,
  type: 'none',
  returned: false,
  amount: null,
  createdAt: new Date('2026-12-20T10:00:00Z'),
  updatedAt: new Date('2026-12-20T10:00:00Z'),
  deletedAt: null,
  ...overrides,
});

/** Тело `POST /visits` (CreateVisitRequest) с одним заказом. */
export const makeCreateVisitRequest = (
  overrides: Record<string, unknown> = {},
) => ({
  clientId: 7,
  visitCode: '1234',
  startDateTime: '2026-12-20',
  endDateTime: '2026-12-21',
  issueTimeFrom: '10:00',
  issueTimeTo: '19:00',
  returnTimeUntil: '19:00',
  orders: [
    { childId: 1, costumeId: 1, rentPrice: 5000, prepaymentAmount: 1000 },
  ],
  ...overrides,
});
