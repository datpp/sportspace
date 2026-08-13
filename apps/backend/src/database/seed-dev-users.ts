import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { Role } from '@sportspace/shared';
import dataSource from './data-source';
import { User } from '../user/entities/user.entity';

const DEV_PASSWORD = 'Password123!';

const DEV_USERS: { role: Role; email: string; fullName: string }[] = [
  { role: Role.ADMIN, email: 'admin@sportspace.dev', fullName: 'Dev Admin' },
  { role: Role.MERCHANT, email: 'merchant@sportspace.dev', fullName: 'Dev Merchant' },
  { role: Role.PLAYER, email: 'player@sportspace.dev', fullName: 'Dev Player' },
];

async function main() {
  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  for (const seed of DEV_USERS) {
    const existing = await userRepo.findOne({ where: { email: seed.email } });
    if (!existing) {
      await userRepo.save({
        email: seed.email,
        passwordHash,
        fullName: seed.fullName,
        role: seed.role,
      });
    }
    console.log(`${seed.role}_EMAIL=${seed.email}`);
    console.log(`${seed.role}_PASSWORD=${DEV_PASSWORD}`);
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
