import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'zirhmute_embassy',
};

async function migrateChatTables() {
  let connection;

  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully!');

    // Create chat_conversations table
    console.log('\nCreating chat_conversations table...');
    await connection.query(`
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
    console.log('✓ chat_conversations table created/verified');

    // Create chat_messages table
    console.log('\nCreating chat_messages table...');
    await connection.query(`
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
    console.log('✓ chat_messages table created/verified');

    // Verify tables exist
    console.log('\nVerifying tables...');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('chat_conversations', 'chat_messages')
    `, [dbConfig.database]);

    console.log('\nFound tables:');
    tables.forEach(table => {
      console.log(`  ✓ ${table.TABLE_NAME}`);
    });

    // Show table structures
    console.log('\nChat Conversations table structure:');
    const [convCols] = await connection.query(`DESCRIBE chat_conversations`);
    console.table(convCols.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default
    })));

    console.log('\nChat Messages table structure:');
    const [msgCols] = await connection.query(`DESCRIBE chat_messages`);
    console.table(msgCols.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Null: col.Null,
      Key: col.Key,
      Default: col.Default
    })));

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run migration
migrateChatTables();
