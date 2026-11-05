import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, History } from "lucide-react";
import {
  db,
  readHistory,
  errorText,
  labels,
  date,
  type Data,
  type Entry,
  type Profile,
  type Status,
  type Task,
} from "./data";
import type { Edit } from "./Editor";
export function Badge({ status }: { status: Status }) {
  return (
    <span className={"badge " + status}>
      <i />
      {labels[status]}
    </span>
  );
}
export function TaskView({
  task,
  data,
  me,
  edit,
  refresh,
  revision,
}: {
  task: Task;
  data: Data;
  me: Profile;
  edit: (e: Edit) => void;
  refresh: () => void;
  revision: number;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null),
    [loadError, setLoadError] = useState("");
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoadError("");
    readHistory(task.id)
      .then((rows) => {
        if (live) setEntries(rows);
      })
      .catch((e) => {
        if (live) setLoadError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [task.id, revision]);
  const name = (id: string) =>
    data.profiles.find((p) => p.id === id)?.name || "Пользователь";
  const site = data.sites.find((s) => s.id === task.site_id);
  const manager = me.role === "manager";
  const actions: [Status, string][] = [];
  if (manager && task.status === "review")
    actions.push(["accepted", "Принять"], ["revision", "Вернуть на доработку"]);
  if (!manager && me.id === task.assignee) {
    if (task.status === "new" || task.status === "revision")
      actions.push(["active", "Взять в работу"]);
    if (task.status === "active")
      actions.push(["review", "Отправить на проверку"]);
  }
  async function move(status: Status) {
    if (busy) return;
    if (status === "revision" && !note.trim()) {
      setError("Укажите, что нужно доработать");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await db().rpc("transition_task", {
        p_task: task.id,
        p_status: status,
        p_comment: note.trim() || null,
      });
      if (r.error) throw r.error;
      setNote("");
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a className="back" href={"#site/" + task.site_id}>
        <ArrowLeft size={15} />
        {site?.name}
      </a>
      <div className="heading">
        <div>
          <div className="eyebrow">Карточка задачи</div>
          <h1>{task.title}</h1>
        </div>
        {manager && (
          <div className="actions">
            <button
              onClick={() => edit({ kind: "task", task, siteId: task.site_id })}
            >
              <Pencil size={15} />
              Изменить
            </button>
            <button
              aria-label="Удалить задачу"
              onClick={() => edit({ kind: "delete", task })}
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      <div className="detail-grid">
        <section className="panel">
          <Badge status={task.status} />
          <h2>Описание</h2>
          <p className="description">{task.description || "Без описания"}</p>
          <dl>
            <dt>Исполнитель</dt>
            <dd>{name(task.assignee)}</dd>
            <dt>Автор</dt>
            <dd>{name(task.author)}</dd>
            <dt>Создана</dt>
            <dd>{date(task.created_at)}</dd>
          </dl>
          {actions.length > 0 && (
            <div className="transition">
              <label>
                Комментарий
                <textarea
                  rows={3}
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    manager
                      ? "При возврате укажите причину"
                      : "При необходимости"
                  }
                />
              </label>
              <div className="actions">
                {actions.map(([s, t], i) => (
                  <button
                    key={s}
                    disabled={busy}
                    className={i === 0 ? "primary" : ""}
                    onClick={() => move(s)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel-title">
            <History size={18} />
            История задачи
          </h2>
          {loadError ? (
            <p className="error">{loadError}</p>
          ) : entries === null ? (
            <p>Загрузка…</p>
          ) : (
            <ol className="timeline">
              {entries.map((h) => (
                <li key={h.id}>
                  <strong>
                    {h.previous_status ? labels[h.previous_status] + " → " : ""}
                    {labels[h.next_status]}
                  </strong>
                  <small>
                    {name(h.actor)} · {date(h.created_at)}
                  </small>
                  {h.comment && <p>{h.comment}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
