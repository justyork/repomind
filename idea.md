# Идея: RepoMind — Knowledge Workspace for AI Development

## 1. Суть продукта

**Единая база знаний проекта в `docs/` внутри репозитория** — wiki, архитектура, ADR, стек, glossary, правила для агентов. Confluence и Notion не нужны: всё версионируется через Git, лежит рядом с кодом.

RepoMind — **обёртка** вокруг этой документации:

* **Люди** — Confluence-подобный локальный UI: каталог, поиск, граф, редактор, publish;
* **AI-агенты** — те же файлы через MCP (`search_docs`, `get_doc`, …).

Один источник истины, два интерфейса. Черновики в SQLite не видны агентам до Publish.

Главная цель — создать единое пространство знаний проекта, которое удобно:

* читать и редактировать разработчикам (без лабиринта разделов Confluence);
* версионировать через Git;
* использовать AI-агентам через MCP;
* переносить между проектами одной командой.

Это не просто папка markdown. Это **repo-native knowledge workspace** с опциональной структурой (frontmatter, типы, связи).

Важно, что система должна хранить не только техническую документацию, но и любые знания, являющиеся источником истины для проекта.

Например, в игровом проекте это могут быть:

* геймдизайн-документы;
* описание игровых механик;
* балансные таблицы;
* нарратив и лор;
* экономика игры;
* контентные пайплайны;
* техническая архитектура;
* правила работы AI-агентов.

Таким образом продукт становится не хранилищем документации, а **централизованной базой знаний проекта**.

Также важно, что знания могут создаваться и поддерживаться как людьми, так и AI-системами.

Система не должна самостоятельно генерировать документацию или принимать решения за команду. Ее задача — предоставлять структуру, шаблоны, правила, инструменты хранения и публикации знаний.

При этом проект может определять собственные правила для AI:

* как оформлять Feature Spec;
* как создавать ADR;
* как описывать игровые механики;
* как обновлять глоссарий;
* как формировать инструкции для агентов.

RepoMind предоставляет инфраструктуру для таких процессов, но не навязывает конкретные AI-воркфлоу.

---

## 2. Проблема

Современные проекты всё чаще разрабатываются с участием AI-агентов: Cursor, Claude Code, Codex, Hermes, OpenClaw и т.д.

Но проектные знания обычно разбросаны:

* README;
* Markdown-файлы;
* Notion;
* Jira;
* Confluence;
* комментарии в задачах;
* приватные инструкции агентам;
* устные договоренности;
* старые архитектурные решения.

Из-за этого AI-агенты:

* теряют контекст;
* не знают актуальные правила проекта;
* придумывают решения;
* плохо понимают архитектуру;
* не видят историю решений;
* повторяют старые ошибки;
* смешивают черновики и утвержденные знания.

---

## 3. Цель

Создать **единую базу знаний в `docs/`** внутри репозитория:

```text
docs/
  README.md
  adr/
  specs/
  glossary/
  agents/
  open-questions/
  wiki/              # произвольные wiki-страницы
  architecture/      # legacy markdown → Prepare добавит frontmatter
  .repo-mind/        # SQLite черновики (gitignored)
```

RepoMind не заменяет `docs/` — он **оборачивает** её: UI для людей, MCP для агентов, Prepare для миграции существующего markdown.

Система должна позволять:

1. Инициализировать `docs/` одной командой (`repo-mind init`).
2. Редактировать знания через локальный web UI (Confluence-like).
3. Рекурсивно находить markdown без frontmatter и подготовить под схему (Prepare).
4. Хранить рабочие изменения в SQLite (drafts).
5. Публиковать утверждённые изменения в `docs/*.md`.
6. Давать AI-агентам доступ к **тем же файлам** через MCP.
7. Строить связи между документами (`related:`).
8. Поддерживать совместную работу людей и AI над одной базой.

---

## 4. Главный принцип хранения

### Не писать каждое изменение сразу в Git

Каждое редактирование не должно сразу создавать commit или менять файлы репозитория.

Вместо этого:

