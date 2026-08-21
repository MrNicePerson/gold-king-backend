// ============================================================
// middleware/upload.js
// ============================================================
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const fileFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|gif|webp/i.test(file.mimetype) || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

let storage;

if (isCloudinaryConfigured) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'gold-shop',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
      public_id: (req, file) => `gold-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    },
  });
} else {
  // Local fallback storage when Cloudinary credentials are not provided
  const uploadDir = path.resolve('uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const disk = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const name = `gold-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  });

  storage = disk;
}

const baseMulter = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// Middleware wrapper to format local file path to accessible URL if disk storage is used
const uploadWrapper = {
  single: (fieldName) => (req, res, next) => {
    baseMulter.single(fieldName)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'File upload error' });
      }
      if (req.file && !isCloudinaryConfigured) {
        const port = process.env.PORT || 5000;
        const host = req.get('host') || `localhost:${port}`;
        const protocol = req.protocol || 'http';
        const filename = req.file.filename;
        // Set accessible HTTP URL and local publicId
        req.file.path = `${protocol}://${host}/uploads/${filename}`;
        req.file.filename = `local-${filename}`;
      }
      next();
    });
  },
  array: (fieldName, maxCount) => baseMulter.array(fieldName, maxCount),
  fields: (fields) => baseMulter.fields(fields),
};

export const upload = uploadWrapper;

export const cloudinaryDeleteImage = async (publicId) => {
  if (!publicId) return;

  if (publicId.startsWith('local-')) {
    const filename = publicId.replace(/^local-/, '');
    const filePath = path.resolve('uploads', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Local file delete error:', err.message);
      }
    }
    return;
  }

  if (isCloudinaryConfigured) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error('Cloudinary delete error:', err.message);
    }
  }
};

export { cloudinary };