begin
  -- lock this table before reading from it, to prevent loss of concurrent
  -- updates when the table is dropped.
  lock table indexed_tasks;

  create table indexed_tasks_entities(
    partition_key text, row_key text,
    value jsonb not null,
    version integer not null,
    etag uuid default public.gen_random_uuid());
  alter table indexed_tasks_entities add primary key (partition_key, row_key);

  insert into indexed_tasks_entities
  select
    encode_string_key(namespace) as partition_key,
    encode_string_key(name) as row_key,
    entity_buf_encode(
        jsonb_build_object(
          'PartitionKey', encode_string_key(namespace),
          'RowKey', encode_string_key(name),
          'rank', rank,
          'taskId', task_id,
          'expires', expires),
        'data', data::text) as value,
    1 as version,
    etag
  from indexed_tasks;

  revoke select, insert, update, delete on indexed_tasks from $db_user_prefix$_index;
  drop table indexed_tasks;
  grant select, insert, update, delete on indexed_tasks_entities to $db_user_prefix$_index;
end
