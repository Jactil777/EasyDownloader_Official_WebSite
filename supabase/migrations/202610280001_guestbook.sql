create extension if not exists pgcrypto;

create table if not exists public.guestbook_messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default '访客' check (char_length(nickname) between 1 and 40),
  message text not null check (char_length(message) between 1 and 600),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists guestbook_messages_public_created_idx
  on public.guestbook_messages (created_at desc)
  where status = 'approved';

alter table public.guestbook_messages enable row level security;
revoke all on public.guestbook_messages from anon, authenticated;
grant all on public.guestbook_messages to service_role;

create table if not exists public.guestbook_rate_limits (
  ip_hash text primary key,
  last_post_at timestamptz not null
);

alter table public.guestbook_rate_limits enable row level security;
revoke all on public.guestbook_rate_limits from anon, authenticated;
grant all on public.guestbook_rate_limits to service_role;

create or replace function public.guestbook_take_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted boolean;
begin
  insert into public.guestbook_rate_limits as limits (ip_hash, last_post_at)
  values (p_ip_hash, now())
  on conflict (ip_hash) do update
    set last_post_at = excluded.last_post_at
    where limits.last_post_at < now() - interval '60 seconds'
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

revoke all on function public.guestbook_take_rate_limit(text) from public, anon, authenticated;
grant execute on function public.guestbook_take_rate_limit(text) to service_role;
