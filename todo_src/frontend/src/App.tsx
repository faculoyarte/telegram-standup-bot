import React, { useEffect, useState } from 'react';
import TaskForm from './TaskForm'; // Import the TaskForm component

// Define the structure of a Task
interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Function to fetch tasks from the backend
  const fetchTasks = () => {
    console.log('Fetching tasks from:', process.env.REACT_APP_API_URL);
    fetch(`${process.env.REACT_APP_API_URL}/api/tasks`)
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched tasks:', data);
        setTasks(data);
      })
      .catch((err) => console.error('Error fetching tasks:', err));
  };

  // Fetch tasks on component mount
  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div>
      <h1>Task List</h1>
      {/* Render the TaskForm and pass the fetchTasks function to refresh tasks */}
      <TaskForm onTaskCreated={fetchTasks} />
      <ul>
        {/* Render the list of tasks */}
        {tasks.map((task) => (
          <li key={task.id}>
            <strong>{task.title}</strong>: {task.description} ({task.status})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
