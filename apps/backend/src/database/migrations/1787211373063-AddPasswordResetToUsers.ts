import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetToUsers1787211373063 implements MigrationInterface {
    name = 'AddPasswordResetToUsers1787211373063'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordTokenHash" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordExpiresAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordTokenHash"`);
    }

}
