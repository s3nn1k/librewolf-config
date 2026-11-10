.PHONY: build policies lint audit autoconfig heal
build:
	python3 scripts/build.py

policies: build
	python3 scripts/merge-policies.py policies.json chrome/sidebery-sidebar.css /usr/share/librewolf/distribution/policies.json > policies.merged.json

lint:
	python3 -m json.tool palette.json >/dev/null
	python3 -m json.tool chrome/JS/keymap.json >/dev/null
	for m in mappings/*.json policies.json; do python3 -m json.tool "$$m" >/dev/null || exit 1; done
	PYTHONPYCACHEPREFIX=/tmp/lwcfg-pycache python3 -m py_compile scripts/build.py scripts/audit.py scripts/merge-policies.py scripts/install-autoconfig.py scripts/heal-search.py

audit:
	python3 scripts/audit.py

autoconfig:
	python3 scripts/install-autoconfig.py

heal:
	python3 scripts/heal-search.py
