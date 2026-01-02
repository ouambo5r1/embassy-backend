import { body, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

export const signupValidation = [
  body('username')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required (max 100 characters)')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required (max 100 characters)')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  handleValidationErrors,
];

export const loginValidation = [
  body('username')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

export const contactValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
  handleValidationErrors,
];

export const visaApplicationValidation = [
  body('userName').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('visaType').isIn(['shortStay', 'mediumStay', 'longStay']).withMessage('Invalid visa type'),
  body('firstName').optional().trim().isLength({ max: 100 }).matches(/^[a-zA-Z\s\-']+$/),
  body('lastName').optional().trim().isLength({ max: 100 }).matches(/^[a-zA-Z\s\-']+$/),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('dateOfBirth').optional().isISO8601().toDate(),
  body('placeOfBirth').optional().trim().isLength({ max: 200 }),
  body('city').optional().trim().isLength({ max: 100 }),
  body('countryOfBirth').optional().trim().isLength({ max: 100 }),
  body('nationalityOrigin').optional().trim().isLength({ max: 100 }),
  body('nationalityCurrent').optional().trim().isLength({ max: 100 }),
  body('address').optional().trim().isLength({ max: 500 }),
  body('cityAddress').optional().trim().isLength({ max: 100 }),
  body('countryAddress').optional().trim().isLength({ max: 100 }),
  body('maritalStatus').optional().isIn(['single', 'married', 'divorced', 'widowed']),
  body('fatherName').optional().trim().isLength({ max: 200 }),
  body('profession').optional().trim().isLength({ max: 200 }),
  body('employer').optional().trim().isLength({ max: 200 }),
  body('employerAddress').optional().trim().isLength({ max: 500 }),
  handleValidationErrors,
];
