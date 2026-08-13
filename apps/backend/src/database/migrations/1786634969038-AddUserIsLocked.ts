import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIsLocked1786634969038 implements MigrationInterface {
    name = 'AddUserIsLocked1786634969038'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "isLocked" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isLocked"`);
    }

}
