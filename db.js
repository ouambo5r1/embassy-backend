import mysql from 'mysql2/promise';

const {
  DB_HOST = 'localhost',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'zirhmute_Embassy',
  DB_PORT = 3306,
} = process.env;

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
};
