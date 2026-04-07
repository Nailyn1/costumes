import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaService } from './prisma.service';

const prisma = new PrismaService();

async function main() {
  const createUser = (index: number) => ({
    login: process.env[`USER${index}_LOGIN`] as string,
    name: process.env[`USER${index}_NAME`] as string,
    password: process.env[`USER${index}_PASSWORD`] as string,
  });

  // 2. Создаём массив пользователей
  const users = [
    createUser(1),
    createUser(2),
    createUser(3),
    createUser(4),
    createUser(5),
  ];

  for (const user of users) {
    const hashedPassword = await argon2.hash(user.password, {
      type: argon2.argon2id,
    });

    await prisma.user.upsert({
      where: { login: user.login },
      update: {},
      create: {
        login: user.login,
        name: user.name,
        password: hashedPassword,
      },
    });

    console.log(`Seed: user "${user.login}" created`);
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error('Seed error:', error.message);
    } else {
      console.error('Seed error:', error);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
