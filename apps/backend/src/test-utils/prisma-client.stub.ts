// Подмена сгенерированного Prisma-клиента для unit-тестов (см. moduleNameMapper
// в jest-конфиге): сам клиент импортирует `./x.js`, что ts-jest не резолвит.
export class PrismaClientKnownRequestError extends Error {
  code = '';
}

export const Prisma = { PrismaClientKnownRequestError };
export class PrismaClient {}
