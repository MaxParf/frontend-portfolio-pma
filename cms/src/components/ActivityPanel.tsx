import type { ActivityEvent } from "./App";

interface ActivityPanelProps {
  events: ActivityEvent[];
}

export function ActivityPanel({ events }: ActivityPanelProps) {
  return (
    <section className="activity-panel" aria-labelledby="activity-title">
      <h2 id="activity-title">Session activity — local UI only</h2>
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
        <p>No local UI activity yet.</p>
      )}
    </section>
  );
}
