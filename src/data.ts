import { createClient } from "@supabase/supabase-js";
export type Status = "new" | "active" | "review" | "accepted" | "revision";
export const labels: Record<Status, string> = {
  new: "Новая",
  active: "В работе",
  review: "На проверке",
  accepted: "Принята",
  revision: "На доработке",
};
export type Profile = { id: string; name: string; role: "manager" | "worker" };
export type Site = { id: string; name: string; address: string };
export type Task = {
  id: string;
  site_id: string;
  title: string;
  description: string;
  assignee: string;
  author: string;
  created_at: string;
  status: Status;
};
export type Entry = {
  id: number;
  actor: string;
  created_at: string;
  previous_status: Status | null;
  next_status: Status;
  comment: string | null;
};
export type Data = { profiles: Profile[]; sites: Site[]; tasks: Task[] };
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const client = url && key ? createClient(url, key) : null;
export const db = () => {
  if (!client) throw new Error("Укажите параметры Supabase в .env.local");
  return client;
};
type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
async function readPages<T>(
  page: (from: number, to: number) => Page<T>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 200;
  for (let start = 0; ; start += size) {
    const { data, error } = await page(start, start + size - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < size) return rows;
  }
}
export async function readData(): Promise<Data> {
  const [profiles, sites, tasks] = await Promise.all([
    readPages<Profile>((a, b) =>
      db().from("profiles").select("*").order("name").order("id").range(a, b),
    ),
    readPages<Site>((a, b) =>
      db().from("sites").select("*").order("name").order("id").range(a, b),
    ),
    readPages<Task>((a, b) =>
      db()
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b),
    ),
  ]);
  return { profiles, sites, tasks };
}
export function readHistory(taskId: string) {
  return readPages<Entry>((a, b) =>
    db()
      .from("task_history")
      .select("*")
      .eq("task_id", taskId)
      .order("id", { ascending: false })
      .range(a, b),
  );
}
export function errorText(e: unknown) {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String(e.message)
      : "Ошибка запроса";
  if (/invalid login/i.test(msg)) return "Неверный email или пароль";
  if (/fetch|network/i.test(msg))
    return "Нет связи с сервером. Проверьте подключение и повторите попытку.";
  return msg;
}
export const date = (s: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(s));
