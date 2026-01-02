import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool, initDB } from './db.js';
import { generateToken, authMiddleware, adminMiddleware } from './auth.js';
import {
  signupValidation,
  loginValidation,
  contactValidation,
  visaApplicationValidation,
} from './validation.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const submissionLogoPath = path.join(__dirname, '..', 'public', 'favicon.png');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
if (process.env.NODE_ENV === 'production') {
  app.use('/api/', limiter);
}

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
});
app.use('/api/login', authLimiter);
app.use('/api/signup', authLimiter);

const PORT = process.env.PORT || 4000;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const CONTACT_TO = process.env.CONTACT_TO || 'ouambo5r@yahoo.fr';
const CONTACT_FROM = process.env.CONTACT_FROM || 'no-reply@usrcaembassy.org';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY is not set; contact emails will fail.');
}

// Initialize DB on start
initDB().catch((err) => {
  console.error('DB init error:', err);
  process.exit(1);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'embassy-backend' });
});

app.post('/api/contact', contactValidation, async (req, res) => {
  const { email, message } = req.body;

  if (!SENDGRID_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    await sgMail.send({
      to: CONTACT_TO,
      from: CONTACT_FROM,
      replyTo: email,
      subject: 'Contact form message',
      text: `From: ${email}\n\n${message}`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('SendGrid error:', err);
    res.status(500).json({ error: 'Unable to send message' });
  }
});

app.post('/api/signup', signupValidation, async (req, res) => {
  const { username, password, firstName, lastName } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO login (username, password, firstname, lastname) VALUES (?, ?, ?, ?)',
      [username.toLowerCase(), hash, firstName, lastName]
    );

    // Generate token for immediate login after signup
    const token = generateToken({
      id: result.insertId,
      username: username.toLowerCase(),
      isAdmin: false,
    });

    res.json({
      success: true,
      token,
      user: {
        id: result.insertId,
        username: username.toLowerCase(),
        fullName: `${firstName} ${lastName}`,
        isAdmin: false,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', loginValidation, async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM login WHERE username = ?', [username.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Check if user is admin (username contains 'admin')
    const isAdmin = user.username.includes('admin');

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      username: user.username,
      isAdmin,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: `${user.firstname} ${user.lastname}`,
        username: user.username,
        isAdmin,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/visa-applications', authMiddleware, visaApplicationValidation, async (req, res) => {
  const {
    visaType,
    firstName,
    lastName,
    gender,
    dateOfBirth,
    placeOfBirth,
    city,
    countryOfBirth,
    nationalityOrigin,
    nationalityCurrent,
    address,
    cityAddress,
    countryAddress,
    maritalStatus,
    fatherName,
    profession,
    employer,
    employerAddress,
  } = req.body;
  const userName = req.user?.username;

  try {
    const [result] = await pool.query(
      `INSERT INTO visa_applications
      (user_name, visa_type, status, first_name, last_name, gender, date_of_birth, place_of_birth, city, country_of_birth, nationality_origin, nationality_current, address, city_address, country_address, marital_status, father_name, profession, employer, employer_address)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userName.toLowerCase(),
        visaType,
        firstName || null,
        lastName || null,
        gender || null,
        dateOfBirth || null,
        placeOfBirth || null,
        city || null,
        countryOfBirth || null,
        nationalityOrigin || null,
        nationalityCurrent || null,
        address || null,
        cityAddress || null,
        countryAddress || null,
        maritalStatus || null,
        fatherName || null,
        profession || null,
        employer || null,
        employerAddress || null,
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/visa-applications', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, user_name as userName, visa_type as visaType, status, first_name as firstName, last_name as lastName, tracking_number, created_at as createdAt, updated_at as updatedAt FROM visa_applications ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single visa application by ID (admin only)
app.get('/api/visa-applications/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM visa_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });

    const application = rows[0];
    // Users can only view their own applications unless they're admin
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/visa-applications/user/:username', authMiddleware, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  // Users can only view their own applications unless they're admin
  if (!req.user.isAdmin && req.user.username !== username.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, user_name as userName, visa_type as visaType, status, first_name as firstName, last_name as lastName, tracking_number, created_at as createdAt, updated_at as updatedAt FROM visa_applications WHERE user_name = ? ORDER BY created_at DESC',
      [username.toLowerCase()]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update visa application status (admin only)
app.put('/api/visa-applications/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'under_review', 'approved', 'denied', 'shipped'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
  }

  try {
    // Get current application
    const [rows] = await pool.query(
      'SELECT id, user_name, status, status_history, first_name, last_name FROM visa_applications WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = rows[0];
    const oldStatus = application.status;

    // Build status history
    let statusHistory = [];
    if (application.status_history) {
      try {
        statusHistory = JSON.parse(application.status_history);
      } catch (e) {
        statusHistory = [];
      }
    }

    // Add new status change to history
    statusHistory.push({
      status,
      changedBy: req.user.username,
      changedAt: new Date().toISOString(),
      previousStatus: oldStatus,
    });

    // Update application
    await pool.query(
      'UPDATE visa_applications SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
      [status, JSON.stringify(statusHistory), id]
    );

    // Send email notification
    if (SENDGRID_API_KEY) {
      const statusMessages = {
        pending: 'Your visa application is pending review.',
        under_review: 'Your visa application is now under review. We will notify you of any updates.',
        approved: 'Congratulations! Your visa application has been approved.',
        denied: 'We regret to inform you that your visa application has been denied. Please contact us for more information.',
        shipped: 'Your passport has been shipped. You will receive tracking information shortly.',
      };

      try {
        await sgMail.send({
          to: application.user_name,
          from: CONTACT_FROM,
          subject: `Visa Application Status Update - ${status.replace('_', ' ').toUpperCase()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0b2f63;">Visa Application Status Update</h2>
              <p>Dear ${application.first_name || ''} ${application.last_name || ''},</p>
              <p><strong>Application ID:</strong> ${application.id}</p>
              <p><strong>New Status:</strong> <span style="color: #0b2f63; font-weight: bold;">${status.replace('_', ' ').toUpperCase()}</span></p>
              <p>${statusMessages[status]}</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 0.875rem;">
                This is an automated notification from the Central African Republic Embassy.
                <br>Please log in to your dashboard to view more details.
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Failed to send status update email:', emailErr);
      }
    }

    res.json({
      success: true,
      application: {
        id: application.id,
        status,
        previousStatus: oldStatus,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add tracking number to visa application (admin only)
app.put('/api/visa-applications/:id/tracking', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { trackingNumber, carrier } = req.body;

  if (!trackingNumber || typeof trackingNumber !== 'string' || trackingNumber.trim().length === 0) {
    return res.status(400).json({ error: 'Tracking number is required' });
  }

  try {
    // Get current application
    const [rows] = await pool.query(
      'SELECT id, user_name, tracking_number, shipping_carrier, first_name, last_name FROM visa_applications WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = rows[0];

    // Update tracking number and carrier
    await pool.query(
      'UPDATE visa_applications SET tracking_number = ?, shipping_carrier = ?, updated_at = NOW() WHERE id = ?',
      [trackingNumber.trim(), carrier || null, id]
    );

    // Send email notification
    if (SENDGRID_API_KEY) {
      try {
        const carrierName = carrier ? carrier.toUpperCase() : 'your carrier';
        await sgMail.send({
          to: application.user_name,
          from: CONTACT_FROM,
          subject: 'Tracking Number Available - Visa Application',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0b2f63;">Your Passport Has Been Shipped!</h2>
              <p>Dear ${application.first_name || ''} ${application.last_name || ''},</p>
              <p>Your passport for visa application <strong>#${application.id}</strong> has been shipped${carrier ? ` via ${carrierName}` : ''}.</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                ${carrier ? `<p style="margin: 0 0 12px 0; color: #374151;"><strong>Shipping Carrier:</strong> ${carrierName}</p>` : ''}
                <p style="margin: 0; color: #374151;"><strong>Tracking Number:</strong></p>
                <p style="margin: 8px 0 0 0; font-size: 1.5rem; color: #0b2f63; font-weight: bold;">
                  ${trackingNumber.trim()}
                </p>
              </div>
              <p>You can use this tracking number to monitor the delivery status of your passport${carrier ? ` on the ${carrierName} website` : ''}.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 0.875rem;">
                This is an automated notification from the Central African Republic Embassy.
                <br>Please log in to your dashboard to view more details.
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Failed to send tracking number email:', emailErr);
      }
    }

    res.json({
      success: true,
      application: {
        id: application.id,
        trackingNumber: trackingNumber.trim(),
        carrier: carrier || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/visa-applications/:id/pdf', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM visa_applications WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    // Users can only view their own PDFs unless they're admin
    const application = rows[0];
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barcode = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(application.id),
      scale: 3,
      height: 10,
      includetext: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=visa-${application.id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    const logoWidth = 80;
    if (fs.existsSync(submissionLogoPath)) {
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const logoX = doc.page.margins.left + (contentWidth - logoWidth) / 2;
      try {
        doc.image(submissionLogoPath, logoX, doc.y, { width: logoWidth });
        doc.moveDown();
      } catch (imgErr) {
        console.warn('Failed to add logo to visa PDF:', imgErr);
      }
    } else {
      console.warn('Visa PDF logo not found at', submissionLogoPath);
    }

    doc.fontSize(18).text('Visa Application', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Application ID: ${application.id}`);
    doc.text(`User: ${application.user_name}`);
    doc.text(`Visa Type: ${application.visa_type}`);
    doc.text(`Submitted: ${application.created_at}`);
    doc.moveDown();

    // Personal Information
    doc.fontSize(14).text('Personal Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.first_name || ''} ${application.last_name || ''}`);
    doc.text(`Gender: ${application.gender || 'N/A'}`);
    doc.text(`Date of Birth: ${application.date_of_birth || ''}`);
    doc.text(`Place of Birth: ${application.place_of_birth || ''}`);
    doc.text(`City: ${application.city || 'N/A'}`);
    doc.text(`Country of Birth: ${application.country_of_birth || ''}`);
    doc.moveDown();

    // Nationality Information
    doc.fontSize(14).text('Nationality:', { underline: true });
    doc.fontSize(11);
    doc.text(`Origin Nationality: ${application.nationality_origin || 'N/A'}`);
    doc.text(`Current Nationality: ${application.nationality_current || 'N/A'}`);
    doc.moveDown();

    // Contact Information
    doc.fontSize(14).text('Contact Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Address: ${application.address || ''}`);
    doc.text(`City: ${application.city_address || ''}`);
    doc.text(`Country: ${application.country_address || ''}`);
    doc.moveDown();

    // Family Information
    doc.fontSize(14).text('Family Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Marital Status: ${application.marital_status || 'N/A'}`);
    doc.text(`Father's Name: ${application.father_name || 'N/A'}`);
    doc.moveDown();

    // Employment Information
    doc.fontSize(14).text('Employment Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Profession: ${application.profession || 'N/A'}`);
    doc.text(`Employer: ${application.employer || 'N/A'}`);
    doc.text(`Employer Address: ${application.employer_address || 'N/A'}`);
    doc.moveDown();

    // Status at the bottom
    doc.fontSize(14).text('Application Status:', { underline: true });
    doc.fontSize(11);
    doc.text(`Current Status: ${application.status}`);
    doc.text(`Tracking Number: ${application.tracking_number || 'Pending'}`);
    if (application.updated_at) {
      doc.text(`Last Updated: ${application.updated_at}`);
    }
    doc.moveDown();

    doc.image(barcode, { fit: [200, 80], align: 'left' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// MARRIAGE CERTIFICATE APPLICATIONS
// ========================================

app.post('/api/marriage-applications', authMiddleware, async (req, res) => {
  const { user } = req;
  const userName = user.username;

  try {
    const formData = req.body;
    const [result] = await pool.query(
      `INSERT INTO marriage_applications (
        user_name, spouse1_first_name, spouse1_last_name, spouse1_birth_date, spouse1_birth_place,
        spouse1_nationality, spouse1_passport_number, spouse1_address, spouse1_phone, spouse1_email,
        spouse1_occupation, spouse1_father_name, spouse1_mother_name,
        spouse2_first_name, spouse2_last_name, spouse2_birth_date, spouse2_birth_place,
        spouse2_nationality, spouse2_passport_number, spouse2_address, spouse2_phone, spouse2_email,
        spouse2_occupation, spouse2_father_name, spouse2_mother_name,
        marriage_date, marriage_place, marriage_country, marriage_type, certificate_purpose
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userName.toLowerCase(),
        formData.spouse1_first_name, formData.spouse1_last_name, formData.spouse1_birth_date, formData.spouse1_birth_place,
        formData.spouse1_nationality, formData.spouse1_passport_number || null, formData.spouse1_address, formData.spouse1_phone, formData.spouse1_email,
        formData.spouse1_occupation || null, formData.spouse1_father_name || null, formData.spouse1_mother_name || null,
        formData.spouse2_first_name, formData.spouse2_last_name, formData.spouse2_birth_date, formData.spouse2_birth_place,
        formData.spouse2_nationality, formData.spouse2_passport_number || null, formData.spouse2_address, formData.spouse2_phone, formData.spouse2_email,
        formData.spouse2_occupation || null, formData.spouse2_father_name || null, formData.spouse2_mother_name || null,
        formData.marriage_date, formData.marriage_place, formData.marriage_country, formData.marriage_type, formData.certificate_purpose
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/marriage-applications', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_name as userName, spouse1_first_name as firstName, spouse1_last_name as lastName,
       spouse2_first_name, spouse2_last_name, marriage_date, status, tracking_number,
       created_at as createdAt, updated_at as updatedAt
       FROM marriage_applications ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single marriage application by ID
app.get('/api/marriage-applications/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM marriage_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });

    const application = rows[0];
    // Users can only view their own applications unless they're admin
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get marriage application PDF
app.get('/api/marriage-applications/:id/pdf', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM marriage_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const application = rows[0];
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barcode = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(application.id),
      scale: 3,
      height: 10,
      includetext: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=marriage-certificate-${application.id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    const logoWidth = 80;
    if (fs.existsSync(submissionLogoPath)) {
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const logoX = doc.page.margins.left + (contentWidth - logoWidth) / 2;
      try {
        doc.image(submissionLogoPath, logoX, doc.y, { width: logoWidth });
        doc.moveDown();
      } catch (imgErr) {
        console.warn('Failed to add logo to marriage PDF:', imgErr);
      }
    }

    doc.fontSize(18).text('Marriage Certificate Application', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Application ID: ${application.id}`);
    doc.text(`User: ${application.user_name}`);
    doc.text(`Submitted: ${application.created_at}`);
    doc.moveDown();

    // Spouse 1 Information
    doc.fontSize(14).text('Spouse 1 Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.spouse1_first_name || ''} ${application.spouse1_last_name || ''}`);
    doc.text(`Birth Date: ${application.spouse1_birth_date || ''}`);
    doc.text(`Birth Place: ${application.spouse1_birth_place || ''}`);
    doc.text(`Nationality: ${application.spouse1_nationality || ''}`);
    doc.text(`Passport Number: ${application.spouse1_passport_number || 'N/A'}`);
    doc.text(`Address: ${application.spouse1_address || ''}`);
    doc.text(`Phone: ${application.spouse1_phone || 'N/A'}`);
    doc.text(`Email: ${application.spouse1_email || 'N/A'}`);
    doc.text(`Occupation: ${application.spouse1_occupation || 'N/A'}`);
    doc.text(`Father's Name: ${application.spouse1_father_name || 'N/A'}`);
    doc.text(`Mother's Name: ${application.spouse1_mother_name || 'N/A'}`);
    doc.moveDown();

    // Spouse 2 Information
    doc.fontSize(14).text('Spouse 2 Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.spouse2_first_name || ''} ${application.spouse2_last_name || ''}`);
    doc.text(`Birth Date: ${application.spouse2_birth_date || ''}`);
    doc.text(`Birth Place: ${application.spouse2_birth_place || ''}`);
    doc.text(`Nationality: ${application.spouse2_nationality || ''}`);
    doc.text(`Passport Number: ${application.spouse2_passport_number || 'N/A'}`);
    doc.text(`Address: ${application.spouse2_address || ''}`);
    doc.text(`Phone: ${application.spouse2_phone || 'N/A'}`);
    doc.text(`Email: ${application.spouse2_email || 'N/A'}`);
    doc.text(`Occupation: ${application.spouse2_occupation || 'N/A'}`);
    doc.text(`Father's Name: ${application.spouse2_father_name || 'N/A'}`);
    doc.text(`Mother's Name: ${application.spouse2_mother_name || 'N/A'}`);
    doc.moveDown();

    // Marriage Details
    doc.fontSize(14).text('Marriage Details:', { underline: true });
    doc.fontSize(11);
    doc.text(`Marriage Date: ${application.marriage_date || ''}`);
    doc.text(`Marriage Place: ${application.marriage_place || ''}`);
    doc.text(`Marriage Country: ${application.marriage_country || ''}`);
    doc.text(`Marriage Type: ${application.marriage_type || 'N/A'}`);
    doc.text(`Certificate Purpose: ${application.certificate_purpose || 'N/A'}`);
    doc.moveDown();

    // Status at the bottom
    doc.fontSize(14).text('Application Status:', { underline: true });
    doc.fontSize(11);
    doc.text(`Current Status: ${application.status}`);
    doc.text(`Tracking Number: ${application.tracking_number || 'Pending'}`);
    if (application.updated_at) {
      doc.text(`Last Updated: ${application.updated_at}`);
    }
    doc.moveDown();

    doc.image(barcode, { fit: [200, 80], align: 'left' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/marriage-applications/user/:username', authMiddleware, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  if (!req.user.isAdmin && req.user.username !== username.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, spouse1_first_name as firstName, spouse1_last_name as lastName,
       spouse2_first_name, spouse2_last_name, marriage_date, status, tracking_number,
       created_at as createdAt, updated_at as updatedAt
       FROM marriage_applications WHERE user_name = ? ORDER BY created_at DESC`,
      [username.toLowerCase()]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/marriage-applications/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'under_review', 'approved', 'denied', 'shipped'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await pool.query(
      'UPDATE marriage_applications SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/marriage-applications/:id/tracking', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { trackingNumber, carrier } = req.body;

  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return res.status(400).json({ error: 'Tracking number is required' });
  }

  try {
    await pool.query(
      'UPDATE marriage_applications SET tracking_number = ?, shipping_carrier = ?, updated_at = NOW() WHERE id = ?',
      [trackingNumber.trim(), carrier || null, id]
    );
    res.json({ success: true, carrier: carrier || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// BIRTH CERTIFICATE APPLICATIONS
// ========================================

app.post('/api/birth-certificate-applications', authMiddleware, async (req, res) => {
  const { user } = req;
  const userName = user.username;

  try {
    const formData = req.body;
    const [result] = await pool.query(
      `INSERT INTO birth_certificate_applications (
        user_name, child_first_name, child_last_name, child_middle_name, child_birth_date,
        child_birth_place, child_birth_country, child_gender, child_nationality,
        father_first_name, father_last_name, father_birth_date, father_birth_place,
        father_nationality, father_occupation, father_address,
        mother_first_name, mother_last_name, mother_maiden_name, mother_birth_date,
        mother_birth_place, mother_nationality, mother_occupation, mother_address,
        applicant_relationship, applicant_first_name, applicant_last_name,
        applicant_phone, applicant_email, applicant_address,
        certificate_purpose, is_minor, original_registration_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userName.toLowerCase(),
        formData.child_first_name, formData.child_last_name, formData.child_middle_name || null, formData.child_birth_date,
        formData.child_birth_place, formData.child_birth_country, formData.child_gender, formData.child_nationality,
        formData.father_first_name, formData.father_last_name, formData.father_birth_date || null, formData.father_birth_place || null,
        formData.father_nationality, formData.father_occupation || null, formData.father_address || null,
        formData.mother_first_name, formData.mother_last_name, formData.mother_maiden_name || null, formData.mother_birth_date || null,
        formData.mother_birth_place || null, formData.mother_nationality, formData.mother_occupation || null, formData.mother_address || null,
        formData.applicant_relationship || 'parent', formData.applicant_first_name || null, formData.applicant_last_name || null,
        formData.applicant_phone, formData.applicant_email, formData.applicant_address,
        formData.certificate_purpose, formData.is_minor !== false, formData.original_registration_number || null
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/birth-certificate-applications', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_name as userName, child_first_name as firstName, child_last_name as lastName,
       child_birth_date, status, tracking_number, created_at as createdAt, updated_at as updatedAt
       FROM birth_certificate_applications ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single birth certificate application by ID
app.get('/api/birth-certificate-applications/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM birth_certificate_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });

    const application = rows[0];
    // Users can only view their own applications unless they're admin
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get birth certificate application PDF
app.get('/api/birth-certificate-applications/:id/pdf', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM birth_certificate_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const application = rows[0];
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barcode = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(application.id),
      scale: 3,
      height: 10,
      includetext: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=birth-certificate-${application.id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    const logoWidth = 80;
    if (fs.existsSync(submissionLogoPath)) {
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const logoX = doc.page.margins.left + (contentWidth - logoWidth) / 2;
      try {
        doc.image(submissionLogoPath, logoX, doc.y, { width: logoWidth });
        doc.moveDown();
      } catch (imgErr) {
        console.warn('Failed to add logo to birth certificate PDF:', imgErr);
      }
    }

    doc.fontSize(18).text('Birth Certificate Application', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Application ID: ${application.id}`);
    doc.text(`User: ${application.user_name}`);
    doc.text(`Submitted: ${application.created_at}`);
    doc.moveDown();

    // Child Information
    doc.fontSize(14).text('Child Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.child_first_name || ''} ${application.child_middle_name || ''} ${application.child_last_name || ''}`);
    doc.text(`Birth Date: ${application.child_birth_date || ''}`);
    doc.text(`Birth Place: ${application.child_birth_place || ''}`);
    doc.text(`Birth Country: ${application.child_birth_country || ''}`);
    doc.text(`Gender: ${application.child_gender || ''}`);
    doc.text(`Nationality: ${application.child_nationality || ''}`);
    doc.moveDown();

    // Father Information
    doc.fontSize(14).text('Father Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.father_first_name || ''} ${application.father_last_name || ''}`);
    doc.text(`Birth Date: ${application.father_birth_date || 'N/A'}`);
    doc.text(`Birth Place: ${application.father_birth_place || 'N/A'}`);
    doc.text(`Nationality: ${application.father_nationality || ''}`);
    doc.text(`Occupation: ${application.father_occupation || 'N/A'}`);
    doc.text(`Address: ${application.father_address || 'N/A'}`);
    doc.moveDown();

    // Mother Information
    doc.fontSize(14).text('Mother Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.mother_first_name || ''} ${application.mother_last_name || ''}`);
    doc.text(`Maiden Name: ${application.mother_maiden_name || 'N/A'}`);
    doc.text(`Birth Date: ${application.mother_birth_date || 'N/A'}`);
    doc.text(`Birth Place: ${application.mother_birth_place || 'N/A'}`);
    doc.text(`Nationality: ${application.mother_nationality || ''}`);
    doc.text(`Occupation: ${application.mother_occupation || 'N/A'}`);
    doc.text(`Address: ${application.mother_address || 'N/A'}`);
    doc.moveDown();

    // Applicant Information
    doc.fontSize(14).text('Applicant Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Relationship to Child: ${application.applicant_relationship || 'parent'}`);
    doc.text(`Name: ${application.applicant_first_name || 'N/A'} ${application.applicant_last_name || ''}`);
    doc.text(`Phone: ${application.applicant_phone || ''}`);
    doc.text(`Email: ${application.applicant_email || ''}`);
    doc.text(`Address: ${application.applicant_address || ''}`);
    doc.moveDown();

    // Additional Details
    doc.fontSize(14).text('Additional Details:', { underline: true });
    doc.fontSize(11);
    doc.text(`Certificate Purpose: ${application.certificate_purpose || 'N/A'}`);
    doc.text(`Is Minor: ${application.is_minor ? 'Yes' : 'No'}`);
    doc.text(`Original Registration Number: ${application.original_registration_number || 'N/A'}`);
    doc.moveDown();

    // Status at the bottom
    doc.fontSize(14).text('Application Status:', { underline: true });
    doc.fontSize(11);
    doc.text(`Current Status: ${application.status}`);
    doc.text(`Tracking Number: ${application.tracking_number || 'Pending'}`);
    if (application.updated_at) {
      doc.text(`Last Updated: ${application.updated_at}`);
    }
    doc.moveDown();

    doc.image(barcode, { fit: [200, 80], align: 'left' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/birth-certificate-applications/user/:username', authMiddleware, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  if (!req.user.isAdmin && req.user.username !== username.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, child_first_name as firstName, child_last_name as lastName,
       child_birth_date, status, tracking_number, created_at as createdAt, updated_at as updatedAt
       FROM birth_certificate_applications WHERE user_name = ? ORDER BY created_at DESC`,
      [username.toLowerCase()]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/birth-certificate-applications/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'under_review', 'approved', 'denied', 'shipped'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    await pool.query(
      'UPDATE birth_certificate_applications SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/birth-certificate-applications/:id/tracking', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { trackingNumber, carrier } = req.body;

  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return res.status(400).json({ error: 'Tracking number is required' });
  }

  try {
    await pool.query(
      'UPDATE birth_certificate_applications SET tracking_number = ?, shipping_carrier = ?, updated_at = NOW() WHERE id = ?',
      [trackingNumber.trim(), carrier || null, id]
    );
    res.json({ success: true, carrier: carrier || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// Travel Pass Applications Endpoints
// ========================================

app.post('/api/travel-pass-applications', authMiddleware, async (req, res) => {
  const { user } = req;
  const formData = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO travel_pass_applications (
        user_id, user_name,
        first_name, last_name, maiden_name, date_of_birth, place_of_birth, country_of_birth, gender, nationality,
        height, eye_color, hair_color, distinguishing_marks,
        current_address, city, country, phone, email,
        father_name, mother_name, mother_maiden_name, marital_status, spouse_name,
        travel_reason, destination_country, destination_city, departure_date, return_date, travel_duration,
        emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, emergency_contact_address,
        passport_lost, passport_stolen, passport_expired, previous_passport_number,
        passport_issue_date, passport_expiry_date, police_report_number, police_report_date,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, user.username,
        formData.first_name, formData.last_name, formData.maiden_name || null, formData.date_of_birth,
        formData.place_of_birth, formData.country_of_birth, formData.gender, formData.nationality,
        formData.height || null, formData.eye_color || null, formData.hair_color || null, formData.distinguishing_marks || null,
        formData.current_address, formData.city, formData.country, formData.phone, formData.email,
        formData.father_name || null, formData.mother_name || null, formData.mother_maiden_name || null,
        formData.marital_status, formData.spouse_name || null,
        formData.travel_reason, formData.destination_country, formData.destination_city || null,
        formData.departure_date, formData.return_date || null, formData.travel_duration || null,
        formData.emergency_contact_name, formData.emergency_contact_relationship,
        formData.emergency_contact_phone, formData.emergency_contact_address || null,
        formData.passport_lost || false, formData.passport_stolen || false, formData.passport_expired || false,
        formData.previous_passport_number || null, formData.passport_issue_date || null,
        formData.passport_expiry_date || null, formData.police_report_number || null, formData.police_report_date || null,
        'pending'
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

app.get('/api/travel-pass-applications', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_name as userName, first_name as firstName, last_name as lastName,
       date_of_birth as dateOfBirth, nationality, destination_country as destinationCountry,
       departure_date as departureDate, status, tracking_number as trackingNumber,
       created_at as createdAt
       FROM travel_pass_applications
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single travel pass application by ID
app.get('/api/travel-pass-applications/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM travel_pass_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });

    const application = rows[0];
    // Users can only view their own applications unless they're admin
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(application);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get travel pass application PDF
app.get('/api/travel-pass-applications/:id/pdf', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM travel_pass_applications WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const application = rows[0];
    if (!req.user.isAdmin && req.user.username !== application.user_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const barcode = await bwipjs.toBuffer({
      bcid: 'code128',
      text: String(application.id),
      scale: 3,
      height: 10,
      includetext: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=travel-pass-${application.id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    const logoWidth = 80;
    if (fs.existsSync(submissionLogoPath)) {
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const logoX = doc.page.margins.left + (contentWidth - logoWidth) / 2;
      try {
        doc.image(submissionLogoPath, logoX, doc.y, { width: logoWidth });
        doc.moveDown();
      } catch (imgErr) {
        console.warn('Failed to add logo to travel pass PDF:', imgErr);
      }
    }

    doc.fontSize(18).text('Travel Pass Application', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Application ID: ${application.id}`);
    doc.text(`User: ${application.user_name}`);
    doc.text(`Submitted: ${application.created_at}`);
    doc.moveDown();

    // Personal Information
    doc.fontSize(14).text('Personal Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.first_name || ''} ${application.last_name || ''}`);
    doc.text(`Maiden Name: ${application.maiden_name || 'N/A'}`);
    doc.text(`Date of Birth: ${application.date_of_birth || ''}`);
    doc.text(`Place of Birth: ${application.place_of_birth || ''}`);
    doc.text(`Country of Birth: ${application.country_of_birth || ''}`);
    doc.text(`Gender: ${application.gender || ''}`);
    doc.text(`Nationality: ${application.nationality || ''}`);
    doc.moveDown();

    // Physical Description
    doc.fontSize(14).text('Physical Description:', { underline: true });
    doc.fontSize(11);
    doc.text(`Height: ${application.height || 'N/A'}`);
    doc.text(`Eye Color: ${application.eye_color || 'N/A'}`);
    doc.text(`Hair Color: ${application.hair_color || 'N/A'}`);
    doc.text(`Distinguishing Marks: ${application.distinguishing_marks || 'N/A'}`);
    doc.moveDown();

    // Contact Information
    doc.fontSize(14).text('Contact Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Address: ${application.current_address || ''}`);
    doc.text(`City: ${application.city || ''}`);
    doc.text(`Country: ${application.country || ''}`);
    doc.text(`Phone: ${application.phone || ''}`);
    doc.text(`Email: ${application.email || ''}`);
    doc.moveDown();

    // Family Information
    doc.fontSize(14).text('Family Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Father's Name: ${application.father_name || 'N/A'}`);
    doc.text(`Mother's Name: ${application.mother_name || 'N/A'}`);
    doc.text(`Mother's Maiden Name: ${application.mother_maiden_name || 'N/A'}`);
    doc.text(`Marital Status: ${application.marital_status || ''}`);
    doc.text(`Spouse Name: ${application.spouse_name || 'N/A'}`);
    doc.moveDown();

    // Travel Information
    doc.fontSize(14).text('Travel Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Travel Reason: ${application.travel_reason || ''}`);
    doc.text(`Destination Country: ${application.destination_country || ''}`);
    doc.text(`Destination City: ${application.destination_city || 'N/A'}`);
    doc.text(`Departure Date: ${application.departure_date || ''}`);
    doc.text(`Return Date: ${application.return_date || 'N/A'}`);
    doc.text(`Travel Duration: ${application.travel_duration || 'N/A'} days`);
    doc.moveDown();

    // Emergency Contact
    doc.fontSize(14).text('Emergency Contact:', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${application.emergency_contact_name || ''}`);
    doc.text(`Relationship: ${application.emergency_contact_relationship || ''}`);
    doc.text(`Phone: ${application.emergency_contact_phone || ''}`);
    doc.text(`Address: ${application.emergency_contact_address || 'N/A'}`);
    doc.moveDown();

    // Passport Information
    doc.fontSize(14).text('Passport Information:', { underline: true });
    doc.fontSize(11);
    doc.text(`Passport Lost: ${application.passport_lost ? 'Yes' : 'No'}`);
    doc.text(`Passport Stolen: ${application.passport_stolen ? 'Yes' : 'No'}`);
    doc.text(`Passport Expired: ${application.passport_expired ? 'Yes' : 'No'}`);
    doc.text(`Previous Passport Number: ${application.previous_passport_number || 'N/A'}`);
    doc.text(`Passport Issue Date: ${application.passport_issue_date || 'N/A'}`);
    doc.text(`Passport Expiry Date: ${application.passport_expiry_date || 'N/A'}`);
    doc.text(`Police Report Number: ${application.police_report_number || 'N/A'}`);
    doc.text(`Police Report Date: ${application.police_report_date || 'N/A'}`);
    doc.moveDown();

    // Status at the bottom
    doc.fontSize(14).text('Application Status:', { underline: true });
    doc.fontSize(11);
    doc.text(`Current Status: ${application.status}`);
    doc.text(`Tracking Number: ${application.tracking_number || 'Pending'}`);
    if (application.updated_at) {
      doc.text(`Last Updated: ${application.updated_at}`);
    }
    doc.moveDown();

    doc.image(barcode, { fit: [200, 80], align: 'left' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/travel-pass-applications/user/:username', authMiddleware, async (req, res) => {
  const { user } = req;
  const { username } = req.params;

  if (user.username !== username && !user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM travel_pass_applications WHERE user_name = ? ORDER BY created_at DESC`,
      [username]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/travel-pass-applications/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'under_review', 'approved', 'denied', 'issued', 'collected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const [current] = await pool.query('SELECT status_history FROM travel_pass_applications WHERE id = ?', [id]);
    const history = current[0]?.status_history ? JSON.parse(current[0].status_history) : [];
    history.push({ status, timestamp: new Date().toISOString() });

    await pool.query(
      'UPDATE travel_pass_applications SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
      [status, JSON.stringify(history), id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/travel-pass-applications/:id/tracking', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { trackingNumber, carrier } = req.body;

  if (!trackingNumber || typeof trackingNumber !== 'string') {
    return res.status(400).json({ error: 'Tracking number is required' });
  }

  try {
    await pool.query(
      'UPDATE travel_pass_applications SET tracking_number = ?, shipping_carrier = ?, updated_at = NOW() WHERE id = ?',
      [trackingNumber.trim(), carrier || null, id]
    );
    res.json({ success: true, carrier: carrier || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// CHAT ENDPOINTS
// ========================================

// Start or get chat conversation
app.post('/api/chat/conversation', async (req, res) => {
  const { sessionId, userName, userEmail } = req.body;

  if (!sessionId || !userName || !userEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if conversation exists
    const [existing] = await pool.query(
      'SELECT * FROM chat_conversations WHERE session_id = ?',
      [sessionId]
    );

    if (existing.length > 0) {
      // Return existing conversation with messages
      const [messages] = await pool.query(
        'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
        [existing[0].id]
      );
      return res.json({
        conversation: existing[0],
        messages,
      });
    }

    // Create new conversation
    const [result] = await pool.query(
      'INSERT INTO chat_conversations (session_id, user_name, user_email) VALUES (?, ?, ?)',
      [sessionId, userName, userEmail]
    );

    res.json({
      conversation: {
        id: result.insertId,
        session_id: sessionId,
        user_name: userName,
        user_email: userEmail,
        status: 'active',
      },
      messages: [],
    });
  } catch (err) {
    console.error('Chat conversation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Save chat message
app.post('/api/chat/message', async (req, res) => {
  const { sessionId, senderType, senderName, message } = req.body;

  if (!sessionId || !senderType || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get conversation
    const [conversations] = await pool.query(
      'SELECT id FROM chat_conversations WHERE session_id = ?',
      [sessionId]
    );

    if (!conversations.length) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversationId = conversations[0].id;

    // Save message
    await pool.query(
      'INSERT INTO chat_messages (conversation_id, sender_type, sender_name, message) VALUES (?, ?, ?, ?)',
      [conversationId, senderType, senderName, message]
    );

    // Update conversation last_message_at
    await pool.query(
      'UPDATE chat_conversations SET last_message_at = NOW() WHERE id = ?',
      [conversationId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Save message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all conversations (admin only)
app.get('/api/chat/conversations', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [conversations] = await pool.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count,
        (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM chat_conversations c
      ORDER BY c.last_message_at DESC
    `);
    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get conversation messages (admin only)
app.get('/api/chat/conversations/:id/messages', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const [messages] = await pool.query(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send admin reply
app.post('/api/chat/admin-reply', authMiddleware, adminMiddleware, async (req, res) => {
  const { conversationId, message } = req.body;
  const adminName = req.user.username;

  if (!conversationId || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Save admin message
    await pool.query(
      'INSERT INTO chat_messages (conversation_id, sender_type, sender_name, message) VALUES (?, ?, ?, ?)',
      [conversationId, 'admin', adminName, message]
    );

    // Update conversation last_message_at
    await pool.query(
      'UPDATE chat_conversations SET last_message_at = NOW() WHERE id = ?',
      [conversationId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Admin reply error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Close conversation
app.put('/api/chat/conversations/:id/close', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      'UPDATE chat_conversations SET status = ? WHERE id = ?',
      ['closed', id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Close conversation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get conversation by session ID (for user to retrieve their chat)
app.get('/api/chat/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const [conversations] = await pool.query(
      'SELECT * FROM chat_conversations WHERE session_id = ?',
      [sessionId]
    );

    if (!conversations.length) {
      return res.json({ conversation: null, messages: [] });
    }

    const [messages] = await pool.query(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversations[0].id]
    );

    res.json({
      conversation: conversations[0],
      messages,
    });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// ADMIN USER MANAGEMENT ENDPOINTS
// ========================================

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT
        id,
        username,
        firstname,
        lastname,
        created_at
      FROM login
      ORDER BY created_at DESC
    `);
    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ========================================
// ADMIN ANALYTICS ENDPOINT
// ========================================

app.get('/api/admin/analytics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Get total users with growth rate
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM login');
    const [usersLast30Days] = await pool.query(
      'SELECT COUNT(*) as count FROM login WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [usersLast7Days] = await pool.query(
      'SELECT COUNT(*) as count FROM login WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    // Get total applications across all types
    const [totalVisa] = await pool.query('SELECT COUNT(*) as count FROM visa_applications');
    const [totalMarriage] = await pool.query('SELECT COUNT(*) as count FROM marriage_applications');
    const [totalBirth] = await pool.query('SELECT COUNT(*) as count FROM birth_certificate_applications');
    const [totalTravel] = await pool.query('SELECT COUNT(*) as count FROM travel_pass_applications');

    const totalApplications =
      totalVisa[0].count +
      totalMarriage[0].count +
      totalBirth[0].count +
      totalTravel[0].count;

    // Get applications from last 30 days
    const [visaLast30] = await pool.query(
      'SELECT COUNT(*) as count FROM visa_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [marriageLast30] = await pool.query(
      'SELECT COUNT(*) as count FROM marriage_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [birthLast30] = await pool.query(
      'SELECT COUNT(*) as count FROM birth_certificate_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    const [travelLast30] = await pool.query(
      'SELECT COUNT(*) as count FROM travel_pass_applications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );

    const applicationsLast30Days =
      visaLast30[0].count +
      marriageLast30[0].count +
      birthLast30[0].count +
      travelLast30[0].count;

    // Get chat conversations statistics
    const [totalConversations] = await pool.query('SELECT COUNT(*) as count FROM chat_conversations');
    const [activeConversations] = await pool.query(
      "SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'active'"
    );
    const [totalMessages] = await pool.query('SELECT COUNT(*) as count FROM chat_messages');

    // Get user registration trend (last 12 months)
    const [userTrend] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM login
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    // Get application submission trend (last 12 months)
    const [visaTrend] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM visa_applications
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);
    const [marriageTrend] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM marriage_applications
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);
    const [birthTrend] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM birth_certificate_applications
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);
    const [travelTrend] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
      FROM travel_pass_applications
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    // Combine application trends
    const allMonths = new Set();
    [visaTrend, marriageTrend, birthTrend, travelTrend].forEach(trend => {
      trend.forEach(item => allMonths.add(item.month));
    });

    const applicationTrend = Array.from(allMonths).sort().map(month => {
      const visa = visaTrend.find(t => t.month === month)?.count || 0;
      const marriage = marriageTrend.find(t => t.month === month)?.count || 0;
      const birth = birthTrend.find(t => t.month === month)?.count || 0;
      const travel = travelTrend.find(t => t.month === month)?.count || 0;

      return {
        month,
        total: visa + marriage + birth + travel,
        visa,
        marriage,
        birth,
        travel
      };
    });

    // Get most popular application types
    const applicationTypes = [
      { type: 'Visa', count: totalVisa[0].count },
      { type: 'Marriage', count: totalMarriage[0].count },
      { type: 'Birth Certificate', count: totalBirth[0].count },
      { type: 'Travel Pass', count: totalTravel[0].count }
    ].sort((a, b) => b.count - a.count);

    res.json({
      overview: {
        totalUsers: totalUsers[0].count,
        usersLast30Days: usersLast30Days[0].count,
        usersLast7Days: usersLast7Days[0].count,
        totalApplications,
        applicationsLast30Days,
        totalConversations: totalConversations[0].count,
        activeConversations: activeConversations[0].count,
        totalMessages: totalMessages[0].count
      },
      trends: {
        userRegistrations: userTrend,
        applications: applicationTrend
      },
      applicationTypes
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ========================================
// ADMIN STATISTICS ENDPOINT
// ========================================

app.get('/api/admin/statistics', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Get counts from all application tables
    const [visaStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped
      FROM visa_applications
    `);

    const [marriageStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
      FROM marriage_applications
    `);

    const [birthStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
      FROM birth_certificate_applications
    `);

    const [travelStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
      FROM travel_pass_applications
    `);

    let userTotal = 0;
    try {
      const [userStats] = await pool.query(`
        SELECT COUNT(*) as total
        FROM login
      `);
      userTotal = Number(userStats[0]?.total) || 0;
    } catch (err) {
      console.warn('User count fallback to users table:', err?.message || err);
    }

    if (userTotal === 0) {
      try {
        const [userStatsLegacy] = await pool.query(`
          SELECT COUNT(*) as total
          FROM users
        `);
        const legacyTotal = Number(userStatsLegacy[0]?.total) || 0;
        if (legacyTotal > 0) {
          userTotal = legacyTotal;
        }
      } catch (err) {
        console.warn('User count fallback failed:', err?.message || err);
      }
    }

    // Get gender distribution from visa applications
    const [genderStats] = await pool.query(`
      SELECT
        gender,
        COUNT(*) as count
      FROM visa_applications
      WHERE gender IS NOT NULL AND gender != ''
      GROUP BY gender
    `);

    // Get age distribution from visa applications
    const [ageStats] = await pool.query(`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 18 AND 30 THEN '18-30'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 31 AND 50 THEN '31-50'
          WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) > 50 THEN '50+'
          ELSE 'Unknown'
        END as age_group,
        COUNT(*) as count
      FROM visa_applications
      WHERE date_of_birth IS NOT NULL
      GROUP BY age_group
    `);

    // Calculate totals
    const totalApplications =
      Number(visaStats[0].total) +
      Number(marriageStats[0].total) +
      Number(birthStats[0].total) +
      Number(travelStats[0].total);

    const totalPending =
      Number(visaStats[0].pending) +
      Number(marriageStats[0].pending) +
      Number(birthStats[0].pending) +
      Number(travelStats[0].pending);

    const totalUnderReview =
      Number(visaStats[0].under_review) +
      Number(marriageStats[0].under_review) +
      Number(birthStats[0].under_review) +
      Number(travelStats[0].under_review);

    const totalApproved =
      Number(visaStats[0].approved) +
      Number(marriageStats[0].approved) +
      Number(birthStats[0].approved) +
      Number(travelStats[0].approved);

    // Calculate gender percentages
    const genderDistribution = {};
    let totalWithGender = 0;
    genderStats.forEach(stat => {
      genderDistribution[stat.gender.toLowerCase()] = Number(stat.count);
      totalWithGender += Number(stat.count);
    });

    const malePercentage = totalWithGender > 0
      ? Math.round((genderDistribution.male || 0) / totalWithGender * 100)
      : 0;
    const femalePercentage = totalWithGender > 0
      ? Math.round((genderDistribution.female || 0) / totalWithGender * 100)
      : 0;

    // Calculate age distribution percentages
    const ageDistribution = {};
    let totalWithAge = 0;
    ageStats.forEach(stat => {
      ageDistribution[stat.age_group] = Number(stat.count);
      totalWithAge += Number(stat.count);
    });

    const age18_30 = totalWithAge > 0
      ? Math.round((ageDistribution['18-30'] || 0) / totalWithAge * 100)
      : 0;
    const age31_50 = totalWithAge > 0
      ? Math.round((ageDistribution['31-50'] || 0) / totalWithAge * 100)
      : 0;
    const age50Plus = totalWithAge > 0
      ? Math.round((ageDistribution['50+'] || 0) / totalWithAge * 100)
      : 0;

    res.json({
      totals: {
        applications: totalApplications,
        pending: totalPending,
        underReview: totalUnderReview,
        approved: totalApproved,
      },
      byType: {
        visa: visaStats[0],
        marriage: marriageStats[0],
        birth: birthStats[0],
        travel: travelStats[0],
      },
      demographics: {
        gender: {
          male: malePercentage,
          female: femalePercentage,
          maleCount: genderDistribution.male || 0,
          femaleCount: genderDistribution.female || 0,
        },
        age: {
          '18-30': age18_30,
          '31-50': age31_50,
          '50+': age50Plus,
          counts: ageDistribution,
        },
      },
      users: {
        total: userTotal,
      },
    });
  } catch (err) {
    console.error('Statistics error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    await initDB();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
});
