--
-- PostgreSQL database dump
--

\restrict ByBuewBCggH5bXLiellggSymJIMUzLDZnLtn617s9xiTht9IMSuEmgtaZyCs3dc

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _realtime;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_functions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_functions;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.application_status AS ENUM (
    'draft',
    'submitted',
    'ai_extracted',
    'needs_review',
    'rfi_requested',
    'approved',
    'denied'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
    ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

    ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
    ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

    REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
    raise debug 'PgBouncer auth request: %', p_usename;

    return query
    select 
        rolname::text, 
        case when rolvaliduntil < now() 
            then null 
            else rolpassword::text 
        end 
    from pg_authid 
    where rolname=$1 and rolcanlogin;
end;
$_$;


--
-- Name: can_access_applicant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_applicant(p_applicant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.applicants ap
      WHERE ap.id = p_applicant_id
        AND ap.user_id = public.request_user_id()
    )
$$;


--
-- Name: can_access_application(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_application(p_application_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.applicants ap ON ap.id = a.applicant_id
      WHERE a.id = p_application_id
        AND ap.user_id = public.request_user_id()
    )
$$;


--
-- Name: can_access_document(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_document(p_document_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.documents d
      WHERE d.id = p_document_id
        AND public.can_access_application(d.application_id)
    )
$$;


--
-- Name: can_access_organization(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_organization(p_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = public.request_user_id()
        AND u.organization_id = p_organization_id
    )
$$;


--
-- Name: can_access_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_user(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p_user_id = public.request_user_id() OR public.is_staff()
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Always upsert the base users row (auth source-of-truth)
  INSERT INTO public.users (id, email, password_hash, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    'supabase_auth_managed',
    true,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        is_active = true;

  -- Determine role from signup metadata (defaults to 'patient')
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'patient');

  -- Only patients get an applicants row.
  -- Social workers, admins, and reviewers store their identity in their own tables.
  IF v_role NOT IN ('social_worker', 'admin', 'reviewer') THEN
    INSERT INTO public.applicants (user_id, first_name, last_name, phone, created_at)
    VALUES (
      NEW.id,
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'last_name',  ''),
      NULLIF(NEW.raw_user_meta_data->>'phone',       ''),
      COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (user_id) DO UPDATE
      SET first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),
          last_name  = COALESCE(EXCLUDED.last_name,  public.applicants.last_name),
          phone      = COALESCE(EXCLUDED.phone,      public.applicants.phone);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: is_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = public.request_user_id()
      AND r.name IN ('admin', 'reviewer')
  )
$$;


--
-- Name: request_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;


--
-- Name: set_session_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_session_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_sw_request_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sw_request_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: touch_applications_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_applications_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_family_profile_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_family_profile_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_user_profile_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_profile_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
	select string_to_array(name, '/') into _parts;
	select _parts[array_length(_parts,1)] into _filename;
	-- @todo return the last part instead of 2
	return reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[1:array_length(_parts,1)-1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::int) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


--
-- Name: http_request(); Type: FUNCTION; Schema: supabase_functions; Owner: -
--

CREATE FUNCTION supabase_functions.http_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'supabase_functions'
    AS $$
  DECLARE
    request_id bigint;
    payload jsonb;
    url text := TG_ARGV[0]::text;
    method text := TG_ARGV[1]::text;
    headers jsonb DEFAULT '{}'::jsonb;
    params jsonb DEFAULT '{}'::jsonb;
    timeout_ms integer DEFAULT 1000;
  BEGIN
    IF url IS NULL OR url = 'null' THEN
      RAISE EXCEPTION 'url argument is missing';
    END IF;

    IF method IS NULL OR method = 'null' THEN
      RAISE EXCEPTION 'method argument is missing';
    END IF;

    IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
      headers = '{"Content-Type": "application/json"}'::jsonb;
    ELSE
      headers = TG_ARGV[2]::jsonb;
    END IF;

    IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
      params = '{}'::jsonb;
    ELSE
      params = TG_ARGV[3]::jsonb;
    END IF;

    IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
      timeout_ms = 1000;
    ELSE
      timeout_ms = TG_ARGV[4]::integer;
    END IF;

    CASE
      WHEN method = 'GET' THEN
        SELECT http_get INTO request_id FROM net.http_get(
          url,
          params,
          headers,
          timeout_ms
        );
      WHEN method = 'POST' THEN
        payload = jsonb_build_object(
          'old_record', OLD,
          'record', NEW,
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA
        );

        SELECT http_post INTO request_id FROM net.http_post(
          url,
          payload,
          params,
          headers,
          timeout_ms
        );
      ELSE
        RAISE EXCEPTION 'method argument % is invalid', method;
    END CASE;

    INSERT INTO supabase_functions.hooks
      (hook_table_id, hook_name, request_id)
    VALUES
      (TG_RELID, TG_NAME, request_id);

    RETURN NEW;
  END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: extensions; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.extensions (
    id uuid NOT NULL,
    type text,
    settings jsonb,
    tenant_external_id text,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: tenants; Type: TABLE; Schema: _realtime; Owner: -
--

CREATE TABLE _realtime.tenants (
    id uuid NOT NULL,
    name text,
    external_id text,
    jwt_secret text,
    max_concurrent_users integer DEFAULT 200 NOT NULL,
    inserted_at timestamp(0) without time zone NOT NULL,
    updated_at timestamp(0) without time zone NOT NULL,
    max_events_per_second integer DEFAULT 100 NOT NULL,
    postgres_cdc_default text DEFAULT 'postgres_cdc_rls'::text,
    max_bytes_per_second integer DEFAULT 100000 NOT NULL,
    max_channels_per_client integer DEFAULT 100 NOT NULL,
    max_joins_per_second integer DEFAULT 500 NOT NULL,
    suspend boolean DEFAULT false,
    jwt_jwks jsonb,
    notify_private_alpha boolean DEFAULT false,
    private_only boolean DEFAULT false NOT NULL,
    migrations_ran integer DEFAULT 0,
    broadcast_adapter character varying(255) DEFAULT 'gen_rpc'::character varying,
    max_presence_events_per_second integer DEFAULT 1000,
    max_payload_size_in_kb integer DEFAULT 3000,
    max_client_presence_events_per_window integer,
    client_presence_window_ms integer,
    presence_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT jwt_secret_or_jwt_jwks_required CHECK (((jwt_secret IS NOT NULL) OR (jwt_jwks IS NOT NULL)))
);


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: applicants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applicants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    first_name text,
    last_name text,
    dob date,
    ssn_encrypted text,
    phone text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    citizenship_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    applicant_id uuid,
    status public.application_status DEFAULT 'draft'::public.application_status NOT NULL,
    household_size integer,
    total_monthly_income numeric(12,2),
    confidence_score numeric(5,2),
    submitted_at timestamp with time zone,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    application_type text,
    draft_state jsonb,
    draft_step integer,
    last_saved_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT applications_confidence_score_range CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::numeric) AND (confidence_score <= (100)::numeric)))),
    CONSTRAINT applications_draft_step_range_check CHECK (((draft_step IS NULL) OR ((draft_step >= 1) AND (draft_step <= 9)))),
    CONSTRAINT applications_household_size_check CHECK (((household_size IS NULL) OR (household_size >= 1))),
    CONSTRAINT applications_total_monthly_income_non_negative CHECK (((total_monthly_income IS NULL) OR (total_monthly_income >= (0)::numeric)))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    asset_type text,
    value numeric(14,2),
    CONSTRAINT assets_value_non_negative CHECK (((value IS NULL) OR (value >= (0)::numeric)))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    application_id uuid,
    action text,
    old_data jsonb,
    new_data jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benefit_stack_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benefit_stack_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_profile_id uuid NOT NULL,
    stack_data jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collaborative_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collaborative_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sw_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    ended_by uuid,
    invite_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collaborative_sessions_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'active'::text, 'ended'::text, 'cancelled'::text])))
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    npi text,
    address text,
    city text,
    state text,
    zip text,
    phone text,
    email_domain text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    CONSTRAINT companies_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: document_extractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_extractions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    model_name text,
    raw_output jsonb,
    structured_output jsonb,
    confidence_score numeric(5,2),
    extracted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_extractions_confidence_score_range CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::numeric) AND (confidence_score <= (100)::numeric))))
);


--
-- Name: document_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    page_number integer,
    ocr_text text,
    CONSTRAINT document_pages_page_number_check CHECK (((page_number IS NULL) OR (page_number > 0)))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    uploaded_by uuid,
    document_type text,
    file_url text,
    mime_type text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    file_name text,
    file_path text,
    file_size_bytes bigint,
    document_status text DEFAULT 'uploaded'::text NOT NULL,
    required_document_label text,
    CONSTRAINT documents_status_check CHECK ((document_status = ANY (ARRAY['uploaded'::text, 'pending_review'::text, 'verified'::text, 'rejected'::text])))
);


--
-- Name: eligibility_screenings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eligibility_screenings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    estimated_program text,
    fpl_percentage numeric(6,2),
    screening_result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eligibility_screenings_fpl_non_negative CHECK (((fpl_percentage IS NULL) OR (fpl_percentage >= (0)::numeric)))
);


--
-- Name: family_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    applicant_id uuid NOT NULL,
    profile_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: household_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.household_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    first_name text,
    last_name text,
    dob date,
    relationship text,
    pregnant boolean DEFAULT false NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    over_65 boolean DEFAULT false NOT NULL
);


--
-- Name: incomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    member_id uuid,
    income_type text,
    employer_name text,
    monthly_amount numeric(12,2),
    verified boolean DEFAULT false NOT NULL,
    CONSTRAINT incomes_monthly_amount_non_negative CHECK (((monthly_amount IS NULL) OR (monthly_amount >= (0)::numeric)))
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    company_id uuid,
    role text DEFAULT 'applicant'::text NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mobile_verify_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_verify_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    user_id uuid NOT NULL,
    applicant_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    verify_status text,
    verify_score smallint,
    verify_breakdown jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    completed_at timestamp with time zone,
    extracted_data jsonb,
    CONSTRAINT mobile_verify_sessions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT mobile_verify_sessions_verify_status_check CHECK ((verify_status = ANY (ARRAY['verified'::text, 'needs_review'::text, 'failed'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    read_at timestamp with time zone,
    email_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['status_change'::text, 'document_request'::text, 'renewal_reminder'::text, 'deadline'::text, 'general'::text, 'session_invite'::text, 'session_starting'::text, 'sw_engagement_request'::text, 'sw_engagement_accepted'::text, 'sw_engagement_rejected'::text, 'new_direct_message'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_social_worker_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_social_worker_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    social_worker_user_id uuid NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: policy_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding public.vector(768),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: policy_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    source_url text NOT NULL,
    doc_type text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    ingested_at timestamp with time zone DEFAULT now() NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL
);


--
-- Name: review_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    reviewer_id uuid,
    action_type text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_actions_action_type_check CHECK (((action_type IS NULL) OR (action_type = ANY (ARRAY['approve'::text, 'deny'::text, 'rfi'::text]))))
);


--
-- Name: rfis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid,
    requested_by uuid,
    message text,
    due_date date,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: session_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    type text DEFAULT 'text'::text NOT NULL,
    content text,
    storage_path text,
    duration_sec integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_messages_type_check CHECK ((type = ANY (ARRAY['text'::text, 'voice'::text])))
);


--
-- Name: social_worker_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_worker_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    license_number text,
    job_title text,
    status text DEFAULT 'pending'::text NOT NULL,
    rejection_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    approved_by uuid,
    first_name text,
    last_name text,
    phone text,
    bio text,
    avatar_url text,
    CONSTRAINT social_worker_profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: sw_direct_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sw_direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sw_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message_type text DEFAULT 'text'::text NOT NULL,
    content text,
    storage_path text,
    duration_sec integer,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transcription text,
    transcription_lang character varying(10),
    CONSTRAINT sw_direct_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'voice'::text, 'image'::text, 'file'::text])))
);


--
-- Name: sw_engagement_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sw_engagement_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    sw_user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    patient_message text,
    rejection_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sw_engagement_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    applicant_id uuid NOT NULL,
    profile_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    bank_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id integer NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    email text NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid
);


--
-- Name: validation_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validation_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    rule_name text,
    severity text,
    message text,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT validation_results_severity_check CHECK (((severity IS NULL) OR (severity = ANY (ARRAY['warning'::text, 'error'::text]))))
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_04_01; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_04_01 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_04_03; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_04_03 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_04_04; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_04_04 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_04_05; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_04_05 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_04_06; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_04_06 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_04_07; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_04_07 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: iceberg_namespaces; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_namespaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    catalog_id uuid NOT NULL
);


--
-- Name: iceberg_tables; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.iceberg_tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namespace_id uuid NOT NULL,
    bucket_name text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    location text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remote_table_id text,
    shard_key text,
    shard_id text,
    catalog_id uuid NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hooks; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.hooks (
    id bigint NOT NULL,
    hook_table_id integer NOT NULL,
    hook_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id bigint
);


--
-- Name: TABLE hooks; Type: COMMENT; Schema: supabase_functions; Owner: -
--

COMMENT ON TABLE supabase_functions.hooks IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';


--
-- Name: hooks_id_seq; Type: SEQUENCE; Schema: supabase_functions; Owner: -
--

CREATE SEQUENCE supabase_functions.hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: supabase_functions; Owner: -
--

ALTER SEQUENCE supabase_functions.hooks_id_seq OWNED BY supabase_functions.hooks.id;


--
-- Name: migrations; Type: TABLE; Schema: supabase_functions; Owner: -
--

CREATE TABLE supabase_functions.migrations (
    version text NOT NULL,
    inserted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text
);


--
-- Name: messages_2026_04_01; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_04_01 FOR VALUES FROM ('2026-04-01 00:00:00') TO ('2026-04-02 00:00:00');


--
-- Name: messages_2026_04_03; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_04_03 FOR VALUES FROM ('2026-04-03 00:00:00') TO ('2026-04-04 00:00:00');


--
-- Name: messages_2026_04_04; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_04_04 FOR VALUES FROM ('2026-04-04 00:00:00') TO ('2026-04-05 00:00:00');


--
-- Name: messages_2026_04_05; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_04_05 FOR VALUES FROM ('2026-04-05 00:00:00') TO ('2026-04-06 00:00:00');


--
-- Name: messages_2026_04_06; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_04_06 FOR VALUES FROM ('2026-04-06 00:00:00') TO ('2026-04-07 00:00:00');


