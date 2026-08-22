import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImagesToVenue1787375822087 implements MigrationInterface {
    name = 'AddImagesToVenue1787375822087'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "venues" ADD "images" text NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "venues" DROP COLUMN "images"`);
    }

}
