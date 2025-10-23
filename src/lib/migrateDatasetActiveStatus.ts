import { supabase } from '@/lib/supabase';

export async function migrateDatasetActiveStatus() {
  try {
    // Add is_active column to datasets table with default value of true
    const { error: alterError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE datasets 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      `
    });

    if (alterError) {
      console.error('Error adding is_active column:', alterError);
      throw alterError;
    }

    // Update existing datasets to be active by default
    const { error: updateError } = await supabase
      .from('datasets')
      .update({ is_active: true })
      .is('is_active', null);

    if (updateError) {
      console.error('Error updating existing datasets:', updateError);
      throw updateError;
    }

    console.log('Dataset active status migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error };
  }
}