import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProvinceToVenues1786881475736 implements MigrationInterface {
    name = 'AddProvinceToVenues1786881475736'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "venues" ADD "province" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "province"`);
    }

}
