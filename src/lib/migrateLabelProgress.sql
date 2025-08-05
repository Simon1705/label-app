-- Add columns for tracking labeling start and completion dates
ALTER TABLE label_progress 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE;

-- Update last_updated with the latest label time for each user and dataset
WITH latest_labels AS (
  SELECT
    user_id,
    dataset_id,
    MAX(created_at) AS last_label_time
  FROM dataset_labels
  GROUP BY user_id, dataset_id
)
UPDATE label_progress lp
SET last_updated = ll.last_label_time
FROM latest_labels ll
WHERE lp.user_id = ll.user_id AND lp.dataset_id = ll.dataset_id AND lp.last_updated IS NULL;

-- Update existing records to have a default start_date
UPDATE label_progress 
SET start_date = created_at 
WHERE start_date IS NULL AND completed > 0;

-- Update completion dates for finished labeling tasks
UPDATE label_progress 
SET completed_date = current_timestamp 
WHERE completed_date IS NULL AND completed = total AND total > 0;
 