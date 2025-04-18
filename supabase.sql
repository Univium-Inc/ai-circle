-- Drop and recreate tables
drop table if exists message_queue cascade;
drop table if exists messages cascade;
drop table if exists players cascade;

-- Players table
create table players (
  id serial primary key,
  name text not null,
  is_human boolean not null default false,
  health int not null default 100,
  msg_tokens int not null default 1,
  atk_tokens int not null default 1,
  last_token_refill timestamp with time zone not null default now(),
  last_attack timestamp with time zone not null default now()
);

-- Messages log
create table messages (
  id serial primary key,
  sender_id int references players(id),
  recipient_id int references players(id),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Message queue for AI
create table message_queue (
  id serial primary key,
  ai_id int references players(id),
  human_id int references players(id),
  content text not null,
  enqueued_at timestamp with time zone default now(),
  processed boolean not null default false
);

-- Seed data
insert into players (name, is_human) values
('You', true),
('Benny', false),
('Rob', false),
('Carla', false),
('Dave', false),
('Elena', false),
('Frank', false),
('Gina', false)
on conflict do nothing;