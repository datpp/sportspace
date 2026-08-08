import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ExecutionContext, HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { Role } from '@sportspace/shared';
import { RolesGuard } from './roles.guard';

function buildContext(
  user: { role: Role } | undefined,
): DeepMocked<ExecutionContext> {
  const context = createMock<ExecutionContext>();
  context.switchToHttp.mockReturnValue(
    createMock<HttpArgumentsHost>({ getRequest: () => ({ user }) }),
  );
  return context;
}

describe('RolesGuard', () => {
  let reflector: DeepMocked<Reflector>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = createMock<Reflector>();
    guard = new RolesGuard(reflector);
  });

  it('allows access when the route has no @Roles() requirement', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.MERCHANT, Role.ADMIN]);
    const context = buildContext({ role: Role.MERCHANT });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when the user lacks the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.MERCHANT, Role.ADMIN]);
    const context = buildContext({ role: Role.PLAYER });

    expect(guard.canActivate(context)).toBe(false);
  });
});
