import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentRefundAmount1786598345734 implements MigrationInterface {
    name = 'AddPaymentRefundAmount1786598345734'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "refundAmount" numeric(12,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "refundAmount"`);
    }

}