--
-- Name: messages_2026_04_07; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_04_07 FOR VALUES FROM ('2026-04-07 00:00:00') TO ('2026-04-08 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: hooks id; Type: DEFAULT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks ALTER COLUMN id SET DEFAULT nextval('supabase_functions.hooks_id_seq'::regclass);


--
-- Data for Name: extensions; Type: TABLE DATA; Schema: _realtime; Owner: -
--

COPY _realtime.extensions (id, type, settings, tenant_external_id, inserted_at, updated_at) FROM stdin;
b32879d1-9de3-4789-ae7d-b8cc178ea5e4	postgres_cdc_rls	{"region": "us-east-1", "db_host": "Dc2nYgFh2rD0mx12iBZscIHcYLDLSqZPKk4eIuzIipg=", "db_name": "sWBpZNdjggEPTQVlI52Zfw==", "db_port": "+enMDFi1J/3IrrquHHwUmA==", "db_user": "uxbEq/zz8DXVD53TOI1zmw==", "slot_name": "supabase_realtime_replication_slot", "db_password": "sWBpZNdjggEPTQVlI52Zfw==", "publication": "supabase_realtime", "ssl_enforced": false, "poll_interval_ms": 100, "poll_max_changes": 100, "poll_max_record_bytes": 1048576}	realtime-dev	2026-04-04 23:06:13	2026-04-04 23:06:13
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: _realtime; Owner: -
--

COPY _realtime.schema_migrations (version, inserted_at) FROM stdin;
20210706140551	2026-03-17 13:57:20
20220329161857	2026-03-17 13:57:20
20220410212326	2026-03-17 13:57:20
20220506102948	2026-03-17 13:57:20
20220527210857	2026-03-17 13:57:20
20220815211129	2026-03-17 13:57:20
20220815215024	2026-03-17 13:57:20
20220818141501	2026-03-17 13:57:20
20221018173709	2026-03-17 13:57:20
20221102172703	2026-03-17 13:57:20
20221223010058	2026-03-17 13:57:20
20230110180046	2026-03-17 13:57:20
20230810220907	2026-03-17 13:57:20
20230810220924	2026-03-17 13:57:20
20231024094642	2026-03-17 13:57:20
20240306114423	2026-03-17 13:57:20
20240418082835	2026-03-17 13:57:20
20240625211759	2026-03-17 13:57:20
20240704172020	2026-03-17 13:57:20
20240902173232	2026-03-17 13:57:20
20241106103258	2026-03-17 13:57:20
20250424203323	2026-03-17 13:57:20
20250613072131	2026-03-17 13:57:20
20250711044927	2026-03-17 13:57:20
20250811121559	2026-03-17 13:57:20
20250926223044	2026-03-17 13:57:20
20251204170944	2026-03-17 13:57:20
20251218000543	2026-03-17 13:57:20
20260209232800	2026-04-04 23:06:12
20260304000000	2026-04-04 23:06:12
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: _realtime; Owner: -
--

COPY _realtime.tenants (id, name, external_id, jwt_secret, max_concurrent_users, inserted_at, updated_at, max_events_per_second, postgres_cdc_default, max_bytes_per_second, max_channels_per_client, max_joins_per_second, suspend, jwt_jwks, notify_private_alpha, private_only, migrations_ran, broadcast_adapter, max_presence_events_per_second, max_payload_size_in_kb, max_client_presence_events_per_window, client_presence_window_ms, presence_enabled) FROM stdin;
4ae58e77-89a4-4bf2-aafe-9ba084d9b6d0	realtime-dev	realtime-dev	iNjicxc4+llvc9wovDvqymwfnj9teWMlyOIbJ8Fh6j2WNU8CIJ2ZgjR6MUIKqSmeDmvpsKLsZ9jgXJmQPpwL8w==	200	2026-04-04 23:06:13	2026-04-04 23:06:13	100	postgres_cdc_rls	100000	100	100	f	{"keys": [{"x": "M5Sjqn5zwC9Kl1zVfUUGvv9boQjCGd45G8sdopBExB4", "y": "P6IXMvA2WYXSHSOMTBH2jsw_9rrzGy89FjPf6oOsIxQ", "alg": "ES256", "crv": "P-256", "ext": true, "kid": "b81269f1-21d8-4f2e-b719-c2240a840d90", "kty": "EC", "use": "sig", "key_ops": ["verify"]}, {"k": "c3VwZXItc2VjcmV0LWp3dC10b2tlbi13aXRoLWF0LWxlYXN0LTMyLWNoYXJhY3RlcnMtbG9uZw", "kty": "oct"}]}	f	f	68	gen_rpc	1000	3000	\N	\N	f
\.


--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
00000000-0000-0000-0000-000000000000	5ab7c3b8-0989-414f-8653-e319004cb814	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 14:40:16.105846+00	
00000000-0000-0000-0000-000000000000	39680b80-6afa-4788-891e-023b89e76547	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 15:19:57.604647+00	
00000000-0000-0000-0000-000000000000	beb2d636-83ac-4680-9b05-a3a28a527c7f	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 15:19:57.608947+00	
00000000-0000-0000-0000-000000000000	e14d683e-c128-44d2-b24d-8b323240debf	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 16:30:44.196422+00	
00000000-0000-0000-0000-000000000000	3466c598-77aa-463e-8748-4dc9c96a2925	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 16:30:44.196884+00	
00000000-0000-0000-0000-000000000000	58c05772-da7b-4925-8963-e94570e94cbe	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 17:29:44.934675+00	
00000000-0000-0000-0000-000000000000	6c83ff9a-58c2-4ac2-b9f4-0bae11dd8ff3	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 17:29:44.935332+00	
00000000-0000-0000-0000-000000000000	2d988896-7d90-41a6-8dcc-8d2c1f902fe2	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-17 17:30:15.486626+00	
00000000-0000-0000-0000-000000000000	be74bd13-ad3a-4b3a-83a0-270ccb7508f3	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 17:30:15.560133+00	
00000000-0000-0000-0000-000000000000	47b27298-f8b0-4417-bc8e-0143e88cd89b	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-17 18:05:37.974716+00	
00000000-0000-0000-0000-000000000000	e2661547-5238-448f-bf0e-ea74f8d0bb63	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 18:05:38.048928+00	
00000000-0000-0000-0000-000000000000	3206f7a7-affb-4a29-9d1c-37d607cbb0e1	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-17 18:26:53.209866+00	
00000000-0000-0000-0000-000000000000	1fd5698f-a7a4-46e3-b79c-6d5fc32123e7	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 18:26:53.28168+00	
00000000-0000-0000-0000-000000000000	0deda9be-a4e9-4590-96c3-f0c66dd9ab99	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-17 18:39:01.392735+00	
00000000-0000-0000-0000-000000000000	e29d0530-63a7-4393-ad40-e7334cc5e07b	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 18:39:01.464973+00	
00000000-0000-0000-0000-000000000000	e6ad1e9c-450d-4678-97f0-d789eb3907cd	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-17 19:08:50.078826+00	
00000000-0000-0000-0000-000000000000	291560d4-ec53-482f-bc1b-ac7bce0b6708	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 19:53:50.700305+00	
00000000-0000-0000-0000-000000000000	bac3b056-bb27-4a65-8a3f-b9d26707864c	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-17 20:46:12.302257+00	
00000000-0000-0000-0000-000000000000	f8031ccb-1143-416b-a83c-9f77130cb174	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-17 20:46:12.373853+00	
00000000-0000-0000-0000-000000000000	5c5220f1-85de-4654-b1cc-a00f952be49a	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 21:44:22.355282+00	
00000000-0000-0000-0000-000000000000	9bfe7f5f-fc0a-4a1a-908a-4f585c8fcdcc	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 21:44:22.355764+00	
00000000-0000-0000-0000-000000000000	be98b12b-fe82-4ca3-a30b-acb38c119789	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 22:42:22.365028+00	
00000000-0000-0000-0000-000000000000	ce3f6078-ea82-4d7c-9f77-7565703808a3	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 22:42:22.365449+00	
00000000-0000-0000-0000-000000000000	2bf1f051-1d03-48f0-892a-b3510e465da0	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 23:40:22.377827+00	
00000000-0000-0000-0000-000000000000	275036cc-4c4f-4d24-a0d4-061499344d84	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-17 23:40:22.378226+00	
00000000-0000-0000-0000-000000000000	53f9406c-63ce-4ae6-84d1-184842eb2494	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 01:30:54.671881+00	
00000000-0000-0000-0000-000000000000	af745098-c637-48ae-b49b-e2e84612b0cd	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 01:30:54.672539+00	
00000000-0000-0000-0000-000000000000	fdde01e2-9645-47dd-a921-f58ecfb35c0c	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-18 01:33:03.753588+00	
00000000-0000-0000-0000-000000000000	192920f8-6437-429e-bc50-4097a5c45415	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-18 01:42:55.653095+00	
00000000-0000-0000-0000-000000000000	4eadf4f5-b2b7-442a-82f3-9c7c0760491a	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-18 01:42:55.721761+00	
00000000-0000-0000-0000-000000000000	3b2a28f9-4fa2-407e-a7c7-35c4f3119bd3	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 18:34:37.86378+00	
00000000-0000-0000-0000-000000000000	ca140942-7de8-4bb8-ac76-1f0460645e1b	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 18:34:37.864272+00	
00000000-0000-0000-0000-000000000000	6f121868-a71e-44b0-a757-2c59f799f591	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-18 18:34:37.895924+00	
00000000-0000-0000-0000-000000000000	e0333d3a-5edc-45b4-87a5-bb2939e60d73	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-18 18:34:38.263679+00	
00000000-0000-0000-0000-000000000000	b815e7d0-4c3a-4901-928e-4436cbeef3ad	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 19:32:51.9907+00	
00000000-0000-0000-0000-000000000000	c3bace4b-a0fa-4ca1-862b-b80e3cc5179c	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 19:32:51.991259+00	
00000000-0000-0000-0000-000000000000	89f5d9ce-8577-482c-9fae-5fc75f36eedf	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 20:30:53.200435+00	
00000000-0000-0000-0000-000000000000	e9343e24-086a-4425-ba96-7027f14d6721	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-18 20:30:53.200976+00	
00000000-0000-0000-0000-000000000000	4d34ff54-98ff-4a3c-863b-14127b7237b7	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-18 20:50:50.478779+00	
00000000-0000-0000-0000-000000000000	ceb70189-d892-43df-a07d-a2afb2d1a470	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-18 20:50:50.557705+00	
00000000-0000-0000-0000-000000000000	3083f834-7ecf-49a8-bf56-f7ce4b85c806	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 00:09:03.642159+00	
00000000-0000-0000-0000-000000000000	781c0646-8b37-4058-8b5e-c91449218681	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 00:09:03.642804+00	
00000000-0000-0000-0000-000000000000	3e5a9763-6fa9-4c4a-a48c-ad76eb2fe61f	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 01:44:30.332086+00	
00000000-0000-0000-0000-000000000000	9de03079-dfa3-4ac4-8588-ac8f6a4fac11	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 01:44:30.332532+00	
00000000-0000-0000-0000-000000000000	7e3359fd-9145-4865-a62a-7f2ac2d83ea9	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-19 01:44:30.358212+00	
00000000-0000-0000-0000-000000000000	d563ee24-baac-42ac-bf79-66a9f7a9eebb	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-19 01:44:30.64549+00	
00000000-0000-0000-0000-000000000000	ed5cdf06-54cf-4046-9d0c-8ff538f83fe4	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 15:09:01.806181+00	
00000000-0000-0000-0000-000000000000	22383007-f7e5-4f92-9c10-645ecd6aeda7	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 15:09:01.806846+00	
00000000-0000-0000-0000-000000000000	0c175040-4275-45ad-865e-2cbc7dcc3473	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-19 15:09:01.833244+00	
00000000-0000-0000-0000-000000000000	2ad4449e-981f-4f86-83cd-d83c59e12c03	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-19 15:09:02.119594+00	
00000000-0000-0000-0000-000000000000	faba592d-9004-4acb-81c5-7954a8071c1b	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 16:07:30.411036+00	
00000000-0000-0000-0000-000000000000	da787179-495e-46dd-aff2-b6c8ca4814d5	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 16:07:30.41163+00	
00000000-0000-0000-0000-000000000000	2667284d-3abe-4624-983d-513a3b48e5db	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 17:05:53.565487+00	
00000000-0000-0000-0000-000000000000	9ed0f8a2-36ca-437e-a477-00bc53a93563	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 17:05:53.565872+00	
00000000-0000-0000-0000-000000000000	f1776302-2ceb-4629-b8fd-aaacc86a3bab	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 18:04:16.11052+00	
00000000-0000-0000-0000-000000000000	9377d7d9-0ec1-441f-8aeb-0b9696806a22	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 18:04:16.111066+00	
00000000-0000-0000-0000-000000000000	f72d79f6-aef8-4e70-ae5b-49c2ebc2f3a9	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 19:53:42.356945+00	
00000000-0000-0000-0000-000000000000	31d8d6d2-47e5-4280-b67e-832289fa28c8	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 19:53:42.357575+00	
00000000-0000-0000-0000-000000000000	46759b0e-a4e5-4d88-a6a7-5729675f9a19	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 20:46:40.091823+00	
00000000-0000-0000-0000-000000000000	459256a8-9fe5-4c1b-9e2d-e66816dc6e96	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 20:46:40.092339+00	
00000000-0000-0000-0000-000000000000	86dfef36-157e-43a1-b2a0-b9a720ae9eb5	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 21:00:35.417911+00	
00000000-0000-0000-0000-000000000000	a9180bc8-48df-4c06-b2c0-8ae5d7156b3f	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 21:00:35.418547+00	
00000000-0000-0000-0000-000000000000	fc0ad391-ca1e-4951-8cb3-190827903b09	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-19 21:00:35.443411+00	
00000000-0000-0000-0000-000000000000	398d2063-d838-4e53-9c2d-4ded70b33eea	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-19 21:00:35.512294+00	
00000000-0000-0000-0000-000000000000	3d23875a-a63b-4a70-9e3e-10478f1ef187	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-19 21:36:22.760419+00	
00000000-0000-0000-0000-000000000000	f2e8b364-c9f0-4ff2-a244-c66025ebe848	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-19 21:36:22.838342+00	
00000000-0000-0000-0000-000000000000	ef09c32d-ba09-4601-8e4e-70e1e368cb64	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-19 21:41:11.907663+00	
00000000-0000-0000-0000-000000000000	86fabc14-283e-441f-a631-930411e0faac	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-19 21:41:11.990917+00	
00000000-0000-0000-0000-000000000000	a170cbf5-0c18-46c0-9b23-e5260976472e	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 21:49:23.273635+00	
00000000-0000-0000-0000-000000000000	2ef62fe1-6013-43dd-8cce-1f56a070c044	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-19 21:49:23.274163+00	
00000000-0000-0000-0000-000000000000	7a162269-455b-4ce9-85db-9c15e066b541	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-19 21:50:04.351648+00	
00000000-0000-0000-0000-000000000000	00471ab5-b39b-43e8-8097-7329a8100fef	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-19 21:50:04.424294+00	
00000000-0000-0000-0000-000000000000	4f3537be-a108-4460-888c-8c45e1a5a0fa	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-20 01:19:53.087492+00	
00000000-0000-0000-0000-000000000000	07e38f9c-2952-408f-8aa2-4fd6b201cd1b	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-20 01:19:53.088108+00	
00000000-0000-0000-0000-000000000000	63db0841-d065-46f2-ad19-340e137bc2d8	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-20 01:23:22.630822+00	
00000000-0000-0000-0000-000000000000	40685cc5-d227-4690-ae2f-061b72288874	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-20 01:23:22.705798+00	
00000000-0000-0000-0000-000000000000	6b11586e-bd33-41a9-a7ba-766ee6cf97f6	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-20 01:32:08.700093+00	
00000000-0000-0000-0000-000000000000	13da81d9-bdab-429c-8443-66f49cd0baeb	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-20 01:32:08.771438+00	
00000000-0000-0000-0000-000000000000	cb621a2f-4153-4bd6-8dc9-05147239bf55	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-20 02:30:23.142704+00	
00000000-0000-0000-0000-000000000000	7c0e3efd-6837-4482-985c-77addf4d6608	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-20 02:30:23.143168+00	
00000000-0000-0000-0000-000000000000	9f2ddaa1-34c4-48e4-986b-7f7e41ab41ed	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-20 02:32:59.278792+00	
00000000-0000-0000-0000-000000000000	4bfd4615-52d5-4e0e-af09-6cc20b1319cb	{"action":"login","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-21 02:35:46.678411+00	
00000000-0000-0000-0000-000000000000	65c15085-e8a0-468e-9c88-5a32c02b8169	{"action":"logout","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"account"}	2026-03-21 02:58:23.906712+00	
00000000-0000-0000-0000-000000000000	1eb8f15e-7ad1-4f56-ba0f-fb9b5eca9dcc	{"action":"login","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-21 02:58:24.231668+00	
00000000-0000-0000-0000-000000000000	58cbceb6-a896-4aab-8dd7-afeee4376ac2	{"action":"token_refreshed","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"token"}	2026-03-22 02:02:10.14814+00	
00000000-0000-0000-0000-000000000000	b5a54b44-d12e-4122-84ee-10af035b066c	{"action":"token_revoked","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"token"}	2026-03-22 02:02:10.151144+00	
00000000-0000-0000-0000-000000000000	b5eb4c8e-e3f9-4682-b9e3-a588e3b281ae	{"action":"token_refreshed","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"token"}	2026-03-22 03:00:13.341985+00	
00000000-0000-0000-0000-000000000000	b355f56d-21f3-40fa-a9d7-b2db1bd43d6e	{"action":"token_revoked","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"token"}	2026-03-22 03:00:13.342527+00	
00000000-0000-0000-0000-000000000000	1102ea55-1a99-4b2b-910b-2f8281f77c63	{"action":"logout","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"account"}	2026-03-22 03:16:16.414344+00	
00000000-0000-0000-0000-000000000000	ee2f7033-292f-483c-9828-90046ee8e1bf	{"action":"login","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 03:16:16.488958+00	
00000000-0000-0000-0000-000000000000	b2e08a5a-050c-4306-8242-d6477fbda0b6	{"action":"logout","actor_id":"60a9e5da-b1b3-4e74-b270-f185258e56e0","actor_username":"binli120@gmail.com","actor_via_sso":false,"log_type":"account"}	2026-03-22 03:21:41.040253+00	
00000000-0000-0000-0000-000000000000	db909bb1-c32f-47a5-9fa9-9d5850bd02b9	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 03:22:03.39887+00	
00000000-0000-0000-0000-000000000000	7a47a020-280a-40ea-bf30-2703dd0d7cbb	{"action":"logout","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-22 03:46:03.074995+00	
00000000-0000-0000-0000-000000000000	c424a254-39bf-446b-9768-552aba2f5ea4	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 03:46:23.172387+00	
00000000-0000-0000-0000-000000000000	179cfad4-e1ae-4a4a-84e4-f5353ec57eb7	{"action":"logout","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-22 03:49:32.360302+00	
00000000-0000-0000-0000-000000000000	d021ec86-64e8-4582-b2e3-2d7960f92e27	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 03:49:32.442656+00	
00000000-0000-0000-0000-000000000000	5834d08d-b6fd-4049-9dd0-58b52c675bf6	{"action":"login","actor_id":"6bc464e1-209a-48ac-820d-fde4ca3500e6","actor_username":"marcus.rivera@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 16:08:44.436421+00	
00000000-0000-0000-0000-000000000000	3d3ec3f5-b3b0-409e-b5f9-954d73cdee43	{"action":"login","actor_id":"6bc464e1-209a-48ac-820d-fde4ca3500e6","actor_username":"marcus.rivera@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 16:14:08.397323+00	
00000000-0000-0000-0000-000000000000	df77dad2-2680-4470-9a9e-5d79d830df07	{"action":"logout","actor_id":"6bc464e1-209a-48ac-820d-fde4ca3500e6","actor_username":"marcus.rivera@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-22 16:18:56.338848+00	
00000000-0000-0000-0000-000000000000	1dfa0446-70c2-4865-ad73-c479d6161249	{"action":"login","actor_id":"6bc464e1-209a-48ac-820d-fde4ca3500e6","actor_username":"marcus.rivera@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 16:18:56.413097+00	
00000000-0000-0000-0000-000000000000	0ed68f9a-d563-439f-aced-22afb5ae0baa	{"action":"login","actor_id":"6bc464e1-209a-48ac-820d-fde4ca3500e6","actor_username":"marcus.rivera@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 21:04:33.090459+00	
00000000-0000-0000-0000-000000000000	1ff1cb91-5ab4-4878-be78-4fa0a7168e66	{"action":"logout","actor_id":"6bc464e1-209a-48ac-820d-fde4ca3500e6","actor_username":"marcus.rivera@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-22 21:06:00.79541+00	
00000000-0000-0000-0000-000000000000	d151c098-d7c3-481b-b169-e77580f0a58c	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-22 21:06:11.870116+00	
00000000-0000-0000-0000-000000000000	63f3d6dc-8eac-4c95-8893-824fbc857b0f	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-24 00:54:58.285269+00	
00000000-0000-0000-0000-000000000000	68982f65-44e9-4846-865e-780297e269b3	{"action":"logout","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-24 00:57:46.760217+00	
00000000-0000-0000-0000-000000000000	a14814ef-2cd0-4910-aa76-20e476954201	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-24 00:59:11.177159+00	
00000000-0000-0000-0000-000000000000	3e7e3c4d-57cb-4a15-9394-20b7f07d65b2	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-24 01:01:08.106162+00	
00000000-0000-0000-0000-000000000000	a9357cf0-66e6-4c2c-aed0-5ac182af192f	{"action":"logout","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-24 01:02:20.103734+00	
00000000-0000-0000-0000-000000000000	f5fc8872-8ab8-4221-91ca-604f5575afef	{"action":"login","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-24 01:02:40.783913+00	
00000000-0000-0000-0000-000000000000	dc007d35-8703-437a-9ecb-2922421ddf41	{"action":"login","actor_id":"910421f3-2802-4b36-b77e-6737d38e86a2","actor_username":"linda.williams@hotmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-24 01:03:34.835685+00	
00000000-0000-0000-0000-000000000000	37812d10-9013-49a4-8eb0-2f316ff3c107	{"action":"token_refreshed","actor_id":"910421f3-2802-4b36-b77e-6737d38e86a2","actor_username":"linda.williams@hotmail.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 02:06:26.570227+00	
00000000-0000-0000-0000-000000000000	3dbd6059-8ea4-41be-8f70-39014f91e2cf	{"action":"token_revoked","actor_id":"910421f3-2802-4b36-b77e-6737d38e86a2","actor_username":"linda.williams@hotmail.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 02:06:26.570742+00	
00000000-0000-0000-0000-000000000000	3cd647ef-2890-438d-bdf1-baeaf697719d	{"action":"logout","actor_id":"910421f3-2802-4b36-b77e-6737d38e86a2","actor_username":"linda.williams@hotmail.com","actor_via_sso":false,"log_type":"account"}	2026-03-25 02:06:42.834047+00	
00000000-0000-0000-0000-000000000000	a938c38f-e729-4bc4-a100-9a5cf5865566	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-25 02:06:43.113048+00	
00000000-0000-0000-0000-000000000000	e8a2c357-de0d-46cb-8ca6-df3432e26bea	{"action":"token_refreshed","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 02:52:01.49437+00	
00000000-0000-0000-0000-000000000000	2c2d5299-de36-4f94-a969-119948c908aa	{"action":"token_revoked","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 02:52:01.494805+00	
00000000-0000-0000-0000-000000000000	0b84173e-ca4e-4066-91d6-073b531d3c7c	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-25 02:52:29.452463+00	
00000000-0000-0000-0000-000000000000	14d24011-fa29-4fbb-bfe3-b4ddf1d7305e	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 03:04:47.053506+00	
00000000-0000-0000-0000-000000000000	68c24670-a6ae-4689-b3f2-e73eb640de95	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 03:04:47.054034+00	
00000000-0000-0000-0000-000000000000	02cf7c50-84ba-4097-9616-ebfae1ae7806	{"action":"logout","actor_id":"df666116-f825-4305-a387-4a6c21c66cef","actor_username":"sarah.chen@homesite.com","actor_via_sso":false,"log_type":"account"}	2026-03-25 03:11:25.172371+00	
00000000-0000-0000-0000-000000000000	67a506f7-bcfe-4da0-9dba-dfc0b8cf38f3	{"action":"login","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-25 03:11:25.425293+00	
00000000-0000-0000-0000-000000000000	1a2c9f0b-a989-4441-b10e-a1a638796294	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 03:52:42.772327+00	
00000000-0000-0000-0000-000000000000	a828f753-d156-4792-868a-04e9755e7a68	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 03:52:42.772811+00	
00000000-0000-0000-0000-000000000000	ba5f9308-cebd-4a31-92b1-386e4c68c8fc	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-25 04:06:50.766559+00	
00000000-0000-0000-0000-000000000000	e062dccb-b56e-4837-8341-2d8f6007ed5d	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 13:44:38.943728+00	
00000000-0000-0000-0000-000000000000	1f0712b2-ff30-43b8-afa0-81b31c528a0c	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 13:44:38.944335+00	
00000000-0000-0000-0000-000000000000	c5bcc174-9283-4ace-9749-901d924fd716	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-25 14:29:10.795857+00	
00000000-0000-0000-0000-000000000000	41f2f9f9-2918-4e47-bde6-f87917372977	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 14:42:48.280439+00	
00000000-0000-0000-0000-000000000000	32d8bf3d-5c3c-4491-b2c3-b06dbae8687b	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 14:42:48.280997+00	
00000000-0000-0000-0000-000000000000	47efebf0-ed19-41f8-85d0-f341b9614656	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-25 15:01:23.780357+00	
00000000-0000-0000-0000-000000000000	4e3cb013-9119-4898-9301-c2c188994fe9	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-25 15:04:39.578928+00	
00000000-0000-0000-0000-000000000000	a8c543ea-ba66-4a84-9510-2f47fa9e15ca	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-25 15:37:11.74854+00	
00000000-0000-0000-0000-000000000000	0379452e-69a0-46d3-b13e-58eeac0706e2	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 15:41:00.664818+00	
00000000-0000-0000-0000-000000000000	5f15813a-79ba-4e46-8ec2-77157fef38dc	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-25 15:41:00.665277+00	
00000000-0000-0000-0000-000000000000	21464103-705a-4ee6-b521-956e6781077f	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-26 01:55:36.711012+00	
00000000-0000-0000-0000-000000000000	946da3c7-e9ca-4d3e-b59b-8e49deb6f23c	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 01:56:07.838345+00	
00000000-0000-0000-0000-000000000000	6e95a6e5-105f-42c5-9a48-8ea03cfab95b	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 01:56:07.83895+00	
00000000-0000-0000-0000-000000000000	db129d5c-3fa7-4dd7-82dc-3a34be22a813	{"action":"logout","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"account"}	2026-03-26 01:56:35.949373+00	
00000000-0000-0000-0000-000000000000	8873b9cb-d208-4b41-91d4-bff12ad21b58	{"action":"login","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-26 01:56:36.026905+00	
00000000-0000-0000-0000-000000000000	a7eca0e5-1a71-4db5-a064-661db3082b39	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 02:53:37.749316+00	
00000000-0000-0000-0000-000000000000	d027f7d8-b813-41e2-af6b-887e0d63e6c8	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 02:53:37.749673+00	
00000000-0000-0000-0000-000000000000	c7922280-812c-4226-b2c6-e524905a65db	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 02:55:15.839979+00	
00000000-0000-0000-0000-000000000000	926e7d6d-9c02-4f3b-a6e2-3c8bfe0b5a0a	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 02:55:15.840301+00	
00000000-0000-0000-0000-000000000000	15859a85-74e5-4173-8a69-eea109e272c3	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-26 03:05:32.132681+00	
00000000-0000-0000-0000-000000000000	d5ddcc03-958f-4cd0-b919-f782573ad26b	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 03:52:17.986337+00	
00000000-0000-0000-0000-000000000000	bf3348e2-360f-4674-ae3e-4937096d6c5d	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 03:52:17.986772+00	
00000000-0000-0000-0000-000000000000	3c991225-e2cd-436f-a55f-6f3ec8d657c0	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 04:50:21.283143+00	
00000000-0000-0000-0000-000000000000	12de8711-62c8-4bed-a38e-6ae9b6093d20	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 04:50:21.283522+00	
00000000-0000-0000-0000-000000000000	e90339fc-9dba-4257-ae0f-a8d6c3f8b1e7	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 05:48:23.760739+00	
00000000-0000-0000-0000-000000000000	7a563983-a721-452e-8858-21774b2dca61	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 05:48:23.761066+00	
00000000-0000-0000-0000-000000000000	1222f351-bb23-4285-bf42-6a4252da9574	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 06:46:47.798451+00	
00000000-0000-0000-0000-000000000000	779f1274-d82e-4dbc-93b5-ea263cc7a47d	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 06:46:47.798942+00	
00000000-0000-0000-0000-000000000000	5c65e0ba-e84d-45ba-95c5-e7895663de14	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 07:45:03.852141+00	
00000000-0000-0000-0000-000000000000	393914ee-c419-4a32-9cb4-5355f4c29e99	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 07:45:03.852926+00	
00000000-0000-0000-0000-000000000000	3dfd4068-20fb-4e10-8db7-dd9f952d0f55	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 08:31:16.984905+00	
00000000-0000-0000-0000-000000000000	6c3f902c-9d77-4a03-8684-2caf4e5ad5d8	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 08:31:16.985232+00	
00000000-0000-0000-0000-000000000000	b4cdb767-c52f-4467-a101-e596126cf3ae	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 09:20:35.664275+00	
00000000-0000-0000-0000-000000000000	13579fc2-629e-4537-aa05-fcbfa205faba	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 09:20:35.664738+00	
00000000-0000-0000-0000-000000000000	ab76e581-6f02-45e2-be4e-a228b310acd6	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 10:13:36.427608+00	
00000000-0000-0000-0000-000000000000	5ff07ddf-4191-4a06-919b-da2bcab85ea6	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 10:13:36.428035+00	
00000000-0000-0000-0000-000000000000	5cfe4857-2e95-41ba-88d8-e01971ff671f	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 11:11:38.077233+00	
00000000-0000-0000-0000-000000000000	282d6cc6-4be6-49a9-88f0-96a78b628bf7	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 11:11:38.077954+00	
00000000-0000-0000-0000-000000000000	49305932-32ea-4f9d-96b6-2193073168fa	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-26 11:44:26.516403+00	
00000000-0000-0000-0000-000000000000	d8737a86-210c-46f9-9399-f3c970bfc45c	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-26 11:45:57.102636+00	
00000000-0000-0000-0000-000000000000	4100afc5-2474-4a37-9b4d-0d08f3e8fa13	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 12:09:59.525594+00	
00000000-0000-0000-0000-000000000000	f64ab027-9918-43a8-ba4d-024ef5eaeea7	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 12:09:59.526927+00	
00000000-0000-0000-0000-000000000000	ad1f6f0e-22d4-4d79-8ee4-1b049b0e7038	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 12:42:35.81762+00	
00000000-0000-0000-0000-000000000000	d3318fc1-ddea-4237-ae8a-ea8fc834ee96	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 12:42:35.81838+00	
00000000-0000-0000-0000-000000000000	2c5de8b0-0f76-4c41-b625-37b19dcd5cb6	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 12:44:05.828144+00	
00000000-0000-0000-0000-000000000000	a6abc249-6f79-432e-90c8-d92f9c588340	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 12:44:05.828525+00	
00000000-0000-0000-0000-000000000000	8dd13afb-18b1-41ad-96d7-5b2e4a11717d	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 13:08:20.996945+00	
00000000-0000-0000-0000-000000000000	2dfd6835-f4be-485b-8606-1e63dcd3faff	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 13:08:20.997845+00	
00000000-0000-0000-0000-000000000000	414ce083-f8ce-478c-aaf2-811409639699	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 13:41:35.078271+00	
00000000-0000-0000-0000-000000000000	1debcabb-df4f-4fbb-90bc-cbcfc98e03fb	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 13:41:35.078628+00	
00000000-0000-0000-0000-000000000000	69724c7a-8fbc-4f68-8766-5ca29b942f53	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 13:42:18.172372+00	
00000000-0000-0000-0000-000000000000	c5b81e40-bdbf-4617-91a1-14e64a63d800	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 13:42:18.172764+00	
00000000-0000-0000-0000-000000000000	c53222d7-a476-4e0f-84a6-d10a89bcc27e	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 14:02:46.717441+00	
00000000-0000-0000-0000-000000000000	df01af1f-f2d7-4dec-9c95-241d33a44660	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 14:02:46.717937+00	
00000000-0000-0000-0000-000000000000	84614ab7-07ba-437a-a97f-e8f1399f627b	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 14:50:22.301622+00	
00000000-0000-0000-0000-000000000000	8e5355e4-f13b-4cc7-b83e-d7b6c3dabe5f	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 14:50:22.302126+00	
00000000-0000-0000-0000-000000000000	1e45b388-fe16-4187-810b-e6023f29fc1c	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 14:50:22.302103+00	
00000000-0000-0000-0000-000000000000	0ab7758f-f898-4139-bd86-fcb5774f88d3	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 14:50:22.302486+00	
00000000-0000-0000-0000-000000000000	321946fe-90a7-431f-9bc2-f81db1e0873e	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 15:52:43.882017+00	
00000000-0000-0000-0000-000000000000	36ec12fd-1b94-451f-a82c-6b33a2d7e40f	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 15:52:43.882427+00	
00000000-0000-0000-0000-000000000000	e52a63e5-f1b3-4f60-841f-8e6731c4b208	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 15:52:43.882623+00	
00000000-0000-0000-0000-000000000000	246d2a07-9ca5-40d9-9b75-3e09af7a828b	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 15:52:43.883048+00	
00000000-0000-0000-0000-000000000000	2ff7d9fa-3526-4c1c-9199-6da5511e4c2f	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 16:44:43.361813+00	
00000000-0000-0000-0000-000000000000	167cc05d-97cd-4d96-a08f-f01610e87ae8	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 16:44:43.362164+00	
00000000-0000-0000-0000-000000000000	574c9702-13e8-4e21-83c5-c21fa9f45d3f	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 16:51:56.551787+00	
00000000-0000-0000-0000-000000000000	2d329df4-7a0b-451a-abb0-04ccfb8624a8	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 16:51:56.551746+00	
00000000-0000-0000-0000-000000000000	bbad2ee1-f10e-44ac-b1b0-3a5eb22ab29e	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 16:51:56.552171+00	
00000000-0000-0000-0000-000000000000	e581ad33-fbd0-40e9-8fca-d522d1544cbd	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 16:51:56.552232+00	
00000000-0000-0000-0000-000000000000	ddbe0831-e0a6-4fe5-b37f-6fc08bed56f5	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-26 17:17:08.548939+00	
00000000-0000-0000-0000-000000000000	d5ce06e9-aed8-46a3-9dea-1de43d1612f5	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 23:56:08.847231+00	
00000000-0000-0000-0000-000000000000	1136a065-97b5-4212-ba0f-c2919fb896a6	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-26 23:56:08.84767+00	
00000000-0000-0000-0000-000000000000	1c2a5d01-116d-4218-98d3-2524ea9f53cb	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 00:43:26.792469+00	
00000000-0000-0000-0000-000000000000	7e90af03-ff4a-4cb8-b9ab-ef32fb79cc16	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 01:17:13.02337+00	
00000000-0000-0000-0000-000000000000	778706a5-a8fe-4534-86a2-497a9c21f8a6	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 01:17:13.023914+00	
00000000-0000-0000-0000-000000000000	7c944349-add1-49c1-91e1-0755c49f600a	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 01:22:44.693065+00	
00000000-0000-0000-0000-000000000000	b6bba504-c7bf-48aa-b34e-cbfb0cdd971e	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 01:41:50.43814+00	
00000000-0000-0000-0000-000000000000	37dc7248-4d69-49d8-922f-93e259070d71	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 01:41:50.438465+00	
00000000-0000-0000-0000-000000000000	c73db7ba-48dc-4ece-9a1f-f71f8bd57333	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-27 02:08:51.245294+00	
00000000-0000-0000-0000-000000000000	26e2a0a7-7bb5-4e20-bf0e-bb3e48e54d82	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 02:08:51.320867+00	
00000000-0000-0000-0000-000000000000	e57e9549-de3b-4449-b1bd-4bd668c0f685	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 02:20:44.719513+00	
00000000-0000-0000-0000-000000000000	0423133f-c0f4-4fb3-bd96-c9c0e7a4d001	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 02:40:03.298786+00	
00000000-0000-0000-0000-000000000000	de389c02-6e99-4b2a-8da5-6257bbb4d573	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 02:40:03.299306+00	
00000000-0000-0000-0000-000000000000	c748045f-cde1-46c1-9886-d96548d8602c	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 02:40:57.25271+00	
00000000-0000-0000-0000-000000000000	db8fcfc4-c35f-4f94-916f-4fffeee40a9b	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 02:40:57.253114+00	
00000000-0000-0000-0000-000000000000	978ba76b-9b30-45f7-b314-ea0422b3540e	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-27 03:03:33.271009+00	
00000000-0000-0000-0000-000000000000	7be3eb96-26cc-44f2-b1da-ec9ab197288b	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 03:22:05.616215+00	
00000000-0000-0000-0000-000000000000	8f3bf0d3-9f76-4e2a-a8d2-3aeb9fbf07c5	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 17:48:04.461997+00	
00000000-0000-0000-0000-000000000000	32627779-cf10-4a9c-8142-2c764d680eda	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 17:48:04.462617+00	
00000000-0000-0000-0000-000000000000	0072cc87-7f63-4478-8aa2-325f257a813b	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-27 17:48:13.079293+00	
00000000-0000-0000-0000-000000000000	c9041eea-8675-4c18-b6ae-9a7547305176	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 17:48:13.157535+00	
00000000-0000-0000-0000-000000000000	6154a744-31da-48e1-907c-ff8ec33ffd4a	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 17:49:30.06008+00	
00000000-0000-0000-0000-000000000000	09596f88-3e1d-4f5c-9805-a079533f0a6b	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 17:49:30.060533+00	
00000000-0000-0000-0000-000000000000	64969e72-d560-4152-9947-c135616c8cd1	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 19:04:48.009181+00	
00000000-0000-0000-0000-000000000000	3e9a151b-da39-4fd3-8343-721a8aaa5738	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-27 19:04:48.009732+00	
00000000-0000-0000-0000-000000000000	e02bd75a-8aaa-4351-8a05-2be71050f50b	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-27 23:29:20.284385+00	
00000000-0000-0000-0000-000000000000	630f27b2-1e4e-436d-bb95-0a5a3d9dd07f	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 00:27:21.747429+00	
00000000-0000-0000-0000-000000000000	e6976160-e128-470f-a590-582579d93d5e	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 00:27:21.747874+00	
00000000-0000-0000-0000-000000000000	599caec7-caa8-4430-82ea-1d866533c81c	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-28 00:43:31.724494+00	
00000000-0000-0000-0000-000000000000	139bcf50-10ed-4a10-96ec-cf113a70c235	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-28 02:42:44.771932+00	
00000000-0000-0000-0000-000000000000	18ed02a8-e998-4618-89b0-b83f0249f845	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 16:34:00.63351+00	
00000000-0000-0000-0000-000000000000	5f94bd96-707d-48b2-9cfe-4b443a104112	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 16:34:00.633909+00	
00000000-0000-0000-0000-000000000000	ef3b80a0-7183-4cec-b44f-d62ffec1550a	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 17:14:13.539788+00	
00000000-0000-0000-0000-000000000000	1b245ecc-3a50-4c90-abe4-92aeacca918d	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 17:14:13.540253+00	
00000000-0000-0000-0000-000000000000	0d72ce78-e27c-4165-a850-92e4589529c4	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 20:36:33.092865+00	
00000000-0000-0000-0000-000000000000	3b9d6ad1-39ea-4f31-80c3-95377c030c62	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 20:36:33.093444+00	
00000000-0000-0000-0000-000000000000	9c32085b-f217-4560-bc68-023d39d384d9	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 21:17:48.878702+00	
00000000-0000-0000-0000-000000000000	37757ff9-e816-4ef1-be7b-9a16261f46dc	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 21:17:48.879162+00	
00000000-0000-0000-0000-000000000000	e39c91a6-2f13-4cf4-891b-43197b8274bd	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-03-28 21:23:58.587471+00	
00000000-0000-0000-0000-000000000000	ad116a2d-a172-406f-83b9-98eab034dcde	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-03-28 21:23:58.668596+00	
00000000-0000-0000-0000-000000000000	2f7c789c-37e4-4488-b346-b77f835b11d7	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 21:35:28.587044+00	
00000000-0000-0000-0000-000000000000	f9a87dc0-1df0-46aa-8117-4774727fcb39	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-28 21:35:28.587547+00	
00000000-0000-0000-0000-000000000000	4c0f3ef3-6e9d-4d21-991f-c6957aa94988	{"action":"token_refreshed","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-29 00:20:17.231722+00	
00000000-0000-0000-0000-000000000000	c2ad03f1-e1f9-493d-bfdc-f245c9ec17f4	{"action":"token_revoked","actor_id":"bc0f8bac-4de4-42ea-a6b9-5714fd328809","actor_username":"sw_test@healthcompassma.com","actor_via_sso":false,"log_type":"token"}	2026-03-29 00:20:17.232271+00	
00000000-0000-0000-0000-000000000000	835755e4-52b4-43a5-b94f-82579cc4a89c	{"action":"token_refreshed","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-29 02:09:02.963123+00	
00000000-0000-0000-0000-000000000000	6c3915e8-09e1-4ef9-8a86-dc931158c141	{"action":"token_revoked","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"token"}	2026-03-29 02:09:02.963632+00	
00000000-0000-0000-0000-000000000000	0e0a677f-4e75-4af1-82b2-6e4e2d82bf10	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-04-04 23:30:31.540485+00	
00000000-0000-0000-0000-000000000000	a64d34bd-9f26-44e0-9fda-3ddf3f1c5756	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-04-04 23:30:44.486369+00	
00000000-0000-0000-0000-000000000000	4311dd21-dd5f-4917-a954-b28a7d853ef6	{"action":"login","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-04-04 23:30:44.559179+00	
00000000-0000-0000-0000-000000000000	b3f2dedb-1157-42cb-b975-3b1e3e89fae5	{"action":"logout","actor_id":"bb728af4-11ae-4df0-8317-0e163c1f4526","actor_username":"d@example.com","actor_via_sso":false,"log_type":"account"}	2026-04-04 23:30:47.256739+00	
00000000-0000-0000-0000-000000000000	f6f2959b-c372-46b2-9d7e-7258942f7fee	{"action":"login","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-04-04 23:32:37.985367+00	
00000000-0000-0000-0000-000000000000	a0acf8ff-89ce-474c-9d40-2437fb992322	{"action":"token_refreshed","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 00:46:20.837757+00	
00000000-0000-0000-0000-000000000000	699272d4-8d2d-439d-a9ab-f62f43a4470a	{"action":"token_revoked","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 00:46:20.875833+00	
00000000-0000-0000-0000-000000000000	225d212b-0f86-4476-8c2b-8d1ca3e9c8e0	{"action":"token_refreshed","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 01:42:27.398664+00	
00000000-0000-0000-0000-000000000000	3ac01254-8535-490f-8229-6afb3e5de7b7	{"action":"token_revoked","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 01:42:27.400908+00	
00000000-0000-0000-0000-000000000000	710a1258-70dd-46d1-8e2f-a0d8ca9b95a4	{"action":"token_refreshed","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 01:47:05.119487+00	
00000000-0000-0000-0000-000000000000	54b4ce36-f630-4ae4-aa06-5c7929952283	{"action":"token_revoked","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 01:47:05.122199+00	
00000000-0000-0000-0000-000000000000	e29ea73d-f146-47d2-a499-4e9f6898b293	{"action":"token_refreshed","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 02:45:07.369729+00	
00000000-0000-0000-0000-000000000000	f55b50b4-9fce-4db6-bcb4-5dde2fbcabbe	{"action":"token_revoked","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"token"}	2026-04-05 02:45:07.370857+00	
00000000-0000-0000-0000-000000000000	2be06ec5-3e5d-4c7e-9db2-d61bf00250d0	{"action":"logout","actor_id":"cdbb0168-004a-4b83-a1ff-0c8336ba52f5","actor_username":"patient@healthcompass.dev","actor_via_sso":false,"log_type":"account"}	2026-04-05 03:18:55.974543+00	
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
bc0f8bac-4de4-42ea-a6b9-5714fd328809	bc0f8bac-4de4-42ea-a6b9-5714fd328809	{"sub": "bc0f8bac-4de4-42ea-a6b9-5714fd328809", "email": "sw_test@healthcompassma.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	email	\N	2026-03-25 02:10:47.327527+00	2026-03-25 03:11:25.298611+00	30253ef0-4113-4e4b-8254-27edd7cc3b95
bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	{"sub": "bb728af4-11ae-4df0-8317-0e163c1f4526", "email": "d@example.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	email	\N	2026-03-17 14:40:15.976097+00	2026-03-28 02:42:44.639372+00	5ef4a184-6cc1-4fa4-970f-c58b8769d516
60a9e5da-b1b3-4e74-b270-f185258e56e0	60a9e5da-b1b3-4e74-b270-f185258e56e0	{"sub": "60a9e5da-b1b3-4e74-b270-f185258e56e0", "email": "binli120@gmail.com", "last_name": "worker", "first_name": "social", "email_verified": true, "phone_verified": false}	email	\N	2026-03-21 02:19:59.313313+00	2026-03-22 03:15:58.615376+00	607cd68a-eca8-4832-b1d9-c570165aa170
07d7e11d-6a3d-41a8-826d-66e38470c830	07d7e11d-6a3d-41a8-826d-66e38470c830	{"sub": "07d7e11d-6a3d-41a8-826d-66e38470c830", "email": "maria.santos@gmail.com", "email_verified": true}	email	\N	2026-03-22 03:39:29.726679+00	2026-03-22 03:39:29.726679+00	0bad9fde-2a34-4e86-839d-52793b52b142
baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	{"sub": "baa1f7ef-8c92-4111-b63a-58f87cbdc8d8", "email": "james.kim@yahoo.com", "email_verified": true}	email	\N	2026-03-22 03:39:29.726679+00	2026-03-22 03:39:29.726679+00	5acf5543-6278-4530-a347-30ef916a1ddf
fa7a619b-dc98-4d47-bc87-61a0e0dad2be	fa7a619b-dc98-4d47-bc87-61a0e0dad2be	{"sub": "fa7a619b-dc98-4d47-bc87-61a0e0dad2be", "email": "robert.garcia@gmail.com", "email_verified": true}	email	\N	2026-03-22 03:39:29.726679+00	2026-03-22 03:39:29.726679+00	fc5c0d89-6a18-4ca6-937e-390ddc5f9ddb
cdbb0168-004a-4b83-a1ff-0c8336ba52f5	cdbb0168-004a-4b83-a1ff-0c8336ba52f5	{"sub": "cdbb0168-004a-4b83-a1ff-0c8336ba52f5", "email": "patient@healthcompass.dev", "email_verified": true}	email	\N	2026-04-04 23:32:11.065543+00	2026-04-04 23:32:11.065543+00	151c3837-aa79-4b7d-a68a-71737b5dccb6
6bc464e1-209a-48ac-820d-fde4ca3500e6	6bc464e1-209a-48ac-820d-fde4ca3500e6	{"sub": "6bc464e1-209a-48ac-820d-fde4ca3500e6", "email": "marcus.rivera@homesite.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	email	\N	2026-03-22 03:20:59.421192+00	2026-03-22 21:04:32.962227+00	458dc82a-0361-485f-aa3a-913a8f590e34
df666116-f825-4305-a387-4a6c21c66cef	df666116-f825-4305-a387-4a6c21c66cef	{"sub": "df666116-f825-4305-a387-4a6c21c66cef", "email": "sarah.chen@homesite.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	email	\N	2026-03-22 03:20:59.421192+00	2026-03-24 00:59:11.04854+00	3240d9cc-2ec4-4c82-a129-438840269be9
910421f3-2802-4b36-b77e-6737d38e86a2	910421f3-2802-4b36-b77e-6737d38e86a2	{"sub": "910421f3-2802-4b36-b77e-6737d38e86a2", "email": "linda.williams@hotmail.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	email	\N	2026-03-22 03:39:29.726679+00	2026-03-24 01:03:34.714799+00	7baf27e6-658a-483e-9b36-6384f53c7b93
6292e07c-4b97-41db-9aaa-2e2b8b7db500	6292e07c-4b97-41db-9aaa-2e2b8b7db500	{"sub": "6292e07c-4b97-41db-9aaa-2e2b8b7db500", "email": "patient_test@healthcompassma.com", "phone": "", "last_name": "Santos", "first_name": "Maria", "email_verified": true, "phone_verified": false}	email	\N	2026-03-25 02:10:36.186324+00	2026-03-25 02:10:36.186324+00	77c929b2-94d5-4bee-a559-13059b4cfd4b
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
af0806ed-50c5-4fc0-b8a8-fd1126e4063a	2026-03-26 01:56:36.029121+00	2026-03-26 01:56:36.029121+00	password	2c4859e1-ebe5-4ab9-a7ed-edb4e843bc7d
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	95	mkqcvlvr6vfc	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 14:02:46.718699+00	2026-03-26 16:44:43.362419+00	7nwzxuscgvgm	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	100	mtb4cvsj4lmi	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 16:44:43.362748+00	2026-03-26 23:56:08.847903+00	mkqcvlvr6vfc	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	103	nhk5uitrnjh6	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 23:56:08.848273+00	2026-03-27 01:17:13.024284+00	mtb4cvsj4lmi	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	105	fo2s2ouim4ut	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-27 01:17:13.025512+00	2026-03-27 02:40:57.253365+00	nhk5uitrnjh6	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	111	2mn6sjjymjmf	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-27 02:40:57.253673+00	2026-03-27 17:49:30.060854+00	fo2s2ouim4ut	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	115	vmvwzodgsccf	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-27 17:49:30.061207+00	2026-03-28 16:34:00.634148+00	2mn6sjjymjmf	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	120	gtcilp4mwirs	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-28 16:34:00.634431+00	2026-03-28 20:36:33.093833+00	vmvwzodgsccf	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	122	kelkzuck2sqq	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-28 20:36:33.094207+00	2026-03-28 21:35:28.587887+00	gtcilp4mwirs	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	125	e4faecqiyk7e	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-28 21:35:28.588319+00	2026-03-29 00:20:17.232616+00	kelkzuck2sqq	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	126	u5npglygka4c	bc0f8bac-4de4-42ea-a6b9-5714fd328809	f	2026-03-29 00:20:17.234369+00	2026-03-29 00:20:17.234369+00	e4faecqiyk7e	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	75	crioyiyrc6bx	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 01:56:36.028365+00	2026-03-26 02:55:15.84051+00	\N	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	77	thihsgxvcuft	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 02:55:15.840841+00	2026-03-26 03:52:17.987006+00	crioyiyrc6bx	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	78	lpatun3jsvyj	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 03:52:17.987293+00	2026-03-26 04:50:21.283835+00	thihsgxvcuft	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	79	kbltpg7emcsf	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 04:50:21.284125+00	2026-03-26 05:48:23.761411+00	lpatun3jsvyj	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	80	6bnolypgtszm	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 05:48:23.761706+00	2026-03-26 06:46:47.799264+00	kbltpg7emcsf	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	81	k64uvrxjclkq	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 06:46:47.799683+00	2026-03-26 07:45:03.854263+00	6bnolypgtszm	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	82	jombweud7pfv	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 07:45:03.8552+00	2026-03-26 08:31:16.985474+00	k64uvrxjclkq	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	83	lehflxfo5cti	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 08:31:16.985834+00	2026-03-26 09:20:35.665051+00	jombweud7pfv	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	84	vqipq4tl343z	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 09:20:35.665369+00	2026-03-26 10:13:36.42843+00	lehflxfo5cti	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	85	pyzitz7kapen	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 10:13:36.42882+00	2026-03-26 11:11:38.078261+00	vqipq4tl343z	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	86	7csjfyalvprt	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 11:11:38.078588+00	2026-03-26 12:09:59.527194+00	pyzitz7kapen	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	89	invodzdqq7yj	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 12:09:59.527554+00	2026-03-26 13:08:20.9982+00	7csjfyalvprt	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
00000000-0000-0000-0000-000000000000	92	7nwzxuscgvgm	bc0f8bac-4de4-42ea-a6b9-5714fd328809	t	2026-03-26 13:08:20.998792+00	2026-03-26 14:02:46.718339+00	invodzdqq7yj	af0806ed-50c5-4fc0-b8a8-fd1126e4063a
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
af0806ed-50c5-4fc0-b8a8-fd1126e4063a	bc0f8bac-4de4-42ea-a6b9-5714fd328809	2026-03-26 01:56:36.027562+00	2026-03-29 00:20:17.236175+00	\N	aal1	\N	2026-03-29 00:20:17.236141	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15	172.18.0.1	\N	\N	\N	\N	\N
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	bc0f8bac-4de4-42ea-a6b9-5714fd328809	authenticated	authenticated	sw_test@healthcompassma.com	$2a$10$ldXG43y3Mp3EZP5N276/R..XWrH92EInzZHmiGMmxEQdlduoVONiO	2026-03-25 02:10:47.327527+00	\N		\N		\N			\N	2026-03-26 01:56:36.027523+00	{"provider": "email", "providers": ["email"]}	{"sub": "bc0f8bac-4de4-42ea-a6b9-5714fd328809", "email": "sw_test@healthcompassma.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	\N	2026-03-25 02:10:47.327527+00	2026-03-29 00:20:17.235282+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6292e07c-4b97-41db-9aaa-2e2b8b7db500	authenticated	authenticated	patient_test@healthcompassma.com	$2a$10$kqFda3lvU.bs.uf3qSL0cupB4eszS3DBC.ql0eLvihb8xn4Xm1ugS	2026-03-25 02:10:36.186324+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"email": "patient_test@healthcompassma.com", "phone": "", "last_name": "Santos", "first_name": "Maria", "email_verified": true, "phone_verified": false}	\N	2026-03-25 02:10:36.186324+00	2026-03-25 02:10:36.186324+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	df666116-f825-4305-a387-4a6c21c66cef	authenticated	authenticated	sarah.chen@homesite.com	$2a$10$dRfn6ZmKmIVftFcjmoF2HOwC5BpxPXiDfAyM1LQdD3A4EZa4LaCBm	2026-03-22 03:20:59.421192+00	\N		\N		\N			\N	2026-03-24 01:02:40.78448+00	{"provider": "email", "providers": ["email"]}	{"sub": "df666116-f825-4305-a387-4a6c21c66cef", "email": "sarah.chen@homesite.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	\N	2026-03-22 03:20:59.421192+00	2026-03-25 02:52:01.496196+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	60a9e5da-b1b3-4e74-b270-f185258e56e0	authenticated	authenticated	binli120@gmail.com	$2a$10$68X/JbZufOLvB0ElpSQX2eGu1uf7QlBggyBB6Xm6SZuTh6BhJplTK	2026-03-21 02:19:59.313313+00	\N		\N		\N			\N	2026-03-22 03:16:16.489495+00	{"provider": "email", "providers": ["email"]}	{"sub": "60a9e5da-b1b3-4e74-b270-f185258e56e0", "email": "binli120@gmail.com", "phone": "", "last_name": "worker", "first_name": "social", "email_verified": true, "phone_verified": false}	\N	2026-03-21 02:19:59.313313+00	2026-03-22 03:16:16.490948+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6bc464e1-209a-48ac-820d-fde4ca3500e6	authenticated	authenticated	marcus.rivera@homesite.com	$2a$10$ISoI4ow61SwygIFOgjjLUODDzkKfjzH.1WYzILZlDVSUlXMl75q3G	2026-03-22 03:20:59.421192+00	\N		\N		\N			\N	2026-03-22 21:04:33.091754+00	{"provider": "email", "providers": ["email"]}	{"sub": "6bc464e1-209a-48ac-820d-fde4ca3500e6", "email": "marcus.rivera@homesite.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	\N	2026-03-22 03:20:59.421192+00	2026-03-22 21:04:33.093728+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	07d7e11d-6a3d-41a8-826d-66e38470c830	authenticated	authenticated	maria.santos@gmail.com	$2a$10$94yDejW84u8I6FQTtBofLeZNTwquTIT/HXMYhKYpTYjg3h8yKuJ0O	2026-03-22 03:39:29.726679+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"last_name": "Santos", "first_name": "Maria", "email_verified": true}	\N	2026-02-05 03:39:29.726679+00	2026-03-22 03:39:29.726679+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	authenticated	authenticated	james.kim@yahoo.com	$2a$10$LnlxzGMFMqpq9AfvaltaquT3ZB0w57o/8G9ZcESlPIsEqqKMFDYSe	2026-03-22 03:39:29.726679+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"last_name": "Kim", "first_name": "James", "email_verified": true}	\N	2026-01-21 03:39:29.726679+00	2026-03-22 03:39:29.726679+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	bb728af4-11ae-4df0-8317-0e163c1f4526	authenticated	authenticated	d@example.com	$2a$10$Udvk7PDfdnyPQOyOrX1ZyuK8lcF2pQJCYVCmLwPPxjB8Vlhq66U0m	2026-03-17 14:40:15.976097+00	\N		\N		\N			\N	2026-04-04 23:30:44.55976+00	{"provider": "email", "providers": ["email"]}	{"sub": "bb728af4-11ae-4df0-8317-0e163c1f4526", "role": "patient", "email": "d@example.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	\N	2026-03-17 14:40:15.976097+00	2026-04-04 23:30:44.561516+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	fa7a619b-dc98-4d47-bc87-61a0e0dad2be	authenticated	authenticated	robert.garcia@gmail.com	$2a$10$kanAblAqxf0YkzTdn37hquVWUiCFxU/kYuVk2Z68F/je40U8YaMZW	2026-03-22 03:39:29.726679+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"last_name": "Garcia", "first_name": "Robert", "email_verified": true}	\N	2026-03-12 03:39:29.726679+00	2026-03-22 03:39:29.726679+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	910421f3-2802-4b36-b77e-6737d38e86a2	authenticated	authenticated	linda.williams@hotmail.com	$2a$10$Cg0v0KEs9YbVqg9N0kdqqOOlI4Z/PyQK7LHZ5FnYccUh8Sa8wZ0wm	2026-03-22 03:39:29.726679+00	\N		\N		\N			\N	2026-03-24 01:03:34.83624+00	{"provider": "email", "providers": ["email"]}	{"sub": "910421f3-2802-4b36-b77e-6737d38e86a2", "email": "linda.williams@hotmail.com", "phone": "", "last_name": "User", "first_name": "Local", "email_verified": true, "phone_verified": false}	\N	2026-03-02 03:39:29.726679+00	2026-03-25 02:06:26.572058+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	cdbb0168-004a-4b83-a1ff-0c8336ba52f5	authenticated	authenticated	patient@healthcompass.dev	$2a$10$T8r7GjyMkAG6V7FOufKsduatAEZVGNb81cudm679O1bVZ9po46Yfa	2026-04-04 23:32:11.065543+00	\N		\N		\N			\N	2026-04-04 23:32:37.986087+00	{"provider": "email", "providers": ["email"]}	{"email": "patient@healthcompass.dev", "last_name": "Patient", "first_name": "Jane", "email_verified": true, "phone_verified": false}	\N	2026-04-04 23:32:11.065543+00	2026-04-05 02:45:07.37622+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: applicants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.applicants (id, user_id, first_name, last_name, dob, ssn_encrypted, phone, address_line1, address_line2, city, state, zip, citizenship_status, created_at) FROM stdin;
a154a6ca-632e-42dc-88eb-ef7bf59db16d	60a9e5da-b1b3-4e74-b270-f185258e56e0	social	worker	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-03-21 02:19:59.313313+00
8be32d63-7583-4a2a-866b-4527c4660dcf	07d7e11d-6a3d-41a8-826d-66e38470c830	Maria	Santos	1985-03-12	\N	617-555-0101	24 Maple Street	\N	Boston	MA	02118	citizen	2026-02-05 03:39:29.726679+00
bacbfdb3-73c4-4ce6-b1e6-59e86f0f78af	baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	James	Kim	1972-08-29	\N	617-555-0202	87 Tremont Ave	\N	Somerville	MA	02143	citizen	2026-01-21 03:39:29.726679+00
40956458-f8ec-4b3e-a421-89895a678558	fa7a619b-dc98-4d47-bc87-61a0e0dad2be	Robert	Garcia	1990-06-17	\N	617-555-0404	305 Elm Street Apt 2	\N	Quincy	MA	02169	citizen	2026-03-12 03:39:29.726679+00
813e8335-daf3-4e12-a277-5dacb2ccf96f	6292e07c-4b97-41db-9aaa-2e2b8b7db500	Maria	Santos	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-03-25 02:10:36.186324+00
edfb3170-babc-4063-b16a-a754c424840e	910421f3-2802-4b36-b77e-6737d38e86a2	Ellis	Wong	1968-11-05	\N	781-555-0303	12 Oak Lane	\N	Cambridge	MA	02139	permanent_resident	2026-03-02 03:39:29.726679+00
5da79148-d75a-49bd-88ce-9b976d0724c0	bb728af4-11ae-4df0-8317-0e163c1f4526	Local	User	\N	\N	978-234-2345	48 Grapevine Ave	\N	Lexington	MA	02421	\N	2026-03-17 14:40:15.976097+00
ebc0dfe7-78b5-41ee-9b31-725c781ce8e9	cdbb0168-004a-4b83-a1ff-0c8336ba52f5	Jane	Patient	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-04 23:32:11.065543+00
\.


--
-- Data for Name: applications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.applications (id, organization_id, applicant_id, status, household_size, total_monthly_income, confidence_score, submitted_at, decided_at, created_at, application_type, draft_state, draft_step, last_saved_at, updated_at) FROM stdin;
1ea1de2a-0d4f-4811-add1-4fe9d26aa6f8	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-18 18:34:43.62264+00	aca3	{"formAssistantMessages": 1}	\N	2026-03-18 18:35:23.666483+00	2026-03-18 18:35:23.666483+00
0d7d13c5-9aee-412d-b614-57d212df0a0f	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-18 20:50:54.881222+00	aca3	{"formAssistantMessages": 11}	\N	2026-03-18 20:52:33.781777+00	2026-03-18 20:52:33.781777+00
e9bf317f-088e-4ef1-bae0-b830d93b9bf7	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 15:09:08.805837+00	aca3	\N	\N	2026-03-19 15:09:08.805837+00	2026-03-19 15:09:08.805837+00
e794f0ae-ae61-4f34-bf7d-c0e1d5145941	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 16:53:43.666227+00	aca3ap	\N	\N	2026-03-19 16:53:43.666227+00	2026-03-19 16:53:43.666227+00
333a6dde-afc9-462a-977f-d94341b8a034	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 21:00:41.238987+00	aca3ap	\N	\N	2026-03-19 21:00:41.238987+00	2026-03-19 21:00:41.238987+00
cbb7f220-0828-4f0b-8159-4a2ad77eccc6	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 21:09:41.984896+00	aca3	\N	\N	2026-03-19 21:09:41.984896+00	2026-03-19 21:09:41.984896+00
26feafea-a61e-4ceb-b472-644a33203b1c	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 21:14:24.865488+00	aca3ap	\N	\N	2026-03-19 21:14:24.865488+00	2026-03-19 21:14:24.865488+00
efdd0139-af5c-4de3-a403-2d0131b34376	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 21:36:32.721789+00	aca3ap	\N	\N	2026-03-19 21:36:32.721789+00	2026-03-19 21:36:32.721789+00
83a58802-b666-4ea6-92db-75ab33bf4535	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 21:41:21.812194+00	aca3ap	\N	\N	2026-03-19 21:41:21.812194+00	2026-03-19 21:41:21.812194+00
9847f7f8-3367-4ccd-91a5-f1daa60be983	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-19 21:50:08.802487+00	aca3ap	\N	\N	2026-03-19 21:50:08.802487+00	2026-03-19 21:50:08.802487+00
a9e25c4c-cc41-48e2-ac4d-22704bd69a21	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-20 01:27:10.097734+00	aca3	\N	\N	2026-03-20 01:27:10.097734+00	2026-03-20 01:27:10.097734+00
8b0167e4-7c11-49dc-a617-e195c4f1656f	\N	8be32d63-7583-4a2a-866b-4527c4660dcf	submitted	3	2400.00	\N	2026-02-25 03:39:29.726679+00	\N	2026-02-20 03:39:29.726679+00	\N	\N	\N	\N	2026-03-22 03:39:29.726679+00
d173fac7-56f2-4050-a542-8f9055dacd38	\N	8be32d63-7583-4a2a-866b-4527c4660dcf	draft	3	2400.00	\N	\N	\N	2026-03-17 03:39:29.726679+00	\N	\N	\N	\N	2026-03-22 03:39:29.726679+00
df4fee30-6885-4565-ab72-c9e2137d03f3	\N	bacbfdb3-73c4-4ce6-b1e6-59e86f0f78af	approved	2	1800.00	\N	2026-02-05 03:39:29.726679+00	\N	2026-01-31 03:39:29.726679+00	\N	\N	\N	\N	2026-03-22 03:39:29.726679+00
0301a47b-e6b6-47d6-8c79-fa9dc536fa51	\N	edfb3170-babc-4063-b16a-a754c424840e	needs_review	4	3100.00	\N	2026-03-12 03:39:29.726679+00	\N	2026-03-08 03:39:29.726679+00	\N	\N	\N	\N	2026-03-22 03:39:29.726679+00
bf3360b0-c4a5-4d0d-b063-1b27b8c98f5f	\N	40956458-f8ec-4b3e-a421-89895a678558	draft	2	1200.00	\N	\N	\N	2026-03-14 03:39:29.726679+00	\N	\N	\N	\N	2026-03-22 03:39:29.726679+00
31afc870-439f-4635-806c-d7d95b9b93b0	\N	40956458-f8ec-4b3e-a421-89895a678558	submitted	2	1200.00	\N	2026-03-19 03:39:29.726679+00	\N	2026-03-16 03:39:29.726679+00	\N	\N	\N	\N	2026-03-22 03:39:29.726679+00
1a4884ed-a8d5-4fb1-ab0f-3f47a8bd2aaf	\N	5da79148-d75a-49bd-88ce-9b976d0724c0	draft	\N	\N	\N	\N	\N	2026-03-22 21:06:17.66281+00	aca3	\N	\N	2026-03-22 21:06:17.66281+00	2026-03-22 21:06:17.66281+00
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assets (id, application_id, asset_type, value) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, user_id, application_id, action, old_data, new_data, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: benefit_stack_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.benefit_stack_results (id, family_profile_id, stack_data, generated_at) FROM stdin;
1e0dedc8-ef1c-4dc7-8bee-10fc6d95f6c8	1a8b3ef8-d5fb-4486-9d91-e46b0983ae7e	{"bundles": [{"bundleId": "masshealth_bundle", "bundleName": "MassHealth Application Bundle", "programIds": ["masshealth_family_assistance", "connector_care"], "description": "A single MassHealth application covers all coverage tracks and the Medicare Savings Program.", "estimatedTime": "30–45 minutes", "applicationUrl": "/application/new", "applicationPhone": "1-800-841-2900", "sharedApplicationName": "MassHealth Application", "totalEstimatedMonthlyValue": 450}], "results": [{"score": 77, "category": "healthcare", "priority": 1, "nextSteps": ["Apply at mahealthconnector.org — comprehensive pediatric coverage", "Small monthly premiums based on income"], "programId": "masshealth_family_assistance", "valueNote": "Low-cost CHIP coverage for 1 child (small monthly premium)", "bundleNote": "MassHealth and Medicare Savings Program share one application.", "bundleWith": ["msp"], "confidence": 80, "programName": "MassHealth Family Assistance (CHIP)", "administeredBy": "MA MassHealth", "applicationUrl": "/application/new", "processingTime": "45 days (10 days if urgent)", "keyRequirements": ["MA resident", "Child under 19", "Income 150–300% FPL (~$38,730–$77,460/yr)"], "applicationPhone": "1-800-841-2900", "programShortName": "MH Family Asst.", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return", "Children's birth certificates"], "applicationMethods": ["online", "phone", "in_person", "mail"], "estimatedAnnualValue": 2400, "estimatedMonthlyValue": 200}, {"score": 74.8, "category": "healthcare", "priority": 2, "nextSteps": ["Shop plans at mahealthconnector.org during open enrollment", "Premiums capped as % of income; reduced copays"], "programId": "connector_care", "valueNote": "Subsidized plans with capped premiums at 265% FPL", "confidence": 82, "programName": "ConnectorCare", "administeredBy": "MA Health Connector", "applicationUrl": "https://www.mahealthconnector.org", "processingTime": "2–4 weeks", "keyRequirements": ["MA resident", "Age 19–64", "Income 138–300% FPL (~$35,632–$77,460/yr)"], "programShortName": "ConnectorCare", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return"], "applicationMethods": ["online"], "estimatedAnnualValue": 3000, "estimatedMonthlyValue": 250}, {"score": 36.239999999999995, "category": "tax_credit", "priority": 3, "nextSteps": ["File your federal and MA state tax returns — claim EITC on Form 1040", "Use IRS Free File (free if income <$79,000) at irs.gov/freefile", "Get free tax prep help at VITA sites (Volunteer Income Tax Assistance): call 1-800-906-9887", "MA EITC is 40% of your federal credit (~$31) — claim on MA Form 1"], "programId": "eitc_federal", "valueNote": "~$77 federal + $31 MA (40%) = $108 total tax credit", "confidence": 65, "programName": "Earned Income Tax Credit (EITC)", "administeredBy": "IRS + MA DOR", "applicationUrl": "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit", "processingTime": "3 weeks (e-file) or 6–8 weeks (mail)", "applicationNote": "Claim on your federal tax return (Form 1040) and MA state return", "keyRequirements": ["Must file a federal tax return", "Must have earned income (wages or self-employment)", "1 qualifying child claimed as dependents", "Annual earned income ≤ $49,084"], "programShortName": "EITC", "eligibilityStatus": "possibly", "requiredDocuments": ["W-2 forms or 1099s for all income", "Social Security numbers for all family members", "Children's birth certificates (if claiming children)", "Prior year tax return"], "applicationMethods": ["online", "in_person"], "estimatedAnnualValue": 108, "estimatedMonthlyValue": 9}, {"score": 36, "category": "food", "priority": 4, "nextSteps": ["Apply online at dta.mass.gov — fast, takes about 20 minutes", "Ask about Expedited SNAP if income is very low or you have no food", "Benefits are loaded onto an EBT card, accepted at most grocery stores"], "programId": "snap", "valueNote": "~$0/month (max $768 for household of 3)", "bundleNote": "One DTA application covers SNAP, TAFDC, and EAEDC — apply once at dta.mass.gov", "bundleWith": ["tafdc", "eaedc"], "confidence": 65, "programName": "SNAP (Food Stamps)", "administeredBy": "MA DTA", "applicationUrl": "https://www.dta.mass.gov", "processingTime": "30 days (7 days if expedited)", "keyRequirements": ["MA resident", "Gross income ≤130% FPL (~$2,797/month)", "US citizen or most qualified immigrants"], "applicationPhone": "1-877-382-2363", "programShortName": "SNAP", "eligibilityStatus": "possibly", "requiredDocuments": ["Photo ID", "Proof of MA residency (utility bill, lease)", "Social Security card or number", "Proof of income (pay stubs, benefit letters)", "Proof of expenses (rent receipt, utility bills)"], "applicationMethods": ["online", "phone", "in_person"], "estimatedAnnualValue": 0, "estimatedMonthlyValue": 0}], "summary": "We found 2 programs you likely qualify for and 2 additional programs to explore — potentially $450/month in benefits. These are estimates based on your answers; official eligibility is determined by each program at time of application.", "annualFPL": 25820, "profileId": "1a8b3ef8-d5fb-4486-9d91-e46b0983ae7e", "quickWins": [{"score": 77, "category": "healthcare", "priority": 1, "nextSteps": ["Apply at mahealthconnector.org — comprehensive pediatric coverage", "Small monthly premiums based on income"], "programId": "masshealth_family_assistance", "valueNote": "Low-cost CHIP coverage for 1 child (small monthly premium)", "bundleNote": "MassHealth and Medicare Savings Program share one application.", "bundleWith": ["msp"], "confidence": 80, "programName": "MassHealth Family Assistance (CHIP)", "administeredBy": "MA MassHealth", "applicationUrl": "/application/new", "processingTime": "45 days (10 days if urgent)", "keyRequirements": ["MA resident", "Child under 19", "Income 150–300% FPL (~$38,730–$77,460/yr)"], "applicationPhone": "1-800-841-2900", "programShortName": "MH Family Asst.", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return", "Children's birth certificates"], "applicationMethods": ["online", "phone", "in_person", "mail"], "estimatedAnnualValue": 2400, "estimatedMonthlyValue": 200}, {"score": 74.8, "category": "healthcare", "priority": 2, "nextSteps": ["Shop plans at mahealthconnector.org during open enrollment", "Premiums capped as % of income; reduced copays"], "programId": "connector_care", "valueNote": "Subsidized plans with capped premiums at 265% FPL", "confidence": 82, "programName": "ConnectorCare", "administeredBy": "MA Health Connector", "applicationUrl": "https://www.mahealthconnector.org", "processingTime": "2–4 weeks", "keyRequirements": ["MA resident", "Age 19–64", "Income 138–300% FPL (~$35,632–$77,460/yr)"], "programShortName": "ConnectorCare", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return"], "applicationMethods": ["online"], "estimatedAnnualValue": 3000, "estimatedMonthlyValue": 250}], "fplPercent": 1214, "generatedAt": "2026-03-19T21:14:08.790Z", "householdSize": 3, "likelyPrograms": [{"score": 77, "category": "healthcare", "priority": 1, "nextSteps": ["Apply at mahealthconnector.org — comprehensive pediatric coverage", "Small monthly premiums based on income"], "programId": "masshealth_family_assistance", "valueNote": "Low-cost CHIP coverage for 1 child (small monthly premium)", "bundleNote": "MassHealth and Medicare Savings Program share one application.", "bundleWith": ["msp"], "confidence": 80, "programName": "MassHealth Family Assistance (CHIP)", "administeredBy": "MA MassHealth", "applicationUrl": "/application/new", "processingTime": "45 days (10 days if urgent)", "keyRequirements": ["MA resident", "Child under 19", "Income 150–300% FPL (~$38,730–$77,460/yr)"], "applicationPhone": "1-800-841-2900", "programShortName": "MH Family Asst.", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return", "Children's birth certificates"], "applicationMethods": ["online", "phone", "in_person", "mail"], "estimatedAnnualValue": 2400, "estimatedMonthlyValue": 200}, {"score": 74.8, "category": "healthcare", "priority": 2, "nextSteps": ["Shop plans at mahealthconnector.org during open enrollment", "Premiums capped as % of income; reduced copays"], "programId": "connector_care", "valueNote": "Subsidized plans with capped premiums at 265% FPL", "confidence": 82, "programName": "ConnectorCare", "administeredBy": "MA Health Connector", "applicationUrl": "https://www.mahealthconnector.org", "processingTime": "2–4 weeks", "keyRequirements": ["MA resident", "Age 19–64", "Income 138–300% FPL (~$35,632–$77,460/yr)"], "programShortName": "ConnectorCare", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return"], "applicationMethods": ["online"], "estimatedAnnualValue": 3000, "estimatedMonthlyValue": 250}], "possiblePrograms": [{"score": 36.239999999999995, "category": "tax_credit", "priority": 3, "nextSteps": ["File your federal and MA state tax returns — claim EITC on Form 1040", "Use IRS Free File (free if income <$79,000) at irs.gov/freefile", "Get free tax prep help at VITA sites (Volunteer Income Tax Assistance): call 1-800-906-9887", "MA EITC is 40% of your federal credit (~$31) — claim on MA Form 1"], "programId": "eitc_federal", "valueNote": "~$77 federal + $31 MA (40%) = $108 total tax credit", "confidence": 65, "programName": "Earned Income Tax Credit (EITC)", "administeredBy": "IRS + MA DOR", "applicationUrl": "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit", "processingTime": "3 weeks (e-file) or 6–8 weeks (mail)", "applicationNote": "Claim on your federal tax return (Form 1040) and MA state return", "keyRequirements": ["Must file a federal tax return", "Must have earned income (wages or self-employment)", "1 qualifying child claimed as dependents", "Annual earned income ≤ $49,084"], "programShortName": "EITC", "eligibilityStatus": "possibly", "requiredDocuments": ["W-2 forms or 1099s for all income", "Social Security numbers for all family members", "Children's birth certificates (if claiming children)", "Prior year tax return"], "applicationMethods": ["online", "in_person"], "estimatedAnnualValue": 108, "estimatedMonthlyValue": 9}, {"score": 36, "category": "food", "priority": 4, "nextSteps": ["Apply online at dta.mass.gov — fast, takes about 20 minutes", "Ask about Expedited SNAP if income is very low or you have no food", "Benefits are loaded onto an EBT card, accepted at most grocery stores"], "programId": "snap", "valueNote": "~$0/month (max $768 for household of 3)", "bundleNote": "One DTA application covers SNAP, TAFDC, and EAEDC — apply once at dta.mass.gov", "bundleWith": ["tafdc", "eaedc"], "confidence": 65, "programName": "SNAP (Food Stamps)", "administeredBy": "MA DTA", "applicationUrl": "https://www.dta.mass.gov", "processingTime": "30 days (7 days if expedited)", "keyRequirements": ["MA resident", "Gross income ≤130% FPL (~$2,797/month)", "US citizen or most qualified immigrants"], "applicationPhone": "1-877-382-2363", "programShortName": "SNAP", "eligibilityStatus": "possibly", "requiredDocuments": ["Photo ID", "Proof of MA residency (utility bill, lease)", "Social Security card or number", "Proof of income (pay stubs, benefit letters)", "Proof of expenses (rent receipt, utility bills)"], "applicationMethods": ["online", "phone", "in_person"], "estimatedAnnualValue": 0, "estimatedMonthlyValue": 0}], "totalMonthlyIncome": 26122, "totalEstimatedAnnualValue": 5400, "totalEstimatedMonthlyValue": 450}	2026-03-19 21:14:08.789397+00
5092360f-805d-4786-a6be-63d85bbfb627	1a8b3ef8-d5fb-4486-9d91-e46b0983ae7e	{"bundles": [], "results": [{"score": 74.8, "category": "healthcare", "priority": 1, "nextSteps": ["Shop plans at mahealthconnector.org during open enrollment", "Premiums capped as % of income; reduced copays"], "programId": "connector_care", "valueNote": "Subsidized plans with capped premiums at 235% FPL", "confidence": 82, "programName": "ConnectorCare", "administeredBy": "MA Health Connector", "applicationUrl": "https://www.mahealthconnector.org", "processingTime": "2–4 weeks", "keyRequirements": ["MA resident", "Age 19–64", "Income 138–300% FPL (~$28,207–$61,320/yr)"], "programShortName": "ConnectorCare", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return"], "applicationMethods": ["online"], "estimatedAnnualValue": 3000, "estimatedMonthlyValue": 250}, {"score": 65, "category": "housing", "priority": 2, "nextSteps": ["Visit mass.gov/hcd to find your regional housing authority", "Apply to ALL open housing authority waitlists in your area — they each have separate lists", "Check CommonwealthConnects and CHAMP (Common Housing Application for MA Programs)", "While waiting, explore other rental assistance programs like RAFT (Residential Assistance for Families in Transition)"], "programId": "section8_hcv", "valueNote": "~$1,090/month housing subsidy (Boston area FMR basis)", "confidence": 70, "programName": "Section 8 Housing Choice Voucher", "administeredBy": "Local MA Housing Authority / HUD", "applicationUrl": "https://www.mass.gov/how-to/apply-for-state-aided-public-housing", "processingTime": "Varies widely — typically 1–10+ years on waitlist", "applicationNote": "Apply through your local Regional Housing Authority at mass.gov. Each HA runs its own waitlist.", "keyRequirements": ["MA resident", "Annual income ≤50% Area Median Income ($80,800 for household of 2)", "US citizen or eligible immigrant status"], "waitlistWarning": "Most MA housing authority waitlists are currently closed or have 5–10 year wait times. Check your local Housing Authority for open waitlists and apply to multiple.", "programShortName": "Section 8", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID for all adult household members", "Birth certificates for children", "Social Security cards", "Proof of income (pay stubs, benefit award letters)", "Proof of citizenship or immigration status"], "applicationMethods": ["online", "in_person"], "estimatedAnnualValue": 13080, "estimatedMonthlyValue": 1090}, {"score": 52.2, "category": "utility", "priority": 3, "nextSteps": ["Find your local Community Action Agency (CAA) at mass.gov/fuel-assistance", "Apply early in the heating season (October–November)", "Benefit is paid directly to your fuel dealer or utility company — nothing comes out of pocket", "Also ask about the Arrearage Management Program (AMP) if you have past-due utility bills"], "programId": "liheap", "valueNote": "~$600/year energy assistance (paid directly to utility/fuel vendor)", "confidence": 68, "programName": "LIHEAP / Fuel Assistance", "administeredBy": "MA DHCD", "applicationUrl": "https://www.mass.gov/fuel-assistance", "processingTime": "30–60 days", "applicationNote": "Apply through your local Community Action Agency (CAA) — find yours at mass.gov/fuel-assistance. Open enrollment typically November–April.", "keyRequirements": ["MA resident", "Pay home heating or electricity costs", "Income ≤60% State Median Income ($55,109/yr for household of 2)"], "programShortName": "Fuel Assistance", "eligibilityStatus": "possibly", "requiredDocuments": ["Photo ID", "Proof of MA residency", "Proof of income for all household members", "Most recent heating/utility bill", "Social Security numbers for all household members"], "applicationMethods": ["online", "phone", "in_person"], "estimatedAnnualValue": 600, "estimatedMonthlyValue": 50}], "summary": "We found 2 programs you likely qualify for and 1 additional program to explore — potentially $1,340/month in benefits. These are estimates based on your answers; official eligibility is determined by each program at time of application.", "annualFPL": 20440, "profileId": "1a8b3ef8-d5fb-4486-9d91-e46b0983ae7e", "quickWins": [{"score": 74.8, "category": "healthcare", "priority": 1, "nextSteps": ["Shop plans at mahealthconnector.org during open enrollment", "Premiums capped as % of income; reduced copays"], "programId": "connector_care", "valueNote": "Subsidized plans with capped premiums at 235% FPL", "confidence": 82, "programName": "ConnectorCare", "administeredBy": "MA Health Connector", "applicationUrl": "https://www.mahealthconnector.org", "processingTime": "2–4 weeks", "keyRequirements": ["MA resident", "Age 19–64", "Income 138–300% FPL (~$28,207–$61,320/yr)"], "programShortName": "ConnectorCare", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return"], "applicationMethods": ["online"], "estimatedAnnualValue": 3000, "estimatedMonthlyValue": 250}, {"score": 65, "category": "housing", "priority": 2, "nextSteps": ["Visit mass.gov/hcd to find your regional housing authority", "Apply to ALL open housing authority waitlists in your area — they each have separate lists", "Check CommonwealthConnects and CHAMP (Common Housing Application for MA Programs)", "While waiting, explore other rental assistance programs like RAFT (Residential Assistance for Families in Transition)"], "programId": "section8_hcv", "valueNote": "~$1,090/month housing subsidy (Boston area FMR basis)", "confidence": 70, "programName": "Section 8 Housing Choice Voucher", "administeredBy": "Local MA Housing Authority / HUD", "applicationUrl": "https://www.mass.gov/how-to/apply-for-state-aided-public-housing", "processingTime": "Varies widely — typically 1–10+ years on waitlist", "applicationNote": "Apply through your local Regional Housing Authority at mass.gov. Each HA runs its own waitlist.", "keyRequirements": ["MA resident", "Annual income ≤50% Area Median Income ($80,800 for household of 2)", "US citizen or eligible immigrant status"], "waitlistWarning": "Most MA housing authority waitlists are currently closed or have 5–10 year wait times. Check your local Housing Authority for open waitlists and apply to multiple.", "programShortName": "Section 8", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID for all adult household members", "Birth certificates for children", "Social Security cards", "Proof of income (pay stubs, benefit award letters)", "Proof of citizenship or immigration status"], "applicationMethods": ["online", "in_person"], "estimatedAnnualValue": 13080, "estimatedMonthlyValue": 1090}], "fplPercent": 235, "generatedAt": "2026-03-20T01:37:04.646Z", "householdSize": 2, "likelyPrograms": [{"score": 74.8, "category": "healthcare", "priority": 1, "nextSteps": ["Shop plans at mahealthconnector.org during open enrollment", "Premiums capped as % of income; reduced copays"], "programId": "connector_care", "valueNote": "Subsidized plans with capped premiums at 235% FPL", "confidence": 82, "programName": "ConnectorCare", "administeredBy": "MA Health Connector", "applicationUrl": "https://www.mahealthconnector.org", "processingTime": "2–4 weeks", "keyRequirements": ["MA resident", "Age 19–64", "Income 138–300% FPL (~$28,207–$61,320/yr)"], "programShortName": "ConnectorCare", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID or birth certificate", "Proof of MA residency", "Social Security card or number", "Recent pay stubs (last 4 weeks)", "Most recent federal tax return"], "applicationMethods": ["online"], "estimatedAnnualValue": 3000, "estimatedMonthlyValue": 250}, {"score": 65, "category": "housing", "priority": 2, "nextSteps": ["Visit mass.gov/hcd to find your regional housing authority", "Apply to ALL open housing authority waitlists in your area — they each have separate lists", "Check CommonwealthConnects and CHAMP (Common Housing Application for MA Programs)", "While waiting, explore other rental assistance programs like RAFT (Residential Assistance for Families in Transition)"], "programId": "section8_hcv", "valueNote": "~$1,090/month housing subsidy (Boston area FMR basis)", "confidence": 70, "programName": "Section 8 Housing Choice Voucher", "administeredBy": "Local MA Housing Authority / HUD", "applicationUrl": "https://www.mass.gov/how-to/apply-for-state-aided-public-housing", "processingTime": "Varies widely — typically 1–10+ years on waitlist", "applicationNote": "Apply through your local Regional Housing Authority at mass.gov. Each HA runs its own waitlist.", "keyRequirements": ["MA resident", "Annual income ≤50% Area Median Income ($80,800 for household of 2)", "US citizen or eligible immigrant status"], "waitlistWarning": "Most MA housing authority waitlists are currently closed or have 5–10 year wait times. Check your local Housing Authority for open waitlists and apply to multiple.", "programShortName": "Section 8", "eligibilityStatus": "likely", "requiredDocuments": ["Photo ID for all adult household members", "Birth certificates for children", "Social Security cards", "Proof of income (pay stubs, benefit award letters)", "Proof of citizenship or immigration status"], "applicationMethods": ["online", "in_person"], "estimatedAnnualValue": 13080, "estimatedMonthlyValue": 1090}], "possiblePrograms": [{"score": 52.2, "category": "utility", "priority": 3, "nextSteps": ["Find your local Community Action Agency (CAA) at mass.gov/fuel-assistance", "Apply early in the heating season (October–November)", "Benefit is paid directly to your fuel dealer or utility company — nothing comes out of pocket", "Also ask about the Arrearage Management Program (AMP) if you have past-due utility bills"], "programId": "liheap", "valueNote": "~$600/year energy assistance (paid directly to utility/fuel vendor)", "confidence": 68, "programName": "LIHEAP / Fuel Assistance", "administeredBy": "MA DHCD", "applicationUrl": "https://www.mass.gov/fuel-assistance", "processingTime": "30–60 days", "applicationNote": "Apply through your local Community Action Agency (CAA) — find yours at mass.gov/fuel-assistance. Open enrollment typically November–April.", "keyRequirements": ["MA resident", "Pay home heating or electricity costs", "Income ≤60% State Median Income ($55,109/yr for household of 2)"], "programShortName": "Fuel Assistance", "eligibilityStatus": "possibly", "requiredDocuments": ["Photo ID", "Proof of MA residency", "Proof of income for all household members", "Most recent heating/utility bill", "Social Security numbers for all household members"], "applicationMethods": ["online", "phone", "in_person"], "estimatedAnnualValue": 600, "estimatedMonthlyValue": 50}], "totalMonthlyIncome": 4000, "totalEstimatedAnnualValue": 16080, "totalEstimatedMonthlyValue": 1340}	2026-03-20 01:37:04.64633+00
\.


--
-- Data for Name: collaborative_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.collaborative_sessions (id, sw_user_id, patient_user_id, status, scheduled_at, started_at, ended_at, ended_by, invite_message, created_at, updated_at) FROM stdin;
7dd049a4-5cbc-4d02-b700-ed8898599a82	df666116-f825-4305-a387-4a6c21c66cef	910421f3-2802-4b36-b77e-6737d38e86a2	active	2026-03-25 01:04:00+00	2026-03-24 01:07:48.466307+00	\N	\N	\N	2026-03-24 01:07:22.201379+00	2026-03-24 01:07:48.466307+00
4a019e02-9eca-49f3-9874-531efa1e30bb	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	active	2026-03-29 21:27:00+00	2026-03-28 21:28:49.02199+00	\N	\N	lete	2026-03-28 21:27:50.340431+00	2026-03-28 21:28:49.02199+00
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.companies (id, name, npi, address, city, state, zip, phone, email_domain, status, created_at, approved_at, approved_by) FROM stdin;
31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a	HOMESITE HOME HEALTH CARE LLC	1245442011	4800 URBANA RD STE 103	SPRINGFIELD	OH	455028323	937-717-0158	\N	approved	2026-03-22 02:41:23.966129+00	2026-03-22 02:41:31.894307+00	60a9e5da-b1b3-4e74-b270-f185258e56e0
286536f3-37dc-4c1e-92f8-f40c4e403d38	Boston Community Health	\N	100 Health St	Boston	MA	02101	\N	\N	pending	2026-03-25 02:10:47.327527+00	\N	\N
\.


--
-- Data for Name: document_extractions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_extractions (id, document_id, model_name, raw_output, structured_output, confidence_score, extracted_at) FROM stdin;
\.


--
-- Data for Name: document_pages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_pages (id, document_id, page_number, ocr_text) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, application_id, uploaded_by, document_type, file_url, mime_type, uploaded_at, file_name, file_path, file_size_bytes, document_status, required_document_label) FROM stdin;
\.


--
-- Data for Name: eligibility_screenings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eligibility_screenings (id, application_id, estimated_program, fpl_percentage, screening_result, created_at) FROM stdin;
\.


--
-- Data for Name: family_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.family_profiles (id, applicant_id, profile_data, created_at, updated_at) FROM stdin;
1a8b3ef8-d5fb-4486-9d91-e46b0983ae7e	5da79148-d75a-49bd-88ce-9b976d0724c0	{"age": 60, "blind": false, "assets": {"other": 0, "vehicles": 0, "realEstate": 0, "investments": 0, "bankAccounts": 10000}, "income": {"ssi": 0, "other": 0, "wages": 4000, "rental": 0, "alimony": 0, "pension": 0, "interest": 0, "veterans": 0, "childSupport": 0, "unemployment": 0, "selfEmployment": 0, "socialSecurity": 0}, "over65": false, "disabled": false, "pregnant": false, "taxFiler": true, "applicantId": "5da79148-d75a-49bd-88ce-9b976d0724c0", "hasMedicare": false, "monthlyRent": 1000, "filingStatus": "head_of_household", "utilityTypes": ["electricity", "other"], "housingStatus": "renter", "stateResident": true, "employmentStatus": "not_working", "householdMembers": [{"id": "bc28ac6a-3885-42d4-aa32-21892ca0b22c", "age": 60, "income": {"ssi": 0, "other": 0, "wages": 0, "rental": 0, "alimony": 0, "pension": 0, "interest": 0, "veterans": 0, "childSupport": 0, "unemployment": 0, "selfEmployment": 0, "socialSecurity": 0}, "over65": false, "disabled": false, "pregnant": false, "firstName": "susan", "isStudent": false, "hasMedicare": false, "relationship": "spouse", "isTaxDependent": true, "isCaringForChild": false, "citizenshipStatus": "citizen"}], "citizenshipStatus": "citizen", "hasPrivateInsurance": false, "hasEmployerInsurance": false}	2026-03-19 21:14:08.787048+00	2026-03-20 01:37:04.641396+00
\.


--
-- Data for Name: household_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.household_members (id, application_id, first_name, last_name, dob, relationship, pregnant, disabled, over_65) FROM stdin;
\.


--
-- Data for Name: incomes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incomes (id, application_id, member_id, income_type, employer_name, monthly_amount, verified) FROM stdin;
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invitations (id, email, company_id, role, token, invited_by, accepted_at, expires_at, created_at) FROM stdin;
3a9a172b-c5b3-4ee3-bb4a-8e78a26ed0b3	binli120@gmail.com	31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a	social_worker	23573f5b9face002eba8fc81c2bece95695526c4716633da82f3bcc98d879f86	60a9e5da-b1b3-4e74-b270-f185258e56e0	2026-03-22 03:15:58.672637+00	2026-03-29 03:15:16.254868+00	2026-03-22 03:15:16.254868+00
\.


--
-- Data for Name: mobile_verify_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mobile_verify_sessions (id, token, user_id, applicant_id, status, verify_status, verify_score, verify_breakdown, created_at, expires_at, completed_at, extracted_data) FROM stdin;
d6085d6a-4fd7-4b69-abe8-c6aa0f63e937	FeirZ2mLv6Tcr3AbcVkAeTUOWxO7kCTh	cdbb0168-004a-4b83-a1ff-0c8336ba52f5	ebc0dfe7-78b5-41ee-9b31-725c781ce8e9	expired	\N	\N	\N	2026-04-04 23:39:54.696892+00	2026-04-04 23:49:54.696892+00	\N	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, body, metadata, read_at, email_sent_at, created_at) FROM stdin;
3fc13c92-84cc-4b3e-b828-e07d7b89b777	910421f3-2802-4b36-b77e-6737d38e86a2	session_invite	Local User has invited you to a session	Your social worker scheduled a session for 2026-03-25T01:04. Accept to confirm.	{"swName": "Local User", "sessionId": "7dd049a4-5cbc-4d02-b700-ed8898599a82", "scheduledAt": "2026-03-25T01:04"}	\N	\N	2026-03-24 01:07:22.204539+00
b3659f67-3035-4c31-a9fc-add10b1bd7db	910421f3-2802-4b36-b77e-6737d38e86a2	session_starting	Session starting now — Local User is ready	Your social worker has started the session. Join now to connect.	{"swName": "Local User", "sessionId": "7dd049a4-5cbc-4d02-b700-ed8898599a82"}	\N	\N	2026-03-24 01:07:48.468406+00
26073985-ef66-4e22-9cce-cf28db491d8f	bc0f8bac-4de4-42ea-a6b9-5714fd328809	sw_engagement_request	Local User wants your help	A patient has requested you as their social worker. Review and respond from your dashboard.	{"requestId": "8a3d74d5-91f3-4e6a-8642-049a563a5789", "patientName": "Local User"}	\N	\N	2026-03-25 02:52:49.129356+00
42acef4c-e5e0-4648-981a-9e38a1700596	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Local User	You have a new message. Click to view and reply.	{"messageId": "1c31c248-34dd-4cbd-94e9-4d980994ea7a", "senderName": "Local User"}	\N	\N	2026-03-25 14:36:57.336+00
b9fcbeea-b62f-4a85-992c-dacaa93b733e	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Local User	You have a new message. Click to view and reply.	{"messageId": "8f6d6827-743a-4e67-88e2-cc003cca4a08", "senderName": "Local User"}	\N	\N	2026-03-25 14:38:49.498379+00
a2b2bc64-9d2b-46f7-8212-f77f1d817433	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Local User	You have a new message. Click to view and reply.	{"messageId": "6b3162eb-e4cc-408f-86df-a64e9da6b185", "senderName": "Local User"}	\N	\N	2026-03-25 14:39:01.277653+00
c444f82f-470a-4e1f-85f3-b51a1ba83723	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Local User	You have a new message. Click to view and reply.	{"messageId": "8f5e6067-ca15-47c0-b024-5d73823667b3", "senderName": "Local User"}	\N	\N	2026-03-25 15:05:03.637509+00
7e210cf3-b1d8-4565-9002-46c388838651	bb728af4-11ae-4df0-8317-0e163c1f4526	new_direct_message	New message from Marcus Rivera	You have a new message. Click to view and reply.	{"messageId": "d90b7c98-1f5f-4425-844f-c4250034c53e", "senderName": "Marcus Rivera"}	2026-03-26 02:07:17.54688+00	\N	2026-03-26 01:57:01.203698+00
d82e4e5c-abe7-4100-bff6-427ef1364eed	bb728af4-11ae-4df0-8317-0e163c1f4526	sw_engagement_accepted	Local User accepted your request	Your social worker is now connected with you. You can send them messages any time from the chat window.	{"swName": "Local User", "requestId": "8a3d74d5-91f3-4e6a-8642-049a563a5789"}	2026-03-26 02:07:26.545913+00	\N	2026-03-25 03:11:36.288814+00
3149447b-1e59-4ab4-931e-e5bb45ef854b	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Local User	You have a new message. Click to view and reply.	{"messageId": "8a824564-b814-4df2-9f9d-ba746bd44fb1", "senderName": "Local User"}	\N	\N	2026-03-26 02:08:06.219202+00
74cdae75-5ed0-4a6a-9f1c-82e9fa5e9a20	bb728af4-11ae-4df0-8317-0e163c1f4526	new_direct_message	New message from Marcus Rivera	You have a new message. Click to view and reply.	{"messageId": "49342170-a4a4-44e4-a2e1-9c189df3c64f", "senderName": "Marcus Rivera"}	\N	\N	2026-03-26 02:10:27.726653+00
798e4977-5dcb-43d8-901b-ecb9165ea9f7	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Local User	You have a new message. Click to view and reply.	{"messageId": "fe991120-3f25-44ad-80dd-56acf94bd02f", "senderName": "Local User"}	\N	\N	2026-03-26 11:44:56.052089+00
d9d6dcdd-ac69-4289-a08c-78448351f4ee	bb728af4-11ae-4df0-8317-0e163c1f4526	new_direct_message	New message from Marcus Rivera	You have a new message. Click to view and reply.	{"messageId": "835b3323-b334-466b-9c49-88c0f193a0d7", "senderName": "Marcus Rivera"}	2026-03-26 12:47:22.737348+00	\N	2026-03-26 12:00:18.274247+00
da46adba-6dcc-4625-b08e-903e11ee6e08	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Bin  Lee	You have a new message. Click to view and reply.	{"messageId": "c35d8b5c-aa84-4e61-986e-461d74f571ad", "senderName": "Bin  Lee"}	\N	\N	2026-03-27 02:33:49.020156+00
288e8d28-7869-4bc4-851e-bfe85e03e955	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Bin  Lee	You have a new message. Click to view and reply.	{"messageId": "2a641403-cac2-4eb2-a10d-9422e897d79c", "senderName": "Bin  Lee"}	\N	\N	2026-03-27 03:23:45.054937+00
543e3d55-8f00-40a8-ae16-55bcdd22152f	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Bin  Lee	You have a new message. Click to view and reply.	{"messageId": "e54dbeea-a1a8-400d-9179-bee0dc246687", "senderName": "Bin  Lee"}	\N	\N	2026-03-27 17:48:57.839031+00
84a7b298-64a9-4430-9355-79aac3e96066	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Bin  Lee	You have a new message. Click to view and reply.	{"messageId": "e2e2077e-5508-4dfa-b359-7f5f9ebb5e4d", "senderName": "Bin  Lee"}	\N	\N	2026-03-27 17:54:24.60195+00
195ba6fa-d83f-47bd-b0ad-3fd0c09477d0	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Bin  Lee	You have a new message. Click to view and reply.	{"messageId": "c9c3414f-0f51-4b06-9650-bbc769d5d355", "senderName": "Bin  Lee"}	\N	\N	2026-03-27 17:57:34.936224+00
e05aebab-b1a6-484c-9b5c-806e66dd319f	bc0f8bac-4de4-42ea-a6b9-5714fd328809	new_direct_message	New message from Bin  Lee	You have a new message. Click to view and reply.	{"messageId": "d4eda787-5b83-4629-87fb-7402c795b370", "senderName": "Bin  Lee"}	\N	\N	2026-03-27 18:39:00.762841+00
557c4e85-e8c7-4871-b26a-b345537093ca	bb728af4-11ae-4df0-8317-0e163c1f4526	session_invite	Social Worker has invited you to a session	Your social worker scheduled a session for 2026-03-29T21:27. Accept to confirm.	{"swName": "Social Worker", "sessionId": "4a019e02-9eca-49f3-9874-531efa1e30bb", "scheduledAt": "2026-03-29T21:27"}	2026-03-28 21:28:01.974162+00	\N	2026-03-28 21:27:50.343858+00
5985e0a8-48bc-4032-956f-2c784e6fc8a1	bb728af4-11ae-4df0-8317-0e163c1f4526	session_starting	Session starting now — Social Worker is ready	Your social worker has started the session. Join now to connect.	{"swName": "Social Worker", "sessionId": "4a019e02-9eca-49f3-9874-531efa1e30bb"}	\N	\N	2026-03-28 21:28:49.024149+00
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, created_at) FROM stdin;
\.


--
-- Data for Name: patient_social_worker_access; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patient_social_worker_access (id, patient_user_id, social_worker_user_id, granted_at, revoked_at, is_active) FROM stdin;
81d4ae7c-a7ea-401d-85f2-083112899f6a	07d7e11d-6a3d-41a8-826d-66e38470c830	df666116-f825-4305-a387-4a6c21c66cef	2026-02-10 03:39:29.726679+00	\N	t
caa514da-809d-47e0-a06d-3a877ae91aa9	baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	df666116-f825-4305-a387-4a6c21c66cef	2026-01-26 03:39:29.726679+00	\N	t
48a5ec8a-451a-42b9-9ada-2581e0213cac	baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	6bc464e1-209a-48ac-820d-fde4ca3500e6	2026-01-31 03:39:29.726679+00	\N	t
7930582a-1959-469c-985c-7879f587c343	910421f3-2802-4b36-b77e-6737d38e86a2	df666116-f825-4305-a387-4a6c21c66cef	2026-03-04 03:39:29.726679+00	\N	t
4b01fa18-3eb1-4acd-940e-3adb8540f199	fa7a619b-dc98-4d47-bc87-61a0e0dad2be	6bc464e1-209a-48ac-820d-fde4ca3500e6	2026-03-13 03:39:29.726679+00	\N	t
8c59c505-ebb6-4767-b309-a898161b3c3f	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	2026-03-25 03:11:36.283293+00	\N	t
\.


--
-- Data for Name: policy_chunks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.policy_chunks (id, document_id, chunk_index, content, embedding, created_at) FROM stdin;
\.


--
-- Data for Name: policy_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.policy_documents (id, title, source_url, doc_type, language, ingested_at, chunk_count) FROM stdin;
\.


--
-- Data for Name: review_actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.review_actions (id, application_id, reviewer_id, action_type, notes, created_at) FROM stdin;
\.


--
-- Data for Name: rfis; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rfis (id, application_id, requested_by, message, due_date, resolved, created_at) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name) FROM stdin;
1	social_worker
2	admin
\.


--
-- Data for Name: session_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session_messages (id, session_id, sender_id, type, content, storage_path, duration_sec, created_at) FROM stdin;
6c3e44d1-a448-4910-8544-3bcdee5ba0a4	7dd049a4-5cbc-4d02-b700-ed8898599a82	910421f3-2802-4b36-b77e-6737d38e86a2	text	hello	\N	\N	2026-03-24 01:20:25.109763+00
3d447bf4-3b32-4a8c-80b2-56efe2d4a659	4a019e02-9eca-49f3-9874-531efa1e30bb	bb728af4-11ae-4df0-8317-0e163c1f4526	text	hello	\N	\N	2026-03-28 21:29:32.643587+00
\.


--
-- Data for Name: social_worker_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.social_worker_profiles (id, user_id, company_id, license_number, job_title, status, rejection_note, created_at, approved_at, approved_by, first_name, last_name, phone, bio, avatar_url) FROM stdin;
dac3956e-58c6-41e3-b8d2-92bc0071d129	bc0f8bac-4de4-42ea-a6b9-5714fd328809	286536f3-37dc-4c1e-92f8-f40c4e403d38	SW-98765	Licensed Clinical Social Worker	approved	\N	2026-03-25 02:10:47.327527+00	2026-03-25 02:11:48.213086+00	\N	Marcus	Rivera	\N	\N	\N
c6bd0354-aa67-46a3-8d08-9975cf3c895d	6bc464e1-209a-48ac-820d-fde4ca3500e6	31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a	SW-MA-20887	Home Health Social Worker	approved	\N	2026-03-22 03:20:59.421192+00	\N	\N	James	Rivera	\N	\N	\N
8ac2b4cc-0917-475a-b51d-f06e2c4ce3bb	df666116-f825-4305-a387-4a6c21c66cef	31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a	SW-MA-10421	Care Coordinator	approved	\N	2026-03-22 03:20:59.421192+00	\N	\N	sarah	Chen	\N	\N	\N
\.


--
-- Data for Name: sw_direct_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sw_direct_messages (id, sw_user_id, patient_user_id, sender_id, message_type, content, storage_path, duration_sec, read_at, created_at, transcription, transcription_lang) FROM stdin;
1c31c248-34dd-4cbd-94e9-4d980994ea7a	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	text	Hello	\N	\N	2026-03-26 01:56:47.433857+00	2026-03-25 14:36:57.332101+00	\N	\N
8f6d6827-743a-4e67-88e2-cc003cca4a08	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	text	you are ok?	\N	\N	2026-03-26 01:56:47.433857+00	2026-03-25 14:38:49.495939+00	\N	\N
6b3162eb-e4cc-408f-86df-a64e9da6b185	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	text	tell	\N	\N	2026-03-26 01:56:47.433857+00	2026-03-25 14:39:01.274802+00	\N	\N
8f5e6067-ca15-47c0-b024-5d73823667b3	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	text	hello	\N	\N	2026-03-26 01:56:47.433857+00	2026-03-25 15:05:03.632258+00	\N	\N
d90b7c98-1f5f-4425-844f-c4250034c53e	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	text	Thanks calling	\N	\N	2026-03-26 01:57:09.562691+00	2026-03-26 01:57:01.199598+00	\N	\N
8a824564-b814-4df2-9f9d-ba746bd44fb1	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	text	hello	\N	\N	2026-03-26 02:08:17.602549+00	2026-03-26 02:08:06.216468+00	\N	\N
49342170-a4a4-44e4-a2e1-9c189df3c64f	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	text	message 1	\N	\N	2026-03-26 02:10:35.110611+00	2026-03-26 02:10:27.723515+00	\N	\N
fe991120-3f25-44ad-80dd-56acf94bd02f	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	text	hello again	\N	\N	2026-03-26 11:45:04.91466+00	2026-03-26 11:44:56.049384+00	\N	\N
835b3323-b334-466b-9c49-88c0f193a0d7	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	text	hello from marcus	\N	\N	2026-03-26 12:00:53.854631+00	2026-03-26 12:00:18.27158+00	\N	\N
c998310c-75f0-4c0c-a2ef-fc4c5b283140	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	image	\N	\N	\N	2026-03-26 12:47:31.283239+00	2026-03-26 12:36:14.050988+00	\N	\N
1514c292-b5ba-4a95-bf74-3c55a030d581	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	image	\N	\N	\N	2026-03-26 12:47:31.283239+00	2026-03-26 12:45:26.049464+00	\N	\N
ca1a2d4f-ff0c-448a-a62f-4f1d39addf10	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-26 12:52:32.009877+00	2026-03-26 12:52:07.003334+00	\N	\N
c0fd1cfb-901c-4113-91d6-f14151907a47	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-26 13:13:04.363445+00	2026-03-26 12:59:20.897273+00	\N	\N
8c7ada00-1088-4b5b-ab28-a373aff807a1	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	image	\N	\N	\N	2026-03-26 13:13:21.072534+00	2026-03-26 13:13:17.694516+00	\N	\N
98d0d684-f48d-4211-ba58-58e12ecd7463	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	image	\N	\N	\N	2026-03-26 13:17:35.067979+00	2026-03-26 13:17:20.270446+00	\N	\N
68dddb9a-f6b3-483e-a0ce-3003c07094cf	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 01:17:13.189366+00	2026-03-27 00:44:00.422745+00	\N	\N
7f1f9e14-fddc-454e-a58d-4f2511730b7b	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 01:27:42.096255+00	2026-03-27 01:21:37.148564+00	\N	\N
5c9e3169-e347-4a72-83cd-52ef0aae609b	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 01:27:42.096255+00	2026-03-27 01:22:57.866878+00	\N	\N
358cde79-e8e2-4dbd-9572-87af4147009e	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 01:51:36.860478+00	\N	\N
ff4aff56-389a-4d15-9ca2-347862ac7840	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:09:07.391812+00	\N	\N
5c64021b-91b2-4870-90b2-a5dcd06ec832	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:19:36.193884+00	\N	\N
17244fc5-1d76-4aeb-a5e6-9e79eacb7834	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:21:02.737958+00	\N	\N
56047c91-78b6-43de-ae50-9521ec50c8d2	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:25:38.647178+00	\N	\N
6f2b9814-dc8f-40db-bfb5-451e895969d4	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:29:41.283108+00	\N	\N
f5df8eb2-dc19-47d4-972f-43f3cd81a19c	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:30:51.198627+00	\N	\N
cae194c7-ace9-4a03-9071-e121761d31f5	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:31:16.973445+00	\N	\N
90b45606-4b3e-4898-a1a3-f6857d02ebc1	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:31:56.266936+00	\N	\N
c35d8b5c-aa84-4e61-986e-461d74f571ad	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	dm/images/bb728af4-11ae-4df0-8317-0e163c1f4526/c35d8b5c-aa84-4e61-986e-461d74f571ad.jpg	\N	2026-03-27 02:41:02.654029+00	2026-03-27 02:33:48.997919+00	\N	\N
fb2c6bed-2745-4427-b076-372383c41a4c	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	image	\N	\N	\N	2026-03-27 02:47:48.478554+00	2026-03-27 02:47:36.901822+00	\N	\N
2a641403-cac2-4eb2-a10d-9422e897d79c	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	voice	\N	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/2a641403-cac2-4eb2-a10d-9422e897d79c.webm	21	2026-03-27 17:49:35.546063+00	2026-03-27 03:23:45.031993+00	hello	en-US
e54dbeea-a1a8-400d-9179-bee0dc246687	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	voice	\N	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/e54dbeea-a1a8-400d-9179-bee0dc246687.wav	\N	2026-03-27 17:49:35.546063+00	2026-03-27 17:48:57.806411+00	\N	\N
e2e2077e-5508-4dfa-b359-7f5f9ebb5e4d	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	voice	\N	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/e2e2077e-5508-4dfa-b359-7f5f9ebb5e4d.wav	\N	2026-03-27 17:54:27.054555+00	2026-03-27 17:54:24.574795+00	\N	\N
c9c3414f-0f51-4b06-9650-bbc769d5d355	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	voice	\N	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/c9c3414f-0f51-4b06-9650-bbc769d5d355.wav	\N	2026-03-27 17:57:47.030745+00	2026-03-27 17:57:34.911214+00	\N	\N
d4eda787-5b83-4629-87fb-7402c795b370	bc0f8bac-4de4-42ea-a6b9-5714fd328809	bb728af4-11ae-4df0-8317-0e163c1f4526	bb728af4-11ae-4df0-8317-0e163c1f4526	voice	\N	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/d4eda787-5b83-4629-87fb-7402c795b370.wav	\N	2026-03-27 18:38:56.384825+00	2026-03-27 18:38:56.04062+00	你好,我想詢問一下我的醫療保險申請情況,我最近提交了所有文件,想瞭解一下聖和進度,我每年的收入大約是三萬美元,我有兩個孩子,如果您需要更多信息,請告訴我,謝謝。	zh-CN
\.


--
-- Data for Name: sw_engagement_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sw_engagement_requests (id, patient_user_id, sw_user_id, status, patient_message, rejection_note, created_at, updated_at) FROM stdin;
8a3d74d5-91f3-4e6a-8642-049a563a5789	bb728af4-11ae-4df0-8317-0e163c1f4526	bc0f8bac-4de4-42ea-a6b9-5714fd328809	accepted	\N	\N	2026-03-25 02:52:49.123748+00	2026-03-25 03:11:36.283293+00
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_profiles (id, applicant_id, profile_data, bank_data, created_at, updated_at, avatar_url) FROM stdin;
7a7ac8f1-8fed-400c-a428-569ef2718519	5da79148-d75a-49bd-88ce-9b976d0724c0	{"gender": "male", "education": {"level": "high_school_or_ged", "currentlyEnrolled": false}, "accessibility": {"needsTranslation": false, "needsVoiceAssistant": false, "needsReadingAssistance": false}, "notifications": {"channel": "email", "reminderLeadDays": 14, "deadlineReminders": true, "regulationUpdates": false, "qualificationAlerts": true}, "preferredLanguage": "en"}	{}	2026-03-17 19:54:00.246675+00	2026-03-19 21:11:29.19872+00	bb728af4-11ae-4df0-8317-0e163c1f4526/avatar/avatar.jpg
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (user_id, role_id) FROM stdin;
60a9e5da-b1b3-4e74-b270-f185258e56e0	2
60a9e5da-b1b3-4e74-b270-f185258e56e0	1
df666116-f825-4305-a387-4a6c21c66cef	1
6bc464e1-209a-48ac-820d-fde4ca3500e6	1
df666116-f825-4305-a387-4a6c21c66cef	2
bc0f8bac-4de4-42ea-a6b9-5714fd328809	1
bb728af4-11ae-4df0-8317-0e163c1f4526	2
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, organization_id, email, password_hash, is_active, created_at, company_id) FROM stdin;
60a9e5da-b1b3-4e74-b270-f185258e56e0	\N	binli120@gmail.com	supabase_auth_managed	t	2026-03-21 02:19:59.313313+00	31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a
07d7e11d-6a3d-41a8-826d-66e38470c830	\N	maria.santos@gmail.com	supabase_auth_managed	t	2026-02-05 03:39:29.726679+00	\N
baa1f7ef-8c92-4111-b63a-58f87cbdc8d8	\N	james.kim@yahoo.com	supabase_auth_managed	t	2026-01-21 03:39:29.726679+00	\N
fa7a619b-dc98-4d47-bc87-61a0e0dad2be	\N	robert.garcia@gmail.com	supabase_auth_managed	t	2026-03-12 03:39:29.726679+00	\N
6bc464e1-209a-48ac-820d-fde4ca3500e6	\N	marcus.rivera@homesite.com	supabase_auth_managed	t	2026-03-22 03:20:59.421192+00	31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a
df666116-f825-4305-a387-4a6c21c66cef	\N	sarah.chen@homesite.com	supabase_auth_managed	t	2026-03-22 03:20:59.421192+00	31e8a8ff-3a6d-4c12-bfb7-21ba91e3cc6a
910421f3-2802-4b36-b77e-6737d38e86a2	\N	linda.williams@hotmail.com	supabase_auth_managed	t	2026-03-02 03:39:29.726679+00	\N
6292e07c-4b97-41db-9aaa-2e2b8b7db500	\N	patient_test@healthcompassma.com	supabase_auth_managed	t	2026-03-25 02:10:36.186324+00	\N
bc0f8bac-4de4-42ea-a6b9-5714fd328809	\N	sw_test@healthcompassma.com	supabase_auth_managed	t	2026-03-25 02:10:47.327527+00	\N
bb728af4-11ae-4df0-8317-0e163c1f4526	\N	d@example.com	supabase_auth_managed	t	2026-03-17 14:40:15.976097+00	\N
cdbb0168-004a-4b83-a1ff-0c8336ba52f5	\N	patient@healthcompass.dev	supabase_auth_managed	t	2026-04-04 23:32:11.065543+00	\N
\.


--
-- Data for Name: validation_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.validation_results (id, application_id, rule_name, severity, message, resolved, created_at) FROM stdin;
\.


--
-- Data for Name: messages_2026_04_01; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2026_04_01 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2026_04_03; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2026_04_03 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2026_04_04; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2026_04_04 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2026_04_05; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2026_04_05 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2026_04_06; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2026_04_06 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: messages_2026_04_07; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.messages_2026_04_07 (topic, extension, payload, event, private, updated_at, inserted_at, id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-03-17 13:57:21
20211116045059	2026-03-17 13:57:21
20211116050929	2026-03-17 13:57:21
20211116051442	2026-03-17 13:57:21
20211116212300	2026-03-17 13:57:21
20211116213355	2026-03-17 13:57:21
20211116213934	2026-03-17 13:57:21
20211116214523	2026-03-17 13:57:21
20211122062447	2026-03-17 13:57:21
20211124070109	2026-03-17 13:57:21
20211202204204	2026-03-17 13:57:21
20211202204605	2026-03-17 13:57:21
20211210212804	2026-03-17 13:57:21
20211228014915	2026-03-17 13:57:21
20220107221237	2026-03-17 13:57:21
20220228202821	2026-03-17 13:57:21
20220312004840	2026-03-17 13:57:21
20220603231003	2026-03-17 13:57:21
20220603232444	2026-03-17 13:57:21
20220615214548	2026-03-17 13:57:21
20220712093339	2026-03-17 13:57:21
20220908172859	2026-03-17 13:57:21
20220916233421	2026-03-17 13:57:21
20230119133233	2026-03-17 13:57:21
20230128025114	2026-03-17 13:57:21
20230128025212	2026-03-17 13:57:21
20230227211149	2026-03-17 13:57:21
20230228184745	2026-03-17 13:57:21
20230308225145	2026-03-17 13:57:21
20230328144023	2026-03-17 13:57:21
20231018144023	2026-03-17 13:57:21
20231204144023	2026-03-17 13:57:21
20231204144024	2026-03-17 13:57:21
20231204144025	2026-03-17 13:57:21
20240108234812	2026-03-17 13:57:21
20240109165339	2026-03-17 13:57:21
20240227174441	2026-03-17 13:57:21
20240311171622	2026-03-17 13:57:21
20240321100241	2026-03-17 13:57:21
20240401105812	2026-03-17 13:57:21
20240418121054	2026-03-17 13:57:21
20240523004032	2026-03-17 13:57:21
20240618124746	2026-03-17 13:57:21
20240801235015	2026-03-17 13:57:21
20240805133720	2026-03-17 13:57:21
20240827160934	2026-03-17 13:57:21
20240919163303	2026-03-17 13:57:21
20240919163305	2026-03-17 13:57:21
20241019105805	2026-03-17 13:57:21
20241030150047	2026-03-17 13:57:21
20241108114728	2026-03-17 13:57:21
20241121104152	2026-03-17 13:57:21
20241130184212	2026-03-17 13:57:21
20241220035512	2026-03-17 13:57:21
20241220123912	2026-03-17 13:57:21
20241224161212	2026-03-17 13:57:21
20250107150512	2026-03-17 13:57:21
20250110162412	2026-03-17 13:57:21
20250123174212	2026-03-17 13:57:21
20250128220012	2026-03-17 13:57:21
20250506224012	2026-03-17 13:57:21
20250523164012	2026-03-17 13:57:21
20250714121412	2026-03-17 13:57:21
20250905041441	2026-03-17 13:57:21
20251103001201	2026-03-17 13:57:21
20251120212548	2026-04-04 23:06:13
20251120215549	2026-04-04 23:06:13
20260218120000	2026-04-04 23:06:13
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at, action_filter) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
masshealth-dev	masshealth-dev	\N	2026-03-17 18:43:04.248245+00	2026-03-17 18:43:04.248245+00	f	f	\N	\N	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.iceberg_namespaces (id, bucket_name, name, created_at, updated_at, metadata, catalog_id) FROM stdin;
\.


--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.iceberg_tables (id, namespace_id, bucket_name, name, location, created_at, updated_at, remote_table_id, shard_key, shard_id, catalog_id) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-03-17 13:57:22.776175
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-03-17 13:57:22.778247
2	storage-schema	f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd	2026-03-17 13:57:22.778883
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-03-17 13:57:22.781995
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-03-17 13:57:22.78347
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-03-17 13:57:22.783908
6	change-column-name-in-get-size	ded78e2f1b5d7e616117897e6443a925965b30d2	2026-03-17 13:57:22.784524
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-03-17 13:57:22.785086
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-03-17 13:57:22.78544
9	fix-search-function	af597a1b590c70519b464a4ab3be54490712796b	2026-03-17 13:57:22.785799
10	search-files-search-function	b595f05e92f7e91211af1bbfe9c6a13bb3391e16	2026-03-17 13:57:22.786301
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-03-17 13:57:22.786955
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-03-17 13:57:22.787606
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-03-17 13:57:22.78795
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-03-17 13:57:22.788347
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-03-17 13:57:22.79199
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-03-17 13:57:22.792527
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-03-17 13:57:22.792843
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-03-17 13:57:22.793157
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-03-17 13:57:22.793644
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-03-17 13:57:22.793999
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-03-17 13:57:22.794613
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-03-17 13:57:22.79642
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-03-17 13:57:22.797916
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-03-17 13:57:22.798543
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-03-17 13:57:22.799005
26	objects-prefixes	215cabcb7f78121892a5a2037a09fedf9a1ae322	2026-03-17 13:57:22.799393
27	search-v2	859ba38092ac96eb3964d83bf53ccc0b141663a6	2026-03-17 13:57:22.799708
28	object-bucket-name-sorting	c73a2b5b5d4041e39705814fd3a1b95502d38ce4	2026-03-17 13:57:22.799998
29	create-prefixes	ad2c1207f76703d11a9f9007f821620017a66c21	2026-03-17 13:57:22.800346
30	update-object-levels	2be814ff05c8252fdfdc7cfb4b7f5c7e17f0bed6	2026-03-17 13:57:22.800646
31	objects-level-index	b40367c14c3440ec75f19bbce2d71e914ddd3da0	2026-03-17 13:57:22.800924
32	backward-compatible-index-on-objects	e0c37182b0f7aee3efd823298fb3c76f1042c0f7	2026-03-17 13:57:22.801195
33	backward-compatible-index-on-prefixes	b480e99ed951e0900f033ec4eb34b5bdcb4e3d49	2026-03-17 13:57:22.801489
34	optimize-search-function-v1	ca80a3dc7bfef894df17108785ce29a7fc8ee456	2026-03-17 13:57:22.801765
35	add-insert-trigger-prefixes	458fe0ffd07ec53f5e3ce9df51bfdf4861929ccc	2026-03-17 13:57:22.802038
36	optimise-existing-functions	6ae5fca6af5c55abe95369cd4f93985d1814ca8f	2026-03-17 13:57:22.802304
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-03-17 13:57:22.8026
38	iceberg-catalog-flag-on-buckets	02716b81ceec9705aed84aa1501657095b32e5c5	2026-03-17 13:57:22.803128
39	add-search-v2-sort-support	6706c5f2928846abee18461279799ad12b279b78	2026-03-17 13:57:22.806196
40	fix-prefix-race-conditions-optimized	7ad69982ae2d372b21f48fc4829ae9752c518f6b	2026-03-17 13:57:22.806704
41	add-object-level-update-trigger	07fcf1a22165849b7a029deed059ffcde08d1ae0	2026-03-17 13:57:22.806988
42	rollback-prefix-triggers	771479077764adc09e2ea2043eb627503c034cd4	2026-03-17 13:57:22.807273
43	fix-object-level	84b35d6caca9d937478ad8a797491f38b8c2979f	2026-03-17 13:57:22.807549
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-03-17 13:57:22.807837
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-03-17 13:57:22.808238
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-03-17 13:57:22.809529
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-03-17 13:57:22.809964
48	iceberg-catalog-ids	e0e8b460c609b9999ccd0df9ad14294613eed939	2026-03-17 13:57:22.810458
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-03-17 13:57:22.815991
50	search-v2-optimised	6323ac4f850aa14e7387eb32102869578b5bd478	2026-03-17 13:57:22.81644
51	index-backward-compatible-search	2ee395d433f76e38bcd3856debaf6e0e5b674011	2026-03-17 13:57:22.819133
53	drop-index-lower-name	d0cb18777d9e2a98ebe0bc5cc7a42e57ebe41854	2026-03-17 13:57:22.820393
54	drop-index-object-level	6289e048b1472da17c31a7eba1ded625a6457e67	2026-03-17 13:57:22.820588
55	prevent-direct-deletes	262a4798d5e0f2e7c8970232e03ce8be695d5819	2026-03-17 13:57:22.820713
52	drop-not-used-indexes-and-functions	5cc44c8696749ac11dd0dc37f2a3802075f3a171	2026-03-17 13:57:22.819264
56	fix-optimized-search-function	cb58526ebc23048049fd5bf2fd148d18b04a2073	2026-04-04 23:06:12.929345
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata) FROM stdin;
2c29d3a9-38ee-44d4-92e8-bc62c8f99166	masshealth-dev	MA-APCD-CY2021-Documentation-Guide.pdf	\N	2026-03-17 18:47:25.789485+00	2026-03-17 18:47:25.789485+00	2026-03-17 18:47:25.789485+00	{"eTag": "\\"50b8c24a3a324c61fe7709d9a29a5928\\"", "size": 859313, "mimetype": "application/pdf", "cacheControl": "max-age=3600", "lastModified": "2026-03-17T18:47:25.778Z", "contentLength": 859313, "httpStatusCode": 200}	a6eb8ce2-e512-4e07-be66-c77226d34aa9	\N	\N
55eccd26-dca1-4f89-b47e-1e4818924708	masshealth-dev	ACA-3-0325-template.attached-check-v26.pdf	\N	2026-03-17 18:47:51.960602+00	2026-03-17 18:47:51.960602+00	2026-03-17 18:47:51.960602+00	{"eTag": "\\"83680efbb97a0d85e0fafa14a4d8cb76\\"", "size": 3053346, "mimetype": "application/pdf", "cacheControl": "max-age=3600", "lastModified": "2026-03-17T18:47:51.946Z", "contentLength": 3053346, "httpStatusCode": 200}	3c0524f8-5596-474c-b18b-5ce31ecb0a04	\N	\N
f9af1a47-2c47-404b-af27-e5034081e256	masshealth-dev	bb728af4-11ae-4df0-8317-0e163c1f4526/avatar/avatar.jpg	bb728af4-11ae-4df0-8317-0e163c1f4526	2026-03-17 19:54:00.238479+00	2026-03-17 19:54:00.238479+00	2026-03-17 19:54:00.238479+00	{"eTag": "\\"b1497dcb83d9c6ac71762997a6bd975b\\"", "size": 22321, "mimetype": "image/jpeg", "cacheControl": "no-cache", "lastModified": "2026-03-17T19:54:00.235Z", "contentLength": 22321, "httpStatusCode": 200}	523c513d-a5e3-4db7-94b6-045ce4e905db	bb728af4-11ae-4df0-8317-0e163c1f4526	{}
11a8f9fe-3011-4498-82e6-7773c5691b57	masshealth-dev	dm/images/test/test.jpg	\N	2026-03-26 12:56:51.822885+00	2026-03-26 12:56:51.822885+00	2026-03-26 12:56:51.822885+00	{"eTag": "\\"6859ef039d79656393d2b951d561d6b8\\"", "size": 8, "mimetype": "image/jpeg", "cacheControl": "no-cache", "lastModified": "2026-03-26T12:56:51.819Z", "contentLength": 8, "httpStatusCode": 200}	6b634f55-2ddf-4863-9d0f-cfacb4fc8b1a	\N	{}
374b6c52-1427-4ad3-b777-8bf4a12dfab6	masshealth-dev	test/test.txt	\N	2026-03-17 18:51:16.412364+00	2026-03-27 01:56:11.9191+00	2026-03-17 18:51:16.412364+00	{"eTag": "\\"9473fdd0d880a43c21b7778d34872157\\"", "size": 12, "mimetype": "text/plain", "cacheControl": "no-cache", "lastModified": "2026-03-27T01:56:11.916Z", "contentLength": 12, "httpStatusCode": 200}	72393171-b9c4-4edd-82fc-dcd958618738	\N	{}
2d348b15-d882-470f-aa6a-5a74cc587e11	masshealth-dev	dm/images/bb728af4-11ae-4df0-8317-0e163c1f4526/c35d8b5c-aa84-4e61-986e-461d74f571ad.jpg	\N	2026-03-27 02:33:49.009936+00	2026-03-27 02:33:49.009936+00	2026-03-27 02:33:49.009936+00	{"eTag": "\\"4f3d723fcc9e83f919f07732e561cc52\\"", "size": 211596, "mimetype": "image/jpeg", "cacheControl": "no-cache", "lastModified": "2026-03-27T02:33:49.006Z", "contentLength": 211596, "httpStatusCode": 200}	c108baa0-270e-47cb-b148-d840a16eb393	\N	{}
128f2aa3-42bf-428a-854a-831ed6c1f6e5	masshealth-dev	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/2a641403-cac2-4eb2-a10d-9422e897d79c.webm	\N	2026-03-27 03:23:45.042698+00	2026-03-27 03:23:45.042698+00	2026-03-27 03:23:45.042698+00	{"eTag": "\\"c57fbe47c7763b38ad69a27250ca894e\\"", "size": 338396, "mimetype": "audio/webm", "cacheControl": "no-cache", "lastModified": "2026-03-27T03:23:45.039Z", "contentLength": 338396, "httpStatusCode": 200}	030e0b1e-c0df-4b87-80ab-b90c2c503175	\N	{}
763b8e82-7ca8-4a17-94f2-803b687a912a	masshealth-dev	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/e54dbeea-a1a8-400d-9179-bee0dc246687.wav	\N	2026-03-27 17:48:57.826758+00	2026-03-27 17:48:57.826758+00	2026-03-27 17:48:57.826758+00	{"eTag": "\\"598ce8770d75a18f8c59539998e91c9a\\"", "size": 798560, "mimetype": "audio/wav", "cacheControl": "no-cache", "lastModified": "2026-03-27T17:48:57.820Z", "contentLength": 798560, "httpStatusCode": 200}	22a030bb-1031-40c2-bb15-56260a218b1a	\N	{}
2013b151-e5ef-4da0-99df-caeb4fa044af	masshealth-dev	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/e2e2077e-5508-4dfa-b359-7f5f9ebb5e4d.wav	\N	2026-03-27 17:54:24.591452+00	2026-03-27 17:54:24.591452+00	2026-03-27 17:54:24.591452+00	{"eTag": "\\"598ce8770d75a18f8c59539998e91c9a\\"", "size": 798560, "mimetype": "audio/wav", "cacheControl": "no-cache", "lastModified": "2026-03-27T17:54:24.585Z", "contentLength": 798560, "httpStatusCode": 200}	313ca43a-dadc-449e-81ee-a37f9f057f8e	\N	{}
c9de21df-657b-4122-a97b-36026e1a84a1	masshealth-dev	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/c9c3414f-0f51-4b06-9650-bbc769d5d355.wav	\N	2026-03-27 17:57:34.926542+00	2026-03-27 17:57:34.926542+00	2026-03-27 17:57:34.926542+00	{"eTag": "\\"598ce8770d75a18f8c59539998e91c9a\\"", "size": 798560, "mimetype": "audio/wav", "cacheControl": "no-cache", "lastModified": "2026-03-27T17:57:34.921Z", "contentLength": 798560, "httpStatusCode": 200}	1415863a-bfd1-4d26-9c40-d129a348f2a0	\N	{}
067be6c1-aee2-4b19-beeb-2eb5f1f2899c	masshealth-dev	dm/voice/bb728af4-11ae-4df0-8317-0e163c1f4526/d4eda787-5b83-4629-87fb-7402c795b370.wav	\N	2026-03-27 18:38:56.056637+00	2026-03-27 18:38:56.056637+00	2026-03-27 18:38:56.056637+00	{"eTag": "\\"598ce8770d75a18f8c59539998e91c9a\\"", "size": 798560, "mimetype": "audio/wav", "cacheControl": "no-cache", "lastModified": "2026-03-27T18:38:56.051Z", "contentLength": 798560, "httpStatusCode": 200}	7ab2975c-2720-4e27-8368-54254d90c96a	\N	{}
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: -
--

COPY supabase_functions.hooks (id, hook_table_id, hook_name, created_at, request_id) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: supabase_functions; Owner: -
--

COPY supabase_functions.migrations (version, inserted_at) FROM stdin;
initial	2026-03-17 13:57:11.018492+00
20210809183423_update_grants	2026-03-17 13:57:11.018492+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: -
--

COPY supabase_migrations.schema_migrations (version, statements, name) FROM stdin;
20260301133000	{BEGIN,"CREATE EXTENSION IF NOT EXISTS pgcrypto","DO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1\n    FROM pg_type\n    WHERE typname = 'application_status'\n  ) THEN\n    CREATE TYPE application_status AS ENUM (\n      'draft',\n      'submitted',\n      'ai_extracted',\n      'needs_review',\n      'rfi_requested',\n      'approved',\n      'denied'\n    );\n  END IF;\nEND $$","CREATE TABLE IF NOT EXISTS organizations (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS users (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  organization_id UUID REFERENCES organizations(id),\n  email TEXT UNIQUE NOT NULL,\n  password_hash TEXT NOT NULL,\n  is_active BOOLEAN NOT NULL DEFAULT true,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS roles (\n  id SERIAL PRIMARY KEY,\n  name TEXT UNIQUE NOT NULL\n)","CREATE TABLE IF NOT EXISTS user_roles (\n  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,\n  PRIMARY KEY (user_id, role_id)\n)","CREATE TABLE IF NOT EXISTS applicants (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES users(id),\n  first_name TEXT,\n  last_name TEXT,\n  dob DATE,\n  ssn_encrypted TEXT,\n  phone TEXT,\n  address_line1 TEXT,\n  address_line2 TEXT,\n  city TEXT,\n  state TEXT,\n  zip TEXT,\n  citizenship_status TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS applications (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  organization_id UUID REFERENCES organizations(id),\n  applicant_id UUID REFERENCES applicants(id),\n  status application_status NOT NULL DEFAULT 'draft',\n  household_size INT,\n  total_monthly_income NUMERIC(12,2),\n  confidence_score NUMERIC(5,2),\n  submitted_at TIMESTAMPTZ,\n  decided_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS household_members (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,\n  first_name TEXT,\n  last_name TEXT,\n  dob DATE,\n  relationship TEXT,\n  pregnant BOOLEAN NOT NULL DEFAULT false,\n  disabled BOOLEAN NOT NULL DEFAULT false,\n  over_65 BOOLEAN NOT NULL DEFAULT false\n)","CREATE TABLE IF NOT EXISTS incomes (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,\n  member_id UUID REFERENCES household_members(id),\n  income_type TEXT,\n  employer_name TEXT,\n  monthly_amount NUMERIC(12,2),\n  verified BOOLEAN NOT NULL DEFAULT false\n)","CREATE TABLE IF NOT EXISTS assets (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,\n  asset_type TEXT,\n  value NUMERIC(14,2)\n)","CREATE TABLE IF NOT EXISTS documents (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,\n  uploaded_by UUID REFERENCES users(id),\n  document_type TEXT,\n  file_url TEXT NOT NULL,\n  mime_type TEXT,\n  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS document_pages (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,\n  page_number INT,\n  ocr_text TEXT\n)","CREATE TABLE IF NOT EXISTS document_extractions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,\n  model_name TEXT,\n  raw_output JSONB,\n  structured_output JSONB,\n  confidence_score NUMERIC(5,2),\n  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS validation_results (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,\n  rule_name TEXT,\n  severity TEXT,\n  message TEXT,\n  resolved BOOLEAN NOT NULL DEFAULT false,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS eligibility_screenings (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,\n  estimated_program TEXT,\n  fpl_percentage NUMERIC(6,2),\n  screening_result TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS review_actions (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID REFERENCES applications(id),\n  reviewer_id UUID REFERENCES users(id),\n  action_type TEXT,\n  notes TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS rfis (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  application_id UUID REFERENCES applications(id),\n  requested_by UUID REFERENCES users(id),\n  message TEXT,\n  due_date DATE,\n  resolved BOOLEAN NOT NULL DEFAULT false,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE TABLE IF NOT EXISTS audit_logs (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES users(id),\n  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,\n  action TEXT,\n  old_data JSONB,\n  new_data JSONB,\n  ip_address TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n)","CREATE INDEX IF NOT EXISTS idx_application_status ON applications(status)","CREATE INDEX IF NOT EXISTS idx_applications_organization_id ON applications(organization_id)","CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id)","CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)","CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)","CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id)","CREATE INDEX IF NOT EXISTS idx_household_members_application_id ON household_members(application_id)","CREATE INDEX IF NOT EXISTS idx_incomes_application_id ON incomes(application_id)","CREATE INDEX IF NOT EXISTS idx_incomes_member_id ON incomes(member_id)","CREATE INDEX IF NOT EXISTS idx_assets_application_id ON assets(application_id)","CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id)","CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)","CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id)","CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON document_extractions(document_id)","CREATE INDEX IF NOT EXISTS idx_extraction_json ON document_extractions USING GIN (structured_output)","CREATE INDEX IF NOT EXISTS idx_validation_application ON validation_results(application_id)","CREATE INDEX IF NOT EXISTS idx_eligibility_screenings_application_id ON eligibility_screenings(application_id)","CREATE INDEX IF NOT EXISTS idx_review_actions_application_id ON review_actions(application_id)","CREATE INDEX IF NOT EXISTS idx_review_actions_reviewer_id ON review_actions(reviewer_id)","CREATE INDEX IF NOT EXISTS idx_rfis_application_id ON rfis(application_id)","CREATE INDEX IF NOT EXISTS idx_rfis_requested_by ON rfis(requested_by)","CREATE INDEX IF NOT EXISTS idx_audit_application ON audit_logs(application_id)","CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)",COMMIT}	init_mhealth_schema
20260301133100	{"-- mHealth schema hardening migration (schema-tolerant)\n-- NOTE: Timestamp conversion assumes existing TIMESTAMP values are UTC.\n\nBEGIN","CREATE EXTENSION IF NOT EXISTS pgcrypto","-- Convert timestamp columns to timestamptz where those columns exist.\nDO $$\nDECLARE\n  rec RECORD;\nBEGIN\n  FOR rec IN\n    SELECT v.table_name, v.column_name\n    FROM (\n      VALUES\n        ('organizations', 'created_at'),\n        ('users', 'created_at'),\n        ('applicants', 'created_at'),\n        ('applications', 'submitted_at'),\n        ('applications', 'decided_at'),\n        ('applications', 'created_at'),\n        ('documents', 'uploaded_at'),\n        ('document_extractions', 'extracted_at'),\n        ('validation_results', 'created_at'),\n        ('eligibility_screenings', 'created_at'),\n        ('review_actions', 'created_at'),\n        ('rfis', 'created_at'),\n        ('audit_logs', 'created_at')\n    ) AS v(table_name, column_name)\n    JOIN information_schema.columns c\n      ON c.table_schema = 'public'\n     AND c.table_name = v.table_name\n     AND c.column_name = v.column_name\n    WHERE c.data_type = 'timestamp without time zone'\n  LOOP\n    EXECUTE format(\n      'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',\n      rec.table_name,\n      rec.column_name,\n      rec.column_name\n    );\n  END LOOP;\nEND $$","-- Normalize nullable boolean/timestamp defaults only if columns exist.\nDO $$\nDECLARE\n  rec RECORD;\nBEGIN\n  FOR rec IN\n    SELECT * FROM (\n      VALUES\n        ('users', 'is_active', 'true'),\n        ('household_members', 'pregnant', 'false'),\n        ('household_members', 'disabled', 'false'),\n        ('household_members', 'over_65', 'false'),\n        ('incomes', 'verified', 'false'),\n        ('validation_results', 'resolved', 'false'),\n        ('rfis', 'resolved', 'false'),\n        ('organizations', 'created_at', 'now()'),\n        ('users', 'created_at', 'now()'),\n        ('applicants', 'created_at', 'now()'),\n        ('applications', 'created_at', 'now()'),\n        ('documents', 'uploaded_at', 'now()'),\n        ('document_extractions', 'extracted_at', 'now()'),\n        ('validation_results', 'created_at', 'now()'),\n        ('eligibility_screenings', 'created_at', 'now()'),\n        ('review_actions', 'created_at', 'now()'),\n        ('rfis', 'created_at', 'now()'),\n        ('audit_logs', 'created_at', 'now()')\n    ) AS v(table_name, column_name, sql_value)\n  LOOP\n    IF EXISTS (\n      SELECT 1\n      FROM information_schema.columns\n      WHERE table_schema = 'public'\n        AND table_name = rec.table_name\n        AND column_name = rec.column_name\n    ) THEN\n      EXECUTE format(\n        'UPDATE public.%I SET %I = %s WHERE %I IS NULL',\n        rec.table_name,\n        rec.column_name,\n        rec.sql_value,\n        rec.column_name\n      );\n    END IF;\n  END LOOP;\nEND $$","-- Keep incomes internally consistent where required columns exist.\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'incomes' AND column_name = 'member_id'\n  )\n  AND EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'incomes' AND column_name = 'application_id'\n  )\n  AND EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'household_members' AND column_name = 'id'\n  )\n  AND EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'household_members' AND column_name = 'application_id'\n  ) THEN\n    EXECUTE $sql$\n      UPDATE incomes i\n      SET application_id = hm.application_id\n      FROM household_members hm\n      WHERE i.member_id = hm.id\n        AND i.application_id IS DISTINCT FROM hm.application_id\n    $sql$;\n\n    EXECUTE $sql$\n      UPDATE incomes i\n      SET member_id = NULL\n      WHERE i.member_id IS NOT NULL\n        AND NOT EXISTS (\n          SELECT 1\n          FROM household_members hm\n          WHERE hm.id = i.member_id\n            AND hm.application_id = i.application_id\n        )\n    $sql$;\n  END IF;\nEND $$","-- Repair invalid audit log references where possible.\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'application_id'\n  )\n  AND EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'id'\n  ) THEN\n    EXECUTE $sql$\n      UPDATE audit_logs a\n      SET application_id = NULL\n      WHERE a.application_id IS NOT NULL\n        AND NOT EXISTS (\n          SELECT 1\n          FROM applications ap\n          WHERE ap.id = a.application_id\n        )\n    $sql$;\n  END IF;\nEND $$","-- Normalize invalid values before adding checks.\nDO $$\nBEGIN\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='household_size') THEN\n    EXECUTE 'UPDATE applications SET household_size = NULL WHERE household_size IS NOT NULL AND household_size < 1';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='total_monthly_income') THEN\n    EXECUTE 'UPDATE applications SET total_monthly_income = NULL WHERE total_monthly_income IS NOT NULL AND total_monthly_income < 0';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='confidence_score') THEN\n    EXECUTE 'UPDATE applications SET confidence_score = NULL WHERE confidence_score IS NOT NULL AND (confidence_score < 0 OR confidence_score > 100)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incomes' AND column_name='monthly_amount') THEN\n    EXECUTE 'UPDATE incomes SET monthly_amount = NULL WHERE monthly_amount IS NOT NULL AND monthly_amount < 0';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='value') THEN\n    EXECUTE 'UPDATE assets SET value = NULL WHERE value IS NOT NULL AND value < 0';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_extractions' AND column_name='confidence_score') THEN\n    EXECUTE 'UPDATE document_extractions SET confidence_score = NULL WHERE confidence_score IS NOT NULL AND (confidence_score < 0 OR confidence_score > 100)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eligibility_screenings' AND column_name='fpl_percentage') THEN\n    EXECUTE 'UPDATE eligibility_screenings SET fpl_percentage = NULL WHERE fpl_percentage IS NOT NULL AND fpl_percentage < 0';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='validation_results' AND column_name='severity') THEN\n    EXECUTE 'UPDATE validation_results SET severity = lower(severity) WHERE severity IS NOT NULL';\n    EXECUTE 'UPDATE validation_results SET severity = NULL WHERE severity IS NOT NULL AND severity NOT IN (''warning'', ''error'')';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_actions' AND column_name='action_type') THEN\n    EXECUTE 'UPDATE review_actions SET action_type = lower(action_type) WHERE action_type IS NOT NULL';\n    EXECUTE 'UPDATE review_actions SET action_type = NULL WHERE action_type IS NOT NULL AND action_type NOT IN (''approve'', ''deny'', ''rfi'')';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='page_number') THEN\n    EXECUTE 'UPDATE document_pages SET page_number = NULL WHERE page_number IS NOT NULL AND page_number <= 0';\n  END IF;\nEND $$","-- Remove duplicate (document_id, page_number) values by nulling subsequent duplicates.\nDO $$\nBEGIN\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='id')\n     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='document_id')\n     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='page_number') THEN\n    EXECUTE $sql$\n      WITH duplicate_pages AS (\n        SELECT\n          id,\n          ROW_NUMBER() OVER (\n            PARTITION BY document_id, page_number\n            ORDER BY id\n          ) AS rn\n        FROM document_pages\n        WHERE page_number IS NOT NULL\n      )\n      UPDATE document_pages dp\n      SET page_number = NULL\n      FROM duplicate_pages d\n      WHERE dp.id = d.id\n        AND d.rn > 1\n    $sql$;\n  END IF;\nEND $$","-- Set defaults if target columns exist.\nDO $$\nDECLARE\n  rec RECORD;\nBEGIN\n  FOR rec IN\n    SELECT * FROM (\n      VALUES\n        ('organizations', 'created_at', 'now()'),\n        ('users', 'is_active', 'true'),\n        ('users', 'created_at', 'now()'),\n        ('applicants', 'created_at', 'now()'),\n        ('applications', 'status', '''draft'''),\n        ('applications', 'created_at', 'now()'),\n        ('household_members', 'pregnant', 'false'),\n        ('household_members', 'disabled', 'false'),\n        ('household_members', 'over_65', 'false'),\n        ('incomes', 'verified', 'false'),\n        ('documents', 'uploaded_at', 'now()'),\n        ('document_extractions', 'extracted_at', 'now()'),\n        ('validation_results', 'resolved', 'false'),\n        ('validation_results', 'created_at', 'now()'),\n        ('eligibility_screenings', 'created_at', 'now()'),\n        ('review_actions', 'created_at', 'now()'),\n        ('rfis', 'resolved', 'false'),\n        ('rfis', 'created_at', 'now()'),\n        ('audit_logs', 'created_at', 'now()')\n    ) AS v(table_name, column_name, sql_default)\n  LOOP\n    IF EXISTS (\n      SELECT 1\n      FROM information_schema.columns\n      WHERE table_schema = 'public'\n        AND table_name = rec.table_name\n        AND column_name = rec.column_name\n    ) THEN\n      EXECUTE format(\n        'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',\n        rec.table_name,\n        rec.column_name,\n        rec.sql_default\n      );\n    END IF;\n  END LOOP;\nEND $$","-- Set NOT NULL where columns exist (after normalization).\nDO $$\nDECLARE\n  rec RECORD;\nBEGIN\n  FOR rec IN\n    SELECT * FROM (\n      VALUES\n        ('users', 'is_active'),\n        ('applications', 'status'),\n        ('household_members', 'pregnant'),\n        ('household_members', 'disabled'),\n        ('household_members', 'over_65'),\n        ('incomes', 'verified'),\n        ('validation_results', 'resolved'),\n        ('rfis', 'resolved')\n    ) AS v(table_name, column_name)\n  LOOP\n    IF EXISTS (\n      SELECT 1\n      FROM information_schema.columns\n      WHERE table_schema = 'public'\n        AND table_name = rec.table_name\n        AND column_name = rec.column_name\n    ) THEN\n      EXECUTE format(\n        'ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL',\n        rec.table_name,\n        rec.column_name\n      );\n    END IF;\n  END LOOP;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE household_members\n    ADD CONSTRAINT household_members_id_application_id_key\n    UNIQUE (id, application_id);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE incomes\n    ADD CONSTRAINT incomes_member_application_fk\n    FOREIGN KEY (member_id, application_id)\n    REFERENCES household_members(id, application_id)\n    ON DELETE CASCADE;\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE audit_logs\n    ADD CONSTRAINT audit_logs_application_fk\n    FOREIGN KEY (application_id)\n    REFERENCES applications(id)\n    ON DELETE SET NULL;\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE applications\n    ADD CONSTRAINT applications_household_size_check\n    CHECK (household_size IS NULL OR household_size >= 1);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE applications\n    ADD CONSTRAINT applications_total_monthly_income_non_negative\n    CHECK (total_monthly_income IS NULL OR total_monthly_income >= 0);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE applications\n    ADD CONSTRAINT applications_confidence_score_range\n    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE incomes\n    ADD CONSTRAINT incomes_monthly_amount_non_negative\n    CHECK (monthly_amount IS NULL OR monthly_amount >= 0);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE assets\n    ADD CONSTRAINT assets_value_non_negative\n    CHECK (value IS NULL OR value >= 0);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE document_pages\n    ADD CONSTRAINT document_pages_page_number_check\n    CHECK (page_number IS NULL OR page_number > 0);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE document_pages\n    ADD CONSTRAINT document_pages_document_id_page_number_key\n    UNIQUE (document_id, page_number);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE document_extractions\n    ADD CONSTRAINT document_extractions_confidence_score_range\n    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE validation_results\n    ADD CONSTRAINT validation_results_severity_check\n    CHECK (severity IS NULL OR severity IN ('warning', 'error'));\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE eligibility_screenings\n    ADD CONSTRAINT eligibility_screenings_fpl_non_negative\n    CHECK (fpl_percentage IS NULL OR fpl_percentage >= 0);\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","DO $$\nBEGIN\n  ALTER TABLE review_actions\n    ADD CONSTRAINT review_actions_action_type_check\n    CHECK (action_type IS NULL OR action_type IN ('approve', 'deny', 'rfi'));\nEXCEPTION\n  WHEN duplicate_object OR duplicate_table OR undefined_table OR undefined_column OR SQLSTATE '42P07' THEN NULL;\nEND $$","-- Create indexes only when required columns exist.\nDO $$\nBEGIN\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='status') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_application_status ON applications(status)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='organization_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_applications_organization_id ON applications(organization_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applications' AND column_name='applicant_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON applications(applicant_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='organization_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name='role_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='applicants' AND column_name='user_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='household_members' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_household_members_application_id ON household_members(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incomes' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_incomes_application_id ON incomes(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='incomes' AND column_name='member_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_incomes_member_id ON incomes(member_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_application_id ON assets(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_application ON documents(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='uploaded_by') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_pages' AND column_name='document_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_extractions' AND column_name='document_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id ON document_extractions(document_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_extractions' AND column_name='structured_output') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_extraction_json ON document_extractions USING GIN (structured_output)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='validation_results' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_validation_application ON validation_results(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='eligibility_screenings' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_eligibility_screenings_application_id ON eligibility_screenings(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_actions' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_review_actions_application_id ON review_actions(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_actions' AND column_name='reviewer_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_review_actions_reviewer_id ON review_actions(reviewer_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rfis' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rfis_application_id ON rfis(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rfis' AND column_name='requested_by') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rfis_requested_by ON rfis(requested_by)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='application_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_application ON audit_logs(application_id)';\n  END IF;\n  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_id') THEN\n    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)';\n  END IF;\nEND $$",COMMIT}	harden_mhealth_schema
20260301145000	{BEGIN,"DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1\n    FROM information_schema.columns\n    WHERE table_schema = 'public'\n      AND table_name = 'applicants'\n      AND column_name = 'user_id'\n  ) THEN\n    BEGIN\n      ALTER TABLE public.applicants\n        ADD CONSTRAINT applicants_user_id_key UNIQUE (user_id);\n    EXCEPTION\n      WHEN duplicate_object OR duplicate_table THEN NULL;\n    END;\n  END IF;\nEND $$","CREATE OR REPLACE FUNCTION public.handle_new_auth_user()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  INSERT INTO public.users (\n    id,\n    email,\n    password_hash,\n    is_active,\n    created_at\n  )\n  VALUES (\n    NEW.id,\n    NEW.email,\n    'supabase_auth_managed',\n    true,\n    COALESCE(NEW.created_at, now())\n  )\n  ON CONFLICT (id) DO UPDATE\n  SET\n    email = EXCLUDED.email,\n    is_active = true;\n\n  IF EXISTS (\n    SELECT 1\n    FROM information_schema.columns\n    WHERE table_schema = 'public'\n      AND table_name = 'applicants'\n      AND column_name = 'user_id'\n  ) THEN\n    INSERT INTO public.applicants (\n      user_id,\n      first_name,\n      last_name,\n      phone,\n      created_at\n    )\n    VALUES (\n      NEW.id,\n      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),\n      NULLIF(NEW.raw_user_meta_data->>'last_name', ''),\n      NULLIF(NEW.raw_user_meta_data->>'phone', ''),\n      COALESCE(NEW.created_at, now())\n    )\n    ON CONFLICT (user_id) DO UPDATE\n    SET\n      first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),\n      last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),\n      phone = COALESCE(EXCLUDED.phone, public.applicants.phone);\n  END IF;\n\n  RETURN NEW;\nEND;\n$$","DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users","CREATE TRIGGER on_auth_user_created\n  AFTER INSERT ON auth.users\n  FOR EACH ROW\n  EXECUTE FUNCTION public.handle_new_auth_user()",COMMIT}	auth_user_sync
20260301152000	{BEGIN,"CREATE OR REPLACE FUNCTION public.request_user_id()\nRETURNS UUID\nLANGUAGE sql\nSTABLE\nAS $$\n  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid\n$$","CREATE OR REPLACE FUNCTION public.is_staff()\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT EXISTS (\n    SELECT 1\n    FROM public.user_roles ur\n    JOIN public.roles r ON r.id = ur.role_id\n    WHERE ur.user_id = public.request_user_id()\n      AND r.name IN ('admin', 'reviewer')\n  )\n$$","CREATE OR REPLACE FUNCTION public.can_access_user(p_user_id UUID)\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT p_user_id = public.request_user_id() OR public.is_staff()\n$$","CREATE OR REPLACE FUNCTION public.can_access_applicant(p_applicant_id UUID)\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT public.is_staff()\n    OR EXISTS (\n      SELECT 1\n      FROM public.applicants ap\n      WHERE ap.id = p_applicant_id\n        AND ap.user_id = public.request_user_id()\n    )\n$$","CREATE OR REPLACE FUNCTION public.can_access_application(p_application_id UUID)\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT public.is_staff()\n    OR EXISTS (\n      SELECT 1\n      FROM public.applications a\n      JOIN public.applicants ap ON ap.id = a.applicant_id\n      WHERE a.id = p_application_id\n        AND ap.user_id = public.request_user_id()\n    )\n$$","CREATE OR REPLACE FUNCTION public.can_access_document(p_document_id UUID)\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT public.is_staff()\n    OR EXISTS (\n      SELECT 1\n      FROM public.documents d\n      WHERE d.id = p_document_id\n        AND public.can_access_application(d.application_id)\n    )\n$$","CREATE OR REPLACE FUNCTION public.can_access_organization(p_organization_id UUID)\nRETURNS BOOLEAN\nLANGUAGE sql\nSTABLE\nSECURITY DEFINER\nSET search_path = public\nAS $$\n  SELECT public.is_staff()\n    OR EXISTS (\n      SELECT 1\n      FROM public.users u\n      WHERE u.id = public.request_user_id()\n        AND u.organization_id = p_organization_id\n    )\n$$","ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY","ALTER TABLE public.users ENABLE ROW LEVEL SECURITY","ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY","ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY","ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY","ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY","ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY","ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY","ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY","ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY","ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY","ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY","ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY","ALTER TABLE public.eligibility_screenings ENABLE ROW LEVEL SECURITY","ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY","ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY","ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS organizations_select ON public.organizations","DROP POLICY IF EXISTS organizations_write_staff ON public.organizations","CREATE POLICY organizations_select\n  ON public.organizations\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_organization(id))","CREATE POLICY organizations_write_staff\n  ON public.organizations\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS users_select ON public.users","DROP POLICY IF EXISTS users_update ON public.users","CREATE POLICY users_select\n  ON public.users\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_user(id))","CREATE POLICY users_update\n  ON public.users\n  FOR UPDATE\n  TO authenticated\n  USING (public.can_access_user(id))\n  WITH CHECK (public.can_access_user(id))","DROP POLICY IF EXISTS roles_select ON public.roles","CREATE POLICY roles_select\n  ON public.roles\n  FOR SELECT\n  TO authenticated\n  USING (true)","DROP POLICY IF EXISTS user_roles_select ON public.user_roles","DROP POLICY IF EXISTS user_roles_write_staff ON public.user_roles","CREATE POLICY user_roles_select\n  ON public.user_roles\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_user(user_id))","CREATE POLICY user_roles_write_staff\n  ON public.user_roles\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS applicants_select ON public.applicants","DROP POLICY IF EXISTS applicants_insert ON public.applicants","DROP POLICY IF EXISTS applicants_update ON public.applicants","CREATE POLICY applicants_select\n  ON public.applicants\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_user(user_id))","CREATE POLICY applicants_insert\n  ON public.applicants\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (public.can_access_user(user_id))","CREATE POLICY applicants_update\n  ON public.applicants\n  FOR UPDATE\n  TO authenticated\n  USING (public.can_access_user(user_id))\n  WITH CHECK (public.can_access_user(user_id))","DROP POLICY IF EXISTS applications_select ON public.applications","DROP POLICY IF EXISTS applications_insert ON public.applications","DROP POLICY IF EXISTS applications_update ON public.applications","DROP POLICY IF EXISTS applications_delete ON public.applications","CREATE POLICY applications_select\n  ON public.applications\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_application(id))","CREATE POLICY applications_insert\n  ON public.applications\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (public.can_access_applicant(applicant_id))","CREATE POLICY applications_update\n  ON public.applications\n  FOR UPDATE\n  TO authenticated\n  USING (public.can_access_application(id))\n  WITH CHECK (public.can_access_applicant(applicant_id))","CREATE POLICY applications_delete\n  ON public.applications\n  FOR DELETE\n  TO authenticated\n  USING (public.can_access_application(id))","DROP POLICY IF EXISTS household_members_owner_rw ON public.household_members","CREATE POLICY household_members_owner_rw\n  ON public.household_members\n  FOR ALL\n  TO authenticated\n  USING (public.can_access_application(application_id))\n  WITH CHECK (public.can_access_application(application_id))","DROP POLICY IF EXISTS incomes_owner_rw ON public.incomes","CREATE POLICY incomes_owner_rw\n  ON public.incomes\n  FOR ALL\n  TO authenticated\n  USING (public.can_access_application(application_id))\n  WITH CHECK (public.can_access_application(application_id))","DROP POLICY IF EXISTS assets_owner_rw ON public.assets","CREATE POLICY assets_owner_rw\n  ON public.assets\n  FOR ALL\n  TO authenticated\n  USING (public.can_access_application(application_id))\n  WITH CHECK (public.can_access_application(application_id))","DROP POLICY IF EXISTS documents_select ON public.documents","DROP POLICY IF EXISTS documents_insert ON public.documents","DROP POLICY IF EXISTS documents_update ON public.documents","DROP POLICY IF EXISTS documents_delete ON public.documents","CREATE POLICY documents_select\n  ON public.documents\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_application(application_id))","CREATE POLICY documents_insert\n  ON public.documents\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (\n    public.can_access_application(application_id)\n    AND (uploaded_by IS NULL OR public.can_access_user(uploaded_by))\n  )","CREATE POLICY documents_update\n  ON public.documents\n  FOR UPDATE\n  TO authenticated\n  USING (public.can_access_application(application_id))\n  WITH CHECK (\n    public.can_access_application(application_id)\n    AND (uploaded_by IS NULL OR public.can_access_user(uploaded_by))\n  )","CREATE POLICY documents_delete\n  ON public.documents\n  FOR DELETE\n  TO authenticated\n  USING (public.can_access_application(application_id))","DROP POLICY IF EXISTS document_pages_select ON public.document_pages","DROP POLICY IF EXISTS document_pages_write_staff ON public.document_pages","CREATE POLICY document_pages_select\n  ON public.document_pages\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_document(document_id))","CREATE POLICY document_pages_write_staff\n  ON public.document_pages\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS document_extractions_select ON public.document_extractions","DROP POLICY IF EXISTS document_extractions_write_staff ON public.document_extractions","CREATE POLICY document_extractions_select\n  ON public.document_extractions\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_document(document_id))","CREATE POLICY document_extractions_write_staff\n  ON public.document_extractions\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS validation_results_select ON public.validation_results","DROP POLICY IF EXISTS validation_results_write_staff ON public.validation_results","CREATE POLICY validation_results_select\n  ON public.validation_results\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_application(application_id))","CREATE POLICY validation_results_write_staff\n  ON public.validation_results\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS eligibility_screenings_select ON public.eligibility_screenings","DROP POLICY IF EXISTS eligibility_screenings_write_staff ON public.eligibility_screenings","CREATE POLICY eligibility_screenings_select\n  ON public.eligibility_screenings\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_application(application_id))","CREATE POLICY eligibility_screenings_write_staff\n  ON public.eligibility_screenings\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS review_actions_select ON public.review_actions","DROP POLICY IF EXISTS review_actions_write_staff ON public.review_actions","CREATE POLICY review_actions_select\n  ON public.review_actions\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_application(application_id))","CREATE POLICY review_actions_write_staff\n  ON public.review_actions\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS rfis_select ON public.rfis","DROP POLICY IF EXISTS rfis_write_staff ON public.rfis","CREATE POLICY rfis_select\n  ON public.rfis\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_application(application_id))","CREATE POLICY rfis_write_staff\n  ON public.rfis\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())","DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs","DROP POLICY IF EXISTS audit_logs_write_staff ON public.audit_logs","CREATE POLICY audit_logs_select\n  ON public.audit_logs\n  FOR SELECT\n  TO authenticated\n  USING (public.can_access_user(user_id))","CREATE POLICY audit_logs_write_staff\n  ON public.audit_logs\n  FOR ALL\n  TO authenticated\n  USING (public.is_staff())\n  WITH CHECK (public.is_staff())",COMMIT}	rls_policies
20260305214500	{BEGIN,"ALTER TABLE public.applications\n  ADD COLUMN IF NOT EXISTS application_type TEXT,\n  ADD COLUMN IF NOT EXISTS draft_state JSONB,\n  ADD COLUMN IF NOT EXISTS draft_step INT,\n  ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ,\n  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()","DO $$\nBEGIN\n  ALTER TABLE public.applications\n    ADD CONSTRAINT applications_draft_step_range_check\n    CHECK (draft_step IS NULL OR (draft_step >= 1 AND draft_step <= 9));\nEXCEPTION\n  WHEN duplicate_object THEN NULL;\nEND $$","CREATE INDEX IF NOT EXISTS idx_applications_application_type\n  ON public.applications(application_type)","CREATE INDEX IF NOT EXISTS idx_applications_last_saved_at\n  ON public.applications(last_saved_at DESC)","CREATE INDEX IF NOT EXISTS idx_applications_draft_state\n  ON public.applications USING GIN (draft_state)","UPDATE public.applications\nSET updated_at = COALESCE(updated_at, created_at, now())\nWHERE updated_at IS NULL","CREATE OR REPLACE FUNCTION public.touch_applications_updated_at()\nRETURNS trigger\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  NEW.updated_at = now();\n  RETURN NEW;\nEND;\n$$","DROP TRIGGER IF EXISTS trg_touch_applications_updated_at ON public.applications","CREATE TRIGGER trg_touch_applications_updated_at\n  BEFORE UPDATE ON public.applications\n  FOR EACH ROW\n  EXECUTE FUNCTION public.touch_applications_updated_at()",COMMIT}	application_drafts
20260306090000	{BEGIN,"CREATE EXTENSION IF NOT EXISTS pg_trgm","CREATE INDEX IF NOT EXISTS idx_applications_id_trgm\n  ON public.applications\n  USING GIN ((id::text) gin_trgm_ops)","CREATE INDEX IF NOT EXISTS idx_applications_application_type_trgm\n  ON public.applications\n  USING GIN (application_type gin_trgm_ops)","CREATE INDEX IF NOT EXISTS idx_applications_applicant_name_trgm\n  ON public.applications\n  USING GIN ((COALESCE(draft_state #>> '{data,contact,p1_name}', '')) gin_trgm_ops)",COMMIT}	applications_search_trgm
20260306235500	{BEGIN,"INSERT INTO public.users (\n  id,\n  email,\n  password_hash,\n  is_active,\n  created_at\n)\nSELECT\n  au.id,\n  au.email::text,\n  'supabase_auth_managed',\n  true,\n  COALESCE(au.created_at, now())\nFROM auth.users au\nWHERE au.email IS NOT NULL\n  AND au.email <> ''\nON CONFLICT (id) DO UPDATE\nSET\n  email = EXCLUDED.email,\n  is_active = true","DO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1\n    FROM information_schema.columns\n    WHERE table_schema = 'public'\n      AND table_name = 'applicants'\n      AND column_name = 'user_id'\n  ) THEN\n    INSERT INTO public.applicants (\n      user_id,\n      first_name,\n      last_name,\n      phone,\n      created_at\n    )\n    SELECT\n      au.id,\n      NULLIF(au.raw_user_meta_data->>'first_name', ''),\n      NULLIF(au.raw_user_meta_data->>'last_name', ''),\n      NULLIF(au.raw_user_meta_data->>'phone', ''),\n      COALESCE(au.created_at, now())\n    FROM auth.users au\n    INNER JOIN public.users pu\n      ON pu.id = au.id\n    ON CONFLICT (user_id) DO UPDATE\n    SET\n      first_name = COALESCE(EXCLUDED.first_name, public.applicants.first_name),\n      last_name = COALESCE(EXCLUDED.last_name, public.applicants.last_name),\n      phone = COALESCE(EXCLUDED.phone, public.applicants.phone);\n  END IF;\nEND $$",COMMIT}	backfill_auth_user_sync
20260307211500	{BEGIN,"UPDATE auth.users\nSET\n  instance_id = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'::uuid),\n  confirmation_token = COALESCE(confirmation_token, ''),\n  recovery_token = COALESCE(recovery_token, ''),\n  email_change_token_new = COALESCE(email_change_token_new, ''),\n  email_change_token_current = COALESCE(email_change_token_current, ''),\n  reauthentication_token = COALESCE(reauthentication_token, ''),\n  email_change = COALESCE(email_change, ''),\n  phone_change = COALESCE(phone_change, ''),\n  phone_change_token = COALESCE(phone_change_token, ''),\n  email_change_confirm_status = COALESCE(email_change_confirm_status, 0),\n  is_sso_user = COALESCE(is_sso_user, false),\n  is_anonymous = COALESCE(is_anonymous, false)\nWHERE\n  instance_id IS NULL\n  OR confirmation_token IS NULL\n  OR recovery_token IS NULL\n  OR email_change_token_new IS NULL\n  OR email_change_token_current IS NULL\n  OR reauthentication_token IS NULL\n  OR email_change IS NULL\n  OR phone_change IS NULL\n  OR phone_change_token IS NULL\n  OR email_change_confirm_status IS NULL",COMMIT}	normalize_local_auth_users
20260311200000	{"-- RAG Policy Document Store\n-- Requires pgvector extension (enable via Supabase Dashboard → Extensions → vector)\n-- Run AFTER enabling pgvector in your Supabase project\n\nCREATE EXTENSION IF NOT EXISTS vector","-- ── Policy Documents ──────────────────────────────────────────────────────────\n-- One row per source document (idempotent by source_url)\n\nCREATE TABLE IF NOT EXISTS policy_documents (\n  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),\n  title       TEXT        NOT NULL,\n  source_url  TEXT        NOT NULL UNIQUE,\n  doc_type    TEXT        NOT NULL,  -- 'member_booklet' | 'eligibility_guide' | 'verifications' | 'transmittal'\n  language    TEXT        NOT NULL DEFAULT 'en',\n  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  chunk_count INT         NOT NULL DEFAULT 0\n)","-- ── Policy Chunks ─────────────────────────────────────────────────────────────\n-- One row per text chunk; embedding is 768-dim (nomic-embed-text)\n\nCREATE TABLE IF NOT EXISTS policy_chunks (\n  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),\n  document_id UUID        NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,\n  chunk_index INT         NOT NULL,\n  content     TEXT        NOT NULL,\n  embedding   vector(768),\n  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()\n)","-- IVFFlat index for fast approximate nearest-neighbor cosine search.\n-- lists=50 is appropriate for up to ~50k chunks; increase to 100 for larger corpora.\nCREATE INDEX IF NOT EXISTS idx_policy_chunks_embedding\n  ON policy_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)","CREATE INDEX IF NOT EXISTS idx_policy_chunks_document_id\n  ON policy_chunks(document_id)","-- ── RLS ───────────────────────────────────────────────────────────────────────\n-- Policy documents are read-only for all authenticated users;\n-- writes are done server-side via service role (ingest route uses getDbPool()).\n\nALTER TABLE policy_documents     ENABLE ROW LEVEL SECURITY","ALTER TABLE policy_chunks        ENABLE ROW LEVEL SECURITY","-- Authenticated users can read all policy data (it's public policy content)\nCREATE POLICY policy_documents_read ON policy_documents\n  FOR SELECT TO authenticated USING (true)","CREATE POLICY policy_chunks_read ON policy_chunks\n  FOR SELECT TO authenticated USING (true)","-- Only service role (server) can write — no authenticated-user write policies needed\n-- (ingest route bypasses RLS using service-role key or getDbPool with superuser)"}	rag_policy_store
20260317000000	{"-- ============================================================\n-- Storage bucket policies for \\"masshealth-dev\\"\n--\n-- Applied via: supabase db push  (runs as supabase_storage_admin)\n-- NOT via plain psql — postgres user doesn't own storage.objects.\n--\n-- Folder layout inside the bucket (all under {userId}/ for isolation):\n--   {userId}/avatar/avatar.{ext}                     ← profile picture\n--   {userId}/{applicationId}/{documentId}/{fileName} ← application docs\n--\n-- These policies only apply when clients use a user JWT.\n-- Server-side code using SUPABASE_SERVICE_ROLE_KEY bypasses them entirely.\n-- ============================================================\n\n-- Drop first so this file is safe to re-run\nDROP POLICY IF EXISTS \\"masshealth_dev_upload_own\\"  ON storage.objects","DROP POLICY IF EXISTS \\"masshealth_dev_read_own\\"    ON storage.objects","DROP POLICY IF EXISTS \\"masshealth_dev_delete_own\\"  ON storage.objects","DROP POLICY IF EXISTS \\"masshealth_dev_staff_all\\"   ON storage.objects","-- Authenticated users may upload only inside their own {userId}/ folder\nCREATE POLICY \\"masshealth_dev_upload_own\\"\n  ON storage.objects\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (\n    bucket_id = 'masshealth-dev'\n    AND (storage.foldername(name))[1] = auth.uid()::text\n  )","-- Authenticated users may read only their own files\nCREATE POLICY \\"masshealth_dev_read_own\\"\n  ON storage.objects\n  FOR SELECT\n  TO authenticated\n  USING (\n    bucket_id = 'masshealth-dev'\n    AND (storage.foldername(name))[1] = auth.uid()::text\n  )","-- Authenticated users may delete only their own files\nCREATE POLICY \\"masshealth_dev_delete_own\\"\n  ON storage.objects\n  FOR DELETE\n  TO authenticated\n  USING (\n    bucket_id = 'masshealth-dev'\n    AND (storage.foldername(name))[1] = auth.uid()::text\n  )","-- Staff (reviewer / admin roles) get full access to the entire bucket\nCREATE POLICY \\"masshealth_dev_staff_all\\"\n  ON storage.objects\n  FOR ALL\n  TO authenticated\n  USING (\n    bucket_id = 'masshealth-dev'\n    AND public.is_staff()\n  )\n  WITH CHECK (\n    bucket_id = 'masshealth-dev'\n    AND public.is_staff()\n  )"}	masshealth_dev_storage_policies
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: -
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 134, true);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 8, true);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: -
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: -
--

SELECT pg_catalog.setval('supabase_functions.hooks_id_seq', 1, false);


--
-- Name: extensions extensions_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: applicants applicants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_pkey PRIMARY KEY (id);


--
-- Name: applicants applicants_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_user_id_key UNIQUE (user_id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: benefit_stack_results benefit_stack_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_stack_results
    ADD CONSTRAINT benefit_stack_results_pkey PRIMARY KEY (id);


--
-- Name: collaborative_sessions collaborative_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborative_sessions
    ADD CONSTRAINT collaborative_sessions_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: document_extractions document_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_extractions
    ADD CONSTRAINT document_extractions_pkey PRIMARY KEY (id);


--
-- Name: document_pages document_pages_document_id_page_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_document_id_page_number_key UNIQUE (document_id, page_number);


--
-- Name: document_pages document_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: eligibility_screenings eligibility_screenings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eligibility_screenings
    ADD CONSTRAINT eligibility_screenings_pkey PRIMARY KEY (id);


--
-- Name: family_profiles family_profiles_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_profiles
    ADD CONSTRAINT family_profiles_applicant_id_key UNIQUE (applicant_id);


--
-- Name: family_profiles family_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_profiles
    ADD CONSTRAINT family_profiles_pkey PRIMARY KEY (id);


--
-- Name: household_members household_members_id_application_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_id_application_id_key UNIQUE (id, application_id);


--
-- Name: household_members household_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_pkey PRIMARY KEY (id);


--
-- Name: incomes incomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: mobile_verify_sessions mobile_verify_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_verify_sessions
    ADD CONSTRAINT mobile_verify_sessions_pkey PRIMARY KEY (id);


--
-- Name: mobile_verify_sessions mobile_verify_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_verify_sessions
    ADD CONSTRAINT mobile_verify_sessions_token_key UNIQUE (token);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: patient_social_worker_access patient_social_worker_access_patient_user_id_social_worker__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_social_worker_access
    ADD CONSTRAINT patient_social_worker_access_patient_user_id_social_worker__key UNIQUE (patient_user_id, social_worker_user_id);


--
-- Name: patient_social_worker_access patient_social_worker_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_social_worker_access
    ADD CONSTRAINT patient_social_worker_access_pkey PRIMARY KEY (id);


--
-- Name: policy_chunks policy_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_chunks
    ADD CONSTRAINT policy_chunks_pkey PRIMARY KEY (id);


--
-- Name: policy_documents policy_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_documents
    ADD CONSTRAINT policy_documents_pkey PRIMARY KEY (id);


--
-- Name: policy_documents policy_documents_source_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_documents
    ADD CONSTRAINT policy_documents_source_url_key UNIQUE (source_url);


--
-- Name: review_actions review_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_actions
    ADD CONSTRAINT review_actions_pkey PRIMARY KEY (id);


--
-- Name: rfis rfis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: session_messages session_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_messages
    ADD CONSTRAINT session_messages_pkey PRIMARY KEY (id);


--
-- Name: social_worker_profiles social_worker_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_worker_profiles
    ADD CONSTRAINT social_worker_profiles_pkey PRIMARY KEY (id);


--
-- Name: social_worker_profiles social_worker_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_worker_profiles
    ADD CONSTRAINT social_worker_profiles_user_id_key UNIQUE (user_id);


--
-- Name: sw_direct_messages sw_direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_direct_messages
    ADD CONSTRAINT sw_direct_messages_pkey PRIMARY KEY (id);


--
-- Name: sw_engagement_requests sw_engagement_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_engagement_requests
    ADD CONSTRAINT sw_engagement_requests_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_applicant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_applicant_id_key UNIQUE (applicant_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: validation_results validation_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_results
    ADD CONSTRAINT validation_results_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_04_01 messages_2026_04_01_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_04_01
    ADD CONSTRAINT messages_2026_04_01_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_04_03 messages_2026_04_03_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_04_03
    ADD CONSTRAINT messages_2026_04_03_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_04_04 messages_2026_04_04_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_04_04
    ADD CONSTRAINT messages_2026_04_04_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_04_05 messages_2026_04_05_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_04_05
    ADD CONSTRAINT messages_2026_04_05_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_04_06 messages_2026_04_06_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_04_06
    ADD CONSTRAINT messages_2026_04_06_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_04_07 messages_2026_04_07_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_04_07
    ADD CONSTRAINT messages_2026_04_07_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: iceberg_namespaces iceberg_namespaces_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_pkey PRIMARY KEY (id);


--
-- Name: iceberg_tables iceberg_tables_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: hooks hooks_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.hooks
    ADD CONSTRAINT hooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: supabase_functions; Owner: -
--

ALTER TABLE ONLY supabase_functions.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (version);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: extensions_tenant_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE INDEX extensions_tenant_external_id_index ON _realtime.extensions USING btree (tenant_external_id);


--
-- Name: extensions_tenant_external_id_type_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON _realtime.extensions USING btree (tenant_external_id, type);


--
-- Name: tenants_external_id_index; Type: INDEX; Schema: _realtime; Owner: -
--

CREATE UNIQUE INDEX tenants_external_id_index ON _realtime.tenants USING btree (external_id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: idx_applicants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applicants_user_id ON public.applicants USING btree (user_id);


--
-- Name: idx_application_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_status ON public.applications USING btree (status);


--
-- Name: idx_applications_applicant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_applicant_id ON public.applications USING btree (applicant_id);


--
-- Name: idx_applications_applicant_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_applicant_name_trgm ON public.applications USING gin (COALESCE((draft_state #>> '{data,contact,p1_name}'::text[]), ''::text) public.gin_trgm_ops);


--
-- Name: idx_applications_application_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_application_type ON public.applications USING btree (application_type);


--
-- Name: idx_applications_application_type_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_application_type_trgm ON public.applications USING gin (application_type public.gin_trgm_ops);


--
-- Name: idx_applications_draft_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_draft_state ON public.applications USING gin (draft_state);


--
-- Name: idx_applications_id_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_id_trgm ON public.applications USING gin (((id)::text) public.gin_trgm_ops);


--
-- Name: idx_applications_last_saved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_last_saved_at ON public.applications USING btree (last_saved_at DESC);


--
-- Name: idx_applications_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_organization_id ON public.applications USING btree (organization_id);


--
-- Name: idx_assets_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_application_id ON public.assets USING btree (application_id);


--
-- Name: idx_audit_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_application ON public.audit_logs USING btree (application_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_benefit_stack_results_generated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benefit_stack_results_generated ON public.benefit_stack_results USING btree (generated_at DESC);


--
-- Name: idx_benefit_stack_results_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benefit_stack_results_json ON public.benefit_stack_results USING gin (stack_data);


--
-- Name: idx_benefit_stack_results_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benefit_stack_results_profile ON public.benefit_stack_results USING btree (family_profile_id);


--
-- Name: idx_companies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_status ON public.companies USING btree (status);


--
-- Name: idx_document_extractions_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_extractions_document_id ON public.document_extractions USING btree (document_id);


--
-- Name: idx_document_pages_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_pages_document_id ON public.document_pages USING btree (document_id);


--
-- Name: idx_documents_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_application ON public.documents USING btree (application_id);


--
-- Name: idx_documents_application_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_application_status ON public.documents USING btree (application_id, document_status);


--
-- Name: idx_documents_file_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_file_path ON public.documents USING btree (file_path) WHERE (file_path IS NOT NULL);


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_status ON public.documents USING btree (document_status);


--
-- Name: idx_documents_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_uploaded_by ON public.documents USING btree (uploaded_by);


--
-- Name: idx_eligibility_screenings_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eligibility_screenings_application_id ON public.eligibility_screenings USING btree (application_id);


--
-- Name: idx_extraction_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extraction_json ON public.document_extractions USING gin (structured_output);


--
-- Name: idx_family_profiles_applicant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_profiles_applicant_id ON public.family_profiles USING btree (applicant_id);


--
-- Name: idx_family_profiles_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_profiles_updated ON public.family_profiles USING btree (updated_at DESC);


--
-- Name: idx_household_members_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_household_members_application_id ON public.household_members USING btree (application_id);


--
-- Name: idx_incomes_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incomes_application_id ON public.incomes USING btree (application_id);


--
-- Name: idx_incomes_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incomes_member_id ON public.incomes USING btree (member_id);


--
-- Name: idx_invitations_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_company_id ON public.invitations USING btree (company_id);


--
-- Name: idx_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_email ON public.invitations USING btree (email);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);


--
-- Name: idx_mobile_verify_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_verify_sessions_token ON public.mobile_verify_sessions USING btree (token);


--
-- Name: idx_mobile_verify_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mobile_verify_sessions_user ON public.mobile_verify_sessions USING btree (user_id, status);


--
-- Name: idx_policy_chunks_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_chunks_document_id ON public.policy_chunks USING btree (document_id);


--
-- Name: idx_policy_chunks_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_chunks_embedding ON public.policy_chunks USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='50');


--
-- Name: idx_review_actions_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_actions_application_id ON public.review_actions USING btree (application_id);


--
-- Name: idx_review_actions_reviewer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_actions_reviewer_id ON public.review_actions USING btree (reviewer_id);


--
-- Name: idx_rfis_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfis_application_id ON public.rfis USING btree (application_id);


--
-- Name: idx_rfis_requested_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rfis_requested_by ON public.rfis USING btree (requested_by);


--
-- Name: idx_session_msgs_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_msgs_session ON public.session_messages USING btree (session_id, created_at);


--
-- Name: idx_sessions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_patient ON public.collaborative_sessions USING btree (patient_user_id, status);


--
-- Name: idx_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_status ON public.collaborative_sessions USING btree (status);


--
-- Name: idx_sessions_sw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_sw ON public.collaborative_sessions USING btree (sw_user_id, status);


--
-- Name: idx_sw_access_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_access_active ON public.patient_social_worker_access USING btree (is_active);


--
-- Name: idx_sw_access_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_access_patient ON public.patient_social_worker_access USING btree (patient_user_id);


--
-- Name: idx_sw_access_sw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_access_sw ON public.patient_social_worker_access USING btree (social_worker_user_id);


--
-- Name: idx_sw_profiles_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_profiles_company ON public.social_worker_profiles USING btree (company_id);


--
-- Name: idx_sw_profiles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_profiles_name ON public.social_worker_profiles USING btree (last_name, first_name);


--
-- Name: idx_sw_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_profiles_status ON public.social_worker_profiles USING btree (status);


--
-- Name: idx_sw_profiles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sw_profiles_user ON public.social_worker_profiles USING btree (user_id);


--
-- Name: idx_user_profiles_applicant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_applicant_id ON public.user_profiles USING btree (applicant_id);


--
-- Name: idx_user_profiles_json; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_json ON public.user_profiles USING gin (profile_data);


--
-- Name: idx_user_profiles_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_updated ON public.user_profiles USING btree (updated_at DESC);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: idx_validation_application; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validation_application ON public.validation_results USING btree (application_id);


--
-- Name: notifications_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id) WHERE (read_at IS NULL);


--
-- Name: sw_direct_messages_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sw_direct_messages_sender_idx ON public.sw_direct_messages USING btree (sender_id, created_at DESC);


--
-- Name: sw_direct_messages_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sw_direct_messages_thread_idx ON public.sw_direct_messages USING btree (sw_user_id, patient_user_id, created_at DESC);


--
-- Name: sw_direct_messages_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sw_direct_messages_unread_idx ON public.sw_direct_messages USING btree (sw_user_id, patient_user_id) WHERE (read_at IS NULL);


--
-- Name: sw_engagement_requests_active_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sw_engagement_requests_active_uq ON public.sw_engagement_requests USING btree (patient_user_id, sw_user_id) WHERE (status = 'pending'::text);


--
-- Name: sw_engagement_requests_patient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sw_engagement_requests_patient_idx ON public.sw_engagement_requests USING btree (patient_user_id, created_at DESC);


--
-- Name: sw_engagement_requests_sw_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sw_engagement_requests_sw_idx ON public.sw_engagement_requests USING btree (sw_user_id, status, created_at DESC);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_04_01_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_04_01_inserted_at_topic_idx ON realtime.messages_2026_04_01 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_04_03_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_04_03_inserted_at_topic_idx ON realtime.messages_2026_04_03 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_04_04_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_04_04_inserted_at_topic_idx ON realtime.messages_2026_04_04 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_04_05_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_04_05_inserted_at_topic_idx ON realtime.messages_2026_04_05 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_04_06_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_04_06_inserted_at_topic_idx ON realtime.messages_2026_04_06 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_04_07_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_04_07_inserted_at_topic_idx ON realtime.messages_2026_04_07 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_iceberg_namespaces_bucket_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_namespaces_bucket_id ON storage.iceberg_namespaces USING btree (catalog_id, name);


--
-- Name: idx_iceberg_tables_location; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_location ON storage.iceberg_tables USING btree (location);


--
-- Name: idx_iceberg_tables_namespace_id; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_iceberg_tables_namespace_id ON storage.iceberg_tables USING btree (catalog_id, namespace_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: supabase_functions_hooks_h_table_id_h_name_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name);


--
-- Name: supabase_functions_hooks_request_id_idx; Type: INDEX; Schema: supabase_functions; Owner: -
--

CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id);


--
-- Name: messages_2026_04_01_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_04_01_inserted_at_topic_idx;


--
-- Name: messages_2026_04_01_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_04_01_pkey;


--
-- Name: messages_2026_04_03_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_04_03_inserted_at_topic_idx;


--
-- Name: messages_2026_04_03_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_04_03_pkey;


--
-- Name: messages_2026_04_04_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_04_04_inserted_at_topic_idx;


--
-- Name: messages_2026_04_04_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_04_04_pkey;


--
-- Name: messages_2026_04_05_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_04_05_inserted_at_topic_idx;


--
-- Name: messages_2026_04_05_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_04_05_pkey;


--
-- Name: messages_2026_04_06_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_04_06_inserted_at_topic_idx;


--
-- Name: messages_2026_04_06_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_04_06_pkey;


--
-- Name: messages_2026_04_07_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_04_07_inserted_at_topic_idx;


--
-- Name: messages_2026_04_07_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_04_07_pkey;


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


--
-- Name: family_profiles family_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER family_profiles_updated_at BEFORE UPDATE ON public.family_profiles FOR EACH ROW EXECUTE FUNCTION public.update_family_profile_updated_at();


--
-- Name: sw_engagement_requests sw_engagement_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sw_engagement_requests_updated_at BEFORE UPDATE ON public.sw_engagement_requests FOR EACH ROW EXECUTE FUNCTION public.set_sw_request_updated_at();


--
-- Name: collaborative_sessions trg_session_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_session_updated_at BEFORE UPDATE ON public.collaborative_sessions FOR EACH ROW EXECUTE FUNCTION public.set_session_updated_at();


--
-- Name: applications trg_touch_applications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.touch_applications_updated_at();


--
-- Name: user_profiles user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_user_profile_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: extensions extensions_tenant_external_id_fkey; Type: FK CONSTRAINT; Schema: _realtime; Owner: -
--

ALTER TABLE ONLY _realtime.extensions
    ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: applicants applicants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applicants
    ADD CONSTRAINT applicants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: applications applications_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id);


--
-- Name: applications applications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: assets assets_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_application_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_application_fk FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: benefit_stack_results benefit_stack_results_family_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benefit_stack_results
    ADD CONSTRAINT benefit_stack_results_family_profile_id_fkey FOREIGN KEY (family_profile_id) REFERENCES public.family_profiles(id) ON DELETE CASCADE;


--
-- Name: collaborative_sessions collaborative_sessions_ended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborative_sessions
    ADD CONSTRAINT collaborative_sessions_ended_by_fkey FOREIGN KEY (ended_by) REFERENCES auth.users(id);


--
-- Name: collaborative_sessions collaborative_sessions_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborative_sessions
    ADD CONSTRAINT collaborative_sessions_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: collaborative_sessions collaborative_sessions_sw_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collaborative_sessions
    ADD CONSTRAINT collaborative_sessions_sw_user_id_fkey FOREIGN KEY (sw_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: companies companies_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: document_extractions document_extractions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_extractions
    ADD CONSTRAINT document_extractions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_pages document_pages_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_pages
    ADD CONSTRAINT document_pages_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: eligibility_screenings eligibility_screenings_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eligibility_screenings
    ADD CONSTRAINT eligibility_screenings_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: family_profiles family_profiles_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_profiles
    ADD CONSTRAINT family_profiles_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: household_members household_members_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_members
    ADD CONSTRAINT household_members_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: incomes incomes_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: incomes incomes_member_application_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_member_application_fk FOREIGN KEY (member_id, application_id) REFERENCES public.household_members(id, application_id) ON DELETE CASCADE;


--
-- Name: incomes incomes_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incomes
    ADD CONSTRAINT incomes_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.household_members(id);


--
-- Name: invitations invitations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: mobile_verify_sessions mobile_verify_sessions_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_verify_sessions
    ADD CONSTRAINT mobile_verify_sessions_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: mobile_verify_sessions mobile_verify_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_verify_sessions
    ADD CONSTRAINT mobile_verify_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: patient_social_worker_access patient_social_worker_access_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_social_worker_access
    ADD CONSTRAINT patient_social_worker_access_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_social_worker_access patient_social_worker_access_social_worker_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_social_worker_access
    ADD CONSTRAINT patient_social_worker_access_social_worker_user_id_fkey FOREIGN KEY (social_worker_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: policy_chunks policy_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_chunks
    ADD CONSTRAINT policy_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.policy_documents(id) ON DELETE CASCADE;


--
-- Name: review_actions review_actions_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_actions
    ADD CONSTRAINT review_actions_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);


--
-- Name: review_actions review_actions_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_actions
    ADD CONSTRAINT review_actions_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: rfis rfis_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id);


--
-- Name: rfis rfis_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfis
    ADD CONSTRAINT rfis_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: session_messages session_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_messages
    ADD CONSTRAINT session_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_messages session_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_messages
    ADD CONSTRAINT session_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.collaborative_sessions(id) ON DELETE CASCADE;


--
-- Name: social_worker_profiles social_worker_profiles_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_worker_profiles
    ADD CONSTRAINT social_worker_profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: social_worker_profiles social_worker_profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_worker_profiles
    ADD CONSTRAINT social_worker_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: social_worker_profiles social_worker_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_worker_profiles
    ADD CONSTRAINT social_worker_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sw_direct_messages sw_direct_messages_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_direct_messages
    ADD CONSTRAINT sw_direct_messages_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sw_direct_messages sw_direct_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_direct_messages
    ADD CONSTRAINT sw_direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sw_direct_messages sw_direct_messages_sw_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_direct_messages
    ADD CONSTRAINT sw_direct_messages_sw_user_id_fkey FOREIGN KEY (sw_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sw_engagement_requests sw_engagement_requests_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_engagement_requests
    ADD CONSTRAINT sw_engagement_requests_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sw_engagement_requests sw_engagement_requests_sw_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sw_engagement_requests
    ADD CONSTRAINT sw_engagement_requests_sw_user_id_fkey FOREIGN KEY (sw_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_applicant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.applicants(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: validation_results validation_results_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_results
    ADD CONSTRAINT validation_results_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: iceberg_namespaces iceberg_namespaces_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_namespaces
    ADD CONSTRAINT iceberg_namespaces_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_catalog_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE;


--
-- Name: iceberg_tables iceberg_tables_namespace_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.iceberg_tables
    ADD CONSTRAINT iceberg_tables_namespace_id_fkey FOREIGN KEY (namespace_id) REFERENCES storage.iceberg_namespaces(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: sw_direct_messages DM participants can mark read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can mark read" ON public.sw_direct_messages FOR UPDATE USING (((sw_user_id = auth.uid()) OR (patient_user_id = auth.uid())));


--
-- Name: sw_direct_messages DM participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can send messages" ON public.sw_direct_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND ((sw_user_id = auth.uid()) OR (patient_user_id = auth.uid())) AND (EXISTS ( SELECT 1
   FROM public.patient_social_worker_access psa
  WHERE ((psa.patient_user_id = sw_direct_messages.patient_user_id) AND (psa.social_worker_user_id = sw_direct_messages.sw_user_id) AND (psa.is_active = true))))));


--
-- Name: sw_direct_messages DM participants can view messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "DM participants can view messages" ON public.sw_direct_messages FOR SELECT USING (((sw_user_id = auth.uid()) OR (patient_user_id = auth.uid())));


--
-- Name: sw_engagement_requests Patients cancel own pending requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients cancel own pending requests" ON public.sw_engagement_requests FOR UPDATE USING (((patient_user_id = auth.uid()) AND (status = 'pending'::text)));


--
-- Name: sw_engagement_requests Patients create engagement requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients create engagement requests" ON public.sw_engagement_requests FOR INSERT WITH CHECK ((patient_user_id = auth.uid()));


--
-- Name: sw_engagement_requests Patients see own engagement requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients see own engagement requests" ON public.sw_engagement_requests FOR SELECT USING ((patient_user_id = auth.uid()));


--
-- Name: sw_engagement_requests SWs respond to pending requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SWs respond to pending requests" ON public.sw_engagement_requests FOR UPDATE USING (((sw_user_id = auth.uid()) AND (status = 'pending'::text)));


--
-- Name: sw_engagement_requests SWs see requests for them; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SWs see requests for them" ON public.sw_engagement_requests FOR SELECT USING ((sw_user_id = auth.uid()));


--
-- Name: invitations admins_manage_invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_manage_invitations ON public.invitations USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: applicants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

--
-- Name: applicants applicants_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applicants_insert ON public.applicants FOR INSERT TO authenticated WITH CHECK (public.can_access_user(user_id));


--
-- Name: applicants applicants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applicants_select ON public.applicants FOR SELECT TO authenticated USING (public.can_access_user(user_id));


--
-- Name: applicants applicants_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applicants_update ON public.applicants FOR UPDATE TO authenticated USING (public.can_access_user(user_id)) WITH CHECK (public.can_access_user(user_id));


--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: applications applications_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applications_delete ON public.applications FOR DELETE TO authenticated USING (public.can_access_application(id));


--
-- Name: applications applications_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applications_insert ON public.applications FOR INSERT TO authenticated WITH CHECK (public.can_access_applicant(applicant_id));


--
-- Name: applications applications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated USING (public.can_access_application(id));


--
-- Name: applications applications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY applications_update ON public.applications FOR UPDATE TO authenticated USING (public.can_access_application(id)) WITH CHECK (public.can_access_applicant(applicant_id));


--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: assets assets_owner_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assets_owner_rw ON public.assets TO authenticated USING (public.can_access_application(application_id)) WITH CHECK (public.can_access_application(application_id));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated USING (public.can_access_user(user_id));


--
-- Name: audit_logs audit_logs_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_write_staff ON public.audit_logs TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: benefit_stack_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.benefit_stack_results ENABLE ROW LEVEL SECURITY;

--
-- Name: benefit_stack_results benefit_stack_results_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY benefit_stack_results_owner_insert ON public.benefit_stack_results FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.family_profiles fp
  WHERE ((fp.id = benefit_stack_results.family_profile_id) AND public.can_access_applicant(fp.applicant_id)))));


--
-- Name: benefit_stack_results benefit_stack_results_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY benefit_stack_results_owner_select ON public.benefit_stack_results FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.family_profiles fp
  WHERE ((fp.id = benefit_stack_results.family_profile_id) AND public.can_access_applicant(fp.applicant_id)))));


--
-- Name: benefit_stack_results benefit_stack_results_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY benefit_stack_results_staff_all ON public.benefit_stack_results TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: collaborative_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies_select_approved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_select_approved ON public.companies FOR SELECT TO authenticated USING (((status = 'approved'::text) OR public.is_staff()));


--
-- Name: companies companies_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_write_staff ON public.companies TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: document_extractions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

--
-- Name: document_extractions document_extractions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_extractions_select ON public.document_extractions FOR SELECT TO authenticated USING (public.can_access_document(document_id));


--
-- Name: document_extractions document_extractions_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_extractions_write_staff ON public.document_extractions TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: document_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: document_pages document_pages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_pages_select ON public.document_pages FOR SELECT TO authenticated USING (public.can_access_document(document_id));


--
-- Name: document_pages document_pages_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY document_pages_write_staff ON public.document_pages TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated USING (public.can_access_application(application_id));


--
-- Name: documents documents_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK ((public.can_access_application(application_id) AND ((uploaded_by IS NULL) OR public.can_access_user(uploaded_by))));


--
-- Name: documents documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated USING (public.can_access_application(application_id));


--
-- Name: documents documents_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated USING (public.can_access_application(application_id)) WITH CHECK ((public.can_access_application(application_id) AND ((uploaded_by IS NULL) OR public.can_access_user(uploaded_by))));


--
-- Name: eligibility_screenings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eligibility_screenings ENABLE ROW LEVEL SECURITY;

--
-- Name: eligibility_screenings eligibility_screenings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eligibility_screenings_select ON public.eligibility_screenings FOR SELECT TO authenticated USING (public.can_access_application(application_id));


--
-- Name: eligibility_screenings eligibility_screenings_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eligibility_screenings_write_staff ON public.eligibility_screenings TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: family_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: family_profiles family_profiles_owner_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY family_profiles_owner_rw ON public.family_profiles TO authenticated USING (public.can_access_applicant(applicant_id)) WITH CHECK (public.can_access_applicant(applicant_id));


--
-- Name: household_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

--
-- Name: household_members household_members_owner_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY household_members_owner_rw ON public.household_members TO authenticated USING (public.can_access_application(application_id)) WITH CHECK (public.can_access_application(application_id));


--
-- Name: incomes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

--
-- Name: incomes incomes_owner_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incomes_owner_rw ON public.incomes TO authenticated USING (public.can_access_application(application_id)) WITH CHECK (public.can_access_application(application_id));


--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: mobile_verify_sessions mobile_sessions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mobile_sessions_owner ON public.mobile_verify_sessions USING ((user_id = auth.uid()));


--
-- Name: mobile_verify_sessions mobile_sessions_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mobile_sessions_staff ON public.mobile_verify_sessions USING (public.is_staff());


--
-- Name: mobile_verify_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mobile_verify_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated USING (public.can_access_organization(id));


--
-- Name: organizations organizations_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_write_staff ON public.organizations TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: patient_social_worker_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_social_worker_access ENABLE ROW LEVEL SECURITY;

--
-- Name: policy_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: policy_chunks policy_chunks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY policy_chunks_read ON public.policy_chunks FOR SELECT TO authenticated USING (true);


--
-- Name: policy_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: policy_documents policy_documents_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY policy_documents_read ON public.policy_documents FOR SELECT TO authenticated USING (true);


--
-- Name: review_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: review_actions review_actions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY review_actions_select ON public.review_actions FOR SELECT TO authenticated USING (public.can_access_application(application_id));


--
-- Name: review_actions review_actions_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY review_actions_write_staff ON public.review_actions TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: rfis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;

--
-- Name: rfis rfis_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rfis_select ON public.rfis FOR SELECT TO authenticated USING (public.can_access_application(application_id));


--
-- Name: rfis rfis_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rfis_write_staff ON public.rfis TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated USING (true);


--
-- Name: session_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: session_messages session_msgs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_msgs_insert ON public.session_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = public.request_user_id()) AND (EXISTS ( SELECT 1
   FROM public.collaborative_sessions s
  WHERE ((s.id = session_messages.session_id) AND (s.status = 'active'::text) AND ((s.sw_user_id = public.request_user_id()) OR (s.patient_user_id = public.request_user_id())))))));


--
-- Name: session_messages session_msgs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_msgs_select ON public.session_messages FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.collaborative_sessions s
  WHERE ((s.id = session_messages.session_id) AND ((s.sw_user_id = public.request_user_id()) OR (s.patient_user_id = public.request_user_id()))))) OR public.is_staff()));


--
-- Name: collaborative_sessions sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_insert ON public.collaborative_sessions FOR INSERT TO authenticated WITH CHECK (((sw_user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: collaborative_sessions sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_select ON public.collaborative_sessions FOR SELECT TO authenticated USING (((sw_user_id = public.request_user_id()) OR (patient_user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: collaborative_sessions sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_update ON public.collaborative_sessions FOR UPDATE TO authenticated USING (((sw_user_id = public.request_user_id()) OR (patient_user_id = public.request_user_id()) OR public.is_staff())) WITH CHECK (((sw_user_id = public.request_user_id()) OR (patient_user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: social_worker_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_worker_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_social_worker_access sw_access_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sw_access_insert ON public.patient_social_worker_access FOR INSERT TO authenticated WITH CHECK (((patient_user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: patient_social_worker_access sw_access_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sw_access_select ON public.patient_social_worker_access FOR SELECT TO authenticated USING (((patient_user_id = public.request_user_id()) OR (social_worker_user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: patient_social_worker_access sw_access_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sw_access_update ON public.patient_social_worker_access FOR UPDATE TO authenticated USING (((patient_user_id = public.request_user_id()) OR public.is_staff())) WITH CHECK (((patient_user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: sw_direct_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sw_direct_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: sw_engagement_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sw_engagement_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: social_worker_profiles sw_profiles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sw_profiles_insert ON public.social_worker_profiles FOR INSERT TO authenticated WITH CHECK (((user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: social_worker_profiles sw_profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sw_profiles_select ON public.social_worker_profiles FOR SELECT TO authenticated USING (((user_id = public.request_user_id()) OR public.is_staff()));


--
-- Name: social_worker_profiles sw_profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sw_profiles_update ON public.social_worker_profiles FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles user_profiles_owner_rw; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_owner_rw ON public.user_profiles TO authenticated USING (public.can_access_applicant(applicant_id)) WITH CHECK (public.can_access_applicant(applicant_id));


--
-- Name: user_profiles user_profiles_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_staff_all ON public.user_profiles TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (public.can_access_user(user_id));


--
-- Name: user_roles user_roles_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_write_staff ON public.user_roles TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications users see own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users see own notifications" ON public.notifications USING ((auth.uid() = user_id));


--
-- Name: users users_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select ON public.users FOR SELECT TO authenticated USING (public.can_access_user(id));


--
-- Name: users users_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated USING (public.can_access_user(id)) WITH CHECK (public.can_access_user(id));


--
-- Name: validation_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;

--
-- Name: validation_results validation_results_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY validation_results_select ON public.validation_results FOR SELECT TO authenticated USING (public.can_access_application(application_id));


--
-- Name: validation_results validation_results_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY validation_results_write_staff ON public.validation_results TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_namespaces; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_namespaces ENABLE ROW LEVEL SECURITY;

--
-- Name: iceberg_tables; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.iceberg_tables ENABLE ROW LEVEL SECURITY;

--
-- Name: objects masshealth_dev_delete_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY masshealth_dev_delete_own ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'masshealth-dev'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects masshealth_dev_read_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY masshealth_dev_read_own ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'masshealth-dev'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: objects masshealth_dev_staff_all; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY masshealth_dev_staff_all ON storage.objects TO authenticated USING (((bucket_id = 'masshealth-dev'::text) AND public.is_staff())) WITH CHECK (((bucket_id = 'masshealth-dev'::text) AND public.is_staff()));


--
-- Name: objects masshealth_dev_upload_own; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY masshealth_dev_upload_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'masshealth-dev'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict ByBuewBCggH5bXLiellggSymJIMUzLDZnLtn617s9xiTht9IMSuEmgtaZyCs3dc

