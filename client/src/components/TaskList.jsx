export default function TaskList({ tasks, onDelete }) {
  if (tasks.length === 0) {
    return <p className="muted">Užduočių nėra</p>;
  }

  return (
    <ul className="tasks">
      {tasks.map((task) => (
        <li key={task.id}>
          <span>{task.due} {task.title}</span>
          <button
            className="secondary"
            title="Ištrina užduotį (kaip ištrynus telefone)"
            onClick={() => onDelete(task.id)}
          >
            Ištrinti
          </button>
        </li>
      ))}
    </ul>
  );
}
