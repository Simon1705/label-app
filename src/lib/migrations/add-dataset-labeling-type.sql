-- Add labeling_type column to datasets table with default value of 'multi_class'
ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS labeling_type TEXT DEFAULT 'multi_class' CHECK (labeling_type IN ('binary', 'multi_class'));