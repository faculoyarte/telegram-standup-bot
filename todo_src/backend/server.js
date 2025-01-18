const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config(); // Explicitly load .env file
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignee: true,
        creator: true,
        reviewer: true,
      },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    console.log('Request body:', req.body); // Log the incoming request body
    const { title, description, creatorId, priority, timeEstimate, timeScale, why } = req.body;
    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        creatorId,
        priority,
        timeEstimate,
        timeScale,
        status: 'NOT_STARTED',
        why,
      },
    });
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error in POST /api/tasks:', error.message); // Log the error
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
