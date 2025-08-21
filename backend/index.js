// File: backend/index.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// JWT Auth Middleware
const auth = (role) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (role && user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// ======================= API Routes =======================

// POST /api/register - Register a new user
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { name, email, password_hash, role: 'patient' },
    });
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
});

// POST /api/login - Login and get a token
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  res.json({ token, role: user.role });
});

// GET /api/slots - Get available slots
app.get('/api/slots', async (req, res) => {
  const bookedSlots = await prisma.booking.findMany({ select: { slotId: true } });
  const bookedIds = bookedSlots.map(b => b.slotId);

  const availableSlots = await prisma.slot.findMany({
    where: {
      id: { notIn: bookedIds }
    },
    orderBy: { start_at: 'asc' }
  });
  res.json(availableSlots);
});

// POST /api/book - Book an appointment
app.post('/api/book', auth('patient'), async (req, res) => {
  const { slotId } = req.body;
  const userId = req.user.id;
  try {
    await prisma.booking.create({
      data: { userId, slotId }
    });
    res.status(201).json({ message: 'Booking successful' });
  } catch (err) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'This slot is already booked.' });
    } else {
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
});

// GET /api/my-bookings - Get patient's bookings
app.get('/api/my-bookings', auth('patient'), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.user.id },
    include: { slot: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(bookings);
});

// GET /api/all-bookings - Get all bookings (Admin only)
app.get('/api/all-bookings', auth('admin'), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    include: { user: true, slot: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(bookings);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});