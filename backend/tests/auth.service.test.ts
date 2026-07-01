import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuditAction } from '@prisma/client';
import { AuthService } from '../src/services/auth.service';
import { ROLES } from '../src/config/permissions';

describe('AuthService', () => {
  const userRepo = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const roleRepo = {
    findByName: vi.fn(),
  };
  const refreshRepo = {
    create: vi.fn(),
    findValidByHash: vi.fn(),
    revoke: vi.fn(),
  };
  const audit = {
    record: vi.fn(),
  };

  const service = new AuthService(
    userRepo as any,
    roleRepo as any,
    refreshRepo as any,
    audit as any,
  );

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

  beforeEach(() => {
    vi.clearAllMocks();
    roleRepo.findByName.mockResolvedValue({ id: 'role-1', name: ROLES.READ_ONLY });
    refreshRepo.create.mockResolvedValue({});
    userRepo.update.mockResolvedValue({});
    audit.record.mockResolvedValue(undefined);
  });

  it('signs up a new user with a hashed password', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.create.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      name: 'New User',
    });
    userRepo.findById.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      name: 'New User',
      avatarUrl: null,
      status: 'ACTIVE',
      role: {
        name: ROLES.READ_ONLY,
        permissions: [{ permission: { key: 'content:view' } }],
      },
    });

    const result = await service.signup(
      { email: 'new@example.com', password: 'password123', name: 'New User' },
      ctx,
    );

    expect(result.user.email).toBe('new@example.com');
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        passwordHash: expect.any(String),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.USER_CREATE }),
    );
  });

  it('rejects signup when email already exists', async () => {
    userRepo.findByEmail.mockResolvedValue({ id: 'existing' });

    await expect(
      service.signup({ email: 'taken@example.com', password: 'password123' }, ctx),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('logs in with a valid password', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    userRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
    });
    userRepo.findById.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      avatarUrl: null,
      status: 'ACTIVE',
      role: {
        name: ROLES.READ_ONLY,
        permissions: [{ permission: { key: 'content:view' } }],
      },
    });

    const result = await service.loginWithPassword(
      { email: 'user@example.com', password: 'password123' },
      ctx,
    );

    expect(result.user.email).toBe('user@example.com');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.LOGIN }),
    );
  });

  it('rejects login with invalid password', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    userRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash,
    });

    await expect(
      service.loginWithPassword({ email: 'user@example.com', password: 'wrong' }, ctx),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects password login for Google-only accounts', async () => {
    userRepo.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: null,
      googleId: 'google-123',
    });

    await expect(
      service.loginWithPassword({ email: 'user@example.com', password: 'anything' }, ctx),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
