--
-- PostgreSQL database dump
--

\restrict 0LRXEvsgFfXZBoJ2Sr3BhaaUeQsGeRqZrKaBcjq14zyWwCkWtl0JVvJhQaDztoa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

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
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE auth.audit_log_entries DISABLE TRIGGER ALL;



ALTER TABLE auth.audit_log_entries ENABLE TRIGGER ALL;

--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state DISABLE TRIGGER ALL;



ALTER TABLE auth.flow_state ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.users DISABLE TRIGGER ALL;



ALTER TABLE auth.users ENABLE TRIGGER ALL;

--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.identities DISABLE TRIGGER ALL;



ALTER TABLE auth.identities ENABLE TRIGGER ALL;

--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.instances DISABLE TRIGGER ALL;



ALTER TABLE auth.instances ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_clients DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_clients ENABLE TRIGGER ALL;

--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions DISABLE TRIGGER ALL;



ALTER TABLE auth.sessions ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims DISABLE TRIGGER ALL;



ALTER TABLE auth.mfa_amr_claims ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors DISABLE TRIGGER ALL;



ALTER TABLE auth.mfa_factors ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges DISABLE TRIGGER ALL;



ALTER TABLE auth.mfa_challenges ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_authorizations DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_authorizations ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_client_states DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_client_states ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_consents DISABLE TRIGGER ALL;



ALTER TABLE auth.oauth_consents ENABLE TRIGGER ALL;

--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens DISABLE TRIGGER ALL;



ALTER TABLE auth.one_time_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens DISABLE TRIGGER ALL;



ALTER TABLE auth.refresh_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers DISABLE TRIGGER ALL;



ALTER TABLE auth.sso_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers DISABLE TRIGGER ALL;



ALTER TABLE auth.saml_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states DISABLE TRIGGER ALL;



ALTER TABLE auth.saml_relay_states ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations DISABLE TRIGGER ALL;

INSERT INTO auth.schema_migrations (version) VALUES ('20171026211738');
INSERT INTO auth.schema_migrations (version) VALUES ('20171026211808');
INSERT INTO auth.schema_migrations (version) VALUES ('20171026211834');
INSERT INTO auth.schema_migrations (version) VALUES ('20180103212743');
INSERT INTO auth.schema_migrations (version) VALUES ('20180108183307');
INSERT INTO auth.schema_migrations (version) VALUES ('20180119214651');
INSERT INTO auth.schema_migrations (version) VALUES ('20180125194653');
INSERT INTO auth.schema_migrations (version) VALUES ('00');
INSERT INTO auth.schema_migrations (version) VALUES ('20210710035447');
INSERT INTO auth.schema_migrations (version) VALUES ('20210722035447');
INSERT INTO auth.schema_migrations (version) VALUES ('20210730183235');
INSERT INTO auth.schema_migrations (version) VALUES ('20210909172000');
INSERT INTO auth.schema_migrations (version) VALUES ('20210927181326');
INSERT INTO auth.schema_migrations (version) VALUES ('20211122151130');
INSERT INTO auth.schema_migrations (version) VALUES ('20211124214934');
INSERT INTO auth.schema_migrations (version) VALUES ('20211202183645');
INSERT INTO auth.schema_migrations (version) VALUES ('20220114185221');
INSERT INTO auth.schema_migrations (version) VALUES ('20220114185340');
INSERT INTO auth.schema_migrations (version) VALUES ('20220224000811');
INSERT INTO auth.schema_migrations (version) VALUES ('20220323170000');
INSERT INTO auth.schema_migrations (version) VALUES ('20220429102000');
INSERT INTO auth.schema_migrations (version) VALUES ('20220531120530');
INSERT INTO auth.schema_migrations (version) VALUES ('20220614074223');
INSERT INTO auth.schema_migrations (version) VALUES ('20220811173540');
INSERT INTO auth.schema_migrations (version) VALUES ('20221003041349');
INSERT INTO auth.schema_migrations (version) VALUES ('20221003041400');
INSERT INTO auth.schema_migrations (version) VALUES ('20221011041400');
INSERT INTO auth.schema_migrations (version) VALUES ('20221020193600');
INSERT INTO auth.schema_migrations (version) VALUES ('20221021073300');
INSERT INTO auth.schema_migrations (version) VALUES ('20221021082433');
INSERT INTO auth.schema_migrations (version) VALUES ('20221027105023');
INSERT INTO auth.schema_migrations (version) VALUES ('20221114143122');
INSERT INTO auth.schema_migrations (version) VALUES ('20221114143410');
INSERT INTO auth.schema_migrations (version) VALUES ('20221125140132');
INSERT INTO auth.schema_migrations (version) VALUES ('20221208132122');
INSERT INTO auth.schema_migrations (version) VALUES ('20221215195500');
INSERT INTO auth.schema_migrations (version) VALUES ('20221215195800');
INSERT INTO auth.schema_migrations (version) VALUES ('20221215195900');
INSERT INTO auth.schema_migrations (version) VALUES ('20230116124310');
INSERT INTO auth.schema_migrations (version) VALUES ('20230116124412');
INSERT INTO auth.schema_migrations (version) VALUES ('20230131181311');
INSERT INTO auth.schema_migrations (version) VALUES ('20230322519590');
INSERT INTO auth.schema_migrations (version) VALUES ('20230402418590');
INSERT INTO auth.schema_migrations (version) VALUES ('20230411005111');
INSERT INTO auth.schema_migrations (version) VALUES ('20230508135423');
INSERT INTO auth.schema_migrations (version) VALUES ('20230523124323');
INSERT INTO auth.schema_migrations (version) VALUES ('20230818113222');
INSERT INTO auth.schema_migrations (version) VALUES ('20230914180801');
INSERT INTO auth.schema_migrations (version) VALUES ('20231027141322');
INSERT INTO auth.schema_migrations (version) VALUES ('20231114161723');
INSERT INTO auth.schema_migrations (version) VALUES ('20231117164230');
INSERT INTO auth.schema_migrations (version) VALUES ('20240115144230');
INSERT INTO auth.schema_migrations (version) VALUES ('20240214120130');
INSERT INTO auth.schema_migrations (version) VALUES ('20240306115329');
INSERT INTO auth.schema_migrations (version) VALUES ('20240314092811');
INSERT INTO auth.schema_migrations (version) VALUES ('20240427152123');
INSERT INTO auth.schema_migrations (version) VALUES ('20240612123726');
INSERT INTO auth.schema_migrations (version) VALUES ('20240729123726');
INSERT INTO auth.schema_migrations (version) VALUES ('20240802193726');
INSERT INTO auth.schema_migrations (version) VALUES ('20240806073726');
INSERT INTO auth.schema_migrations (version) VALUES ('20241009103726');
INSERT INTO auth.schema_migrations (version) VALUES ('20250717082212');
INSERT INTO auth.schema_migrations (version) VALUES ('20250731150234');
INSERT INTO auth.schema_migrations (version) VALUES ('20250804100000');
INSERT INTO auth.schema_migrations (version) VALUES ('20250901200500');
INSERT INTO auth.schema_migrations (version) VALUES ('20250903112500');
INSERT INTO auth.schema_migrations (version) VALUES ('20250904133000');
INSERT INTO auth.schema_migrations (version) VALUES ('20250925093508');
INSERT INTO auth.schema_migrations (version) VALUES ('20251007112900');
INSERT INTO auth.schema_migrations (version) VALUES ('20251104100000');
INSERT INTO auth.schema_migrations (version) VALUES ('20251111201300');
INSERT INTO auth.schema_migrations (version) VALUES ('20251201000000');


