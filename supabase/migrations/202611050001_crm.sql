begin;
create type public.member_role as enum ('manager', 'worker');
create type public.task_status as enum ('new', 'active', 'review', 'accepted', 'revision');

create table public.profiles (
  id uuid primary key references auth.users(id),
  name text not null check (length(trim(name)) between 1 and 120),
  role public.member_role not null
);
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  address text not null check (length(trim(address)) between 1 and 300)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  description text not null default '' check (length(description) <= 5000),
  assignee uuid not null references public.profiles,
  author uuid not null default auth.uid() references public.profiles,
  created_at timestamptz not null default now(),
  status public.task_status not null default 'new'
);
create index tasks_assignee_site on public.tasks(assignee, site_id);
create index tasks_site on public.tasks(site_id);
create table public.task_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks on delete cascade,
  actor uuid not null references public.profiles,
  created_at timestamptz not null default now(),
  previous_status public.task_status,
  next_status public.task_status not null,
  comment text check (length(comment) <= 2000)
);
create index history_task on public.task_history(task_id, id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create function private.is_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;
create function private.validate_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id = new.assignee and role = 'worker') then
    raise exception 'Задачу можно назначить только исполнителю';
  end if;
  return new;
end;
$$;
create trigger check_assignee before insert or update of assignee on public.tasks
for each row execute function private.validate_assignee();

create function private.record_creation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_history(task_id, actor, next_status)
  values (new.id, new.author, new.status);
  return new;
end;
$$;
create trigger task_created after insert on public.tasks
for each row execute function private.record_creation();

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

revoke all on public.profiles, public.sites, public.tasks, public.task_history
  from public, anon, authenticated;
grant select on public.profiles, public.sites, public.tasks, public.task_history to authenticated;
grant insert (name, address), update (name, address), delete on public.sites to authenticated;
grant insert (site_id,title,description,assignee), update (site_id,title,description,assignee), delete
  on public.tasks to authenticated;

create policy manage_sites on public.sites for all to authenticated
using (private.is_manager()) with check (private.is_manager());
create policy assigned_sites on public.sites for select to authenticated using (
  exists(select 1 from public.tasks t where t.site_id = sites.id and t.assignee = auth.uid())
);
create policy manage_tasks on public.tasks for all to authenticated
using (private.is_manager()) with check (private.is_manager());
create policy assigned_tasks on public.tasks for select to authenticated using (assignee = auth.uid());
create policy visible_history on public.task_history for select to authenticated using (
  exists(select 1 from public.tasks t where t.id = task_history.task_id)
);
create policy visible_profiles on public.profiles for select to authenticated using (
  id = auth.uid() or private.is_manager()
  or exists(select 1 from public.tasks t where t.author = profiles.id)
  or exists(select 1 from public.task_history h where h.actor = profiles.id)
);

-- PostgreSQL locks the current row before checking its actual status.
create function public.transition_task(p_task uuid, p_status public.task_status, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_task public.tasks%rowtype;
  manager boolean := private.is_manager();
  note text := nullif(regexp_replace(coalesce(p_comment,''), '^[[:space:]]+|[[:space:]]+$','','g'),'');
begin
  select * into current_task from public.tasks where id = p_task
    and (manager or assignee = auth.uid()) for update;
  if not found then raise exception 'Задача недоступна'; end if;
  if not coalesce((
    (manager and current_task.status = 'review' and p_status in ('accepted','revision'))
    or (current_task.assignee = auth.uid() and (
      (current_task.status in ('new','revision') and p_status = 'active')
      or (current_task.status = 'active' and p_status = 'review')
    ))
  ),false) then raise exception 'Переход недоступен. Обновите карточку задачи'; end if;
  if p_status = 'revision' and note is null then raise exception 'Укажите причину доработки'; end if;
  update public.tasks set status = p_status where id = p_task;
  insert into public.task_history(task_id,actor,previous_status,next_status,comment)
    values(p_task,auth.uid(),current_task.status,p_status,note);
end;
$$;
revoke all on function public.transition_task(uuid,public.task_status,text) from public,anon;
grant execute on function public.transition_task(uuid,public.task_status,text) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_manager() to authenticated;
commit;
