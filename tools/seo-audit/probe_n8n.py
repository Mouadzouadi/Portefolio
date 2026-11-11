"""Second point d'observation pour l'audit : requetes vers zmsolutions.fr faites depuis le serveur n8n.

  python3 tools/seo-audit/probe_n8n.py <chemin de deploy.py du depot n8n>

Utile quand le poste d'audit ne peut pas joindre le port 80 (redirections http -> https) ou que sa connexion
coupe. Cree un workflow temporaire (adresse et secret aleatoires, hotes limites a zmsolutions.fr et www),
sans suivi de redirection, puis le supprime. Sortie : une ligne par requete (code, Location, duree).
"""
import importlib.util, json, secrets, sys, time, urllib.request

import os
spec = importlib.util.spec_from_file_location("deploy", os.environ.get("N8N_DEPLOY") or sys.argv[1])
deploy = importlib.util.module_from_spec(spec); spec.loader.exec_module(deploy)
call, API = deploy.call, deploy.API
BASE = API.rsplit("/api/", 1)[0]
GOOGLEBOT = ("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) "
             "Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")

TESTS = [
    ("http apex", "http://zmsolutions.fr/"), ("http www", "http://www.zmsolutions.fr/"), ("https www", "https://www.zmsolutions.fr/"),
    ("https www page", "https://www.zmsolutions.fr/agent-vocal-ia-restaurant/"), ("http page", "http://zmsolutions.fr/agent-vocal-ia-restaurant/"),
    ("index.html", "https://zmsolutions.fr/index.html"), ("sans slash final", "https://zmsolutions.fr/creation-site-web"),
    ("ancienne page", "https://zmsolutions.fr/creation-site-web-blois/"), ("404", "https://zmsolutions.fr/page-inexistante-xyz"),
    ("404 dossier", "https://zmsolutions.fr/dossier-inexistant/"), ("majuscules", "https://zmsolutions.fr/Agent-Vocal-IA-Restaurant/"),
    ("parametre", "https://zmsolutions.fr/?utm_source=test"), ("page + index.html", "https://zmsolutions.fr/creation-site-web/index.html"),
] + [("stabilite %d" % i, "https://zmsolutions.fr/commande-whatsapp-restaurant/") for i in range(1, 13)]


def workflow(path, secret):
    cond = lambda cid, left: {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                              "conditions": [{"id": cid, "leftValue": left, "rightValue": True, "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
                              "combinator": "and"}, "options": {}}
    ok = "={{ $json.headers['x-audit'] === '%s' && /^https?:\\/\\/(www\\.)?zmsolutions\\.fr\\//.test(String($json.body.url || '')) }}" % secret
    return {"name": "ZZ audit SEO (temporaire)", "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "none"}, "nodes": [
        {"parameters": {"httpMethod": "POST", "path": path, "responseMode": "lastNode", "options": {}}, "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0], "id": "a1", "name": "W", "webhookId": path},
        {"parameters": cond("s", ok), "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [200, 0], "id": "a2", "name": "OK?"},
        {"parameters": {"url": "={{ $json.body.url }}", "sendHeaders": True, "headerParameters": {"parameters": [{"name": "User-Agent", "value": GOOGLEBOT}]},
                        "options": {"timeout": 20000, "redirect": {"redirect": {"followRedirects": False}}, "response": {"response": {"fullResponse": True, "neverError": True, "responseFormat": "text"}}}},
         "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [400, 0], "id": "a3", "name": "R", "onError": "continueRegularOutput"},
        {"parameters": {"jsCode": "const r = $input.first().json; const h = r.headers || {}; const b = String(r.body || r.data || '');\n"
                                  "const text = /html|css|javascript|json|xml|plain/.test(h['content-type'] || '');\n"
                                  "return [{ json: { status: r.statusCode || 0, location: h.location || null, type: h['content-type'] || null, bytes: b.length,\n"
                                  "  length: h['content-length'] || null, cache: h['cache-control'] || null, encoding: h['content-encoding'] || null, lastmod: h['last-modified'] || null,\n"
                                  "  title: (b.match(/<title>([^<]*)/) || [])[1] || null, xrobots: h['x-robots-tag'] || null, hsts: h['strict-transport-security'] || null,\n"
                                  "  body: text && $('W').first().json.body.want_body ? b : null, error: r.error ? String(r.error.message || r.error).slice(0, 160) : null } }];"},
         "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [600, 0], "id": "a4", "name": "C"}],
        "connections": {"W": {"main": [[{"node": "OK?", "type": "main", "index": 0}]]}, "OK?": {"main": [[{"node": "R", "type": "main", "index": 0}], []]},
                        "R": {"main": [[{"node": "C", "type": "main", "index": 0}]]}}}


class Probe:
    """with Probe() as p: p.get(url, want_body=False) -> dict (status, location, type, cache, bytes, body...)"""
    def __enter__(self):
        self.path, self.secret = "zz-audit-" + secrets.token_hex(6), secrets.token_hex(16)
        code, res = call("POST", "/workflows", workflow(self.path, self.secret))
        if code != 200:
            raise SystemExit("creation refusee : %s %s" % (code, res))
        self.wid = res["id"]
        call("POST", "/workflows/%s/activate" % self.wid); time.sleep(2)
        return self

    def __exit__(self, *exc):
        call("POST", "/workflows/%s/deactivate" % self.wid)
        print("workflow temporaire supprime :", call("DELETE", "/workflows/" + self.wid)[0], file=sys.stderr)

    def get(self, url, want_body=False):
        req = urllib.request.Request(BASE + "/webhook/" + self.path, data=json.dumps({"url": url, "want_body": want_body}).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "X-Audit": self.secret})
        for k in range(4):
            try:
                return json.loads(urllib.request.urlopen(req, timeout=60).read() or b"{}")
            except Exception as e:
                err = e; time.sleep(3)
        return {"status": "?", "error": "appel n8n : %s" % err}


if __name__ == "__main__":
    out = []
    with Probe() as p:
        for name, url in TESTS:
            t = time.time(); r = p.get(url)
            r.update({"test": name, "url": url, "seconds": round(time.time() - t, 2)}); out.append(r)
            print("%-18s %s -> %s %s %s%s" % (name, url, r.get("status"), r.get("location") or "", "%ss" % r["seconds"], " ERREUR " + r["error"] if r.get("error") else ""), flush=True)
            time.sleep(1)
    json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else "probe.json", "w"), ensure_ascii=False, indent=1)
