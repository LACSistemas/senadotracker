from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.md', '.ts', '.tsx', '.json', '.css', '.mjs', '.yml', '.yaml', '.html'}
SKIP_PARTS = {'.git', '.next', 'node_modules', 'data'}
CHARS = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇñÑºª—–“”‘’…→↗·'

def garble(value: str) -> str | None:
    try:
        return value.encode('utf-8').decode('cp1252')
    except UnicodeError:
        return None

replacements: dict[str, str] = {}
for correct in CHARS:
    value = correct
    for _ in range(4):
        value = garble(value)
        if value is None:
            break
        replacements[value] = correct

# UTF-8 BOM or non-breaking space decoded as text.
replacements.update({'ï»¿': '', 'Â ': ' ', 'Â ': ' '})
ordered = sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True)

changed: list[str] = []
residual: list[str] = []
for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix.lower() not in EXTENSIONS or any(part in SKIP_PARTS for part in path.parts):
        continue
    try:
        original = path.read_text(encoding='utf-8')
    except UnicodeError:
        continue
    repaired = original
    for broken, correct in ordered:
        repaired = repaired.replace(broken, correct)
    if repaired != original:
        path.write_text(repaired, encoding='utf-8', newline='')
        changed.append(str(path.relative_to(ROOT)))
    if any(broken in repaired for broken, _ in ordered):
        residual.append(str(path.relative_to(ROOT)))

print(f'{len(changed)} arquivo(s) reparado(s)')
for name in changed:
    print(name)
print(f'{len(residual)} arquivo(s) ainda suspeito(s)')
for name in residual:
    print(name)
