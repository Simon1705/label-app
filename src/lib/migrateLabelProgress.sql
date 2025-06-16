-- Add columns for tracking labeling start and completion dates
ALTER TABLE label_progress 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP WITH TIME ZONE;

-- Update existing records to have a default start_date
UPDATE label_progress 
SET start_date = created_at 
WHERE start_date IS NULL AND completed > 0;

-- Update completion dates for finished labeling tasks
UPDATE label_progress 
SET completed_date = current_timestamp 
WHERE completed_date IS NULL AND completed = total AND total > 0; 