```text
UI edit
  ↓
SQLite draft storage
  ↓
review / validation / approval
  ↓
publish
  ↓
write files to repo
  ↓
git commit / PR / scheduled sync
```

---

## 5. Два слоя данных

## 5.1 Working Layer — SQLite

SQLite используется как рабочее хранилище.

Там лежит:

* черновики документов;
* незавершенные правки;
* история локальных изменений;
* статус документа;
* комментарии;
* lock state;
* временные AI-заметки;
* результаты валидации;
* индексы для поиска;
* metadata;
* sync queue;
* граф связей между документами.

Пример:

```text
docs/.repo-mind/
  drafts.db
  cache/
```

SQLite не обязан попадать в Git.

---

## 5.2 Published Layer — repo files

После публикации данные сохраняются в репозиторий в стабильном формате.

Форматы:

* `.md`
* `.mdx`
* `.mdoc`
* `.yaml`
* `.json`
* assets: `.png`, `.jpg`, `.svg`, `.webp`

Пример:

```text
docs/
  architecture/
    system-overview.md
  adr/
    ADR-0001-use-sqlite-draft-layer.md
  specs/
    expedition-system.md
  wiki/
    factions.md
  agents/
    query-first.md
  glossary/
    caravan.md
```

---

## 6. Почему не HTML как source of truth

HTML остается только как интерфейс отображения.

Основной формат хранения лучше делать не HTML, потому что HTML:

* плохо читается в diff;
* создает шумные merge conflicts;
* сложнее редактируется руками;
* менее удобен для AI;
* требует очистки от мусорной разметки;
* хуже подходит для структурных документов.

Лучший вариант:

```text
Storage: MDX / Markdoc / Markdown + YAML/JSON
UI: HTML / React / Astro
Agent Access: MCP + generated exports
```

---

## 7. Форматы документов

### 7.1 Markdown

Для простых документов:

* README-like docs;
* инструкции;
* заметки;
* простые workflow.

### 7.2 MDX

Для rich-документов:

* tabs;
* callouts;
* embedded components;
* diagrams;
* interactive blocks;
* status cards.

### 7.3 Markdoc

Альтернатива MDX, если нужен более контролируемый формат без полноценного JSX.

### 7.4 YAML / JSON

Для структурированных данных:

* glossary;
* agent config;
* document index;
* permissions;
* workflows;
* schemas;
* source map;
* knowledge graph exports.

---

## 8. Документные типы

В системе должны быть шаблоны.

Каждый шаблон может сопровождаться правилами заполнения как для человека, так и для AI-агента.

### Feature Spec

Описание фичи:

* цель;
* пользовательский сценарий;
* acceptance criteria;
* edge cases;
* технические ограничения;
* связанные документы;
* статус.

### ADR

Architecture Decision Record:

* контекст;
* решение;
* альтернативы;
* последствия;
* дата;
* статус.

### Agent Instruction

Инструкции для AI-агентов:

* роль;
* границы ответственности;
* доступные источники;
* запреты;
* формат ответа;
* tools.

### Workflow

Процесс:

* шаги;
* участники;
* условия;
* переходы статусов;
* automation hooks.

### Open Question

Открытый вопрос:

* вопрос;
* контекст;
* варианты решения;
* owner;
* статус;
* deadline.

### Glossary Term

Термин проекта:

* название;
* значение;
* aliases;
* связанные документы;
* можно ли использовать публично.

### Game Design Document

Описание игровой механики:

* цель механики;
* правила;
* баланс;
* ограничения;
* связанные системы;
* статус реализации.

### Lore Entry

Элемент мира:

* сущность;
* описание;
* связи;
* каноничность;
* связанные документы.

---

## 9. Web UI

Локальный web UI запускается командой:

```text
project-knowledge dev
```

Возможности:

* читать документацию;
* редактировать документы;
* создавать новые документы из шаблонов;
* видеть статус draft / published;
* делать preview;
* искать по проектным знаниям;
* видеть связи между документами;
* просматривать knowledge graph;
* запускать validation;
* публиковать изменения в repo;
* создавать commit или PR.

