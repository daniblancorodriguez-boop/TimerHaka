"""Genera los iconos de HAKATIMER a partir de www/icons/gym-logo.png (logo cuadrado). Uso: python3 tools_make_icons.py"""
from PIL import Image
S = 1024
BG = (231, 189, 19)
im = Image.open('www/icons/gym-logo.png').convert('RGB')
full = im.resize((S, S), Image.LANCZOS)
out = 'www/icons/'
full.resize((512, 512), Image.LANCZOS).save(out + 'icon-512.png')
full.resize((192, 192), Image.LANCZOS).save(out + 'icon-192.png')
full.save(out + 'icon-1024.png')
mk = Image.new('RGB', (S, S), BG)                       # iconos adaptativos: logo dentro de la zona segura
k = int(S * 0.66); mk.paste(im.resize((k, k), Image.LANCZOS), ((S - k) // 2, (S - k) // 2))
mk.resize((512, 512), Image.LANCZOS).save(out + 'icon-512-maskable.png')
print('iconos listos')
