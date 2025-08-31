// server/src/index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { processOfxFile, validateFileType } from './utils/ofxProcessor';
  
const app = express();
const PORT = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';
  
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
  
// API routes
app.post('/api/process-ofx', upload.single('file'), async (req, res) => {
  try {
    console.log('File upload request received');
    if (!req.file) {
      console.log('No file found in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('File received:', req.file.originalname, 'Size:', req.file.size);
    try {
      const fileContent = req.file.buffer.toString('utf-8');
      const isXmlFormat = fileContent.includes('</') || fileContent.includes('/>');
      console.log('Processing file...');
      const result = await processOfxFile(req.file.buffer);
      console.log('File processed successfully');
      // Set appropriate headers
      res.setHeader('Content-Type', 'application/json');
      // Send the response
      return res.json({
        filename: req.file.originalname,
        transactions: result.transactions,
        processedContent: result.processedContent,
        processingStats: result.processingStats,
        isXmlFormat
      });
    } catch (processingError: any) {
      console.error('Error processing file:', processingError);
      return res.status(500).json({
        error: 'Error processing file',
        details: processingError.message
      });
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
});
  
// Serve static files from the React app in production
if (!isDevelopment) {
  // Debug: Log current directory and check what's available
  console.log('Current directory:', __dirname);
  console.log('Available directories:');
  try {
    console.log('/ directory:', fs.readdirSync('/'));
    console.log('/app directory:', fs.readdirSync('/app'));
  } catch (err) {
    console.error('Error listing directories:', err);
  }

  // Try multiple possible paths for client build
  const possiblePaths = [
    path.join(__dirname, '../../client/dist'),
    path.join(__dirname, '../client/dist'),
    '/app/client/dist',
    '/client/dist'
  ];
  
  let clientBuildPath = null;
  for (const p of possiblePaths) {
    console.log('Checking path:', p);
    if (fs.existsSync(p)) {
      console.log('Found client build at:', p);
      clientBuildPath = p;
      break;
    }
  }
  
  if (clientBuildPath) {
    app.use(express.static(clientBuildPath));
    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
      const indexPath = path.join(clientBuildPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('index.html not found at ' + indexPath);
      }
    });
  } else {
    console.error('Could not find client build directory!');
    console.log('Tried paths:', possiblePaths);
    app.get('*', (req, res) => {
      res.status(404).send('Client build not found. Please check your Docker configuration.');
    });
  }
}
  
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${isDevelopment ? 'development' : 'production'} mode`);
});