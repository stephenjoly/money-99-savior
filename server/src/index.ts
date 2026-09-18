// server/src/index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { processOfxFile, validateFileType, getMerchantRules, MAX_NAME_LENGTH } from './utils/ofxProcessor';
  
const app = express();
const PORT = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';
  
// Middleware
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// The correction rules page reads these so it can never drift from the rules
// the processor actually applies.
app.get('/api/rules', (_req, res) => {
  res.status(200).json({
    merchantRules: getMerchantRules(),
    maxNameLength: MAX_NAME_LENGTH,
    removedTags: ['SIC', 'CORRECTFITID'],
  });
});
  
// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 0,
  },
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
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
      const fileContent = req.file.buffer.toString('utf-8');
      const isXmlFormat = fileContent.includes('</') || fileContent.includes('/>');
      const result = await processOfxFile(req.file.buffer);
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
    } catch (processingError) {
      console.error('Error processing file:', processingError);
      return res.status(500).json({
        error: 'Error processing file',
        details: processingError instanceof Error ? processingError.message : String(processingError)
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Return JSON for upload errors (invalid file type, size limit) instead of Express HTML
app.use((error: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(error);
  }
  return res.status(400).json({ error: error.message });
});
  
// Serve static files from the React app in production
if (!isDevelopment) {
  // Try multiple possible paths for client build
  const possiblePaths = [
    path.join(__dirname, '../../client/dist'),
    path.join(__dirname, '../client/dist'),
    '/app/client/dist',
    '/client/dist'
  ];
  
  let clientBuildPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      clientBuildPath = p;
      break;
    }
  }
  
  if (clientBuildPath) {
    console.log('Serving client build from:', clientBuildPath);
    app.use(express.static(clientBuildPath));
    // Handle React routing, return all requests to React app
    app.use((_req, res) => {
      const indexPath = path.join(clientBuildPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('index.html not found at ' + indexPath);
      }
    });
  } else {
    console.error('Could not find client build directory. Tried paths:', possiblePaths);
    app.use((_req, res) => {
      res.status(404).send('Client build not found. Please check your Docker configuration.');
    });
  }
}
  
// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${isDevelopment ? 'development' : 'production'} mode`);
});
