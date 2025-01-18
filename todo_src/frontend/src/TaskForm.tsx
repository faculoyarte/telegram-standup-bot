import React, { useState } from 'react';

function TaskForm({ onTaskCreated }: { onTaskCreated: Function }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newTask = {
      title,
      description,
      creatorId: 1, // Replace with actual creator ID if needed
      priority: 0,
      timeEstimate: 1,
      timeScale: 'HOURS',
      why: 'Added via frontend',
    };
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    });
    if (response.ok) {
      onTaskCreated(); // Refresh tasks after creation
      setTitle('');
      setDescription('');
    } else {
      console.error('Error creating task:', await response.text());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <h2>Create Task</h2>
      <div>
        <label>
          Title:
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
      </div>
      <div>
        <label>
          Description:
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
      </div>
      <button type="submit">Create Task</button>
    </form>
  );
}

export default TaskForm;
