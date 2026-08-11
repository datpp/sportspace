import { ValueTransformer } from 'typeorm';

/**
 * pg returns `decimal`/`numeric` columns as strings (avoids float precision
 * loss at the driver level); TypeORM does not convert them back on its own.
 * Apply to every `@Column({ type: 'decimal', ... })` so entities expose a
 * real `number` at runtime, matching their declared TS type.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};
