import type { ActivityEvent } from "./App";

interface ActivityPanelProps {
  events: ActivityEvent[];
}

export function ActivityPanel({ events }: ActivityPanelProps) {
  return (
    <section className="activity-panel" aria-labelledby="activity-title">
      <h2 id="activity-title">Активность сессии — только локальный интерфейс</h2>
      {events.length ? (
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <span>{event.label}</span>
              <time>{event.createdAt}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p>Локальных действий пока нет.</p>
      )}
    </section>
  );
}
