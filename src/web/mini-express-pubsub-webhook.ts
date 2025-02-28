import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json()); // Middleware to parse incoming JSON requests

const PORT = process.env.PORT || 8080;

// Endpoint to receive Pub/Sub push messages
app.post('/pubsub', (req: Request, res: Response) => {
    try {
        const message = req.body.message;

        if (!message || !message.data) {
            console.warn('Received an empty or malformed message:', req.body);
            return res.status(400).send('Bad Request');
        }

        // Decode the base64 message data
        const decodedMessage = Buffer.from(message.data, 'base64').toString();
        console.log(`Received message: ${decodedMessage}`);

        // Handle the message here
        // Example: If message contains JSON data
        try {
            const parsedData = JSON.parse(decodedMessage);
            console.log('Parsed message data:', parsedData);
        } catch (err) {
            console.log('Non-JSON message:', decodedMessage);
        }

        // Acknowledge the message
        res.status(204).send();
    } catch (error) {
        console.error('Error processing Pub/Sub message:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Pub/Sub server listening on port ${PORT}`);
});