from html.parser import HTMLParser
from pathlib import Path

class Parser(HTMLParser):
    pass

for file_name in ['index.html', 'admin-dashboard.html', 'student-dashboard.html']:
    Parser().feed(Path(file_name).read_text(encoding='utf-8'))

print('HTML parse ok')