ALTER TABLE auth.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains DISABLE TRIGGER ALL;



ALTER TABLE auth.sso_domains ENABLE TRIGGER ALL;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public._prisma_migrations DISABLE TRIGGER ALL;

INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('e7e47c62-39b7-40df-b57c-e1820e758538', '8e747d966b2b3713edfdee1fce76a30574b51afe92f7d183a112fbb1f9ee9fe4', '2026-01-15 18:27:40.667808+00', '20260106232205_init', NULL, NULL, '2026-01-15 18:27:40.57571+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('00f977ac-228a-4e13-b8f3-af44123d9842', 'af1f6d8b1e3a31e5d33e3b44c2c0a54e9bbe75008ea919da43a4efb11ef731a5', '2026-01-15 18:27:40.692982+00', '20260107180249_add_account_members', NULL, NULL, '2026-01-15 18:27:40.672449+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('b420a913-b488-41a7-9236-f8bd31c95ec8', 'fc230ec3bc8a35dbd005658647ca30a46d84e41e34f5ef1b2e95b75710b9cbe5', '2026-01-15 18:27:40.727083+00', '20260107185128_add_account_invitations', NULL, NULL, '2026-01-15 18:27:40.698023+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('1b0ea1b9-6d86-4ffd-89b2-255e27e34b24', '2123263b7c35f3388c38a3ed7a4069b4d6a2a017439ad2282594808d8e482ce4', '2026-01-15 18:27:40.74191+00', '20260109200608_', NULL, NULL, '2026-01-15 18:27:40.731161+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('7627989e-2ba4-4d9e-995d-7e8a108b7d02', 'c15d529d88bff5a9ef81ac8e4fb1e5cb5cbb112e8fb8beb79a4e19d7be8e0852', '2026-01-15 18:27:40.94354+00', '20260111203442_change_category_from_user_to_account', NULL, NULL, '2026-01-15 18:27:40.745938+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('52382f75-8258-4908-bd92-a3166794fc96', '121a7208bde4559234d288fea4ff2cbc4fd9e09be8794af94bcb8bf102441afd', '2026-01-19 22:10:13.676539+00', '20260119144005_add_calendar_indexes', NULL, NULL, '2026-01-19 22:10:13.540939+00', 1);


ALTER TABLE public._prisma_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.users DISABLE TRIGGER ALL;

INSERT INTO public.users (id, email, password_hash, full_name, created_at, updated_at, last_login, is_active, email_verified) VALUES ('f31568aa-a87b-489b-9259-48bb2b67fca9', '1g0r.guari@gmai.com', '$2a$12$JXylRvqxMB11wKPKgcByi.X4u6KIeb3NlQ3Ra6fL6mzX.90Acolli', 'Igor Guariroba', '2026-01-16 15:39:10.344', '2026-01-16 15:39:10.531', '2026-01-16 15:39:10.528', true, false);
INSERT INTO public.users (id, email, password_hash, full_name, created_at, updated_at, last_login, is_active, email_verified) VALUES ('b0d5734d-461c-4b5e-befc-ae4743c0d48b', '1g0r.guari@gmail.com', '$2a$12$Sv43Ge1QO6CkH2xZGVZHxuU6F7yMPJVG1WH3py//ERM/E6oXHeGr.', 'Igor Guariroba', '2026-01-17 17:20:04.236', '2026-01-21 01:35:22.329', '2026-01-21 01:35:22.328', true, false);


ALTER TABLE public.users ENABLE TRIGGER ALL;

--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.accounts DISABLE TRIGGER ALL;

INSERT INTO public.accounts (id, user_id, account_name, account_type, total_balance, available_balance, locked_balance, emergency_reserve, currency, is_default, created_at, updated_at) VALUES ('6e178084-a722-4d5b-9fd1-0b845c6f7b9b', 'f31568aa-a87b-489b-9259-48bb2b67fca9', 'Conta Principal', 'checking', 0.00, 0.00, 0.00, 0.00, 'BRL', true, '2026-01-16 15:39:10.446', '2026-01-16 15:39:10.446');
INSERT INTO public.accounts (id, user_id, account_name, account_type, total_balance, available_balance, locked_balance, emergency_reserve, currency, is_default, created_at, updated_at) VALUES ('421c933e-cb72-44b6-83a6-46502f66ad02', 'b0d5734d-461c-4b5e-befc-ae4743c0d48b', 'Conta Principal', 'checking', 4578.66, 973.81, 364.85, 3240.00, 'BRL', true, '2026-01-17 17:20:04.325', '2026-01-21 01:42:38.567');


ALTER TABLE public.accounts ENABLE TRIGGER ALL;

--
-- Data for Name: account_invitations; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.account_invitations DISABLE TRIGGER ALL;



ALTER TABLE public.account_invitations ENABLE TRIGGER ALL;

--
-- Data for Name: account_members; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.account_members DISABLE TRIGGER ALL;

INSERT INTO public.account_members (id, account_id, user_id, role, created_at, updated_at) VALUES ('479d033a-222b-4e39-b038-ef9cb309dd85', '6e178084-a722-4d5b-9fd1-0b845c6f7b9b', 'f31568aa-a87b-489b-9259-48bb2b67fca9', 'owner', '2026-01-16 15:39:10.461', '2026-01-16 15:39:10.461');
INSERT INTO public.account_members (id, account_id, user_id, role, created_at, updated_at) VALUES ('949c1f9f-8e5f-4d9a-a81b-aea03b5add8a', '421c933e-cb72-44b6-83a6-46502f66ad02', 'b0d5734d-461c-4b5e-befc-ae4743c0d48b', 'owner', '2026-01-17 17:20:04.341', '2026-01-17 17:20:04.341');


ALTER TABLE public.account_members ENABLE TRIGGER ALL;

--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.categories DISABLE TRIGGER ALL;

INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('3a68b98d-f662-4ffd-afbc-8a11d772b2d6', 'Salário', 'income', NULL, NULL, false, '2026-01-19 11:55:00.342', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('db9dcbe7-6114-48e7-8dba-062fa8105bef', 'Alimentação', 'expense', NULL, NULL, false, '2026-01-20 01:30:18.045', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('bb277b06-09cd-4c0b-ad44-2c3415d6ffd6', 'Transporte', 'expense', NULL, NULL, false, '2026-01-20 01:32:17.591', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('95626910-3754-4c06-b828-21df11aeec57', 'Emprestimo', 'expense', NULL, NULL, false, '2026-01-20 01:33:46.244', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('5fa3a04a-03c1-4537-a4b0-dfbb48b6ac70', 'Hobbies', 'expense', NULL, NULL, false, '2026-01-20 01:40:21.64', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('dfb84e6a-7990-4912-9a00-dcb45af96463', 'Trabalho', 'expense', NULL, NULL, false, '2026-01-20 01:43:09.534', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('98a540c9-80b1-487e-8917-0bd5d921c059', 'Família', 'expense', NULL, NULL, false, '2026-01-20 02:18:07.997', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('93c1a5b7-d75a-4b53-af20-8ff3d500808f', 'Moradia', 'expense', NULL, NULL, false, '2026-01-20 14:32:17.104', '421c933e-cb72-44b6-83a6-46502f66ad02');
INSERT INTO public.categories (id, name, type, color, icon, is_system, created_at, account_id) VALUES ('e9ba459a-e84c-4aeb-a0b3-367813f9aed2', 'Saúde ', 'expense', NULL, NULL, false, '2026-01-21 01:35:51.799', '421c933e-cb72-44b6-83a6-46502f66ad02');


ALTER TABLE public.categories ENABLE TRIGGER ALL;

--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.transactions DISABLE TRIGGER ALL;

INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('b7d172ed-c44d-439a-86c9-7beb489a6559', '421c933e-cb72-44b6-83a6-46502f66ad02', '3a68b98d-f662-4ffd-afbc-8a11d772b2d6', 'income', 10000.00, 'Movida', '2026-01-19 13:10:00', '2026-01-19 13:10:29.872', '2026-01-19 13:10:29.875', '2026-01-19 13:10:29.875', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('e898a34f-8e87-4f3e-a1c9-80d950874397', '421c933e-cb72-44b6-83a6-46502f66ad02', 'db9dcbe7-6114-48e7-8dba-062fa8105bef', 'variable_expense', 800.00, 'Supermercado Assaí ', '2026-01-20 01:31:04.536', '2026-01-20 01:31:04.536', '2026-01-20 01:31:04.537', '2026-01-20 01:31:04.537', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('d4f1a101-c697-4abf-a922-3a4b2d2644cd', '421c933e-cb72-44b6-83a6-46502f66ad02', 'bb277b06-09cd-4c0b-ad44-2c3415d6ffd6', 'variable_expense', 250.00, 'Gasolina', '2026-01-20 01:32:20.132', '2026-01-20 01:32:20.132', '2026-01-20 01:32:20.133', '2026-01-20 01:32:20.133', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('6557f5bd-13f6-4d3f-8ee4-66223315507b', '421c933e-cb72-44b6-83a6-46502f66ad02', '95626910-3754-4c06-b828-21df11aeec57', 'variable_expense', 547.47, 'Klubi', '2026-01-20 01:33:48.55', '2026-01-20 01:33:48.55', '2026-01-20 01:33:48.551', '2026-01-20 01:33:48.551', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('3977c1a6-11ed-4862-8cb2-56d3624c1374', '421c933e-cb72-44b6-83a6-46502f66ad02', 'db9dcbe7-6114-48e7-8dba-062fa8105bef', 'variable_expense', 32.73, 'Padaria', '2026-01-20 01:34:26.875', '2026-01-20 01:34:26.875', '2026-01-20 01:34:26.875', '2026-01-20 01:34:26.875', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('2be829fd-379c-4f7f-812c-fcba7439a35a', '421c933e-cb72-44b6-83a6-46502f66ad02', 'db9dcbe7-6114-48e7-8dba-062fa8105bef', 'variable_expense', 379.92, 'Supermercado Shibata', '2026-01-20 01:35:10.079', '2026-01-20 01:35:10.079', '2026-01-20 01:35:10.08', '2026-01-20 01:35:10.08', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('ddfc186a-e621-4f4f-9d7c-ca8192f19c99', '421c933e-cb72-44b6-83a6-46502f66ad02', '5fa3a04a-03c1-4537-a4b0-dfbb48b6ac70', 'variable_expense', 599.99, 'smartwatch xiaomi redmi watch 5', '2026-01-20 01:40:28.696', '2026-01-20 01:40:28.696', '2026-01-20 01:40:28.697', '2026-01-20 01:40:28.697', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('7ab96b7a-a6cd-4288-bf7f-c3f8cb11fe33', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 60.53, 'PhpStorm da JetBrains', '2026-01-20 01:43:12.064', '2026-01-20 01:43:12.064', '2026-01-20 01:43:12.065', '2026-01-20 01:43:12.065', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('f29afae3-ec02-45a9-943d-c27fef551a61', '421c933e-cb72-44b6-83a6-46502f66ad02', '98a540c9-80b1-487e-8917-0bd5d921c059', 'variable_expense', 379.80, 'Huggies Fralda 320 uni', '2026-01-20 02:18:56.943', '2026-01-20 02:18:56.943', '2026-01-20 02:18:56.944', '2026-01-20 02:18:56.944', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('e142da29-4640-4032-9a0d-3fbd5681e44e', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 177.00, 'Contabilidade Contador direto', '2026-01-20 12:28:52.912', '2026-01-20 12:28:52.912', '2026-01-20 12:28:52.915', '2026-01-20 12:28:52.915', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('b24c032a-57e5-4439-a358-04289674cc99', '421c933e-cb72-44b6-83a6-46502f66ad02', '3a68b98d-f662-4ffd-afbc-8a11d772b2d6', 'income', 800.00, 'Vale - Ana', '2026-01-20 14:18:00', '2026-01-20 14:18:35.658', '2026-01-20 14:18:35.662', '2026-01-20 14:18:35.662', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('99f68fb1-5e4a-4b00-b08c-df54fa126ed4', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 142.45, 'Vivo celular/wifi', '2026-01-20 14:21:41.853', '2026-01-20 14:21:41.853', '2026-01-20 14:21:41.855', '2026-01-20 14:21:41.855', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('7b5ee06e-0f2b-4012-bd8d-be42c5e56d9b', '421c933e-cb72-44b6-83a6-46502f66ad02', '98a540c9-80b1-487e-8917-0bd5d921c059', 'variable_expense', 48.97, 'Vivo - Ana', '2026-01-20 14:30:10.965', '2026-01-20 14:30:10.965', '2026-01-20 14:30:10.966', '2026-01-20 14:30:10.966', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('77d83667-8c30-4c22-bcb4-a61a601ce002', '421c933e-cb72-44b6-83a6-46502f66ad02', '93c1a5b7-d75a-4b53-af20-8ff3d500808f', 'variable_expense', 272.81, 'EDP', '2026-01-20 14:32:24.027', '2026-01-20 14:32:24.027', '2026-01-20 14:32:24.029', '2026-01-20 14:32:24.029', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('fa9e07ae-b201-4ec7-8112-25ace8cf8eb2', '421c933e-cb72-44b6-83a6-46502f66ad02', '95626910-3754-4c06-b828-21df11aeec57', 'variable_expense', 50.00, 'Larissa', '2026-01-20 14:33:34.208', '2026-01-20 14:33:34.208', '2026-01-20 14:33:34.209', '2026-01-20 14:33:34.209', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('60f1bb16-21af-47e6-8d8c-dc3aec303fdb', '421c933e-cb72-44b6-83a6-46502f66ad02', '5fa3a04a-03c1-4537-a4b0-dfbb48b6ac70', 'variable_expense', 100.00, 'Sonia Avon', '2026-01-20 14:35:24.538', '2026-01-20 14:35:24.538', '2026-01-20 14:35:24.539', '2026-01-20 14:35:24.539', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('adb27ffd-f841-4822-b369-3c73558632d9', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'fixed_expense', 364.85, 'Parcela DAS', '2026-01-21 01:19:00', NULL, '2026-01-21 01:19:36.852', '2026-01-21 01:19:36.852', 'locked', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('6bd25923-473b-47bd-ac72-308deb2598e8', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 501.56, '1/12 parcela DARF INSS', '2026-01-21 01:23:08.106', '2026-01-21 01:23:08.106', '2026-01-21 01:23:08.107', '2026-01-21 01:23:08.107', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('7e83a72c-c545-408f-bf60-b70f421d27e4', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 291.00, 'Taxa de serviço da contabilidade', '2026-01-21 01:25:47.223', '2026-01-21 01:25:47.223', '2026-01-21 01:25:47.224', '2026-01-21 01:25:47.224', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('0bdcc2fa-9b25-486b-a5b1-fb0e03554af2', '421c933e-cb72-44b6-83a6-46502f66ad02', '5fa3a04a-03c1-4537-a4b0-dfbb48b6ac70', 'variable_expense', 99.90, 'Apple one ', '2026-01-21 01:26:50.733', '2026-01-21 01:26:50.733', '2026-01-21 01:26:50.734', '2026-01-21 01:26:50.734', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('cad30a3b-c2fd-4ce6-9f09-1be7865c5a68', '421c933e-cb72-44b6-83a6-46502f66ad02', '5fa3a04a-03c1-4537-a4b0-dfbb48b6ac70', 'variable_expense', 69.90, 'YouTube premium ', '2026-01-21 01:27:22.837', '2026-01-21 01:27:22.837', '2026-01-21 01:27:22.838', '2026-01-21 01:27:22.838', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('0b75ac05-bc20-4284-a966-5ea2dc6d851e', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 600.00, 'DAS Dezembro', '2026-01-21 01:28:49.239', '2026-01-21 01:28:49.239', '2026-01-21 01:28:49.24', '2026-01-21 01:28:49.24', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('26789435-4831-4a8c-994b-2d816226a2de', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 308.00, 'INSS Dezembro', '2026-01-21 01:29:31.532', '2026-01-21 01:29:31.532', '2026-01-21 01:29:31.533', '2026-01-21 01:29:31.533', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('dc7642e4-810c-4297-85df-7a8bf4717c9a', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 123.65, 'TAXA TFI 1/9', '2026-01-21 01:30:17.571', '2026-01-21 01:30:17.571', '2026-01-21 01:30:17.572', '2026-01-21 01:30:17.572', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('f7f05b2c-bd25-4089-b0f7-cf8f43ae66c7', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dfb84e6a-7990-4912-9a00-dcb45af96463', 'variable_expense', 129.53, 'ISS parcela 1/6', '2026-01-21 01:31:10.219', '2026-01-21 01:31:10.219', '2026-01-21 01:31:10.221', '2026-01-21 01:31:10.221', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('fd1ecfff-9d24-4e7a-b7a7-0d51e360e24c', '421c933e-cb72-44b6-83a6-46502f66ad02', 'e9ba459a-e84c-4aeb-a0b3-367813f9aed2', 'variable_expense', 66.40, 'Ultrafarma', '2026-01-21 01:35:55.993', '2026-01-21 01:35:55.993', '2026-01-21 01:35:55.995', '2026-01-21 01:35:55.995', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('d6c496e3-aff8-4b66-9112-600d14ced6b6', '421c933e-cb72-44b6-83a6-46502f66ad02', 'db9dcbe7-6114-48e7-8dba-062fa8105bef', 'variable_expense', 34.38, 'Ifood', '2026-01-21 01:36:36.263', '2026-01-21 01:36:36.263', '2026-01-21 01:36:36.264', '2026-01-21 01:36:36.264', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('594ebb30-513b-4e27-9de7-9ee0af6309e4', '421c933e-cb72-44b6-83a6-46502f66ad02', 'bb277b06-09cd-4c0b-ad44-2c3415d6ffd6', 'variable_expense', 99.55, 'Jogo de vela corsa wind', '2026-01-21 01:38:21.924', '2026-01-21 01:38:21.924', '2026-01-21 01:38:21.925', '2026-01-21 01:38:21.925', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.transactions (id, account_id, category_id, type, amount, description, due_date, executed_date, created_at, updated_at, status, is_recurring, recurrence_pattern, recurrence_end_date, parent_transaction_id, tags, attachment_url, notes) VALUES ('f6469a44-06be-4a62-bc5c-1cd084e4d94d', '421c933e-cb72-44b6-83a6-46502f66ad02', 'bb277b06-09cd-4c0b-ad44-2c3415d6ffd6', 'variable_expense', 55.80, 'Soque vela corsa', '2026-01-21 01:42:38.637', '2026-01-21 01:42:38.637', '2026-01-21 01:42:38.638', '2026-01-21 01:42:38.638', 'executed', false, NULL, NULL, NULL, NULL, NULL, NULL);


ALTER TABLE public.transactions ENABLE TRIGGER ALL;

--
-- Data for Name: balance_history; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.balance_history DISABLE TRIGGER ALL;

INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('d01920e7-b59c-483f-9054-96ca12e23542', '421c933e-cb72-44b6-83a6-46502f66ad02', 'b7d172ed-c44d-439a-86c9-7beb489a6559', 10000.00, 7000.00, 0.00, 3000.00, 'income_received', '2026-01-19 13:10:29.88');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('21a152f1-7c81-4826-9971-85d09cd7fdb6', '421c933e-cb72-44b6-83a6-46502f66ad02', 'e898a34f-8e87-4f3e-a1c9-80d950874397', 9200.00, 6200.00, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:31:04.567');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('06dc2ee6-a109-433a-b1b3-e071dc04a942', '421c933e-cb72-44b6-83a6-46502f66ad02', 'd4f1a101-c697-4abf-a922-3a4b2d2644cd', 8950.00, 5950.00, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:32:20.138');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('30fabeee-6c6f-4369-bb49-a3c637ffa1a2', '421c933e-cb72-44b6-83a6-46502f66ad02', '6557f5bd-13f6-4d3f-8ee4-66223315507b', 8402.53, 5402.53, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:33:48.568');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('30cba2ab-a1f7-4e9e-a0fd-a997dc4d083e', '421c933e-cb72-44b6-83a6-46502f66ad02', '3977c1a6-11ed-4862-8cb2-56d3624c1374', 8369.80, 5369.80, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:34:26.88');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('b32ed001-105e-43dd-b939-374472fdaf9f', '421c933e-cb72-44b6-83a6-46502f66ad02', '2be829fd-379c-4f7f-812c-fcba7439a35a', 7989.88, 4989.88, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:35:10.083');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('89af6e2a-109a-4a2f-aadf-d079ae4f90ff', '421c933e-cb72-44b6-83a6-46502f66ad02', 'ddfc186a-e621-4f4f-9d7c-ca8192f19c99', 7389.89, 4389.89, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:40:28.705');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('3e865c8e-acbe-4ce3-84c4-45b185e7b372', '421c933e-cb72-44b6-83a6-46502f66ad02', '7ab96b7a-a6cd-4288-bf7f-c3f8cb11fe33', 7329.36, 4329.36, 0.00, 3000.00, 'expense_paid', '2026-01-20 01:43:12.071');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('a3a2f366-f95b-4766-b1b0-2c4e19970873', '421c933e-cb72-44b6-83a6-46502f66ad02', 'f29afae3-ec02-45a9-943d-c27fef551a61', 6949.56, 3949.56, 0.00, 3000.00, 'expense_paid', '2026-01-20 02:18:56.963');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('dba00827-17a5-44d7-8154-7378f4cc3bba', '421c933e-cb72-44b6-83a6-46502f66ad02', 'e142da29-4640-4032-9a0d-3fbd5681e44e', 6772.56, 3772.56, 0.00, 3000.00, 'expense_paid', '2026-01-20 12:28:52.946');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('37650192-3764-43ad-86c7-5357ddbb4b1d', '421c933e-cb72-44b6-83a6-46502f66ad02', 'b24c032a-57e5-4439-a358-04289674cc99', 7572.56, 4332.56, 0.00, 3240.00, 'income_received', '2026-01-20 14:18:35.686');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('62b793d1-3d62-418e-b15b-9a74c9c9f33a', '421c933e-cb72-44b6-83a6-46502f66ad02', '99f68fb1-5e4a-4b00-b08c-df54fa126ed4', 7430.11, 4190.11, 0.00, 3240.00, 'expense_paid', '2026-01-20 14:21:41.863');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('6d579d27-e582-4f63-b915-3158687967cd', '421c933e-cb72-44b6-83a6-46502f66ad02', '7b5ee06e-0f2b-4012-bd8d-be42c5e56d9b', 7381.14, 4141.14, 0.00, 3240.00, 'expense_paid', '2026-01-20 14:30:10.972');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('d97bb726-e006-4b29-9bb6-6f9016f11e84', '421c933e-cb72-44b6-83a6-46502f66ad02', '77d83667-8c30-4c22-bcb4-a61a601ce002', 7108.33, 3868.33, 0.00, 3240.00, 'expense_paid', '2026-01-20 14:32:24.037');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('9e2c43f5-a43f-4f4e-8ba8-cb50cf84d466', '421c933e-cb72-44b6-83a6-46502f66ad02', 'fa9e07ae-b201-4ec7-8112-25ace8cf8eb2', 7058.33, 3818.33, 0.00, 3240.00, 'expense_paid', '2026-01-20 14:33:34.235');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('55a2e6fb-21aa-4b14-a073-d76f38849865', '421c933e-cb72-44b6-83a6-46502f66ad02', '60f1bb16-21af-47e6-8d8c-dc3aec303fdb', 6958.33, 3718.33, 0.00, 3240.00, 'expense_paid', '2026-01-20 14:35:24.544');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('32dec425-5fd8-4a3d-a339-47369e625312', '421c933e-cb72-44b6-83a6-46502f66ad02', 'adb27ffd-f841-4822-b369-3c73558632d9', 6958.33, 3353.48, 364.85, 3240.00, 'expense_locked', '2026-01-21 01:19:36.922');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('a711ffeb-72b1-41a6-85f4-cf41a36e7590', '421c933e-cb72-44b6-83a6-46502f66ad02', '6bd25923-473b-47bd-ac72-308deb2598e8', 6456.77, 2851.92, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:23:08.111');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('601ee91b-ca8c-458b-8a70-f9de2adb6855', '421c933e-cb72-44b6-83a6-46502f66ad02', '7e83a72c-c545-408f-bf60-b70f421d27e4', 6165.77, 2560.92, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:25:47.24');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('3daeb0eb-c38b-465c-8c25-44674ef4ee59', '421c933e-cb72-44b6-83a6-46502f66ad02', '0bdcc2fa-9b25-486b-a5b1-fb0e03554af2', 6065.87, 2461.02, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:26:50.738');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('82b677d2-b00d-4f26-9e88-dcd633d3b0c4', '421c933e-cb72-44b6-83a6-46502f66ad02', 'cad30a3b-c2fd-4ce6-9f09-1be7865c5a68', 5995.97, 2391.12, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:27:22.842');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('2363c6d5-dbdd-4fba-a36e-1d1e1022b82a', '421c933e-cb72-44b6-83a6-46502f66ad02', '0b75ac05-bc20-4284-a966-5ea2dc6d851e', 5395.97, 1791.12, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:28:49.243');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('2861825a-332e-4319-bbef-79712455f49c', '421c933e-cb72-44b6-83a6-46502f66ad02', '26789435-4831-4a8c-994b-2d816226a2de', 5087.97, 1483.12, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:29:31.541');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('c58b4ba4-e834-4cb4-869e-369c086797ab', '421c933e-cb72-44b6-83a6-46502f66ad02', 'dc7642e4-810c-4297-85df-7a8bf4717c9a', 4964.32, 1359.47, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:30:17.622');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('63d0ca12-00b7-493f-b153-eef181617ed9', '421c933e-cb72-44b6-83a6-46502f66ad02', 'f7f05b2c-bd25-4089-b0f7-cf8f43ae66c7', 4834.79, 1229.94, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:31:10.225');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('e66de06f-c8fd-4cd8-84b1-6975a5450392', '421c933e-cb72-44b6-83a6-46502f66ad02', 'fd1ecfff-9d24-4e7a-b7a7-0d51e360e24c', 4768.39, 1163.54, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:35:56.007');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('5a1a3bb2-5cc9-459e-be38-2ead31fc87f9', '421c933e-cb72-44b6-83a6-46502f66ad02', 'd6c496e3-aff8-4b66-9112-600d14ced6b6', 4734.01, 1129.16, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:36:36.27');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('a7328b4c-bba6-4b2b-91a3-a9114ee0e3d8', '421c933e-cb72-44b6-83a6-46502f66ad02', '594ebb30-513b-4e27-9de7-9ee0af6309e4', 4634.46, 1029.61, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:38:21.928');
INSERT INTO public.balance_history (id, account_id, transaction_id, total_balance, available_balance, locked_balance, emergency_reserve, change_reason, recorded_at) VALUES ('a925623c-9a0e-4387-8095-a639f6e933b3', '421c933e-cb72-44b6-83a6-46502f66ad02', 'f6469a44-06be-4a62-bc5c-1cd084e4d94d', 4578.66, 973.81, 364.85, 3240.00, 'expense_paid', '2026-01-21 01:42:38.653');


ALTER TABLE public.balance_history ENABLE TRIGGER ALL;

--
-- Data for Name: financial_rules; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.financial_rules DISABLE TRIGGER ALL;

INSERT INTO public.financial_rules (id, account_id, rule_type, rule_name, percentage, fixed_amount, condition_json, priority, is_active, created_at, updated_at) VALUES ('6198aeec-8935-4d79-a58a-0e03965d24fc', '6e178084-a722-4d5b-9fd1-0b845c6f7b9b', 'emergency_reserve', 'Reserva de Emergência Automática', 30.00, NULL, NULL, 1, true, '2026-01-16 15:39:10.477', '2026-01-16 15:39:10.477');
INSERT INTO public.financial_rules (id, account_id, rule_type, rule_name, percentage, fixed_amount, condition_json, priority, is_active, created_at, updated_at) VALUES ('bc26171e-6108-4123-9a77-157073f28fb7', '421c933e-cb72-44b6-83a6-46502f66ad02', 'emergency_reserve', 'Reserva de Emergência Automática', 30.00, NULL, NULL, 1, true, '2026-01-17 17:20:04.351', '2026-01-17 17:20:04.351');


ALTER TABLE public.financial_rules ENABLE TRIGGER ALL;

--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.notifications DISABLE TRIGGER ALL;



ALTER TABLE public.notifications ENABLE TRIGGER ALL;

--
-- Data for Name: spending_suggestions; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.spending_suggestions DISABLE TRIGGER ALL;

INSERT INTO public.spending_suggestions (id, account_id, suggestion_date, valid_until, daily_limit, monthly_projection, available_balance_snapshot, locked_balance_snapshot, days_until_next_income, average_daily_expense, calculation_metadata, created_at) VALUES ('4f8670f9-cebe-4acd-bb3e-e5e9e74ec772', '421c933e-cb72-44b6-83a6-46502f66ad02', '2026-01-19 13:13:28.876', '2026-01-19 23:59:59.999', 233.33, 7000.00, 7000.00, 0.00, 30, NULL, '{"method": "simple_division", "formula": "available_balance / 30"}', '2026-01-19 13:13:28.879');
INSERT INTO public.spending_suggestions (id, account_id, suggestion_date, valid_until, daily_limit, monthly_projection, available_balance_snapshot, locked_balance_snapshot, days_until_next_income, average_daily_expense, calculation_metadata, created_at) VALUES ('1de701b7-0c5d-4296-9ee1-9bfdad1c204b', '421c933e-cb72-44b6-83a6-46502f66ad02', '2026-01-20 01:32:31.164', '2026-01-20 23:59:59.999', 198.33, 5950.00, 5950.00, 0.00, 30, NULL, '{"method": "simple_division", "formula": "available_balance / 30"}', '2026-01-20 01:32:31.166');
INSERT INTO public.spending_suggestions (id, account_id, suggestion_date, valid_until, daily_limit, monthly_projection, available_balance_snapshot, locked_balance_snapshot, days_until_next_income, average_daily_expense, calculation_metadata, created_at) VALUES ('05e03fa6-f3c2-4e41-9c09-d178c7c84a5a', '421c933e-cb72-44b6-83a6-46502f66ad02', '2026-01-20 01:46:22.093', '2026-01-20 23:59:59.999', 144.31, 4329.36, 4329.36, 0.00, 30, NULL, '{"method": "simple_division", "formula": "available_balance / 30"}', '2026-01-20 01:46:22.094');
INSERT INTO public.spending_suggestions (id, account_id, suggestion_date, valid_until, daily_limit, monthly_projection, available_balance_snapshot, locked_balance_snapshot, days_until_next_income, average_daily_expense, calculation_metadata, created_at) VALUES ('3ee7110e-18ea-4b63-9879-d15cb36a0945', '421c933e-cb72-44b6-83a6-46502f66ad02', '2026-01-20 12:50:04.181', '2026-01-20 23:59:59.999', 125.75, 3772.56, 3772.56, 0.00, 30, NULL, '{"method": "simple_division", "formula": "available_balance / 30"}', '2026-01-20 12:50:04.187');
INSERT INTO public.spending_suggestions (id, account_id, suggestion_date, valid_until, daily_limit, monthly_projection, available_balance_snapshot, locked_balance_snapshot, days_until_next_income, average_daily_expense, calculation_metadata, created_at) VALUES ('2ca1c074-834f-44ba-957f-5dee7a9cd662', '421c933e-cb72-44b6-83a6-46502f66ad02', '2026-01-21 01:21:55.017', '2026-01-21 23:59:59.999', 111.78, 3353.48, 3353.48, 364.85, 30, NULL, '{"method": "simple_division", "formula": "available_balance / 30"}', '2026-01-21 01:21:55.019');


ALTER TABLE public.spending_suggestions ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: -
--

ALTER TABLE realtime.schema_migrations DISABLE TRIGGER ALL;

INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116024918, '2026-01-15 10:52:58');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116045059, '2026-01-15 10:52:58');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116050929, '2026-01-15 10:52:58');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116051442, '2026-01-15 10:52:58');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116212300, '2026-01-15 10:52:59');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116213355, '2026-01-15 10:52:59');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116213934, '2026-01-15 10:52:59');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211116214523, '2026-01-15 10:52:59');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211122062447, '2026-01-15 10:52:59');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211124070109, '2026-01-15 10:53:00');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211202204204, '2026-01-15 10:53:00');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211202204605, '2026-01-15 10:53:00');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211210212804, '2026-01-15 10:53:01');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20211228014915, '2026-01-15 10:53:01');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220107221237, '2026-01-15 10:53:01');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220228202821, '2026-01-15 10:53:01');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220312004840, '2026-01-15 10:53:01');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220603231003, '2026-01-15 10:53:02');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220603232444, '2026-01-15 10:53:02');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220615214548, '2026-01-15 10:53:02');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220712093339, '2026-01-15 10:53:02');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220908172859, '2026-01-15 10:53:03');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20220916233421, '2026-01-15 10:53:03');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230119133233, '2026-01-15 10:53:03');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230128025114, '2026-01-15 10:53:03');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230128025212, '2026-01-15 10:53:03');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230227211149, '2026-01-15 10:53:04');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230228184745, '2026-01-15 10:53:04');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230308225145, '2026-01-15 10:53:04');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20230328144023, '2026-01-15 10:53:04');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20231018144023, '2026-01-15 10:53:04');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20231204144023, '2026-01-15 10:53:05');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20231204144024, '2026-01-15 10:53:05');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20231204144025, '2026-01-15 10:53:05');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240108234812, '2026-01-15 10:53:05');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240109165339, '2026-01-15 10:53:06');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240227174441, '2026-01-15 10:53:06');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240311171622, '2026-01-15 10:53:06');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240321100241, '2026-01-15 10:53:07');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240401105812, '2026-01-15 10:53:07');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240418121054, '2026-01-15 10:53:07');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240523004032, '2026-01-15 10:53:08');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240618124746, '2026-01-15 10:53:08');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240801235015, '2026-01-15 10:53:09');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240805133720, '2026-01-15 10:53:09');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240827160934, '2026-01-15 10:53:09');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240919163303, '2026-01-15 10:53:09');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20240919163305, '2026-01-15 10:53:09');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241019105805, '2026-01-15 10:53:10');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241030150047, '2026-01-15 10:53:10');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241108114728, '2026-01-15 10:53:11');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241121104152, '2026-01-15 10:53:11');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241130184212, '2026-01-15 10:53:11');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241220035512, '2026-01-15 10:53:11');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241220123912, '2026-01-15 10:53:11');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20241224161212, '2026-01-15 10:53:12');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250107150512, '2026-01-15 10:53:12');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250110162412, '2026-01-15 10:53:12');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250123174212, '2026-01-15 10:53:12');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250128220012, '2026-01-15 10:53:12');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250506224012, '2026-01-15 10:53:13');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250523164012, '2026-01-15 10:53:13');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250714121412, '2026-01-15 10:53:13');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20250905041441, '2026-01-15 10:53:13');
INSERT INTO realtime.schema_migrations (version, inserted_at) VALUES (20251103001201, '2026-01-15 10:53:13');


