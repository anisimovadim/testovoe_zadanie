import { useState, type FormEvent } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";
import { db, errorText, type Data, type Site, type Task } from "./data";
export type Edit =
  | { kind: "site"; site?: Site }
  | { kind: "task"; task?: Task; siteId: string }
  | { kind: "delete"; site?: Site; task?: Task };
type Props = {
  edit: Edit;
  data: Data;
  close: () => void;
  saved: (target?: string) => void;
};
export function Editor({ edit, data, close, saved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const site = "site" in edit ? edit.site : undefined;
  const task = "task" in edit ? edit.task : undefined;
  const removing = edit.kind === "delete";
  const title = removing
    ? site
      ? "Удалить объект?"
      : "Удалить задачу?"
    : edit.kind === "site"
      ? site
        ? "Редактировать объект"
        : "Новый объект"
      : task
        ? "Редактировать задачу"
        : "Новая задача";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const value = (k: string) => String(f.get(k) || "").trim();
    setBusy(true);
    setError("");
    try {
      let target: string | undefined;
      if (removing) {
        const row = site || task!;
        const result = await db()
          .from(site ? "sites" : "tasks")
          .delete()
          .eq("id", row.id)
          .select("id")
          .single();
        if (result.error) throw result.error;
        target = site ? "sites" : "site/" + task!.site_id;
      } else if (edit.kind === "site") {
        const fields = { name: value("name"), address: value("address") };
        const query = site
          ? db().from("sites").update(fields).eq("id", site.id)
          : db().from("sites").insert(fields);
        const res = await query.select("id").single();
        if (res.error) throw res.error;
        target = "site/" + res.data.id;
      } else {
        const fields = {
          title: value("title"),
          description: value("description"),
          site_id: value("site_id"),
          assignee: value("assignee"),
        };
        const query = task
          ? db().from("tasks").update(fields).eq("id", task.id)
          : db().from("tasks").insert(fields);
        const res = await query.select("id").single();
        if (res.error) throw res.error;
        target = "task/" + res.data.id;
      }
      saved(target);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      show
      centered
      onHide={() => {
        if (!busy) close();
      }}
      backdrop={busy ? "static" : true}
      keyboard={!busy}
      aria-labelledby="form-title"
    >
      <Modal.Header closeButton={!busy} closeLabel="Закрыть">
        <Modal.Title id="form-title">{title}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          {removing ? (
            <p>
              «{site?.name || task?.title}» и история будут удалены
              {site ? " вместе со всеми задачами объекта" : ""}. Восстановить
              данные будет невозможно.
            </p>
          ) : edit.kind === "site" ? (
            <>
              <label className="field">
                Название объекта
                <Form.Control
                  name="name"
                  autoFocus
                  required
                  maxLength={160}
                  defaultValue={site?.name}
                />
              </label>
              <label className="field">
                Адрес
                <Form.Control
                  name="address"
                  required
                  maxLength={300}
                  defaultValue={site?.address}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                Название задачи
                <Form.Control
                  name="title"
                  autoFocus
                  required
                  maxLength={180}
                  defaultValue={task?.title}
                />
              </label>
              <label className="field">
                Описание
                <Form.Control
                  as="textarea"
                  name="description"
                  rows={3}
                  maxLength={5000}
                  defaultValue={task?.description}
                />
              </label>
              <label className="field">
                Объект
                <Form.Select
                  aria-label="Объект"
                  name="site_id"
                  required
                  defaultValue={task?.site_id || edit.siteId}
                >
                  {data.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Form.Select>
              </label>
              <label className="field">
                Исполнитель
                <Form.Select
                  aria-label="Исполнитель"
                  name="assignee"
                  required
                  defaultValue={task?.assignee || ""}
                >
                  <option value="" disabled>
                    Выберите исполнителя
                  </option>
                  {data.profiles
                    .filter((p) => p.role === "worker")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </Form.Select>
              </label>
            </>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            type="button"
            disabled={busy}
            onClick={close}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            variant={removing ? "danger" : "primary"}
            disabled={busy}
          >
            {busy ? "Сохранение…" : removing ? "Удалить" : "Сохранить"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
