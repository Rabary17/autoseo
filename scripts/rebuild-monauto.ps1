# Rebuild quotidien du site statique monauto - lance par une tache planifiee
# Windows tous les jours a 3h du matin (voir docs/architecture-headless.md
# section 4). Regenere frontend/monauto/out/ a partir du contenu WordPress
# publie la veille. Le resultat (dossier out/) est ce qu'il faudra deployer
# vers l'hebergeur statique choisi (Cloudflare Pages/Netlify/autre) une fois
# celui-ci en place - pour l'instant ce script se contente de reconstruire et
# de journaliser, sans deploiement automatique.
#
# Redirection via cmd.exe (pas les operateurs de flux PowerShell) : en
# PowerShell 5.1, capturer le stderr d'un executable natif (npm.cmd -> node)
# directement dans PowerShell le fait remonter comme une erreur terminante
# meme quand la commande reussit reellement - cmd.exe n'a pas ce probleme.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend\monauto"
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "rebuild-monauto.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "`n===== Rebuild $timestamp ====="

Set-Location $frontendDir

# Cause reelle constatee une fois sur cette machine : un run precedent
# interrompu (ex. depassement du delai d'un outil, plantage) peut laisser un
# processus node.exe zombie qui garde un fichier de out/ verrouille - le
# prochain build echoue alors avec une erreur EPERM/lstat qui n'a rien a voir
# avec l'antivirus. On tue tout node.exe dont la ligne de commande reference
# ce projet avant de nettoyer et reconstruire (sans risque a 3h du matin,
# personne ne travaille dessus a ce moment-la).
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like "*monauto*" } |
    ForEach-Object {
        Add-Content -Path $logFile -Value "Arret du processus node.exe residuel (PID $($_.ProcessId))."
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

# Deuxieme cause constatee (independante de la precedente) : le serveur
# WordPress local (Local by Flywheel) sature parfois et referme des
# connexions quand Next.js lui envoie plusieurs requetes a la suite au build,
# meme avec la limite de concurrence deja reduite cote Next.js (lib/wp.ts).
# Purement local a cette machine de test - une vraie instance WP de
# production tiendrait la charge sans probleme. En attendant, plus de
# tentatives + une pause plus longue absorbent ces echecs transitoires.
$maxAttempts = 5
$exitCode = 1
for ($attempt = 1; $attempt -le $maxAttempts -and $exitCode -ne 0; $attempt++) {
    if ($attempt -gt 1) {
        Add-Content -Path $logFile -Value "--- Nouvelle tentative $attempt/$maxAttempts ---"
        Start-Sleep -Seconds 15
    }
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $frontendDir "out")
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $frontendDir ".next")
    cmd /c "npm run build >> `"$logFile`" 2>&1"
    $exitCode = $LASTEXITCODE
}

if ($exitCode -eq 0) {
    Add-Content -Path $logFile -Value "OK - build termine avec succes."
} else {
    Add-Content -Path $logFile -Value "ECHEC - npm run build a retourne le code $exitCode apres $maxAttempts tentative(s)."
    exit $exitCode
}
