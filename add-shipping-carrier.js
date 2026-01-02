import { pool } from './db.js';

async function addShippingCarrier() {
  const connection = await pool.getConnection();

  try {
    console.log('Adding shipping_carrier column to application tables...');

    // Add shipping_carrier to visa_applications
    await connection.query(`
      ALTER TABLE visa_applications
      ADD COLUMN IF NOT EXISTS shipping_carrier ENUM('usps', 'ups', 'fedex') DEFAULT NULL AFTER tracking_number
    `).catch(err => {
      if (!err.message.includes('Duplicate column')) {
        throw err;
      }
      console.log('shipping_carrier already exists in visa_applications');
    });

    // Add shipping_carrier to marriage_applications
    await connection.query(`
      ALTER TABLE marriage_applications
      ADD COLUMN IF NOT EXISTS shipping_carrier ENUM('usps', 'ups', 'fedex') DEFAULT NULL AFTER tracking_number
    `).catch(err => {
      if (!err.message.includes('Duplicate column')) {
        throw err;
      }
      console.log('shipping_carrier already exists in marriage_applications');
    });

    // Add shipping_carrier to birth_certificate_applications
    await connection.query(`
      ALTER TABLE birth_certificate_applications
      ADD COLUMN IF NOT EXISTS shipping_carrier ENUM('usps', 'ups', 'fedex') DEFAULT NULL AFTER tracking_number
    `).catch(err => {
      if (!err.message.includes('Duplicate column')) {
        throw err;
      }
      console.log('shipping_carrier already exists in birth_certificate_applications');
    });

    // Add shipping_carrier to travel_pass_applications
    await connection.query(`
      ALTER TABLE travel_pass_applications
      ADD COLUMN IF NOT EXISTS shipping_carrier ENUM('usps', 'ups', 'fedex') DEFAULT NULL AFTER tracking_number
    `).catch(err => {
      if (!err.message.includes('Duplicate column')) {
        throw err;
      }
      console.log('shipping_carrier already exists in travel_pass_applications');
    });

    console.log('✓ Successfully added shipping_carrier column to all application tables');

  } catch (error) {
    console.error('Error adding shipping_carrier:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

addShippingCarrier()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
