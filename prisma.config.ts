import { config as dotenvConfig } from "dotenv";
import { defineConfig } from "prisma/config";

dotenvConfig({ path: ".env.local", quiet: true });
dotenvConfig({ path: ".env", quiet: true });

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/maquinateam?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
