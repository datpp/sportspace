import { PaginationMetaDto } from './dto/paginated.dto';

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMetaDto {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
