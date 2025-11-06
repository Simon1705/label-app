import { supabase } from '@/lib/supabase';

export async function migrateLabelingType() {
  try {
    // Add labeling_type column to datasets table with default value of 'multi_class'
    const { error: alterError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE datasets 
        ADD COLUMN IF NOT EXISTS labeling_type TEXT DEFAULT 'multi_class' CHECK (labeling_type IN ('binary', 'multi_class'));
      `
    });

    if (alterError) {
      console.error('Error adding labeling_type column:', alterError);
      throw alterError;
    }

    // Update existing datasets to have the default value
    const { error: updateError } = await supabase
      .from('datasets')
      .update({ labeling_type: 'multi_class' })
      .is('labeling_type', null);

    if (updateError) {
      console.error('Error updating existing datasets:', updateError);
      throw updateError;
    }

    console.log('Labeling type migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error };
  }
}