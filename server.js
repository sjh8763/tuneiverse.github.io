// Import necessary libraries
// 'express' is for creating the server and API endpoints
// 'dotenv' is for loading your secret keys from the .env file
// 'cors' is to allow your front-end (on Live Server) to talk to this backend
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Note: As of Node.js v18, 'fetch' is built-in.
// If you are using an older version of Node.js,
// you would need to run `npm install node-fetch` and add:
// import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config();

// Get your Spotify credentials from the .env file
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// Check if credentials are set
if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Error: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set in your .env file.');
    process.exit(1); // Exit the app if keys are missing
}

const app = express();
const PORT = 3000; // This is the port your backend will run on

// --- Middleware ---
// 1. Use CORS: This is the security step that allows your front-end
// (running on http://127.0.0.1:5500) to make requests to this server
// (running on http://localhost:3000).
app.use(cors());

// 2. Use express.json(): To parse any incoming JSON (not needed for this endpoint, but good practice)
app.use(express.json());


// --- API Endpoint 1: Spotify Token ---
// This is the URL your front-end will call
app.get('/api/get-spotify-token', async (req, res) => {
    console.log('Received request for Spotify token...');

    // 1. Prepare Spotify API request
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    
    // Spotify requires the Client ID and Secret to be Base64 encoded in the Authorization header.
    // Buffer.from(...).toString('base64') is the standard Node.js way to do this.
    const authHeader = 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
    
    // Spotify requires the body to be in 'x-www-form-urlencoded' format
    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'client_credentials');

    try {
        // 2. Make the POST request to Spotify
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyParams
        });

        // 3. Handle Spotify's response
        if (!response.ok) {
            // If Spotify returns an error, log it and send it to the front-end
            const errorData = await response.json();
            console.error('Spotify API Error:', errorData);
            throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 4. Send the successful response (with the access token) to your front-end
        console.log('Successfully fetched token from Spotify.');
        res.json(data); // This will send { access_token: "...", token_type: "...", ... }

    } catch (error) {
        // 5. Handle any other errors (e.g., network issues)
        console.error('Internal server error:', error.message);
        res.status(500).json({ error: 'Failed to fetch token from Spotify' });
    }
});


// --- NEW: API Endpoint 2: Deezer Preview ---
// This endpoint acts as our own private, reliable proxy
app.get('/api/get-deezer-preview', async (req, res) => {
    // Get track and artist from the query parameters
    const { track, artist } = req.query;

    if (!track || !artist) {
        return res.status(400).json({ error: 'Missing track or artist name' });
    }

    console.log(`Received preview request for: ${track} by ${artist}`);

    const searchQuery = `artist:"${artist}" track:"${track}"`;
    const deezerApiUrl = `https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=1`;

    try {
        // Fetch directly from Deezer. No CORS issues here (server-to-server).
        const response = await fetch(deezerApiUrl);
        if (!response.ok) {
            throw new Error(`Deezer API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Find the preview URL
        const previewUrl = data.data && data.data.length > 0 ? data.data[0].preview : null;
        
        if (previewUrl) {
            console.log(`Found preview URL: ${previewUrl}`);
        } else {
            console.log("No preview URL found for this track.");
        }
        
        // Send just the URL back to the front-end
        res.json({ previewUrl: previewUrl });

    } catch (error) {
        console.error('Deezer fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch preview from Deezer' });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log(`Waiting for requests at http://localhost:${PORT}/api/get-spotify-token`);
});