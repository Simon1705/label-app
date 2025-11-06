import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

/**
 * Runs the SQL migration to add labeling_type column to datasets table
 */
export async function runLabelingTypeMigration() {
  try {
    // Read the SQL migration file
    const sqlPath = path.join(process.cwd(), 'src', 'lib', 'migrations', 'add-dataset-labeling-type.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Labeling type migration error:', error);
      return { success: false, error };
    }
    
    console.log('Labeling type migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Labeling type migration execution error:', error);
    return { success: false, error };
  }
}