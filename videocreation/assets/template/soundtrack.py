"""ШАБЛОН саундтрека. Скопируйте в папку проекта и расставьте события по cues.json.

    python3 soundtrack.py            -> mix.wav + таблица уровней (stems)

Правила: музыка меняет настроение вместе с сюжетом (см. references/audio.md);
каждое появление заголовка = thump; каждая смена сцены = whoosh W1 за 0.05 с до склейки;
большие цифры/повороты = impact; перед раскрытием — riser, который заканчивается ровно на нём.
"""
import os, sys
SKILL = os.environ.get("VIDEOCREATION", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
sys.path.insert(0, os.path.join(SKILL, "scripts"))
from soundlib import *  # noqa: E402,F401

HERE = os.path.dirname(os.path.abspath(__file__))
DUR = 12.0
VO = os.path.join(HERE, "vo_fit.wav")
s = Session(dur=DUR, voice=VO if os.path.exists(VO) else None, voice_offset=0.1)   # offset = --offset из fit_vo.py

# --- музыка: хук -> основная часть -> финал ---
hook_hits(s, [0.10, 1.20])                       # удары под словами хука
s.m(riser(2.0, f0=200, f1=6000), 1.6, -18)       # нарастание, заканчивается на первой сцене
groove(s, 3.6, 8.3, 110, Dmaj, 'marimba', clapg=-20)   # настроение основной части (см. audio.md)
impact(s, 8.4)                                   # финальный поворот
final_chord(s, 11.2)

# --- эффекты ---
s.fx(lightning(), 0.02, -8); s.fx(rumble(), 0.1, -14)
for t in [3.6, 8.4]: s.fx(W1, t - .05, -16)
for t, g in [(0.10, -6), (1.20, -10), (3.75, -12), (4.30, -12), (8.5, -9)]: s.fx(thump(), t, g)
for k in range(16): s.fx(tick(), 4.3 + k * .05, -30)                 # счётчик бежит
s.fx(pop(1000), 5.4, -18); s.fx(chime(1568), 9.6, -18)

s.section_gain([(0, 3.5, -4.0), (3.6, 8.3, 4.0)])   # подгоняйте по таблице stems ниже
s.mixdown(os.path.join(HERE, "mix.wav"))
s.stems([(0, 3.5), (3.6, 8.3), (8.4, DUR)])
