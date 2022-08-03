create table if not exists proposals
(
    id          int auto_increment
        primary key,
    chat_id     bigint not null,
    proposal_id int    not null
);