ALTER TABLE realtime.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription DISABLE TRIGGER ALL;



ALTER TABLE realtime.subscription ENABLE TRIGGER ALL;

--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets DISABLE TRIGGER ALL;



ALTER TABLE storage.buckets ENABLE TRIGGER ALL;

--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics DISABLE TRIGGER ALL;



ALTER TABLE storage.buckets_analytics ENABLE TRIGGER ALL;

--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors DISABLE TRIGGER ALL;



ALTER TABLE storage.buckets_vectors ENABLE TRIGGER ALL;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations DISABLE TRIGGER ALL;

INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (0, 'create-migrations-table', 'e18db593bcde2aca2a408c4d1100f6abba2195df', '2026-01-15 10:52:59.646874');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (1, 'initialmigration', '6ab16121fbaa08bbd11b712d05f358f9b555d777', '2026-01-15 10:52:59.654415');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (2, 'storage-schema', '5c7968fd083fcea04050c1b7f6253c9771b99011', '2026-01-15 10:52:59.659759');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (3, 'pathtoken-column', '2cb1b0004b817b29d5b0a971af16bafeede4b70d', '2026-01-15 10:52:59.681363');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (4, 'add-migrations-rls', '427c5b63fe1c5937495d9c635c263ee7a5905058', '2026-01-15 10:52:59.753286');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (5, 'add-size-functions', '79e081a1455b63666c1294a440f8ad4b1e6a7f84', '2026-01-15 10:52:59.757027');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (6, 'change-column-name-in-get-size', 'f93f62afdf6613ee5e7e815b30d02dc990201044', '2026-01-15 10:52:59.761381');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (7, 'add-rls-to-buckets', 'e7e7f86adbc51049f341dfe8d30256c1abca17aa', '2026-01-15 10:52:59.765659');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (8, 'add-public-to-buckets', 'fd670db39ed65f9d08b01db09d6202503ca2bab3', '2026-01-15 10:52:59.768746');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (9, 'fix-search-function', '3a0af29f42e35a4d101c259ed955b67e1bee6825', '2026-01-15 10:52:59.772296');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (10, 'search-files-search-function', '68dc14822daad0ffac3746a502234f486182ef6e', '2026-01-15 10:52:59.776109');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (11, 'add-trigger-to-auto-update-updated_at-column', '7425bdb14366d1739fa8a18c83100636d74dcaa2', '2026-01-15 10:52:59.779679');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (12, 'add-automatic-avif-detection-flag', '8e92e1266eb29518b6a4c5313ab8f29dd0d08df9', '2026-01-15 10:52:59.783983');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (13, 'add-bucket-custom-limits', 'cce962054138135cd9a8c4bcd531598684b25e7d', '2026-01-15 10:52:59.787241');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (14, 'use-bytes-for-max-size', '941c41b346f9802b411f06f30e972ad4744dad27', '2026-01-15 10:52:59.791353');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (15, 'add-can-insert-object-function', '934146bc38ead475f4ef4b555c524ee5d66799e5', '2026-01-15 10:52:59.811738');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (16, 'add-version', '76debf38d3fd07dcfc747ca49096457d95b1221b', '2026-01-15 10:52:59.814924');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (17, 'drop-owner-foreign-key', 'f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101', '2026-01-15 10:52:59.818023');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (18, 'add_owner_id_column_deprecate_owner', 'e7a511b379110b08e2f214be852c35414749fe66', '2026-01-15 10:52:59.821143');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (19, 'alter-default-value-objects-id', '02e5e22a78626187e00d173dc45f58fa66a4f043', '2026-01-15 10:52:59.82636');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (20, 'list-objects-with-delimiter', 'cd694ae708e51ba82bf012bba00caf4f3b6393b7', '2026-01-15 10:52:59.829892');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (21, 's3-multipart-uploads', '8c804d4a566c40cd1e4cc5b3725a664a9303657f', '2026-01-15 10:52:59.835699');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (22, 's3-multipart-uploads-big-ints', '9737dc258d2397953c9953d9b86920b8be0cdb73', '2026-01-15 10:52:59.849344');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (23, 'optimize-search-function', '9d7e604cddc4b56a5422dc68c9313f4a1b6f132c', '2026-01-15 10:52:59.862281');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (24, 'operation-function', '8312e37c2bf9e76bbe841aa5fda889206d2bf8aa', '2026-01-15 10:52:59.86561');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (25, 'custom-metadata', 'd974c6057c3db1c1f847afa0e291e6165693b990', '2026-01-15 10:52:59.869103');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (26, 'objects-prefixes', 'ef3f7871121cdc47a65308e6702519e853422ae2', '2026-01-15 10:52:59.872275');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (27, 'search-v2', '33b8f2a7ae53105f028e13e9fcda9dc4f356b4a2', '2026-01-15 10:52:59.888353');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (28, 'object-bucket-name-sorting', 'ba85ec41b62c6a30a3f136788227ee47f311c436', '2026-01-15 10:52:59.961148');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (29, 'create-prefixes', 'a7b1a22c0dc3ab630e3055bfec7ce7d2045c5b7b', '2026-01-15 10:52:59.967048');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (30, 'update-object-levels', '6c6f6cc9430d570f26284a24cf7b210599032db7', '2026-01-15 10:52:59.973');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (31, 'objects-level-index', '33f1fef7ec7fea08bb892222f4f0f5d79bab5eb8', '2026-01-15 10:53:00.06415');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (32, 'backward-compatible-index-on-objects', '2d51eeb437a96868b36fcdfb1ddefdf13bef1647', '2026-01-15 10:53:00.106509');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (33, 'backward-compatible-index-on-prefixes', 'fe473390e1b8c407434c0e470655945b110507bf', '2026-01-15 10:53:00.229265');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (34, 'optimize-search-function-v1', '82b0e469a00e8ebce495e29bfa70a0797f7ebd2c', '2026-01-15 10:53:00.2338');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (35, 'add-insert-trigger-prefixes', '63bb9fd05deb3dc5e9fa66c83e82b152f0caf589', '2026-01-15 10:53:00.240187');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (36, 'optimise-existing-functions', '81cf92eb0c36612865a18016a38496c530443899', '2026-01-15 10:53:00.244572');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (37, 'add-bucket-name-length-trigger', '3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1', '2026-01-15 10:53:00.253786');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (38, 'iceberg-catalog-flag-on-buckets', '19a8bd89d5dfa69af7f222a46c726b7c41e462c5', '2026-01-15 10:53:00.260638');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (39, 'add-search-v2-sort-support', '39cf7d1e6bf515f4b02e41237aba845a7b492853', '2026-01-15 10:53:00.270189');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (40, 'fix-prefix-race-conditions-optimized', 'fd02297e1c67df25a9fc110bf8c8a9af7fb06d1f', '2026-01-15 10:53:00.275591');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (41, 'add-object-level-update-trigger', '44c22478bf01744b2129efc480cd2edc9a7d60e9', '2026-01-15 10:53:00.287459');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (42, 'rollback-prefix-triggers', 'f2ab4f526ab7f979541082992593938c05ee4b47', '2026-01-15 10:53:00.293302');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (43, 'fix-object-level', 'ab837ad8f1c7d00cc0b7310e989a23388ff29fc6', '2026-01-15 10:53:00.299866');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (44, 'vector-bucket-type', '99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3', '2026-01-15 10:53:00.303907');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (45, 'vector-buckets', '049e27196d77a7cb76497a85afae669d8b230953', '2026-01-15 10:53:00.30809');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (46, 'buckets-objects-grants', 'fedeb96d60fefd8e02ab3ded9fbde05632f84aed', '2026-01-15 10:53:00.322094');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (47, 'iceberg-table-metadata', '649df56855c24d8b36dd4cc1aeb8251aa9ad42c2', '2026-01-15 10:53:00.326246');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (48, 'iceberg-catalog-ids', '2666dff93346e5d04e0a878416be1d5fec345d6f', '2026-01-15 10:53:00.332214');
INSERT INTO storage.migrations (id, name, hash, executed_at) VALUES (49, 'buckets-objects-grants-postgres', '072b1195d0d5a2f888af6b2302a1938dd94b8b3d', '2026-01-15 10:53:00.349095');


ALTER TABLE storage.migrations ENABLE TRIGGER ALL;

--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.objects DISABLE TRIGGER ALL;



ALTER TABLE storage.objects ENABLE TRIGGER ALL;

--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes DISABLE TRIGGER ALL;



ALTER TABLE storage.prefixes ENABLE TRIGGER ALL;

--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads DISABLE TRIGGER ALL;



ALTER TABLE storage.s3_multipart_uploads ENABLE TRIGGER ALL;

--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts DISABLE TRIGGER ALL;



ALTER TABLE storage.s3_multipart_uploads_parts ENABLE TRIGGER ALL;

--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes DISABLE TRIGGER ALL;



ALTER TABLE storage.vector_indexes ENABLE TRIGGER ALL;

--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: -
--

ALTER TABLE vault.secrets DISABLE TRIGGER ALL;



ALTER TABLE vault.secrets ENABLE TRIGGER ALL;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 1, false);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: -
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict 0LRXEvsgFfXZBoJ2Sr3BhaaUeQsGeRqZrKaBcjq14zyWwCkWtl0JVvJhQaDztoa

