import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1786178153238 implements MigrationInterface {
  name = 'InitialSchema1786178153238';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('PLAYER', 'MERCHANT', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "fullName" character varying NOT NULL, "phone" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'PLAYER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "venues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "address" character varying NOT NULL, "lat" numeric(10,7) NOT NULL, "lng" numeric(10,7) NOT NULL, "description" character varying, "status" character varying NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "owner_id" uuid, CONSTRAINT "PK_cb0f885278d12384eb7a81818be" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "courts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "sport" character varying NOT NULL, "basePrice" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "venue_id" uuid, CONSTRAINT "PK_948a5d356c3083f3237ecbf9897" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingDate" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'PENDING', "totalAmount" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "court_id" uuid, "user_id" uuid, CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_booking_slot" ON "bookings"  ("court_id", "bookingDate", "startTime") WHERE status IN ('PENDING','CONFIRMED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "price" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "booking_services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL DEFAULT '1', "booking_id" uuid, "service_id" uuid, CONSTRAINT "PK_8997bf4d0728c8740c87694d59a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slotsTotal" integer NOT NULL, "slotsFilled" integer NOT NULL DEFAULT '0', "skillLevel" character varying, "status" character varying NOT NULL DEFAULT 'OPEN', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" uuid, "host_id" uuid, CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."match_participants_status_enum" AS ENUM('REQUESTED', 'ACCEPTED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "match_participants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."match_participants_status_enum" NOT NULL DEFAULT 'REQUESTED', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "match_id" uuid, "user_id" uuid, CONSTRAINT "PK_0ad61c7059cbe8a5c85c34376c1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying NOT NULL, "amount" numeric(12,2) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "transactionRef" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" uuid, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "price_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dayOfWeek" integer NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "price" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "court_id" uuid, CONSTRAINT "PK_332f84d0bdaa08303a9292653f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "comment" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "venue_id" uuid, "user_id" uuid, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "body" character varying NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "venues" ADD CONSTRAINT "FK_8cb5cf3df16fc75663f85b5b35c" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" ADD CONSTRAINT "FK_9da2e37c269dfe8cbbfd8d87583" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_2bd7e9c03db9f51a4765974abb8" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_64cd97487c5c42806458ab5520c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_services" ADD CONSTRAINT "FK_813fb23d7e327b6d9cff929cce6" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_services" ADD CONSTRAINT "FK_6e853453a3c24df1beed35c13eb" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_afd6031f8b80aba1157095e49b9" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_5291097df833c4177b5bb9333cc" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_participants" ADD CONSTRAINT "FK_997994aee635254fc31adec7440" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_participants" ADD CONSTRAINT "FK_bb0b53928a62088ac805487bb26" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_e86edf76dc2424f123b9023a2b2" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_rules" ADD CONSTRAINT "FK_6f91aa5584cbd66d366820bd23e" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_892f659696877d5b0a4a37de098" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_728447781a30bc3fcfe5c2f1cdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP CONSTRAINT "FK_892f659696877d5b0a4a37de098"`,
    );
    await queryRunner.query(
      `ALTER TABLE "price_rules" DROP CONSTRAINT "FK_6f91aa5584cbd66d366820bd23e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_e86edf76dc2424f123b9023a2b2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_participants" DROP CONSTRAINT "FK_bb0b53928a62088ac805487bb26"`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_participants" DROP CONSTRAINT "FK_997994aee635254fc31adec7440"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT "FK_5291097df833c4177b5bb9333cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT "FK_afd6031f8b80aba1157095e49b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_services" DROP CONSTRAINT "FK_6e853453a3c24df1beed35c13eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_services" DROP CONSTRAINT "FK_813fb23d7e327b6d9cff929cce6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_64cd97487c5c42806458ab5520c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_2bd7e9c03db9f51a4765974abb8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" DROP CONSTRAINT "FK_9da2e37c269dfe8cbbfd8d87583"`,
    );
    await queryRunner.query(
      `ALTER TABLE "venues" DROP CONSTRAINT "FK_8cb5cf3df16fc75663f85b5b35c"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "reviews"`);
    await queryRunner.query(`DROP TABLE "price_rules"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TABLE "match_participants"`);
    await queryRunner.query(
      `DROP TYPE "public"."match_participants_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "matches"`);
    await queryRunner.query(`DROP TABLE "booking_services"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP INDEX "public"."uq_booking_slot"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(`DROP TABLE "courts"`);
    await queryRunner.query(`DROP TABLE "venues"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
