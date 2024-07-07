import express from 'express';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { verifyToken, generateToken } from './JWT/jwt.js'; // Pfade anpassen
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const port = 8080;

// Prisma Client initialisieren
const prisma = new PrismaClient();

// Multer initialisieren für das Hochladen von Bildern
const upload = multer({ dest: 'pictures/' });

// Middleware
app.use(express.json()); // für das Parsen von JSON-Anfragen
app.use(cors()); // für die Konfiguration von Cross-Origin Resource Sharing (CORS)
app.use(log);

function log(req, res, next) {
    console.log(req.method + " Request at " + req.url);
    next();
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    try {
        const user = verifyToken(token);
        req.user = user;
        next();
    } catch (err) {
        res.sendStatus(403);
    }
};

// Endpunkte
app.get("/list", authenticateToken, async (req, res) => {
    try {
        const cars = await prisma.car.findMany({ where: { userId: req.user.id } });
        res.status(200).json(cars);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/addPic", authenticateToken, upload.single('image'), async (req, res) => {
    const image = req.file ? req.file.path : null;
    try {
        const newCode = await prisma.scannedCode.create({
            data: {
                name: req.body.name,
                rating: parseInt(req.body.rating),
                image: image
            }
        });
        res.status(200).json(newCode);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/addUser', async (req, res) => {
    const { name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const newUser = await prisma.user.create({
            data: {
                name: name,
                password: hashedPassword
            }
        });
        res.status(200).json({ message: 'User created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/addCar', authenticateToken, async (req, res) => {
    const { brand, model } = req.body;
    try {
        const newCar = await prisma.car.create({
            data: {
                brand,
                model,
                userId: req.user.id
            }
        });
        res.status(200).json(newCar);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { name, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { name } });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = generateToken(user);
            res.status(200).json({ token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Hauptteil des Servers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/pictures', express.static(path.join(__dirname, 'pictures')));

app.listen(port, () => console.log(`Server listening on port ${port}!`));

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    console.log('Closed the Prisma Client connection.');
    process.exit(0);
});
