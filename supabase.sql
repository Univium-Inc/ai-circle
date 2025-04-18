-- Drop existing tables
drop table if exists messages cascade;
drop table if exists players cascade;

-- Create tables again
create table players (
  id serial primary key,
  name text not null,
  is_human boolean not null default false,
  health int not null default 100,
  last_message timestamp with time zone not null default now(),
  last_attack timestamp with time zone not null default now()
);

create table messages (
  id serial primary key,
  sender_id int references players(id),
  recipient_id int references players(id),
  content text not null,
  created_at timestamp with time zone default now()
);

-- Seed initial data (1 human + 7 named AI)
insert into players (name, is_human) values
('You', true),
('Benny', false),
('Rob', false),
('Carla', false),
('Dave', false),
('Elena', false),
('Frank', false),
('Gina', false);