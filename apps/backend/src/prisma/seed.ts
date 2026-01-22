import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaService } from './prisma.service';

const prisma = new PrismaService();

async function main() {
  const users = [
    {
      login: 'Nail_prokat',
      name: 'Наиль',
      password: 'prokatPupavka_nail_4321',
    },
    {
      login: 'Asya_prokat',
      name: 'Ася',
      password: 'prokatPupavka_asya_1234',
    },
    {
      login: 'Mama_Prokat',
      name: 'Мама',
      password: 'prokatPupavka_mama_4312',
    },
    {
      login: 'Kamila_Prokat',
      name: 'Камила',
      password: 'prokatPupavka_kamila_1243',
    },
    {
      login: 'User_Prokat',
      name: 'Пользователь',
      password: 'prokatPupavka_user_3412',
    },
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
