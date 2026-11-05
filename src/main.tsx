import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import {
  Building2,
  ListChecks,
  LogOut,
  Plus,
  ArrowUpRight,
  MapPin,
  Search,
  Pencil,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Layers3,
} from "lucide-react";
import {
  client,
  db,
  readData,
  errorText,
  labels,
  type Data,
  type Task,
  type Status,
} from "./data";
import { Brand, Login } from "./Login";
import { Editor, type Edit } from "./Editor";
import { Badge, TaskView } from "./TaskView";
import "./style.css";
const roleName = { manager: "Постановщик", worker: "Исполнитель" };
function TaskList({ tasks, data }: { tasks: Task[]; data: Data }) {
  const [filter, setFilter] = useState("");
  const rows = tasks.filter((t) => !filter || t.status === filter);
  return (
    <section className="list-section">
      <div className="section-head">
        <h2>
          Список задач <span className="counter">{tasks.length}</span>
        </h2>
        <select
          aria-label="Фильтр по статусу"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          {Object.entries(labels).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Задача</th>
              <th>Объект</th>
              <th>Исполнитель</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <a href={"#task/" + t.id}>{t.title}</a>
                </td>
                <td>{data.sites.find((s) => s.id === t.site_id)?.name}</td>
                <td>{data.profiles.find((p) => p.id === t.assignee)?.name}</td>
                <td>
                  <Badge status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty">
            {tasks.length ? "Нет задач с таким статусом" : "Задач пока нет"}
          </p>
        )}
      </div>
    </section>
  );
}
function Workspace({ user }: { user: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [rev, setRev] = useState(0);
  const [route, setRoute] = useState(location.hash.slice(1) || "sites"),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<Edit | null>(null);
  const refresh = () => setRev((r) => r + 1);
  useEffect(() => {
    const fn = () => {
      setRoute(location.hash.slice(1) || "sites");
      setEdit(null);
      setQuery("");
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    let live = true;
    setError("");
    readData()
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [user, rev]);
  const me = data?.profiles.find((p) => p.id === user);
  const manager = me?.role === "manager";
  const [page, id] = route.split("/");
  const site = data?.sites.find((s) => s.id === id),
    task = data?.tasks.find((t) => t.id === id);
  const sites =
    data?.sites.filter((s) =>
      (s.name + " " + s.address)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    ) || [];
  const mine = page === "mine";
  async function logout() {
    const r = await db().auth.signOut({ scope: "local" });
    if (r.error) setError(errorText(r.error));
    else location.hash = "sites";
  }
  return (
    <div className="shell">
      <aside>
        <Brand />
        <nav>
          <a href="#sites" className={!mine ? "selected" : ""}>
            <Building2 size={18} />
            Объекты
          </a>
          {me && !manager && (
            <a href="#mine" className={mine ? "selected" : ""}>
              <ListChecks size={18} />
              Мои задачи
            </a>
          )}
        </nav>
        <div className="user">
          <span className="avatar">
            {me?.name
              .split(" ")
              .slice(0, 2)
              .map((x) => x[0])
              .join("")}
          </span>
          <div>
            <strong>{me?.name || "Аккаунт"}</strong>
            <small>{me && roleName[me.role]}</small>
          </div>
          <button aria-label="Выйти" title="Выйти" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="content">
        <header>
          <span>
            <Layers3 size={16} />
            Рабочее пространство
          </span>
          <button
            className="iconbtn"
            title="Обновить"
            aria-label="Обновить"
            onClick={refresh}
          >
            <RefreshCw size={16} />
          </button>
        </header>
        <article>
          {error && (
            <div className="error" role="alert">
              {error} <button onClick={refresh}>Повторить</button>
            </div>
          )}
          {!data ? (
            !error && <p>Загрузка данных…</p>
          ) : !me ? (
            <p>Для аккаунта не назначена роль. Обратитесь к администратору.</p>
          ) : page === "sites" ? (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">Реестр объектов</div>
                  <h1>Объекты</h1>
                </div>
                {manager && (
                  <button
                    className="primary"
                    onClick={() => setEdit({ kind: "site" })}
                  >
                    <Plus size={17} />
                    Новый объект
                  </button>
                )}
              </div>
              <div className="stats">
                {[
                  ["Объекты", data.sites.length],
                  ["Задачи", data.tasks.length],
                  [
                    "На проверке",
                    data.tasks.filter((t) => t.status === "review").length,
                  ],
                ].map(([l, n]) => (
                  <div key={l}>
                    <small>{l}</small>
                    <strong>{String(n).padStart(2, "0")}</strong>
                  </div>
                ))}
              </div>
              <div className="section-head">
                <h2>Список объектов</h2>
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Поиск объектов"
                    placeholder="Название или адрес"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <div className="cards">
                {sites.map((s) => {
                  const tasks = data.tasks.filter((t) => t.site_id === s.id),
                    done = tasks.filter((t) => t.status === "accepted").length;
                  return (
                    <a className="card" key={s.id} href={"#site/" + s.id}>
                      <div className="card-top">
                        <span className="building">
                          <Building2 size={23} />
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                      <h3>{s.name}</h3>
                      <p>
                        <MapPin size={14} />
                        {s.address}
                      </p>
                      <div className="card-bottom">
                        <span>
                          Задач <b>{tasks.length}</b>
                        </span>
                        <span>
                          Принято <b>{done}</b>
                        </span>
                      </div>
                      <div className="bar">
                        <i
                          style={{
                            width:
                              (tasks.length ? (done / tasks.length) * 100 : 0) +
                              "%",
                          }}
                        />
                      </div>
                    </a>
                  );
                })}
              </div>
              {sites.length === 0 && (
                <p className="empty">
                  {query ? "Объекты не найдены" : "Доступных объектов пока нет"}
                </p>
              )}
            </>
          ) : mine && !manager ? (
            <>
              <div className="eyebrow">Персональный список</div>
              <h1>Мои задачи</h1>
              <TaskList
                tasks={data.tasks.filter((t) => t.assignee === user)}
                data={data}
              />
            </>
          ) : page === "site" && site ? (
            <>
              <a href="#sites" className="back">
                <ArrowLeft size={15} />
                Все объекты
              </a>
              <div className="heading">
                <div>
                  <div className="eyebrow">Карточка объекта</div>
                  <h1>{site.name}</h1>
                  <p className="address">
                    <MapPin size={16} />
                    {site.address}
                  </p>
                </div>
                {manager && (
                  <div className="actions">
                    <button onClick={() => setEdit({ kind: "site", site })}>
                      <Pencil size={15} />
                      Изменить
                    </button>
                    <button
                      aria-label="Удалить объект"
                      onClick={() => setEdit({ kind: "delete", site })}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              {manager && (
                <button
                  className="primary"
                  onClick={() => setEdit({ kind: "task", siteId: site.id })}
                >
                  <Plus size={16} />
                  Новая задача
                </button>
              )}
              <TaskList
                data={data}
                tasks={data.tasks.filter((t) => t.site_id === site.id)}
              />
            </>
          ) : page === "task" && task ? (
            <TaskView
              key={task.id}
              task={task}
              data={data}
              me={me}
              edit={setEdit}
              refresh={refresh}
              revision={rev}
            />
          ) : (
            <p>
              Карточка недоступна. <a href="#sites">К списку объектов</a>
            </p>
          )}
        </article>
      </main>
      {edit && data && manager && (
        <Editor
          edit={edit}
          data={data}
          close={() => setEdit(null)}
          saved={(target) => {
            setEdit(null);
            refresh();
            if (target) location.hash = target;
          }}
        />
      )}
    </div>
  );
}
function App() {
  const [session, setSession] = useState<Session | null | undefined>(
    client ? undefined : null,
  );
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <main className="loading">Загрузка…</main>;
  return session ? (
    <Workspace key={session.user.id} user={session.user.id} />
  ) : (
    <Login />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
