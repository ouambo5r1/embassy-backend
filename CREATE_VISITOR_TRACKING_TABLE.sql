-- ============================================================================
-- VISITOR TRACKING TABLE
-- ============================================================================
-- This SQL script creates the visitor_logs table for tracking website visitors
-- Run this in your MySQL database (phpMyAdmin or MySQL console in Dokploy)
-- ============================================================================

-- Switch to your database
USE zirhmute_embassy;

-- Create the visitor_logs table
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
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip (ip_address),
  INDEX idx_visited (visited_at),
  INDEX idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Verify the table was created
SHOW TABLES LIKE 'visitor_logs';

-- Check the table structure
DESC visitor_logs;

-- Check if table is empty (should return 0 rows initially)
SELECT COUNT(*) as total_visitors FROM visitor_logs;
