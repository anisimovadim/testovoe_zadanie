import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import {
  LogOut,
  Plus,
  MapPin,
  Pencil,
  Trash2,
  ArrowLeft,
  RefreshCw,
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
import { Login } from "./Login";
import { Editor, type Edit } from "./Editor";
import { Badge, TaskView } from "./TaskView";
import { Button, Form, Navbar, Nav, Container, Table } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
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
        <Form.Select
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
        </Form.Select>
      </div>
      <div className="table-wrap">
        <Table responsive hover className="mb-0">
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
        </Table>
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
      <Navbar className="topbar">
        <Container className="top-inner">
          <Nav
            variant="underline"
            activeKey={mine ? "mine" : "sites"}
            aria-label="Разделы"
          >
            <Nav.Link href="#sites" eventKey="sites">
              Объекты
            </Nav.Link>
            {me && !manager && (
              <Nav.Link href="#mine" eventKey="mine">
                Мои задачи
              </Nav.Link>
            )}
          </Nav>
          <div className="account">
            <span>
              {me?.name}
              <small>{me && roleName[me.role]}</small>
            </span>
            <Button
              variant="outline-secondary"
              size="sm"
              title="Обновить"
              aria-label="Обновить"
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              aria-label="Выйти"
              title="Выйти"
              onClick={logout}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </Container>
      </Navbar>
      <main className="container content">
        <article>
          {error && (
            <div className="error" role="alert">
              {error}{" "}
              <Button variant="outline-secondary" onClick={refresh}>
                Повторить
              </Button>
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
                  <h1>Объекты</h1>
                </div>
                {manager && (
                  <Button
                    variant="primary"

                    onClick={() => setEdit({ kind: "site" })}
                  >
                    <Plus size={17} />
                    Новый объект
                  </Button>
                )}
              </div>
              <Form.Control
                className="site-search"
                type="search"
                aria-label="Поиск объектов"
                placeholder="Поиск по названию или адресу"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="table-wrap">
                <Table responsive hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Объект</th>
                      <th>Адрес</th>
                      <th className="text-end">Задач</th>
                      <th className="text-end">На проверке</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((s) => {
                      const tasks = data.tasks.filter(
                        (t) => t.site_id === s.id,
                      );
                      return (
                        <tr key={s.id}>
                          <td>
                            <a href={"#site/" + s.id}>{s.name}</a>
                          </td>
                          <td>{s.address}</td>
                          <td className="text-end">{tasks.length}</td>
                          <td className="text-end">
                            {tasks.filter((t) => t.status === "review").length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              {sites.length === 0 && (
                <p className="empty">
                  {query ? "Объекты не найдены" : "Доступных объектов пока нет"}
                </p>
              )}
            </>
          ) : mine && !manager ? (
            <>
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
                  <h1>{site.name}</h1>
                  <p className="address">
                    <MapPin size={16} />
                    {site.address}
                  </p>
                </div>
                {manager && (
                  <div className="actions">
                    <Button
                      variant="outline-secondary"
                      onClick={() => setEdit({ kind: "site", site })}
                    >
                      <Pencil size={15} />
                      Изменить
                    </Button>
                    <Button
                      variant="outline-secondary"
                      aria-label="Удалить объект"
                      onClick={() => setEdit({ kind: "delete", site })}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                )}
              </div>
              {manager && (
                <Button
                  variant="primary"

                  onClick={() => setEdit({ kind: "task", siteId: site.id })}
                >
                  <Plus size={16} />
                  Новая задача
                </Button>
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
