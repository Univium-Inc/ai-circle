-- Run this in Supabase SQL

create table if not exists players (
  id serial primary key,
  name text not null,
  is_human boolean not null default false,
  health int not null default 100,
  last_message timestamp with time zone not null default now(),
  last_attack timestamp with time zone not null default now()
);

create table if not exists messages (
  id serial primary key,
  sender_id int references players(id),
  recipient_id int references players(id),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Initial data
insert into players (name, is_human) values
('You', true),
('AI Cultist 1', false),
('AI Cultist 2', false),
('AI Cultist 3', false),
('AI Cultist 4', false),
('AI Cultist 5', false),
('AI Cultist 6', false),
('AI Cultist 7', false)
on conflict do nothing;