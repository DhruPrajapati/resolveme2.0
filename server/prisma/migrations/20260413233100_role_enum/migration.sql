CREATE TYPE "Role" AS ENUM ('admin', 'agent');

ALTER TABLE "user" DROP COLUMN "role";
ALTER TABLE "user" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'agent';
