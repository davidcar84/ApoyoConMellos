from PIL import Image, ImageDraw, ImageFont
import math

def make_icon(size, filename):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 512

    def sc(v): return int(v * s)

    # Background
    d.rounded_rectangle([0, 0, size-1, size-1], radius=sc(80), fill='#1565C0')
    d.rounded_rectangle([sc(8), sc(8), size-sc(8), size-sc(8)], radius=sc(72),
                        fill=None, outline=(255,255,255,25), width=max(1,sc(3)))

    # ===== LEFT HAND =====
    hand_pts = [
        (sc(78), sc(310)), (sc(85), sc(275)), (sc(100), sc(255)),
        (sc(125), sc(245)), (sc(160), sc(240)), (sc(195), sc(245)),
        (sc(220), sc(255)), (sc(232), sc(275)), (sc(238), sc(310)),
        (sc(235), sc(340)), (sc(220), sc(360)), (sc(195), sc(370)),
        (sc(160), sc(375)), (sc(125), sc(370)), (sc(100), sc(360)),
        (sc(85), sc(340))
    ]
    d.polygon(hand_pts, fill='#64B5F6')
    d.ellipse([sc(70), sc(268), sc(98), sc(310)], fill='#64B5F6')
    d.ellipse([sc(222), sc(268), sc(248), sc(310)], fill='#64B5F6')

    # ===== RIGHT HAND =====
    roff = sc(190)
    hand_pts_r = [(x+roff, y) for x,y in hand_pts]
    d.polygon(hand_pts_r, fill='#42A5F5')
    d.ellipse([sc(70)+roff, sc(268), sc(98)+roff, sc(310)], fill='#42A5F5')
    d.ellipse([sc(222)+roff, sc(268), sc(248)+roff, sc(310)], fill='#42A5F5')

    # ===== BABY GIRL (left) =====
    gx, gy = sc(160), sc(255)
    hr = sc(32)

    # Body/onesie
    d.rounded_rectangle([gx-sc(38), gy-sc(10), gx+sc(38), gy+sc(55)], radius=sc(18), fill='#E3F2FD')
    d.ellipse([gx-sc(38), gy+sc(30), gx+sc(38), gy+sc(65)], fill='#E3F2FD')

    # Arms
    d.ellipse([gx-sc(48), gy+sc(2), gx-sc(28), gy+sc(22)], fill='#FFCC80')
    d.ellipse([gx+sc(28), gy+sc(2), gx+sc(48), gy+sc(22)], fill='#FFCC80')
    d.ellipse([gx-sc(52), gy+sc(6), gx-sc(38), gy+sc(20)], fill='#FFD699')
    d.ellipse([gx+sc(38), gy+sc(6), gx+sc(52), gy+sc(20)], fill='#FFD699')

    # Head
    hcy = gy - sc(28)
    d.ellipse([gx-hr, hcy-hr, gx+hr, hcy+hr], fill='#FFE0B2')
    d.ellipse([gx-hr, hcy-hr, gx+hr, hcy+hr], fill=None, outline='#F5C89A', width=max(1,sc(1)))

    # Hair - girl
    d.ellipse([gx-hr-sc(2), hcy-hr-sc(4), gx+hr+sc(2), hcy-sc(8)], fill='#8D6E63')
    d.ellipse([gx-hr-sc(6), hcy-sc(15), gx-hr+sc(10), hcy+sc(12)], fill='#8D6E63')
    d.ellipse([gx+hr-sc(10), hcy-sc(15), gx+hr+sc(6), hcy+sc(12)], fill='#8D6E63')
    d.chord([gx-sc(25), hcy-hr-sc(6), gx+sc(25), hcy-sc(5)], 180, 360, fill='#8D6E63')

    # Bow (pink)
    bow_x, bow_y = gx+sc(18), hcy-sc(28)
    d.ellipse([bow_x-sc(14), bow_y-sc(8), bow_x, bow_y+sc(8)], fill='#F48FB1')
    d.ellipse([bow_x, bow_y-sc(8), bow_x+sc(14), bow_y+sc(8)], fill='#F48FB1')
    d.ellipse([bow_x-sc(4), bow_y-sc(4), bow_x+sc(4), bow_y+sc(4)], fill='#E91E63')

    # Eyes - cartoon style
    ey = hcy - sc(2)
    d.ellipse([gx-sc(16), ey-sc(9), gx-sc(4), ey+sc(9)], fill='white')
    d.ellipse([gx+sc(4), ey-sc(9), gx+sc(16), ey+sc(9)], fill='white')
    d.ellipse([gx-sc(14), ey-sc(6), gx-sc(6), ey+sc(6)], fill='#5D4037')
    d.ellipse([gx+sc(6), ey-sc(6), gx+sc(14), ey+sc(6)], fill='#5D4037')
    d.ellipse([gx-sc(12), ey-sc(4), gx-sc(8), ey+sc(3)], fill='#212121')
    d.ellipse([gx+sc(8), ey-sc(4), gx+sc(12), ey+sc(3)], fill='#212121')
    d.ellipse([gx-sc(13), ey-sc(5), gx-sc(10), ey-sc(1)], fill='white')
    d.ellipse([gx+sc(7), ey-sc(5), gx+sc(10), ey-sc(1)], fill='white')

    # Smile
    d.arc([gx-sc(10), ey+sc(5), gx+sc(10), ey+sc(20)], 10, 170, fill='#D4846A', width=max(2,sc(2)))

    # Cheeks
    d.ellipse([gx-sc(22), ey+sc(5), gx-sc(13), ey+sc(13)], fill=(255,138,128,80))
    d.ellipse([gx+sc(13), ey+sc(5), gx+sc(22), ey+sc(13)], fill=(255,138,128,80))

    # ===== BABY BOY (right) =====
    bx, by = sc(350), sc(255)

    # Body/onesie
    d.rounded_rectangle([bx-sc(38), by-sc(10), bx+sc(38), by+sc(55)], radius=sc(18), fill='#BBDEFB')
    d.ellipse([bx-sc(38), by+sc(30), bx+sc(38), by+sc(65)], fill='#BBDEFB')

    # Arms
    d.ellipse([bx-sc(48), by+sc(2), bx-sc(28), by+sc(22)], fill='#FFCC80')
    d.ellipse([bx+sc(28), by+sc(2), bx+sc(48), by+sc(22)], fill='#FFCC80')
    d.ellipse([bx-sc(52), by+sc(6), bx-sc(38), by+sc(20)], fill='#FFD699')
    d.ellipse([bx+sc(38), by+sc(6), bx+sc(52), by+sc(20)], fill='#FFD699')

    # Head
    bhy = by - sc(28)
    d.ellipse([bx-hr, bhy-hr, bx+hr, bhy+hr], fill='#FFE0B2')
    d.ellipse([bx-hr, bhy-hr, bx+hr, bhy+hr], fill=None, outline='#F5C89A', width=max(1,sc(1)))

    # Hair - boy, shorter spiky
    d.ellipse([bx-hr-sc(1), bhy-hr-sc(3), bx+hr+sc(1), bhy-sc(12)], fill='#5D4037')
    for angle_offset in [-25, -10, 5, 20]:
        tx = bx + sc(angle_offset)
        d.polygon([(tx-sc(6), bhy-sc(26)), (tx, bhy-sc(40)), (tx+sc(6), bhy-sc(26))], fill='#5D4037')

    # Eyes (blue iris for boy)
    ey2 = bhy - sc(2)
    d.ellipse([bx-sc(16), ey2-sc(9), bx-sc(4), ey2+sc(9)], fill='white')
    d.ellipse([bx+sc(4), ey2-sc(9), bx+sc(16), ey2+sc(9)], fill='white')
    d.ellipse([bx-sc(14), ey2-sc(6), bx-sc(6), ey2+sc(6)], fill='#1976D2')
    d.ellipse([bx+sc(6), ey2-sc(6), bx+sc(14), ey2+sc(6)], fill='#1976D2')
    d.ellipse([bx-sc(12), ey2-sc(4), bx-sc(8), ey2+sc(3)], fill='#212121')
    d.ellipse([bx+sc(8), ey2-sc(4), bx+sc(12), ey2+sc(3)], fill='#212121')
    d.ellipse([bx-sc(13), ey2-sc(5), bx-sc(10), ey2-sc(1)], fill='white')
    d.ellipse([bx+sc(7), ey2-sc(5), bx+sc(10), ey2-sc(1)], fill='white')

    # Open mouth smile
    d.chord([bx-sc(10), ey2+sc(6), bx+sc(10), ey2+sc(22)], 0, 180, fill='#E57373')
    d.chord([bx-sc(5), ey2+sc(12), bx+sc(5), ey2+sc(22)], 0, 180, fill='#EF9A9A')

    # Cheeks
    d.ellipse([bx-sc(22), ey2+sc(5), bx-sc(13), ey2+sc(13)], fill=(255,138,128,80))
    d.ellipse([bx+sc(13), ey2+sc(5), bx+sc(22), ey2+sc(13)], fill=(255,138,128,80))

    # ===== HEART =====
    hx, hy = sc(256), sc(240)
    hs = sc(11)
    d.ellipse([hx-hs, hy-hs, hx, hy+sc(2)], fill='#FF5252')
    d.ellipse([hx, hy-hs, hx+hs, hy+sc(2)], fill='#FF5252')
    d.polygon([(hx-hs, hy-sc(2)), (hx, hy+hs+sc(2)), (hx+hs, hy-sc(2))], fill='#FF5252')

    # ===== TEXT =====
    try:
        font_big = ImageFont.truetype('arialbd.ttf', sc(40))
        font_sm = ImageFont.truetype('arial.ttf', sc(26))
    except Exception:
        try:
            font_big = ImageFont.truetype('arial.ttf', sc(40))
            font_sm = ImageFont.truetype('arial.ttf', sc(26))
        except Exception:
            font_big = ImageFont.load_default()
            font_sm = ImageFont.load_default()

    bbox = d.textbbox((0,0), 'APOYO', font=font_big)
    tw = bbox[2] - bbox[0]
    d.text(((size-tw)//2, sc(400)), 'APOYO', fill='white', font=font_big)

    bbox2 = d.textbbox((0,0), 'con Mellos', font=font_sm)
    tw2 = bbox2[2] - bbox2[0]
    d.text(((size-tw2)//2, sc(445)), 'con Mellos', fill=(255,255,255,210), font=font_sm)

    img.save(filename, 'PNG')
    print(f'Created {filename} ({size}x{size})')

make_icon(512, 'c:/Users/David/Claude-ApoyoConMellos/icons/icon-512.png')
make_icon(192, 'c:/Users/David/Claude-ApoyoConMellos/icons/icon-192.png')
