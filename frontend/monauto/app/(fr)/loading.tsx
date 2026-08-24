// Fallback Suspense affiché par Next.js pendant le chargement d'une page (le
// temps du fetch WP côté serveur) — sans ça, l'utilisateur voit l'ancienne
// page rester figée sans aucun signe qu'un clic a été pris en compte
// (demande explicite de l'utilisateur, 2026-07-29). S'applique à toutes les
// routes qui n'ont pas leur propre loading.tsx plus spécifique.
export default function Loading() {
  return (
    <div className="wrap" style={{ padding: "96px 0", display: "flex", justifyContent: "center" }}>
      <div className="page-spinner" role="status" aria-label="Chargement en cours">
        <span className="page-spinner__ring" aria-hidden="true" />
      </div>
    </div>
  );
}
