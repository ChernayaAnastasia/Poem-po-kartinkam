"""Вписывает слова песни из текстового файла в файл песни (songs/<имя>.json).

Запуск из папки репозитория:
    python _tools/vstavit_slova.py songs/ya-risuyu-rodinu.json slova.txt

Строчки вписываются по порядку: первая строчка текста — в первую картинку первого куплета и т. д.
Картинки и подписи не меняются. Куплеты в тексте отмечайте строками «1 куплет», «2 куплет»
(или пустой строкой между куплетами, если таких подписей нет). Название песни и строчки
«Слова …», «Музыка …» до первого куплета пропускаются.
"""
import json, re, sys
from pathlib import Path

MARKER = re.compile(r'^\s*(\d+\s*(-?й)?\s*куплет|куплет\s*\d+|припев)\s*[.:]?\s*$', re.I)
NUMBERED = re.compile(r'^(\d+)\s*[.)]\s*(.+)$')


def parse_lyrics(text):
    lines = text.replace('\r', '').split('\n')
    has_markers = any(MARKER.match(l) or re.match(r'^\s*\d+\s*[.)]\s*\S', l) for l in lines)
    verses, cur, marker = [], [], False

    def flush():
        nonlocal cur
        if cur:
            verses.append(cur)
        cur = []

    for l in lines:
        l = l.strip()
        if not l:
            if not has_markers and (verses or cur):
                flush()
            continue
        if re.match(r'^(слова|музыка|муз\.|сл\.)', l, re.I):
            continue
        if MARKER.match(l):
            if not marker:
                cur = []
            else:
                flush()
            marker = True
            continue
        m = NUMBERED.match(l)
        if m:
            if not marker:
                cur = []
            else:
                flush()
            marker = True
            cur.append(m.group(2).strip())
            continue
        cur.append(l)
    flush()
    return [v for v in verses if v]


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    song_path, text_path = Path(sys.argv[1]), Path(sys.argv[2])
    song = json.loads(song_path.read_text(encoding='utf-8'))
    verses = parse_lyrics(text_path.read_text(encoding='utf-8'))

    want = [len(v) for v in song['verses']]
    got = [len(v) for v in verses]
    if want != got:
        print(f'Не совпадает число строчек.\n  В файле песни по куплетам: {want}\n  В тексте по куплетам:      {got}')
        print('Проверьте подписи куплетов в тексте и попробуйте ещё раз. Файл песни не изменён.')
        sys.exit(1)

    for sv, tv in zip(song['verses'], verses):
        for line, text in zip(sv, tv):
            line['text'] = text.rstrip(',.;:')

    j = lambda x: json.dumps(x, ensure_ascii=False)
    out = '{\n  "title": %s,\n' % j(song['title'])
    for key in ('credits', 'listen'):
        if key in song:
            out += '  "%s": %s,\n' % (key, j(song[key]))
    out += '  "verses": [\n' + ',\n'.join(
        '    [\n' + ',\n'.join('      ' + j(l) for l in v) + '\n    ]' for v in song['verses']
    ) + '\n  ]\n}\n'
    song_path.write_text(out, encoding='utf-8')
    print(f'Готово: строчек вписано — {sum(got)}, файл {song_path} обновлён.')


if __name__ == '__main__':
    main()
