import { join } from 'path';

// Single source of truth for where venue images live on disk — imported by
// main.ts (static serving), venue.controller.ts (multer destination), and
// venue.service.ts (delete-on-disk) so the __dirname-relative path is only
// computed once and can't drift between the three call sites.
export const UPLOADS_ROOT_DIR = join(__dirname, '..', '..', 'uploads');
export const VENUE_UPLOADS_DIR = join(UPLOADS_ROOT_DIR, 'venues');
