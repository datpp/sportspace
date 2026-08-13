import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedDto, PaginationMetaDto } from '../dto/paginated.dto';

export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(PaginatedDto, PaginationMetaDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
}
