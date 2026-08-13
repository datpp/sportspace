import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewBookingRelation1786629724402 implements MigrationInterface {
    name = 'AddReviewBookingRelation1786629724402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" ADD "booking_id" uuid`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_review_booking" ON "reviews"  ("booking_id") `);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_bbd6ac6e3e6a8f8c6e0e8692d63" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_bbd6ac6e3e6a8f8c6e0e8692d63"`);
        await queryRunner.query(`DROP INDEX "public"."uq_review_booking"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP COLUMN "booking_id"`);
    }

}
