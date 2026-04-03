-- Fix: change default role to member
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member';
-- Downgrade all existing users to member (admin will be set via seed)
UPDATE users SET role = 'member' WHERE role = 'admin';
