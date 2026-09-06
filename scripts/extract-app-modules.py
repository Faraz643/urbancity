from pathlib import Path

app = Path('frontend/src/App.tsx')
text = app.read_text(encoding='utf-8')
print(f'App.tsx currently has {len(text.splitlines())} lines')
