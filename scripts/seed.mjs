import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  DEMO_PASSWORD,
} = process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SECRET_KEY ||
  !SUPABASE_PUBLISHABLE_KEY ||
  !DEMO_PASSWORD ||
  DEMO_PASSWORD.length < 12
) {
  throw new Error(
    "Заполните .env.seed. Длина тестового пароля — минимум 12 символов.",
  );
}
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, options);
const accounts = [
  ["manager", "Анна Соколова", "manager"],
  ["worker1", "Илья Орлов", "worker"],
  ["worker2", "Мария Белова", "worker"],
];
function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}
const members = [];
for (const [login, name, role] of accounts) {
  const email = login + "@kontur.example";
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, options);
  let session = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (session.error) {
    checked(
      await admin.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      }),
    );
    session = await client.auth.signInWithPassword({
      email,
      password: DEMO_PASSWORD,
    });
  }
  const { user } = checked(session);
  checked(await admin.from("profiles").upsert({ id: user.id, name, role }));
  members.push({ client, id: user.id });
}
const sites = [
  ["ЖК «Береговой»", "Москва, Береговой проезд, 3"],
  ["Деловой центр «Север»", "Москва, Дмитровское шоссе, 42"],
  ["Школа в Сосновке", "Москва, Сосновая улица, 8"],
];
const siteId = (n) =>
  "adfe0000-0000-4000-8000-" + String(n + 1).padStart(12, "0");
const taskId = (n) =>
  "adfe1000-0000-4000-8000-" + String(n + 1).padStart(12, "0");
for (const [i, [name, address]] of sites.entries()) {
  checked(
    await admin
      .from("sites")
      .upsert({ id: siteId(i), name, address }, { ignoreDuplicates: true }),
  );
}
const tasks = [
  [
    0,
    1,
    "Проверить армирование плиты",
    "Сверить шаг и диаметр арматуры с рабочими чертежами.",
    [],
  ],
  [
    0,
    2,
    "Принять оконные блоки",
    "Проверить комплектацию поставки и состояние рам.",
    ["active", "review"],
  ],
  [
    1,
    1,
    "Разметить перегородки",
    "Перенести оси внутренних стен на перекрытие второго этажа.",
    ["active"],
  ],
  [
    1,
    2,
    "Проверить узел вентиляции",
    "Сверить положение воздуховода с планом этажа.",
    ["active", "review", "revision"],
  ],
  [
    2,
    2,
    "Подписать акт скрытых работ",
    "Передать акт и фотографии гидроизоляции руководителю.",
    ["active", "review", "accepted"],
  ],
];
for (const [i, [site, worker, title, description, steps]] of tasks.entries()) {
  const id = taskId(i);
  const existing = checked(
    await admin.from("tasks").select("id").eq("id", id).maybeSingle(),
  );
  if (existing) continue;
  checked(
    await admin
      .from("tasks")
      .insert({
        id,
        title,
        description,
        site_id: siteId(site),
        assignee: members[worker].id,
        author: members[0].id,
      }),
  );
  for (const status of steps) {
    const person = ["accepted", "revision"].includes(status)
      ? members[0]
      : members[worker];
    checked(
      await person.client.rpc("transition_task", {
        p_task: id,
        p_status: status,
        p_comment:
          status === "revision"
            ? "Уточните отметку воздуховода и приложите замер."
            : null,
      }),
    );
  }
}
console.log("Демо подготовлено: 3 аккаунта, 3 объекта, 5 задач.");
