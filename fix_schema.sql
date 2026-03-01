ALTER TABLE interactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

