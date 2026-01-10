import mysql from 'mysql2/promise';

const env = process.env;
const DB_HOST = env.DB_HOST || env.MYSQL_HOST || env.MYSQL_HOSTNAME || 'localhost';
const DB_USER = env.DB_USER || env.MYSQL_USER || 'root';
const DB_PASSWORD = env.DB_PASSWORD || env.MYSQL_PASSWORD || '';
const DB_NAME = env.DB_NAME || env.MYSQL_DATABASE || 'zirhmute_embassy';
const DB_PORT = Number(env.DB_PORT || env.MYSQL_PORT || 3306);

if (env.NODE_ENV === 'production' && (DB_HOST === 'localhost' || DB_HOST === '127.0.0.1')) {
  console.warn('DB_HOST is localhost in production; check your Dokploy environment variables.');
}

export const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const initDB = async () => {
  await pool.query('CREATE DATABASE IF NOT EXISTS ??', [DB_NAME]);
  await pool.query('USE ??', [DB_NAME]);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      firstname VARCHAR(255) NOT NULL,
      lastname TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visa_applications (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(255) NOT NULL,
      visa_type VARCHAR(50) NOT NULL,
      status ENUM('pending', 'under_review', 'approved', 'denied', 'shipped') NOT NULL DEFAULT 'pending',
      first_name VARCHAR(80),
      last_name VARCHAR(80),
      gender VARCHAR(20),
      date_of_birth DATE,
      place_of_birth VARCHAR(120),
      city VARCHAR(120),
      country_of_birth VARCHAR(120),
      nationality_origin VARCHAR(120),
      nationality_current VARCHAR(120),
      address VARCHAR(200),
      city_address VARCHAR(120),
      country_address VARCHAR(120),
      marital_status VARCHAR(50),
      father_name VARCHAR(160),
      profession VARCHAR(120),
      employer VARCHAR(160),
      employer_address VARCHAR(200),
      tracking_number VARCHAR(100) DEFAULT NULL,
      status_history TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_name (user_name),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL UNIQUE,
      user_name VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      status ENUM('active', 'closed') DEFAULT 'active',
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_session_id (session_id),
      INDEX idx_user_email (user_email),
      INDEX idx_status (status),
      INDEX idx_last_message_at (last_message_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT UNSIGNED NOT NULL,
      sender_type ENUM('user', 'bot', 'admin') NOT NULL,
      sender_name VARCHAR(255) DEFAULT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
      INDEX idx_conversation_id (conversation_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Birth Certificate Applications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS birth_certificate_applications (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(255) NOT NULL,
      child_first_name VARCHAR(100) NOT NULL,
      child_last_name VARCHAR(100) NOT NULL,
      child_middle_name VARCHAR(100),
      child_birth_date DATE NOT NULL,
      child_birth_place VARCHAR(150) NOT NULL,
      child_birth_country VARCHAR(100) NOT NULL,
      child_gender ENUM('male', 'female', 'other') NOT NULL,
      child_nationality VARCHAR(100) NOT NULL,
      father_first_name VARCHAR(100) NOT NULL,
      father_last_name VARCHAR(100) NOT NULL,
      father_birth_date DATE,
      father_birth_place VARCHAR(150),
      father_nationality VARCHAR(100) NOT NULL,
      father_occupation VARCHAR(100),
      father_address TEXT,
      mother_first_name VARCHAR(100) NOT NULL,
      mother_last_name VARCHAR(100) NOT NULL,
      mother_maiden_name VARCHAR(100),
      mother_birth_date DATE,
      mother_birth_place VARCHAR(150),
      mother_nationality VARCHAR(100) NOT NULL,
      mother_occupation VARCHAR(100),
      mother_address TEXT,
      applicant_relationship VARCHAR(100) NOT NULL,
      applicant_first_name VARCHAR(100) NOT NULL,
      applicant_last_name VARCHAR(100) NOT NULL,
      applicant_phone VARCHAR(50) NOT NULL,
      applicant_email VARCHAR(150) NOT NULL,
      applicant_address TEXT NOT NULL,
      certificate_purpose TEXT NOT NULL,
      is_minor BOOLEAN DEFAULT TRUE,
      original_registration_number VARCHAR(100),
      status ENUM('pending', 'under_review', 'approved', 'denied', 'shipped') DEFAULT 'pending',
      tracking_number VARCHAR(100),
      status_history TEXT,
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_name (user_name),
      INDEX idx_status (status),
      INDEX idx_tracking (tracking_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Marriage Applications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marriage_applications (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(255) NOT NULL,
      spouse1_first_name VARCHAR(100) NOT NULL,
      spouse1_last_name VARCHAR(100) NOT NULL,
      spouse1_birth_date DATE NOT NULL,
      spouse1_birth_place VARCHAR(150),
      spouse1_nationality VARCHAR(100) NOT NULL,
      spouse1_passport_number VARCHAR(50),
      spouse1_address TEXT,
      spouse1_phone VARCHAR(50),
      spouse1_email VARCHAR(150),
      spouse1_occupation VARCHAR(150),
      spouse1_father_name VARCHAR(150),
      spouse1_mother_name VARCHAR(150),
      spouse2_first_name VARCHAR(100) NOT NULL,
      spouse2_last_name VARCHAR(100) NOT NULL,
      spouse2_birth_date DATE NOT NULL,
      spouse2_birth_place VARCHAR(150),
      spouse2_nationality VARCHAR(100) NOT NULL,
      spouse2_passport_number VARCHAR(50),
      spouse2_address TEXT,
      spouse2_phone VARCHAR(50),
      spouse2_email VARCHAR(150),
      spouse2_occupation VARCHAR(150),
      spouse2_father_name VARCHAR(150),
      spouse2_mother_name VARCHAR(150),
      marriage_date DATE NOT NULL,
      marriage_place VARCHAR(150) NOT NULL,
      marriage_country VARCHAR(100) NOT NULL,
      marriage_type ENUM('civil', 'religious', 'traditional', 'other') NOT NULL,
      certificate_purpose TEXT NOT NULL,
      status ENUM('pending', 'under_review', 'approved', 'denied', 'shipped') DEFAULT 'pending',
      tracking_number VARCHAR(100),
      status_history TEXT,
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_name (user_name),
      INDEX idx_status (status),
      INDEX idx_tracking (tracking_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Travel Pass Applications table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS travel_pass_applications (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(255) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      maiden_name VARCHAR(100),
      date_of_birth DATE NOT NULL,
      place_of_birth VARCHAR(150) NOT NULL,
      country_of_birth VARCHAR(100) NOT NULL,
      gender ENUM('male', 'female', 'other') NOT NULL,
      nationality VARCHAR(100) NOT NULL,
      height VARCHAR(20),
      eye_color VARCHAR(50),
      hair_color VARCHAR(50),
      distinguishing_marks TEXT,
      current_address TEXT NOT NULL,
      city VARCHAR(100) NOT NULL,
      country VARCHAR(100) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(150) NOT NULL,
      father_name VARCHAR(160),
      mother_name VARCHAR(160),
      mother_maiden_name VARCHAR(100),
      marital_status ENUM('single', 'married', 'divorced', 'widowed') NOT NULL,
      spouse_name VARCHAR(160),
      travel_reason TEXT NOT NULL,
      destination_country VARCHAR(100) NOT NULL,
      destination_city VARCHAR(100),
      departure_date DATE NOT NULL,
      return_date DATE,
      travel_duration VARCHAR(50),
      emergency_contact_name VARCHAR(160) NOT NULL,
      emergency_contact_relationship VARCHAR(100) NOT NULL,
      emergency_contact_phone VARCHAR(50) NOT NULL,
      emergency_contact_address TEXT,
      passport_lost BOOLEAN DEFAULT FALSE,
      passport_stolen BOOLEAN DEFAULT FALSE,
      passport_expired BOOLEAN DEFAULT FALSE,
      previous_passport_number VARCHAR(100),
      passport_issue_date DATE,
      passport_expiry_date DATE,
      police_report_number VARCHAR(100),
      police_report_date DATE,
      status ENUM('pending', 'under_review', 'approved', 'denied', 'issued', 'collected') DEFAULT 'pending',
      tracking_number VARCHAR(100),
      status_history TEXT,
      admin_notes TEXT,
      issue_date DATE,
      expiry_date DATE,
      document_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_name (user_name),
      INDEX idx_status (status),
      INDEX idx_tracking (tracking_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Password reset tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_id (user_id),
      INDEX idx_token (token(255)),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Visitor tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      country VARCHAR(100),
      city VARCHAR(100),
      region VARCHAR(100),
      user_agent TEXT,
      device_type VARCHAR(50),
      browser VARCHAR(50),
      os VARCHAR(50),
      page_url VARCHAR(500),
      referrer VARCHAR(500),
      session_id VARCHAR(100),
      user_id INT UNSIGNED,
      visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ip (ip_address),
      INDEX idx_visited (visited_at),
      INDEX idx_session (session_id),
      INDEX idx_last_active (last_active),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};
