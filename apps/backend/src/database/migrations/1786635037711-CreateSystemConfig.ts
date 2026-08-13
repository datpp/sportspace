import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSystemConfig1786635037711 implements MigrationInterface {
    name = 'CreateSystemConfig1786635037711'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "system_config" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cancellationFullRefundHours" integer NOT NULL DEFAULT '24', "cancellationPartialRefundHours" integer NOT NULL DEFAULT '2', "cancellationPartialRefundPercent" integer NOT NULL DEFAULT '50', "platformCommissionPercent" integer NOT NULL DEFAULT '10', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_db4e70ac0d27e588176e9bb44a0" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_config"`);
    }

}
