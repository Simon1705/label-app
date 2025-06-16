import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

/**
 * Runs the SQL migration to add date tracking columns to label_progress table
 */
export async function migrateLabelProgress() {
  try {
    // Read the SQL migration file
    const sqlPath = path.join(process.cwd(), 'src', 'lib', 'migrateLabelProgress.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration error:', error);
      return { success: false, error };
    }
    
    console.log('Label progress migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration execution error:', error);
    return { success: false, error };
  }
}

// Run migration immediately if this script is executed directly
if (require.main === module) {
  migrateLabelProgress()
    .then(result => {
      if (result.success) {
        console.log('Migration completed successfully');
        process.exit(0);
      } else {
        console.error('Migration failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
} 