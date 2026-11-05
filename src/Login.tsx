import { useState, type FormEvent } from "react";
import { Button, Card, Form, Alert, InputGroup } from "react-bootstrap";
import { client, db, errorText } from "./data";
export function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { error } = await db().auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) throw error;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <Card as="section" className="login-card">
        <Card.Body>
          <h1>Вход в систему</h1>
          <p className="text-secondary mb-4">Объекты и задачи</p>
          <Form onSubmit={submit}>
            <Form.Group controlId="login-email" className="mb-3">
              <Form.Label>Электронная почта</Form.Label>
              <Form.Control
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </Form.Group>
            <Form.Group controlId="login-password" className="mb-4">
              <Form.Label>Пароль</Form.Label>
              <InputGroup>
                <Form.Control
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? "Скрыть" : "Показать"}
                </Button>
              </InputGroup>
            </Form.Group>
            {(!client || error) && (
              <Alert variant="danger">
                {error || "Укажите параметры Supabase в .env.local."}
              </Alert>
            )}
            <Button type="submit" className="w-100" disabled={busy || !client}>
              {busy ? "Вход…" : "Войти"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </main>
  );
}
