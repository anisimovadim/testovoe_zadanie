// Run against the demo database after seeding. All requests use the public client key.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const {
  SUPABASE_URL: url,
  SUPABASE_PUBLISHABLE_KEY: key,
  DEMO_PASSWORD: password,
} = process.env;
function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function ok(result) {
  if (result.error) throw result.error;
  return result.data;
}
async function account(name) {
  const api = client();
  const { user } = ok(
    await api.auth.signInWithPassword({
      email: name + "@kontur.example",
      password,
    }),
  );
  return { api, id: user.id };
}
const [manager, one, two] = await Promise.all(
  ["manager", "worker1", "worker2"].map(account),
);
const anon = client();
const signup = await anon.auth.signUp({
  email: randomUUID() + "@kontur.example",
  password,
});
assert.equal(signup.error?.code, "signup_disabled");
assert((await anon.from("tasks").select("*")).error);
const site = ok(
  await manager.api
    .from("sites")
    .insert({ name: "Проверка доступа", address: "Тестовый адрес" })
    .select()
    .single(),
);
try {
  const task = ok(
    await manager.api
      .from("tasks")
      .insert({
        site_id: site.id,
        title: "Проверка переходов",
        assignee: one.id,
      })
      .select()
      .single(),
  );
  const read = (api, table, column, id) =>
    api.from(table).select("*").eq(column, id);
  const move = (who, status, p_comment = null) =>
    who.api.rpc("transition_task", {
      p_task: task.id,
      p_status: status,
      p_comment,
    });
  assert.equal(ok(await read(one.api, "sites", "id", site.id)).length, 1);
  assert.deepEqual(ok(await read(two.api, "sites", "id", site.id)), []);
  assert.deepEqual(ok(await read(two.api, "tasks", "id", task.id)), []);
  assert.deepEqual(
    ok(await read(two.api, "task_history", "task_id", task.id)),
    [],
  );
  assert.deepEqual(
    ok(
      await two.api
        .from("tasks")
        .update({ title: "Чужая правка" })
        .eq("id", task.id)
        .select(),
    ),
    [],
  );
  assert.deepEqual(
    ok(
      await one.api
        .from("tasks")
        .update({ title: "Своя правка" })
        .eq("id", task.id)
        .select(),
    ),
    [],
  );
  assert(
    (
      await one.api
        .from("sites")
        .insert({ name: "Чужой объект", address: "Адрес" })
    ).error,
  );
  assert(
    (
      await one.api
        .from("profiles")
        .update({ role: "manager" })
        .eq("id", one.id)
    ).error,
  );
  assert(
    (
      await manager.api
        .from("tasks")
        .update({ status: "accepted" })
        .eq("id", task.id)
    ).error,
  );
  assert(
    (
      await manager.api
        .from("tasks")
        .update({ author: one.id })
        .eq("id", task.id)
    ).error,
  );
  assert(
    (
      await manager.api
        .from("tasks")
        .update({ assignee: manager.id })
        .eq("id", task.id)
    ).error,
  );
  assert((await move(two, "active")).error);
  assert((await move(manager, "active")).error);
  assert((await move(one, "accepted")).error);
  const race = await Promise.all([move(one, "active"), move(one, "active")]);
  assert.equal(race.filter((r) => !r.error).length, 1);
  ok(await move(one, "review"));
  assert((await move(one, "accepted")).error);
  assert((await move(manager, "revision", " \t\n ")).error);
  ok(await move(manager, "revision", "Сверить размеры"));
  ok(await move(one, "active"));
  ok(await move(one, "review"));
  ok(await move(manager, "accepted"));
  assert((await move(one, "active")).error);
  const history = ok(
    await read(one.api, "task_history", "task_id", task.id).order("id"),
  );
  assert.deepEqual(
    history.map((h) => h.next_status),
    ["new", "active", "review", "revision", "active", "review", "accepted"],
  );
  assert.deepEqual(
    history.map((h) => h.previous_status),
    [null, "new", "active", "review", "revision", "active", "review"],
  );
  assert.deepEqual(
    history.map((h) => h.actor),
    [manager.id, one.id, one.id, manager.id, one.id, one.id, manager.id],
  );
  assert.equal(history[3].comment, "Сверить размеры");
  for (const who of [manager, one]) {
    assert(
      (
        await who.api
          .from("task_history")
          .insert({ task_id: task.id, actor: one.id, next_status: "new" })
      ).error,
    );
    assert(
      (
        await who.api
          .from("task_history")
          .update({ comment: "Подмена" })
          .eq("task_id", task.id)
      ).error,
    );
    assert(
      (await who.api.from("task_history").delete().eq("task_id", task.id))
        .error,
    );
  }
  ok(
    await manager.api
      .from("tasks")
      .update({ assignee: two.id })
      .eq("id", task.id),
  );
  assert.deepEqual(
    ok(await read(one.api, "task_history", "task_id", task.id)),
    [],
  );
  assert.equal(
    ok(await read(two.api, "task_history", "task_id", task.id)).length,
    7,
  );
  console.log(
    "Проверки API пройдены: роли, регистрация, изоляция, конкурирующие переходы, история.",
  );
} finally {
  ok(
    await manager.api
      .from("sites")
      .delete()
      .eq("id", site.id)
      .select()
      .single(),
  );
}
