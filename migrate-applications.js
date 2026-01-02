import { pool } from './db.js';

async function migrateApplications() {
  const connection = await pool.getConnection();

  try {
    console.log('Starting application tables migration...');

    // Create marriage_applications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS marriage_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_name VARCHAR(255) NOT NULL,

        -- Spouse 1 Information
        spouse1_first_name VARCHAR(255) NOT NULL,
        spouse1_last_name VARCHAR(255) NOT NULL,
        spouse1_birth_date DATE NOT NULL,
        spouse1_birth_place VARCHAR(255) NOT NULL,
        spouse1_nationality VARCHAR(100) NOT NULL,
        spouse1_passport_number VARCHAR(100),
        spouse1_address TEXT NOT NULL,
        spouse1_phone VARCHAR(50) NOT NULL,
        spouse1_email VARCHAR(255) NOT NULL,
        spouse1_occupation VARCHAR(255),
        spouse1_father_name VARCHAR(255),
        spouse1_mother_name VARCHAR(255),

        -- Spouse 2 Information
        spouse2_first_name VARCHAR(255) NOT NULL,
        spouse2_last_name VARCHAR(255) NOT NULL,
        spouse2_birth_date DATE NOT NULL,
        spouse2_birth_place VARCHAR(255) NOT NULL,
        spouse2_nationality VARCHAR(100) NOT NULL,
        spouse2_passport_number VARCHAR(100),
        spouse2_address TEXT NOT NULL,
        spouse2_phone VARCHAR(50) NOT NULL,
        spouse2_email VARCHAR(255) NOT NULL,
        spouse2_occupation VARCHAR(255),
        spouse2_father_name VARCHAR(255),
        spouse2_mother_name VARCHAR(255),

        -- Marriage Details
        marriage_date DATE NOT NULL,
        marriage_place VARCHAR(255) NOT NULL,
        marriage_country VARCHAR(100) NOT NULL,
        marriage_type ENUM('civil', 'religious', 'traditional', 'other') NOT NULL,
        certificate_purpose TEXT NOT NULL,

        -- Documents
        documents JSON,

        -- Status and Tracking
        status ENUM('pending', 'under_review', 'approved', 'denied', 'shipped') DEFAULT 'pending',
        tracking_number VARCHAR(100),
        status_history TEXT,

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        -- Indexes
        INDEX idx_user_name (user_name),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ marriage_applications table created');

    // Create birth_certificate_applications table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS birth_certificate_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_name VARCHAR(255) NOT NULL,

        -- Child Information
        child_first_name VARCHAR(255) NOT NULL,
        child_last_name VARCHAR(255) NOT NULL,
        child_middle_name VARCHAR(255),
        child_birth_date DATE NOT NULL,
        child_birth_place VARCHAR(255) NOT NULL,
        child_birth_country VARCHAR(100) NOT NULL,
        child_gender ENUM('male', 'female', 'other') NOT NULL,
        child_nationality VARCHAR(100) NOT NULL,

        -- Father Information
        father_first_name VARCHAR(255) NOT NULL,
        father_last_name VARCHAR(255) NOT NULL,
        father_birth_date DATE,
        father_birth_place VARCHAR(255),
        father_nationality VARCHAR(100) NOT NULL,
        father_occupation VARCHAR(255),
        father_address TEXT,

        -- Mother Information
        mother_first_name VARCHAR(255) NOT NULL,
        mother_last_name VARCHAR(255) NOT NULL,
        mother_maiden_name VARCHAR(255),
        mother_birth_date DATE,
        mother_birth_place VARCHAR(255),
        mother_nationality VARCHAR(100) NOT NULL,
        mother_occupation VARCHAR(255),
        mother_address TEXT,

        -- Applicant Information (if different from parents)
        applicant_relationship VARCHAR(100),
        applicant_first_name VARCHAR(255),
        applicant_last_name VARCHAR(255),
        applicant_phone VARCHAR(50) NOT NULL,
        applicant_email VARCHAR(255) NOT NULL,
        applicant_address TEXT NOT NULL,

        -- Certificate Details
        certificate_purpose TEXT NOT NULL,
        is_minor BOOLEAN DEFAULT TRUE,
        original_registration_number VARCHAR(100),

        -- Documents
        documents JSON,

        -- Status and Tracking
        status ENUM('pending', 'under_review', 'approved', 'denied', 'shipped') DEFAULT 'pending',
        tracking_number VARCHAR(100),
        status_history TEXT,

        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        -- Indexes
        INDEX idx_user_name (user_name),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ birth_certificate_applications table created');

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

migrateApplications()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
