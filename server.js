import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3003;

// Security headers with relaxed settings for WebGPU
app.use(helmet({
    contentSecurityPolicy: false 
}));

// Enable gzip compression
app.use(compression());

// Serve static files from dist directory (including index.html)
app.use(express.static(path.join(__dirname, 'dist')));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});