/**
 * Image Upload Helper
 * Handles saving base64 data URLs safely to the uploads directory.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Save an uploaded photo (base64 data URL)
 * @param {string} dataUrl 
 * @returns {string} Public relative path, e.g. '/uploads/photo_1234.jpg'
 */
function saveBase64Image(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  // Match data:image/png;base64,....
  const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!matches) {
    // If it's already an existing /uploads/ path, return as is
    if (dataUrl.startsWith('/uploads/')) {
      return dataUrl;
    }
    return null;
  }

  const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // Limit max file size to 5MB
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image size exceeds 5MB limit');
  }

  const filename = `user_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${filename}`;
}

module.exports = {
  saveBase64Image,
  UPLOADS_DIR
};