---

## 10. Publish flow

Публикация может работать несколькими способами.

### Manual publish

Пользователь нажимает Publish.

Система:

1. Валидирует документы.
2. Конвертирует draft из SQLite в repo files.
3. Обновляет индексы.
4. Генерирует exports.
5. Создает git diff.
6. Предлагает commit.

---

### Scheduled publish

По cron:

```text
project-knowledge publish --scheduled
```

Система публикует только документы со статусом:

```text
approved_for_publish
```

---

### PR-based publish

Для командной работы:

```text
project-knowledge publish --pr
```

Система:

1. Создает branch.
2. Записывает файлы.
3. Создает commit.
4. Открывает Pull Request.

---

## 11. Статусы документов

```text
draft
review
approved
published
archived
deprecated
```

Дополнительно:

```text
ai_generated
needs_human_review
blocked
outdated
```

Статусы позволяют явно разделять:

* знания, созданные человеком;
* знания, предложенные AI;
* знания, прошедшие человеческую проверку;
* опубликованные знания, являющиеся источником истины.

---

## 12. AI / MCP слой

Система должна иметь MCP server:

```text
project-knowledge mcp
```

MCP tools:

```text
search_docs
get_doc
list_docs
list_features
list_open_questions
list_architecture_decisions
get_agent_instructions
get_workflow
get_glossary_term
get_related_docs
explore_graph
create_draft
update_draft
request_publish
```

AI-агенты не должны читать весь репозиторий хаотично.

Они должны получать знания через управляемые tools.

Важно, что RepoMind не является AI-агентом и не пытается автоматически создавать документацию.

Он предоставляет стандартизированный слой знаний и инструменты, через которые внешние AI-системы могут:

* читать знания;
* создавать черновики;
* обновлять документы;
* следовать проектным правилам;
* отправлять изменения на ревью.

---

## 13. AI exports

### Пересмотреть роль llms.txt

Стоит учитывать, что `llms.txt` сам по себе не является обязательным стандартом для большинства современных AI-систем.

Во многих случаях он превращается лишь в список ссылок или карту документации.

Поэтому экспорт знаний должен быть шире, чем просто генерация одного текстового файла.

Система должна генерировать:

```text
.project-knowledge/exports/
  llms.txt
  llms-full.txt
  agents.md
  docs-index.json
  search-index.json
  source-map.json
  knowledge-graph.json
  entities.json
```

Назначение:

* `llms.txt` — краткая карта проекта;
* `llms-full.txt` — агрегированный контекст;
* `agents.md` — правила для AI-агентов;
* `docs-index.json` — структура документации;
* `source-map.json` — связь между документами и файлами;
* `knowledge-graph.json` — граф знаний проекта;
* `entities.json` — сущности и их связи.

### Knowledge Graph

Вместо упора только на `llms.txt` имеет смысл строить граф знаний.

Например:

```text
Combat System
  ├── uses → Damage Formula
  ├── affects → Economy
  ├── references → Weapon Types
  └── implemented_by → combat-service
```

Такой граф позволяет:

* находить связанные документы;
* строить контекст по сущностям;
* уменьшать объем поиска;
* улучшать retrieval для AI;
* объяснять зависимости между системами.

Для AI-агентов граф часто полезнее, чем большой текстовый файл.

---

## 14. Validation

Команда:

```text
project-knowledge check
```

Проверяет:

* битые ссылки;
* отсутствующие обязательные поля;
* документы без owner;
* устаревшие ADR;
* open questions без статуса;
* AI-generated документы без human review;
* дубли терминов;
* конфликтующие утверждения;
* документы без published версии;
* несинхронизированные изменения SQLite → repo;
* битые связи в knowledge graph.

---

## 15. Архитектура MVP

```text
CLI
  ├── init
  ├── dev
  ├── check
  ├── publish
  ├── export
  └── mcp

Local Web UI
  ├── document editor
  ├── preview
  ├── search
  ├── graph explorer
  ├── status dashboard
  └── publish panel

SQLite
  ├── documents
  ├── drafts
  ├── revisions
  ├── links
  ├── assets
  ├── validation_results
  └── sync_queue

Repo Files
  ├── md/mdx/mdoc
  ├── yaml/json
  ├── assets
  └── generated exports

MCP Server
  ├── read tools
  ├── graph tools
  ├── draft tools
  └── publish request tools
```

