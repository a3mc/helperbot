create table if not exists preferences
(
    id        int auto_increment
        primary key,
    chat_id   bigint                        not null,
    pref_type varchar(32) default 'general' not null,
    sunday    tinyint(1)  default 0         not null,
    monday    tinyint(1)  default 0         not null,
    tuesday   tinyint(1)  default 0         not null,
    wednesday tinyint(1)  default 0         not null,
    thursday  tinyint(1)  default 0         null,
    friday    tinyint(1)  default 0         not null,
    saturday  tinyint(1)  default 0         not null,
    post_time varchar(5)  default '15:00'   not null,
    timezone  int         default 0         not null
);

