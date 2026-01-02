import { pool } from './db.js';

/**
 * Migration script to update visa_applications table with new status workflow fields
 * Run this script once to update existing database
 */
async function migrateVisaStatus() {
  try {
    console.log('Starting migration for visa_applications table...');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'visa_applications'"
    );

    if (tables.length === 0) {
      console.log('visa_applications table does not exist. No migration needed.');
      return;
    }

    // Check existing columns
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM visa_applications"
    );
    const columnNames = columns.map(col => col.Field);

    // Modify status column to ENUM if it's not already
    if (columnNames.includes('status')) {
      console.log('Updating status column to ENUM type...');
      await pool.query(`
        ALTER TABLE visa_applications
        MODIFY COLUMN status ENUM('pending', 'under_review', 'approved', 'denied', 'shipped')
        NOT NULL DEFAULT 'pending'
      `);
      console.log('✓ Status column updated');
    }

    // Add tracking_number column if it doesn't exist
    if (!columnNames.includes('tracking_number')) {
      console.log('Adding tracking_number column...');
      await pool.query(`
        ALTER TABLE visa_applications
        ADD COLUMN tracking_number VARCHAR(100) DEFAULT NULL
      `);
      console.log('✓ tracking_number column added');
    }

    // Add status_history column if it doesn't exist
    if (!columnNames.includes('status_history')) {
      console.log('Adding status_history column...');
      await pool.query(`
        ALTER TABLE visa_applications
        ADD COLUMN status_history TEXT DEFAULT NULL
      `);
      console.log('✓ status_history column added');
    }

    // Add updated_at column if it doesn't exist
    if (!columnNames.includes('updated_at')) {
      console.log('Adding updated_at column...');
      await pool.query(`
        ALTER TABLE visa_applications
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
      console.log('✓ updated_at column added');
    }

    // Add indexes if they don't exist
    const [indexes] = await pool.query(`
      SHOW INDEX FROM visa_applications
    `);
    const indexNames = indexes.map(idx => idx.Key_name);

    if (!indexNames.includes('idx_user_name')) {
      console.log('Adding index on user_name...');
      await pool.query(`
        ALTER TABLE visa_applications
        ADD INDEX idx_user_name (user_name)
      `);
      console.log('✓ idx_user_name index added');
    }

    if (!indexNames.includes('idx_status')) {
      console.log('Adding index on status...');
      await pool.query(`
        ALTER TABLE visa_applications
        ADD INDEX idx_status (status)
      `);
      console.log('✓ idx_status index added');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNew fields added:');
    console.log('  - status: Now uses ENUM with values (pending, under_review, approved, denied, shipped)');
    console.log('  - tracking_number: VARCHAR(100) for passport shipping tracking');
    console.log('  - status_history: TEXT field to store status change timeline');
    console.log('  - updated_at: Auto-updated timestamp for tracking changes');
    console.log('  - Indexes: Added for better query performance\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
migrateVisaStatus()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
