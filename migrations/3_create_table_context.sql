create table if not exists context
(
    id      int auto_increment
        primary key,
    chat_id bigint      not null,
    menu    varchar(32) not null
);
