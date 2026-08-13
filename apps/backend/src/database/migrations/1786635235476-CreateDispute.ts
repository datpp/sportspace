import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDispute1786635235476 implements MigrationInterface {
    name = 'CreateDispute1786635235476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."disputes_status_enum" AS ENUM('OPEN', 'RESOLVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "disputes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reason" text NOT NULL, "status" "public"."disputes_status_enum" NOT NULL DEFAULT 'OPEN', "resolutionNote" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" uuid, "raised_by_id" uuid, "resolved_by_id" uuid, CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_722d6e06d51e51095ef73df20d4" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_1e8426bb7937fd68804813287d2" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "disputes" ADD CONSTRAINT "FK_46a6bddc5b940e568033271437a" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_46a6bddc5b940e568033271437a"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_1e8426bb7937fd68804813287d2"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_722d6e06d51e51095ef73df20d4"`);
        await queryRunner.query(`DROP TABLE "disputes"`);
        await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
    }

}