---

## 16. SQLite schema draft

### documents

```text
id
path
title
type
status
owner
created_at
updated_at
published_at
current_draft_id
published_hash
metadata_json
```

### drafts

```text
id
document_id
content
format
status
created_by
created_at
updated_at
source
ai_generated
human_review_required
```

### revisions

```text
id
document_id
draft_id
content_hash
summary
created_at
created_by
```

### links

```text
id
source_document_id
target_document_id
link_type
created_at
```

### validation_results

```text
id
document_id
severity
code
message
created_at
resolved_at
```

### sync_queue

```text
id
document_id
action
status
created_at
processed_at
error_message
```

---

## 17. CLI команды

```text
project-knowledge init
```

Создает структуру проекта.

```text
project-knowledge dev
```

Запускает локальный UI.

```text
project-knowledge check
```

Проверяет документацию.

```text
project-knowledge publish
```

Публикует approved drafts в repo.

```text
project-knowledge export
```

Генерирует AI exports.

```text
project-knowledge mcp
```

Запускает MCP server.

```text
project-knowledge status
```

Показывает состояние draft/published/sync.

---

## 18. MVP scope

В MVP включить:

* `init`;
* локальный UI;
* SQLite draft layer;
* Markdown/MDX documents;
* templates;
* validation;
* publish to repo;
* docs index;
* search index;
* simple graph links;
* simple MCP read tools;
* search по SQLite.

Не включать в MVP:

* полноценный multiplayer editing;
* сложный RBAC;
* cloud hosting;
* comments like Notion;
* визуальный no-code page builder;
* автоматический publish без review;
* сложные AI agents внутри продукта;
* полноценный knowledge graph engine;
* автоматическую генерацию документации системой.

---

## 19. Auth model

Для MVP:

```text
local-only
```

То есть авторизация не нужна, если UI работает локально.

Для командной версии:

```text
GitHub / GitLab OAuth
```

Права можно брать из Git provider:

* read;
* write;
* approve;
* publish.

---

## 20. Целевая аудитория

Первая аудитория:

* solo developers;
* small teams;
* AI-heavy development teams;
* разработчики, использующие Cursor / Claude Code / Codex;
* игровые команды;
* проекты, где документация нужна агентам, а не только людям.

---

## 21. Позиционирование

Не:

```text
Another documentation CMS
```

А:

```text
Git-native project memory for AI-assisted development
```

Или:

```text
AI-ready knowledge workspace inside your repository
```

---

## 22. Почему это может быть полезно

Система помогает:

* держать проектные знания рядом с кодом;
* не засорять Git каждым черновиком;
* давать AI-агентам структурированный доступ;
* разделять draft и published знания;
* превращать хаотичные заметки в версионированную базу знаний;
* снижать галлюцинации AI-агентов;
* сохранять историю решений;
* переиспользовать стандартные шаблоны между проектами;
* связывать знания через граф зависимостей;
* стандартизировать взаимодействие людей и AI с проектными знаниями.

---

## 23. Главный риск

Продукт нельзя превращать в универсальный Notion/Confluence/GitBook clone.

Сильная ниша — не “редактор документации”.

Сильная ниша:

```text
Project knowledge system for AI agents and developers
```

---

## 24. Название

Рабочее название:

```text
RepoMind
```

Название хорошо отражает основную идею продукта:

* знания живут рядом с репозиторием;
* знания являются памятью проекта;
* память доступна как людям, так и AI-системам;
* Git остается долговременным источником истины после публикации.

---

## 25. Итоговая формула

```text
RepoMind = local knowledge workspace + SQLite draft layer + Git publishing + MCP access + knowledge graph + AI-ready exports.
```

Или более кратко:

```text
RepoMind = Git-native project memory for humans and AI.
```
