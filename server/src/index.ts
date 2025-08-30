import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { processOfxFile, validateFileType } from './utils/ofxProcessor';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (validateFileType(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only OFX, QFX, and QBO files are allowed.') as any, false);
    }
  }
});

// API endpoint to process OFX file
app.post('/api/process-ofx', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const isXmlFormat = fileContent.includes('</') || fileContent.includes('/>');
    const result = await processOfxFile(req.file.buffer);
    
    res.json({
      filename: req.file.originalname,
      transactions: result.transactions,
      processedContent: result.processedContent,
      processingStats: result.processingStats,
      isXmlFormat
    });
  } catch (error: any) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message });
  }
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});