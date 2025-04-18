-- Run this file on your Supabase project SQL editor

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

-- Initial data: 1 human + 7 AIs
insert into players (name, is_human) values
('You', true),
('AI 1', false),
('AI 2', false),
('AI 3', false),
('AI 4', false),
('AI 5', false),
('AI 6', false),
('AI 7', false)
on conflict do nothing;