import { pool } from './db.js';

async function fixDatabase() {
  try {
    console.log('Checking database schema...');

    // Show current structure
    const [columns] = await pool.query('SHOW COLUMNS FROM chat_conversations');
    console.log('Current chat_conversations columns:', columns.map(c => c.Field));

    // Drop and recreate the table with correct schema
    console.log('Recreating chat_conversations table...');
    await pool.query('DROP TABLE IF EXISTS chat_messages');
    await pool.query('DROP TABLE IF EXISTS chat_conversations');

    await pool.query(`
      CREATE TABLE chat_conversations (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE chat_messages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT UNSIGNED NOT NULL,
        sender_type ENUM('user', 'bot', 'admin') NOT NULL,
        sender_name VARCHAR(255) DEFAULT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✓ Chat tables recreated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing database:', err);
    process.exit(1);
  }
}

fixDatabase();
