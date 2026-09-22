"""Package the validated LENS release without dependencies or private scan history."""
from pathlib import Path
import ast, hashlib, json, re, shutil, zipfile
from datetime import datetime, timezone
root = Path(__file__).resolve().parents[1]
workspace = root.parent
runtime = ast.literal_eval(re.search(r"const buildFiles=(\[[^;]+\]);", (root / 'server.js').read_text()).group(1))
hash_state = hashlib.sha256()
for name in runtime:
    hash_state.update((root / name).read_bytes())
build_id = hash_state.hexdigest()[:12]
version = json.loads((root / 'package.json').read_text())['version']
results = json.loads((root / 'test-output/design/results.json').read_text())
assert results['build'] == build_id, 'Design evidence does not match the current runtime.'
assert not results['errors']
separation = json.loads((root / 'test-output/separation/results.json').read_text())
assert separation['buildId'] == build_id and separation['status'] == 'passed'
assert 'All thirteen regression suites passed.' in (root / 'test-output/separation-regression.log').read_text()
assert (root / 'lens-tokens.css').read_bytes() == (workspace / 'lens-design-system/tokens.css').read_bytes()
manifest = {
    'version': version, 'buildId': build_id,
    'packagedAt': datetime.now(timezone.utc).isoformat(),
    'validation': 'Thirteen headless regression suites passed; final wording and per-URL summary checked with scoring, design, result separation and export cases',
    'fullRegressionBuild': 'b099d3c8a73d', 'finalDesignValidationBuild': results['build'],
    'runtime': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in runtime},
    'scope': 'LinkLens implemented; shared design foundation and follow-up contracts for ImageLens and A11yLens',
}
(root / 'RELEASE-MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = workspace / f'LinkLens-{version}-{build_id}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        if any(part in ['node_modules', '.git', '.DS_Store', '__pycache__'] for part in rel.parts):
            continue
        # Ship only this release's public fixture evidence, not prior live-site scan outputs.
        if rel.parts[0] == 'validation-output':
            continue
        if rel.parts[0] == 'test-output' and not (len(rel.parts) > 1 and (rel.parts[1] in ['design','separation'] or rel.name in ['separation-regression.log','separation-focused.log','separation-saucedemo.log','separation-final-design.log','separation-final-scoring.log'])):
            continue
        z.write(path, Path('link-lense') / rel)
    for path in sorted((workspace / 'lens-design-system').rglob('*')):
        if path.is_file():
            z.write(path, path.relative_to(workspace))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name, expected in manifest['runtime'].items():
        assert hashlib.sha256(z.read('link-lense/' + name)).hexdigest() == expected
shutil.copyfile(archive, workspace / 'LinkLense-latest.zip')
shutil.copyfile(archive, workspace / 'LinkLens-latest.zip')
print(json.dumps({'archive': str(archive), 'buildId': build_id, 'bytes': archive.stat().st_size}, indent=2))
