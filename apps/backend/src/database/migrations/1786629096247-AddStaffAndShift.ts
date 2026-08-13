import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaffAndShift1786629096247 implements MigrationInterface {
    name = 'AddStaffAndShift1786629096247'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying NOT NULL, "phone" character varying NOT NULL, "position" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "venue_id" uuid, CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shiftDate" date NOT NULL, "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "staff_id" uuid, CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "staff" ADD CONSTRAINT "FK_25f6e1ae519a82ea1a331f98522" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD CONSTRAINT "FK_5d750ec7e9b1c0c4f4edb89621f" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shifts" DROP CONSTRAINT "FK_5d750ec7e9b1c0c4f4edb89621f"`);
        await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_25f6e1ae519a82ea1a331f98522"`);
        await queryRunner.query(`DROP TABLE "shifts"`);
        await queryRunner.query(`DROP TABLE "staff"`);
    }

}
