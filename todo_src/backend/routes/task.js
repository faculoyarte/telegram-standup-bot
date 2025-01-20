const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get all tasks
router.get('/', async (req, res) => {
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

// Create a new task
router.post('/', async (req, res) => {
  try {
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
