import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourtStatusAndCourtBlocks1787207615421 implements MigrationInterface {
    name = 'AddCourtStatusAndCourtBlocks1787207615421'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "court_blocks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "blockDate" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "reason" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "court_id" uuid, CONSTRAINT "PK_4b5a673735a903c09d7dc156a36" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."courts_status_enum" AS ENUM('ACTIVE', 'MAINTENANCE')`);
        await queryRunner.query(`ALTER TABLE "courts" ADD "status" "public"."courts_status_enum" NOT NULL DEFAULT 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "court_blocks" ADD CONSTRAINT "FK_bcd816a94c996643266ff9188b3" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "court_blocks" DROP CONSTRAINT "FK_bcd816a94c996643266ff9188b3"`);
        await queryRunner.query(`ALTER TABLE "courts" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."courts_status_enum"`);
        await queryRunner.query(`DROP TABLE "court_blocks"`);
    }

}
