"""Verifie que le site en ligne est identique au depot, fichier par fichier, depuis le serveur n8n (probe_n8n.Probe),
et releve les en-tetes de chaque fichier. Sortie : <dossier>/_headers.json + un etat par fichier.

  N8N_DEPLOY=<chemin de deploy.py> python3 tools/seo-audit/verify_live.py <dossier de sortie> [chemins en plus...]

Texte (HTML, CSS, JS, JSON, XML) : contenu compare caractere par caractere. Images : taille comparee (Content-Length).
Les chemins en plus (restes d'un ancien site, fichiers sensibles) sont seulement testes : code et type.
"""
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
out_dir, extra = sys.argv[1], sys.argv[2:]
sys.argv = [sys.argv[0], os.environ["N8N_DEPLOY"]]
from probe_n8n import Probe  # noqa: E402

SITE = "https://zmsolutions.fr"
SKIP = (".gitignore", "README.md", "api/config.php")
files = [f for f in subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
         if f and not f.startswith(("pages/", "tools/")) and f not in SKIP]
TEXT = (".html", ".css", ".js", ".json", ".xml", ".txt")
headers, diff = {}, []
os.makedirs(out_dir, exist_ok=True)
with Probe() as p:
    for f in files:
        url_path = "/" + (f[:-len("index.html")] if f.endswith("/index.html") or f == "index.html" else f)
        if f.startswith("api/") or f.endswith(".htaccess"):
            r = p.get(SITE + "/" + f)
            headers["/" + f] = {k: r.get(k) for k in ("status", "type", "xrobots")}
            print("%-48s %s (fichier serveur, non public attendu)" % ("/" + f, r.get("status")), flush=True); time.sleep(0.4); continue
        is_text = f.endswith(TEXT)
        r = p.get(SITE + url_path, want_body=is_text)
        local = open(os.path.join(ROOT, f), "rb").read()
        if is_text:
            same = (r.get("body") or "").replace("\r\n", "\n").strip() == local.decode("utf-8", "replace").replace("\r\n", "\n").strip()
        else:
            same = str(r.get("length")) == str(len(local))
        headers[url_path] = {"status": r.get("status"), "type": r.get("type"), "cache": r.get("cache"), "encoding": "gzip" if is_text and f.endswith((".html", ".css", ".js", ".json", ".xml", ".txt")) else None,
                             "bytes": len(local), "identical": same, "lastmod": r.get("lastmod"), "xrobots": r.get("xrobots")}
        if not same or r.get("status") != 200:
            diff.append(url_path)
        print("%-48s %s %s cache=%s" % (url_path, r.get("status"), "identique" if same else "DIFFERENT (en ligne %s o / depot %d o)" % (r.get("length") or r.get("bytes"), len(local)), r.get("cache")), flush=True)
        time.sleep(0.4)
    print("--- chemins en plus")
    for e in extra:
        r = p.get(SITE + e)
        headers[e] = {"status": r.get("status"), "type": r.get("type"), "extra": True, "location": r.get("location"), "length": r.get("length")}
        print("%-48s %s %s %s" % (e, r.get("status"), r.get("type") or "", r.get("location") or ""), flush=True); time.sleep(0.4)
json.dump(headers, open(os.path.join(out_dir, "_headers.json"), "w"), indent=1)
print("fichiers du depot :", len(files), "| differents ou absents en ligne :", diff or "aucun")
