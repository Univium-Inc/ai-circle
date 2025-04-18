-- Drop and recreate tables
drop table if exists message_queue cascade;
drop table if exists messages cascade;
drop table if exists players cascade;

-- Players: add token columns
create table players (
  id serial primary key,
  name text not null,
  is_human boolean not null default false,
  health int not null default 100,
  msg_tokens int not null default 0,
  atk_tokens int not null default 0,
  last_token_refill timestamp with time zone not null default now(),
  last_attack timestamp with time zone not null default now()
);

-- Message log
create table messages (
  id serial primary key,
  sender_id int references players(id),
  recipient_id int references players(id),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Queue inbound human->AI messages
create table message_queue (
  id serial primary key,
  ai_id int references players(id),
  human_id int references players(id),
  content text not null,
  enqueued_at timestamp with time zone default now(),
  processed boolean not null default false
);

-- Seed initial data
insert into players (name, is_human, msg_tokens, atk_tokens) values
('You', true, 1, 1),
('Benny', false, 1, 1),
('Rob', false, 1, 1),
('Carla', false, 1, 1),
('Dave', false, 1, 1),
('Elena', false, 1, 1),
('Frank', false, 1, 1),
('Gina', false, 1, 1)
on conflict do nothing;