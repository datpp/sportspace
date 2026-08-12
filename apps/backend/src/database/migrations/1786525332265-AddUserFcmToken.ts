import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserFcmToken1786525332265 implements MigrationInterface {
    name = 'AddUserFcmToken1786525332265'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "fcmToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fcmToken"`);
    }

}
