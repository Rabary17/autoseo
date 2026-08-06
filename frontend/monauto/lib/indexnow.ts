// Soumission IndexNow (Bing + moteurs partenaires) — appelée depuis
// app/api/revalidate/route.ts, qui reçoit déjà un événement à chaque
// publication/dépublication/mise à jour WordPress (mu-plugin
// monauto_send_revalidation), quelle que soit la source (édition manuelle,
// script de QC, ou passage automatique de WP de "future" à "publish"). Un
// seul point d'intégration couvre donc tous les cas, sans dupliquer la
// logique côté WordPress.
//
// La clé IndexNow n'est pas un secret : elle est déjà publiée en clair sur
// /f67b8b1993a0445f9dfd2caa7ecd9b47.txt (exigé par le protocole lui-même,
// qui vérifie que host et clé se répondent). Aucun risque à la coder en dur.
const INDEXNOW_KEY = "f67b8b1993a0445f9dfd2caa7ecd9b47";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export async function submitToIndexNow(urls: string[], siteUrl: string): Promise<void> {
  if (!urls.length) return;
  try {
    const host = new URL(siteUrl).host;
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    // IndexNow renvoie souvent 200/202 même sans corps — un échec (ex. clé pas
    // encore vérifiée juste après un premier déploiement) ne doit jamais faire
    // échouer la revalidation elle-même, seulement être loggé.
    if (!res.ok) {
      console.warn(`[indexnow] réponse ${res.status} pour ${urls.length} URL(s)`);
    }
  } catch (e) {
    console.warn(`[indexnow] échec de soumission : ${e}`);
  }
}
