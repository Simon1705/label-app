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
-- For records without start_date but with completed labels, use the earliest label creation time
UPDATE label_progress 
SET start_date = (
  SELECT MIN(created_at)
  FROM dataset_labels
  WHERE dataset_labels.dataset_id = label_progress.dataset_id
  AND dataset_labels.user_id = label_progress.user_id
)
WHERE start_date IS NULL AND completed > 0;

-- Update completion dates for finished labeling tasks
-- Only set completed_date if it's NULL and the task is completed, but don't update it repeatedly
UPDATE label_progress 
SET completed_date = (
  SELECT MAX(created_at) 
  FROM dataset_labels 
  WHERE dataset_labels.dataset_id = label_progress.dataset_id 
  AND dataset_labels.user_id = label_progress.user_id
)
WHERE completed_date IS NULL AND completed = total AND total > 0;