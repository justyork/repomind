import type { CheckReport, Draft } from './api.js';
import { exportAgentsMd, getCheckReport, getLinkHealth, listDrafts, listUnprepared, prepareAllDocs, prepareDoc, publishDraftApi, syncAllLinks } from './api.js';

export interface DashboardCallbacks {
  onOpenDraft: (draft: Draft) => void;
  onPublished: (path: string) => void;
  onNotify: (message: string, isError?: boolean) => void;
}

export function renderDashboard(
  container: HTMLElement,
  callbacks: DashboardCallbacks,
): { refresh: () => Promise<void> } {
  container.className = 'workspace-main workspace-dashboard';
  container.innerHTML = `
    <div class="dashboard-header">
      <h1 class="doc-title">Health &amp; publish</h1>
      <div class="workspace-actions">
        <button type="button" id="dash-export" class="btn-ghost">Export agents.md</button>
        <button type="button" id="dash-refresh" class="btn-ghost">Refresh</button>
      </div>
    </div>
    <div id="dash-check" class="dashboard-section"></div>
    <div id="dash-links" class="dashboard-section"></div>
    <div class="dashboard-section">
      <h2>Prepare docs</h2>
      <p class="dashboard-hint">Markdown files without RepoMind frontmatter. Add frontmatter to index them for MCP and the catalog.</p>
      <div class="dashboard-actions">
        <button type="button" id="dash-prepare-all" class="btn-primary btn-sm">Prepare all</button>
        <button type="button" id="dash-sync-links" class="btn-ghost btn-sm">Sync all links</button>
      </div>
      <ul id="dash-unprepared" class="queue-list"></ul>
    </div>
    <div class="dashboard-section">
      <h2>Publish queue</h2>
      <ul id="dash-queue" class="queue-list"></ul>
    </div>
  `;

  const checkEl = container.querySelector<HTMLElement>('#dash-check')!;
  const linksEl = container.querySelector<HTMLElement>('#dash-links')!;
  const unpreparedEl = container.querySelector<HTMLUListElement>('#dash-unprepared')!;
  const queueEl = container.querySelector<HTMLUListElement>('#dash-queue')!;

  function renderCheck(report: CheckReport): void {
    const statusClass = report.ok ? 'check-ok' : 'check-fail';
    const statusLabel = report.ok ? 'All checks passed' : `${report.violations.length} issue(s)`;
    let html = `
      <h2>Schema check</h2>
      <p class="check-status ${statusClass}">${statusLabel}</p>
    `;

    if (report.violations.length > 0) {
      html += '<ul class="violation-list">';
      for (const v of report.violations) {
        html += `<li><code>${escapeHtml(v.path)}</code> — ${escapeHtml(v.message)}</li>`;
      }
      html += '</ul>';
    }

    if (report.warnings.length > 0) {
      html += '<h3 class="warnings-title">Warnings</h3><ul class="warning-list">';
      for (const w of report.warnings) {
        html += `<li>${escapeHtml(w)}</li>`;
      }
      html += '</ul>';
    }

    checkEl.innerHTML = html;
  }

  function renderLinkHealth(health: Awaited<ReturnType<typeof getLinkHealth>>): void {
    let html = `
      <h2>Link health</h2>
      <div class="link-health-stats">
        <div class="link-health-stat"><span class="link-health-value">${health.orphanCount}</span> orphans</div>
        <div class="link-health-stat"><span class="link-health-value">${health.brokenCount}</span> broken</div>
        <div class="link-health-stat"><span class="link-health-value">${health.oneWayCount}</span> one-way</div>
      </div>
    `;

    if (health.brokenTargets.length > 0) {
      html += '<h3 class="warnings-title">Broken targets</h3><ul class="warning-list">';
      for (const target of health.brokenTargets) {
        html += `<li><code>${escapeHtml(target)}</code></li>`;
      }
      html += '</ul>';
    }

    if (health.orphanSlugs.length > 0) {
      html += '<h3 class="warnings-title">Orphan pages</h3><ul class="warning-list">';
      for (const slug of health.orphanSlugs) {
        html += `<li><code>${escapeHtml(slug)}</code></li>`;
      }
      html += '</ul>';
    }

    linksEl.innerHTML = html;
  }

  function renderUnprepared(files: Awaited<ReturnType<typeof listUnprepared>>['files']): void {
    unpreparedEl.innerHTML = '';
    if (files.length === 0) {
      unpreparedEl.innerHTML = '<li class="placeholder">All docs have frontmatter</li>';
      return;
    }

    for (const file of files) {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.innerHTML = `
        <div class="queue-main">
          <div class="queue-title">${escapeHtml(file.relativePath)}</div>
          <div class="meta">${escapeHtml(file.suggestedType)} · slug: ${escapeHtml(file.suggestedSlug)}</div>
        </div>
        <div class="queue-actions">
          <button type="button" class="btn-primary btn-sm" data-action="prepare">Add frontmatter</button>
        </div>
      `;

      li.querySelector('[data-action="prepare"]')?.addEventListener('click', () => {
        void prepareDoc(file.relativePath, file.suggestedType)
          .then(({ result }) => {
            callbacks.onNotify(`Prepared: ${result.slug}`);
            void refresh();
          })
          .catch((err: unknown) => {
            callbacks.onNotify(err instanceof Error ? err.message : 'Prepare failed', true);
          });
      });

      unpreparedEl.appendChild(li);
    }
  }

  function renderQueue(drafts: Draft[]): void {
    queueEl.innerHTML = '';
    if (drafts.length === 0) {
      queueEl.innerHTML = '<li class="placeholder">No drafts in queue</li>';
      return;
    }

    for (const draft of drafts) {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.innerHTML = `
        <div class="queue-main">
          <div class="queue-title">${escapeHtml(draft.title || draft.slug)}</div>
          <div class="meta">${escapeHtml(draft.slug)} · ${escapeHtml(draft.type)}</div>
        </div>
        <div class="queue-actions">
          <button type="button" class="btn-ghost btn-sm" data-action="edit">Edit</button>
          <button type="button" class="btn-primary btn-sm" data-action="publish">Publish</button>
        </div>
      `;

      li.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        callbacks.onOpenDraft(draft);
      });

      li.querySelector('[data-action="publish"]')?.addEventListener('click', () => {
        void publishDraftApi(draft.id)
          .then(({ result }) => {
            callbacks.onPublished(result.path);
            void refresh();
          })
          .catch((err: unknown) => {
            callbacks.onNotify(err instanceof Error ? err.message : 'Publish failed', true);
          });
      });

      queueEl.appendChild(li);
    }
  }

  async function refresh(): Promise<void> {
    try {
      const [report, linkHealth, { drafts }, { files }] = await Promise.all([
        getCheckReport(),
        getLinkHealth(),
        listDrafts(),
        listUnprepared(),
      ]);
      renderCheck(report);
      renderLinkHealth(linkHealth);
      renderUnprepared(files);
      renderQueue(drafts);
    } catch (err) {
      checkEl.innerHTML = `<p class="check-status check-fail">${escapeHtml(err instanceof Error ? err.message : 'Failed to load')}</p>`;
    }
  }

  container.querySelector('#dash-refresh')?.addEventListener('click', () => {
    void refresh();
  });

  container.querySelector('#dash-prepare-all')?.addEventListener('click', () => {
    void prepareAllDocs()
      .then(({ result }) => {
        callbacks.onNotify(`Prepared ${result.prepared.length} file(s)`);
        void refresh();
      })
      .catch((err: unknown) => {
        callbacks.onNotify(err instanceof Error ? err.message : 'Prepare all failed', true);
      });
  });

  container.querySelector('#dash-sync-links')?.addEventListener('click', () => {
    void syncAllLinks()
      .then(({ result }) => {
        const changed = result.files.filter((file) => file.changed).length;
        callbacks.onNotify(`Synced links in ${changed} file(s)`);
        void refresh();
      })
      .catch((err: unknown) => {
        callbacks.onNotify(err instanceof Error ? err.message : 'Sync links failed', true);
      });
  });

  container.querySelector('#dash-export')?.addEventListener('click', () => {
    void exportAgentsMd()
      .then(({ path }) => {
        callbacks.onNotify(`Exported ${path}`);
      })
      .catch((err: unknown) => {
        callbacks.onNotify(err instanceof Error ? err.message : 'Export failed', true);
      });
  });

  void refresh();

  return { refresh };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
