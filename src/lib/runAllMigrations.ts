import { migrateLabelProgress } from './runMigration';
import { migrateDatasetActiveStatus } from './migrateDatasetActiveStatus';
import { runLabelingTypeMigration } from './runLabelingTypeMigration';

export async function runAllMigrations() {
  try {
    console.log('Running all migrations...');
    
    // Run label progress migration
    console.log('Running label progress migration...');
    const labelProgressResult = await migrateLabelProgress();
    if (!labelProgressResult.success) {
      throw new Error('Label progress migration failed: ' + labelProgressResult.error);
    }
    console.log('Label progress migration completed successfully');
    
    // Run dataset active status migration
    console.log('Running dataset active status migration...');
    const activeStatusResult = await migrateDatasetActiveStatus();
    if (!activeStatusResult.success) {
      throw new Error('Dataset active status migration failed: ' + activeStatusResult.error);
    }
    console.log('Dataset active status migration completed successfully');
    
    // Run labeling type migration
    console.log('Running labeling type migration...');
    const labelingTypeResult = await runLabelingTypeMigration();
    if (!labelingTypeResult.success) {
      throw new Error('Labeling type migration failed: ' + labelingTypeResult.error);
    }
    console.log('Labeling type migration completed successfully');
    
    console.log('All migrations completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error };
  }
}

// Run all migrations if this script is executed directly
if (require.main === module) {
  runAllMigrations()
    .then(result => {
      if (result.success) {
        console.log('All migrations completed successfully');
        process.exit(0);
      } else {
        console.error('Migrations failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}