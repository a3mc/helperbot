create table if not exists posts
(
    id          int auto_increment primary key,
    type        smallint  default 0                 not null,
    date        timestamp default CURRENT_TIMESTAMP not null,
    result      tinyint   default 0                 not null,
    proposal_id int       default 0                 not null,
    vote_type   smallint  default 0                 not null
);
