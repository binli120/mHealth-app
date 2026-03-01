select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

select tablename, count(*) as policy_count
from pg_policies
where schemaname='public'
group by tablename
order by tablename;
