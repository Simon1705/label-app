-- Add is_active column to datasets table with default value of true
ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update RLS policies to respect is_active status
-- Users can view their own datasets (active or inactive)
DROP POLICY IF EXISTS "Users can view their own datasets" ON datasets;
CREATE POLICY "Users can view their own datasets" ON datasets
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid()
  );

-- Admins can view all datasets (active or inactive)
DROP POLICY IF EXISTS "Admins can view all datasets" ON datasets;
CREATE POLICY "Admins can view all datasets" ON datasets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Users can only view active datasets they are labeling
DROP POLICY IF EXISTS "Users can view entries of datasets they are labeling" ON dataset_entries;
CREATE POLICY "Users can view entries of datasets they are labeling" ON dataset_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM label_progress
      WHERE label_progress.dataset_id = dataset_entries.dataset_id
      AND label_progress.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_entries.dataset_id
      AND datasets.is_active = true
    )
  );

-- Admins can view all entries (active or inactive datasets)
DROP POLICY IF EXISTS "Admins can view all entries" ON dataset_entries;
CREATE POLICY "Admins can view all entries" ON dataset_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Users can view entries of active datasets they own
DROP POLICY IF EXISTS "Users can view entries of their own datasets" ON dataset_entries;
CREATE POLICY "Users can view entries of their own datasets" ON dataset_entries
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM datasets
      WHERE datasets.id = dataset_entries.dataset_id
      AND datasets.owner_id = auth.uid()
      AND datasets.is_active = true
    )
  );