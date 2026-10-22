import { DEFAULT_BRANDING, type Branding, type BrandingInput } from '@shiksha/api-contract';
import type { BrandingRepo } from '../ports.js';
import type { Sql } from './pg.js';

interface Row {
  name_hi: string;
  name_en: string;
  primary_color: string;
  accent_color: string;
  version: number;
}

export class PgBrandingRepo implements BrandingRepo {
  constructor(private readonly sql: Sql) {}

  async get(): Promise<Branding> {
    const [row] = await this.sql<Row[]>`select * from branding where id`;
    if (!row) return structuredClone(DEFAULT_BRANDING);
    return {
      name: { hi: row.name_hi, en: row.name_en },
      primary: row.primary_color,
      accent: row.accent_color,
      version: row.version,
    };
  }

  async set(input: BrandingInput): Promise<{ version: number }> {
    const [row] = await this.sql<{ version: number }[]>`
      update branding
      set name_hi = ${input.name.hi}, name_en = ${input.name.en},
          primary_color = ${input.primary}, accent_color = ${input.accent},
          version = version + 1
      where id
      returning version`;
    if (!row) throw new Error('the branding row is missing');
    return { version: row.version };
  }
}
