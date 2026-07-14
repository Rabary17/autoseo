// Écrit le résumé de run dans logs/autopublish/<date>.md et remplace un bloc
// dédié dans STATE.md (jamais un ajout chronologique de plus — un bloc qui se
// remplace à chaque run, consultable sans fouiller les logs bruts).
const fs = require('fs');
const path = require('path');

const LOGS_ROOT = path.join(__dirname, '..', '..', '..', 'logs', 'autopublish');
const STATE_MD_PATH = path.join(__dirname, '..', '..', '..', 'STATE.md');

const MARKER_START = '<!-- autopublish:report:start -->';
const MARKER_END = '<!-- autopublish:report:end -->';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Deux causes de blocage bien distinctes, jamais confondues dans le rapport :
// - "draft"  : le contenu a été généré et relu, mais a échoué une règle de
//              gating qualité (section 5) — normal, fait partie du processus.
// - "erreur" : un maillon technique a levé une exception (API, WordPress,
//              fichier corrompu...) — anormal, mérite l'attention de l'utilisateur.
function writeRunReport({ runDate, dryRun, phase, silo, items, totalUsage }) {
  const published = items.filter(i => i.status === 'publie');
  const draft = items.filter(i => i.status === 'draft');
  const erreur = items.filter(i => i.status === 'erreur');

  const lines = [
    `# Rapport autopublish — ${runDate}${dryRun ? ' (dry-run)' : ''}`,
    '',
    `- Phase : ${phase}`,
    `- Silo en cours : ${silo ?? '—'}`,
    `- Pièces traitées : ${items.length}`,
    `- Programmées : ${published.length}`,
    `- Bloquées par le gating qualité (draft) : ${draft.length}`,
    `- Échecs techniques (erreur) : ${erreur.length}${erreur.length ? ' — À VÉRIFIER' : ''}`,
    '',
    '## Détail',
    '',
    ...items.map(i => {
      if (i.status === 'publie') return `- [x] ${i.slug} (${i.contentType}) — programmé pour ${i.postDate}`;
      if (i.status === 'erreur') return `- [!] ${i.slug} (${i.contentType}) — ERREUR TECHNIQUE : ${(i.reasons || []).join('; ')}`;
      return `- [ ] ${i.slug} (${i.contentType}) — bloqué (gating) : ${(i.reasons || []).join('; ')}`;
    }),
    '',
    '## Coût du run (cumul des appels Messages API, génération + relecture)',
    '',
    `- input tokens (hors cache) : ${totalUsage.input_tokens ?? 0}`,
    `- output tokens : ${totalUsage.output_tokens ?? 0}`,
    `- cache_read tokens : ${totalUsage.cache_read_input_tokens ?? 0}`,
    `- cache_creation tokens : ${totalUsage.cache_creation_input_tokens ?? 0}`,
    '',
  ];

  fs.mkdirSync(LOGS_ROOT, { recursive: true });
  const reportPath = path.join(LOGS_ROOT, `${runDate}.md`);
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');

  updateStateMd({
    runDate,
    dryRun,
    phase,
    silo,
    publishedCount: published.length,
    blockedCount: draft.length,
    errorCount: erreur.length,
    lastScheduledDate: published.length ? published[published.length - 1].postDate : null,
    reportRelPath: `logs/autopublish/${runDate}.md`,
  });

  return reportPath;
}

function updateStateMd({ runDate, dryRun, phase, silo, publishedCount, blockedCount, errorCount, lastScheduledDate, reportRelPath }) {
  if (!fs.existsSync(STATE_MD_PATH)) return;
  const content = fs.readFileSync(STATE_MD_PATH, 'utf8');

  const blockLines = [
    MARKER_START,
    `## Autopublish — dernier run : ${runDate}${dryRun ? ' (dry-run)' : ''}`,
    '',
    `- Phase : ${phase} — silo en cours : ${silo ?? '—'}`,
    `- Programmées : ${publishedCount} — bloquées (draft) : ${blockedCount} — erreurs techniques : ${errorCount}${errorCount ? ' ⚠️' : ''}`,
    lastScheduledDate ? `- Dernier article programmé pour : ${lastScheduledDate}` : null,
    `- Détail complet : [${reportRelPath}](${reportRelPath})`,
    MARKER_END,
  ].filter(Boolean);
  const block = blockLines.join('\n');

  let next;
  if (content.includes(MARKER_START) && content.includes(MARKER_END)) {
    const re = new RegExp(`${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`);
    next = content.replace(re, block);
  } else {
    // Première insertion : juste après la ligne "## Niche active" pour rester visible en haut du fichier.
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.startsWith('## Niche active'));
    const insertAt = idx === -1 ? 0 : idx + 2; // saute la ligne de contenu qui suit le titre
    lines.splice(insertAt, 0, '', block, '');
    next = lines.join('\n');
  }
  fs.writeFileSync(STATE_MD_PATH, next, 'utf8');
}

module.exports = { writeRunReport };
