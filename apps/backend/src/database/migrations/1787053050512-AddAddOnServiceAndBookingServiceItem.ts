import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAddOnServiceAndBookingServiceItem1787053050512 implements MigrationInterface {
    name = 'AddAddOnServiceAndBookingServiceItem1787053050512'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "add_on_services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "price" numeric(12,2) NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "venue_id" uuid, CONSTRAINT "PK_b37824b03a53845cb5c54e0bd49" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "booking_service_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL, "unitPrice" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" uuid, "add_on_service_id" uuid, CONSTRAINT "PK_e1a4b356f01c01fc55b996ab836" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "add_on_services" ADD CONSTRAINT "FK_830f401e7fdd7ae312ea77b8039" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking_service_items" ADD CONSTRAINT "FK_e6d3a9a780745a9da44aacfffd7" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking_service_items" ADD CONSTRAINT "FK_7c8d8701ae1b047f6bae21980c4" FOREIGN KEY ("add_on_service_id") REFERENCES "add_on_services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_service_items" DROP CONSTRAINT "FK_7c8d8701ae1b047f6bae21980c4"`);
        await queryRunner.query(`ALTER TABLE "booking_service_items" DROP CONSTRAINT "FK_e6d3a9a780745a9da44aacfffd7"`);
        await queryRunner.query(`ALTER TABLE "add_on_services" DROP CONSTRAINT "FK_830f401e7fdd7ae312ea77b8039"`);
        await queryRunner.query(`DROP TABLE "booking_service_items"`);
        await queryRunner.query(`DROP TABLE "add_on_services"`);
    }

}
