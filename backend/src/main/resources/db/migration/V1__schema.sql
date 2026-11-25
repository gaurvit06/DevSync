create table users (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 name varchar(255) not null,
 email varchar(255) not null,
 password_hash varchar(255) not null,
 unique(email)
);
create table projects (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 name varchar(255) not null,
 description text not null,
 deadline date,
 timezone varchar(255) not null
);
create table project_members (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 project_id bigint not null,
 user_id bigint not null,
 role varchar(255) not null,
 unique(project_id,user_id),
 foreign key (project_id) references projects(id) on delete cascade,
 foreign key (user_id) references users(id)
);
create table project_invitations (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 project_id bigint not null,
 recipient_id bigint not null,
 status varchar(255) not null,
 foreign key (project_id) references projects(id) on delete cascade,
 foreign key (recipient_id) references users(id)
);
create table work_items (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 project_id bigint not null,
 title varchar(255) not null,
 description text not null,
 type varchar(255) not null,
 assignee_id bigint,
 priority varchar(255) not null,
 status varchar(255) not null,
 deadline date,
 creator_id bigint not null,
 version bigint,
 constraint chk_type check (type in ('TASK','BUG')),
 constraint chk_status check (status in ('TODO','IN_PROGRESS','REVIEW','DONE')),
 foreign key (project_id) references projects(id) on delete cascade,
 foreign key (assignee_id) references users(id),
 foreign key (creator_id) references users(id)
);
create table bug_details (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 work_item_id bigint,
 severity varchar(255) not null,
 steps text not null,
 expected_behavior text not null,
 actual_behavior text not null,
 category varchar(255) not null,
 unique(work_item_id),
 foreign key (work_item_id) references work_items(id) on delete cascade
);
create table comments (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 work_item_id bigint,
 author_id bigint not null,
 content text not null,
 foreign key (work_item_id) references work_items(id) on delete cascade,
 foreign key (author_id) references users(id)
);
create table notifications (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 recipient_id bigint not null,
 project_id bigint not null,
 work_item_id bigint,
 message varchar(255) not null,
 is_read bit(1) not null,
 foreign key (recipient_id) references users(id),
 foreign key (project_id) references projects(id) on delete cascade,
 foreign key (work_item_id) references work_items(id) on delete cascade
);
create table activity_events (
 id bigint primary key auto_increment,
 created_at datetime(6) not null,
 updated_at datetime(6) not null,
 project_id bigint not null,
 actor_id bigint not null,
 work_item_id bigint,
 event varchar(255) not null,
 old_value text,
 new_value text,
 foreign key (project_id) references projects(id) on delete cascade,
 foreign key (actor_id) references users(id),
 foreign key (work_item_id) references work_items(id) on delete cascade
);
create index ix_work_project_status on work_items(project_id,status);
create index ix_notifications_recipient on notifications(recipient_id,is_read);
create index ix_activity_project on activity_events(project_id,id);
