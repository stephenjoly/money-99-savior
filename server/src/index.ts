// server/src/index.ts
import express from 'express';
import path from 'path';
import fs from 'fs';
  
const app = express();
const PORT = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// OFX cleaning happens entirely in the browser, so this server only serves
// static files and a health check. There is intentionally no upload endpoint:
// statement data never reaches it.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Explicitly refuse API traffic rather than letting the SPA fallback answer it.
// A browser holding a pre-migration bundle would otherwise POST a statement
// here and have the bytes accepted (then ignored); this turns that into a clear
// error so the client can tell the visitor to reload.
app.use('/api', (_req, res) => {
  res.status(410).json({
    error: 'This app no longer accepts file uploads. Reload the page to get the current version — cleaning now happens in your browser.'
  });
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
        // The entry document must not be cached, or a browser could keep
        // running an old bundle against a new server.
        res.setHeader('Cache-Control', 'no-cache');
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
