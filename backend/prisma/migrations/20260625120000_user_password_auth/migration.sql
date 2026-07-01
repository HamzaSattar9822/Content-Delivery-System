-- Add optional password hash for email/password authentication.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
