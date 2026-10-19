#!/usr/bin/env python3
"""Generates the SEO landing pages (locations + services), sitemap.xml and OG/touch icons.
Run from the repo root:  python3 tools/build-pages.py
Edit the PAGES/SHOPS data below, rerun, commit."""
import json, os, html, datetime
BASE = 'https://eastcoasthockeyandskating.com'
TODAY = datetime.date.today().isoformat()
NAME = 'East Coast Hockey & Skating Supply'
FB = 'https://www.facebook.com/ForSportsLaurel/'
IG = 'https://www.instagram.com/east.coast.hockey.and.skating/'
BRANDS = ['Bauer', 'CCM', 'True', 'Warrior', 'Jackson', 'Edea']
SHOPS = [
 dict(slug='laurel-md', key='Laurel', city='Laurel', street='13800 Old Gunpowder Rd', zip='20707', phone='(301) 604-8200', tel='+13016048200',
      title='Skate Shop in Laurel, MD | Sharpening & Fitting | East Coast Hockey',
      h1='Hockey & Figure Skate Pro Shop in Laurel, Maryland',
      desc='Walk-in skate sharpening, fitting and heat molding in Laurel, MD. Bauer, CCM, True, Warrior, Jackson and Edea at East Coast Hockey & Skating Supply.',
      intro='Our Laurel shop is our flagship pro shop for hockey players and figure skaters. Walk in with your skates and the team here will sharpen them by hand, fit new boots to your foot, heat mold them, and repair rivets and eyelets, all in the shop and all without a reservation.',
      areas='Laurel, Beltsville, Greenbelt, College Park, Bowie, Columbia, Fulton and the Washington, DC to Baltimore corridor',
      near='Laurel sits between Washington, DC and Baltimore, so skaters come to us from across the DMV.'),
 dict(slug='rockville-md', key='Rockville', city='Rockville', street='50 Southlawn Ct', zip='20850', phone='(301) 610-7500', tel='+13016107500',
      title='Skate Shop in Rockville, MD | Sharpening & Fitting | East Coast Hockey',
      h1='Hockey & Figure Skate Pro Shop in Rockville, Maryland',
      desc='Walk-in skate sharpening, fitting and heat molding in Rockville, MD. Bauer, CCM, True, Warrior, Jackson and Edea at East Coast Hockey & Skating Supply.',
      intro='Our Rockville shop is a full pro shop at the rink. Bring your skates in for hand sharpening, get fitted for hockey or figure skates, and have boots heat molded or stretched while you are here. No appointment is needed.',
      areas='Rockville, Gaithersburg, Bethesda, North Bethesda, Potomac, Silver Spring, Germantown and Washington, DC',
      near='Rockville is a short drive from Washington, DC and the Montgomery County suburbs.'),
 dict(slug='piney-orchard-odenton-md', key='Piney Orchard', city='Odenton', street='8781 Piney Orchard Pky', zip='21113', phone='(410) 695-0000', tel='+14106950000',
      title='Skate Shop in Odenton (Piney Orchard), MD | East Coast Hockey',
      h1='Hockey & Figure Skate Pro Shop in Odenton (Piney Orchard), Maryland',
      desc='Walk-in skate sharpening, fitting and heat molding in Odenton, MD (Piney Orchard). Bauer, CCM, True, Warrior, Jackson and Edea.',
      intro='Our Piney Orchard shop is a rink pro shop in Odenton. Walk in for hand sharpening, a proper skate fitting, heat molding, boot stretching and quick repairs. Everything is done in the shop with no reservation.',
      areas='Odenton, Crofton, Gambrills, Severn, Millersville, Bowie, Annapolis and the Fort Meade area',
      near='Odenton is convenient to Annapolis, Bowie and the Baltimore and Washington suburbs.'),
]
def addr(s): return f"{s['street']}, {s['city']}, MD {s['zip']}"
def maps_dir(s): return 'https://www.google.com/maps/dir/?api=1&destination=' + addr(s).replace(' ', '+').replace(',', '%2C')
def maps_search(s): return 'https://www.google.com/maps/search/?api=1&query=' + (NAME + ' ' + addr(s)).replace(' ', '+').replace(',', '%2C').replace('&', '%26')
def esc(t): return html.escape(t, quote=True)

SERVICES = [
 dict(slug='skate-sharpening', title='Skate Sharpening in Maryland | Walk-In, Hand Sharpened',
      h1='Skate Sharpening in Maryland: Walk In, No Reservation',
      desc='Hand skate sharpening for hockey and figure skates in Laurel, Rockville and Odenton, MD. Walk-in, no appointment. Usually about 15 minutes.',
      lead='A good edge changes how you skate. We sharpen hockey and figure skates by hand at all three of our Maryland shops, and you never need a reservation. Walk in, hand us your skates, and tell us how you skate.',
      sections=[('How sharpening works here', ['Every pair is sharpened by hand and matched to the way you skate, not run through a one-size-fits-all setting.','Most sharpenings take about 15 minutes. During a game or tournament rush it can take longer, so give us a little extra time on busy weekends.','We sharpen hockey skates and figure skates, and we can check blades for damage while we have them.']),
                ('When to get your skates sharpened', ['The edges feel dull or you slide on turns and stops.','You skated over something hard, like a floor, a puck or the rink door area.','You are switching to a new pair or new steel and want them set up right.','You are not sure. Ask us and we will look at the blades with you.']),
                ('Tell us how you skate', ['Players and skaters have different preferences for bite and glide. Tell us your position, level and what feels off, and we will sharpen to match.'])],
      faq=[('Do I need an appointment for skate sharpening?','No. Sharpening is walk-in only at all three shops. We do not take reservations.'),
           ('How long does a skate sharpening take?','Usually about 15 minutes. It can take longer during busy rushes before games and tournaments.'),
           ('Do you sharpen figure skates?','Yes. We sharpen hockey skates and figure skates at every shop.'),
           ('Where can I get my skates sharpened near me?','We have shops in Laurel, Rockville and Odenton (Piney Orchard), Maryland. Walk into whichever is closest.')]),
 dict(slug='skate-fitting', title='Hockey Skate Fitting & Heat Molding in Maryland | Walk-In',
      h1='Hockey Skate Fitting & Heat Molding in Maryland',
      desc='Walk-in hockey and figure skate fitting, heat molding and boot stretching in Laurel, Rockville and Odenton, MD. Bauer, CCM, True, Warrior, Jackson, Edea.',
      lead='Skate size does not match shoe size, and it changes between brands. The fastest way to a comfortable pair is a proper fitting. Walk into any of our three Maryland shops and we will fit you in person. We do not take reservations.',
      sections=[('Proper skate fitting', ['We fit hockey and figure skates in the shop, with your foot in the boot, not from a chart.','We carry Bauer, CCM, True, Warrior, Jackson and Edea, so you can compare how different brands feel.','If you already know your model, we can still check the fit before you leave.']),
                ('Heat molding (baking)', ['Heat molding shapes the boot around your foot for a glove-like fit and helps reduce hot spots and break-in time.','It works for hockey skates and figure skates alike.']),
                ('Boot stretching and repairs', ['Boot stretching relieves pressure points so a good skate can feel right.','We repair rivets and eyelets to keep boots solid, often the same day.'])],
      faq=[('Do I need a reservation for a skate fitting?','No. Fittings are walk-in only at all three shops.'),
           ('Should I buy skates online?','We do not sell skates or gear online. Skate sizing varies between Bauer, CCM, True, Warrior, Jackson and Edea, so we fit you in person.'),
           ('What is heat molding?','Heat molding warms the skate so the boot shapes to your foot, which helps comfort and fit. We do it in the shop.'),
           ('Which brands do you carry?','Bauer, CCM, True, Warrior, Jackson and Edea.')]),
 dict(slug='figure-skating', title='Figure Skates, Blade Mounting & Sharpening in Maryland',
      h1='Figure Skates, Blade Mounting & Sharpening in Maryland',
      desc='Jackson and Edea figure skates, precision blade mounting, sharpening and fitting at our Maryland shops in Laurel, Rockville and Odenton. Walk-in only.',
      lead='Figure skaters at every level can walk into our Maryland shops for boots, blades and the work that makes them skate well together. We carry Jackson and Edea, mount blades, sharpen, and fit in person. No reservation is needed.',
      sections=[('Boots and fitting', ['Jackson and Edea figure skates, fit in the shop with your foot in the boot.','Boot stretching and heat molding for comfort and a precise fit.']),
                ('Blade mounting', ['Precise blade alignment matters. We mount figure blades in the shop with careful alignment.','Bring your blades and boots in and we will talk through the setup.']),
                ('Sharpening and repairs', ['Hand sharpening for figure blades at all three shops.','Rivet and eyelet repairs to keep boots solid.'])],
      faq=[('Do you carry figure skates?','Yes. We carry Jackson and Edea figure skates and handle boot work, blade mounting, sharpening and fitting.'),
           ('Do I need an appointment for blade mounting or sharpening?','No. All services are walk-in at our shops in Laurel, Rockville and Odenton.'),
           ('Can you sharpen figure skate blades?','Yes, by hand, at every shop.'),
           ('Do you sell figure skates online?','No. We fit figure skates in person at our shops.')]),
 dict(slug='team-apparel', title='Custom Hockey Team Apparel & Jerseys | Team Stores in Maryland',
      h1='Custom Hockey Team Apparel & Jerseys in Maryland',
      desc='Team stores for Maryland hockey programs: jerseys, pant shells, warm-ups, hoodies, tees, hats and bags with names and numbers. Pickup or shipping.',
      lead='We are the team apparel supplier for hockey programs across Maryland. Each team has its own store on our website where players and families choose items, sizes, names and numbers. We decorate everything in house.',
      sections=[('What teams order', ['Game jerseys and pant shells.','Warm-up jackets and pants.','Team hoodies, practice tees, hats and equipment bags.']),
                ('How ordering works', ['Find your program in our team stores, choose the item and size, and add the player name and number where the item needs it.','Send the order request. We confirm the details with you before anything is made.','Pick it up at our Laurel, Rockville or Odenton shop, or choose shipping.']),
                ('Personalized items', ['Items with a logo, name or number are made for you and are final sale, except when there is a defect or our mistake. See our returns policy for details.'])],
      faq=[('How do team stores work?','Find your program in the team stores on our website, pick your gear, size, name and number, and send your order request. We confirm the details and arrange payment.'),
           ('Can I pick up a team order in a shop?','Yes. Choose pickup at Laurel, Rockville or Odenton (Piney Orchard), or have it shipped.'),
           ('My team is not listed. Can you set one up?','Yes. Send us your logo and colors from the contact form and we will help.'),
           ('Can I return personalized team apparel?','Personalized items are final sale unless they arrive defective or we made a mistake. See our returns and refunds page.')]),
]

def ld_store(s, with_ctx=True):
    d = {'@type': 'SportingGoodsStore', '@id': f"{BASE}/locations/{s['slug']}#store", 'name': NAME, 'url': f"{BASE}/locations/{s['slug']}",
         'image': f"{BASE}/assets/og-image.jpg", 'logo': f"{BASE}/assets/logo.webp", 'telephone': s['tel'],
         'address': {'@type': 'PostalAddress', 'streetAddress': s['street'], 'addressLocality': s['city'], 'addressRegion': 'MD', 'postalCode': s['zip'], 'addressCountry': 'US'},
         'hasMap': maps_search(s), 'parentOrganization': {'@id': f'{BASE}/#org'},
         'areaServed': [{'@type': 'AdministrativeArea', 'name': 'Washington metropolitan area (DMV)'}, {'@type': 'State', 'name': 'Maryland'}],
         'brand': [{'@type': 'Brand', 'name': b} for b in BRANDS],
         'sameAs': [FB, IG], 'description': 'Hockey and figure skating pro shop: skate sharpening, fitting, heat molding, blade mounting and team apparel.'}
    if with_ctx: d['@context'] = 'https://schema.org'
    return d
def ld_org():
    return {'@type': 'Organization', '@id': f'{BASE}/#org', 'name': NAME, 'url': BASE + '/', 'logo': f'{BASE}/assets/logo.webp', 'sameAs': [FB, IG]}
def script(obj, id_=None):
    return '<script type="application/ld+json"' + (f' id="{id_}"' if id_ else '') + '>' + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '</script>'

def head(title, desc, path, ld):
    url = BASE + path
    return f'''<!doctype html>
<html lang="en">
<head>
<script src="/gate.js"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#041634">
<meta property="og:type" content="website"><meta property="og:site_name" content="{esc(NAME)}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(desc)}"><meta name="twitter:image" content="{BASE}/assets/og-image.jpg">
<link rel="icon" href="/assets/logo.webp"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/page.css">
{ld}
</head>
<body>
<header class="ph"><div class="bar"><a href="/" aria-label="{esc(NAME)} home"><img src="/assets/logo.webp" alt="{esc(NAME)}" width="150" height="46"></a>
<nav aria-label="Main"><a href="/#locations">Locations</a><a href="/skate-sharpening">Sharpening</a><a href="/skate-fitting">Fitting</a><a href="/figure-skating">Figure skating</a><a href="/team-apparel">Team apparel</a></nav>
<a class="cta" href="/#locations">Find a shop</a></div></header>
<main>'''

def foot():
    shops = ''.join(f'<li><a href="/locations/{s["slug"]}">{esc(s["key"])}</a> <span data-loc="{esc(s["key"])}" data-f="addr">{esc(addr(s))}</span> · <a data-loc="{esc(s["key"])}" data-f="tel" href="tel:{s["tel"]}"><span data-loc="{esc(s["key"])}" data-f="phone">{s["phone"]}</span></a></li>' for s in SHOPS)
    return f'''</main>
<footer class="pf"><div class="wrap"><div><strong>{esc(NAME)}</strong><p>Hockey and figure skating pro shop serving Maryland, Washington, DC and Northern Virginia. Skate sharpening and fitting are walk-in only, no reservations.</p></div>
<div><strong>Our shops</strong><ul>{shops}</ul></div>
<div><strong>Explore</strong><ul><li><a href="/skate-sharpening">Skate sharpening</a></li><li><a href="/skate-fitting">Skate fitting &amp; heat molding</a></li><li><a href="/figure-skating">Figure skating</a></li><li><a href="/team-apparel">Team apparel</a></li><li><a href="/returns">Returns &amp; refunds</a></li><li><a href="/">Home</a></li></ul></div></div>
<p class="copy">&copy; {datetime.date.today().year} {esc(NAME)} &middot; <a href="https://northco.us" target="_blank" rel="noopener">Made by NorthCo</a></p></footer>
<script src="/assets/ld-sync.js" defer></script>
</body></html>'''

def faq_html(faq):
    return '<section class="faq"><h2>Frequently asked questions</h2>' + ''.join(f'<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq) + '</section>'
def faq_ld(faq):
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}
def crumbs(items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + p} for i, (n, p) in enumerate(items)]}

def write(path, text):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)

urls = [('/', '1.0')]
# ---- location pages
LOC_FAQ = lambda s: [
    ('Do I need a reservation for skate sharpening or fitting?', 'No. Sharpening and fitting are walk-in only. We do not take reservations.'),
    ('How long does a sharpening take?', 'Usually about 15 minutes, longer during busy rushes before games and tournaments.'),
    ('Do you work on figure skates?', 'Yes. We sharpen, fit and mount blades for figure skates, and carry Jackson and Edea.'),
    (f'What is the address of the {s["key"]} shop?', f'{addr(s)}. Call {s["phone"]}.')]
for s in SHOPS:
    path = f"/locations/{s['slug']}"
    faq = LOC_FAQ(s)
    ld = script({'@context': 'https://schema.org', '@graph': [ld_org(), ld_store(s, False), crumbs([('Home', '/'), (f"{s['key']} shop", path)]), faq_ld(faq)]}, 'ld-page')
    others = ''.join(f'<li><a href="/locations/{o["slug"]}">{esc(o["key"])}: {esc(addr(o))}</a></li>' for o in SHOPS if o is not s)
    body = f'''<article class="wrap narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>{esc(s["key"])} shop</span></nav>
<h1>{esc(s["h1"])}</h1>
<p class="lead">{esc(s["intro"])}</p>
<div class="visit"><div><h2>Visit the {esc(s["key"])} shop</h2>
<p class="nap"><strong>{esc(NAME)}</strong><br><span data-loc="{esc(s["key"])}" data-f="addr">{esc(addr(s))}</span><br><a data-loc="{esc(s["key"])}" data-f="tel" href="tel:{s["tel"]}"><span data-loc="{esc(s["key"])}" data-f="phone">{s["phone"]}</span></a></p>
<p class="btns"><a class="btn p" data-loc="{esc(s["key"])}" data-f="tel" href="tel:{s["tel"]}">Call the shop</a><a class="btn" href="{maps_dir(s)}" target="_blank" rel="noopener">Get directions</a><a class="btn" href="{maps_search(s)}" target="_blank" rel="noopener">Hours &amp; reviews on Google</a></p></div></div>
<h2>What we do in the {esc(s["key"])} shop</h2>
<ul class="ticks"><li><a href="/skate-sharpening">Skate sharpening</a>, done by hand while you wait</li><li><a href="/skate-fitting">Skate fitting, heat molding and boot stretching</a></li><li>Rivet and eyelet repairs</li><li><a href="/figure-skating">Figure skates and blade mounting</a></li><li>Hockey sticks, protective gear and skates</li><li><a href="/team-apparel">Team apparel</a> pickup for team stores</li></ul>
<h2>Brands we carry</h2>
<p>{esc(", ".join(BRANDS[:-1]) + " and " + BRANDS[-1])}.</p>
<h2>Good to know</h2>
<ul class="ticks"><li><strong>Walk-in only.</strong> Sharpening and fitting do not need a reservation.</li><li>Bring your skates, and tell us how you skate.</li><li>We fit skates in person and do not sell skates or gear online.</li></ul>
<h2>Who we serve</h2>
<p>{esc(s["near"])} Skaters and players visit this shop from {esc(s["areas"])}.</p>
{faq_html(faq)}
<h2>Our other shops</h2><ul class="plain">{others}</ul>
</article>'''
    write(path.lstrip('/') + '.html', head(s['title'], s['desc'], path, ld) + body + foot())
    urls.append((path, '0.9'))

# ---- service pages
for sv in SERVICES:
    path = '/' + sv['slug']
    ld = script({'@context': 'https://schema.org', '@graph': [ld_org(), {'@type': 'Service', 'name': sv['h1'], 'serviceType': sv['slug'].replace('-', ' '), 'url': BASE + path, 'description': sv['desc'],
        'provider': {'@id': f'{BASE}/#org'}, 'areaServed': [{'@type': 'AdministrativeArea', 'name': 'Washington metropolitan area (DMV)'}, {'@type': 'State', 'name': 'Maryland'}]},
        crumbs([('Home', '/'), (sv['h1'].split(':')[0].split('|')[0], path)]), faq_ld(sv['faq'])]}, 'ld-page')
    secs = ''.join(f'<h2>{esc(h)}</h2><ul class="ticks">' + ''.join(f'<li>{esc(i)}</li>' for i in items) + '</ul>' for h, items in sv['sections'])
    shops = ''.join(f'<li><a href="/locations/{o["slug"]}"><strong>{esc(o["key"])}</strong></a>: <span data-loc="{esc(o["key"])}" data-f="addr">{esc(addr(o))}</span> · <a data-loc="{esc(o["key"])}" data-f="tel" href="tel:{o["tel"]}"><span data-loc="{esc(o["key"])}" data-f="phone">{o["phone"]}</span></a></li>' for o in SHOPS)
    body = f'''<article class="wrap narrow">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <span>{esc(sv["h1"].split(":")[0].split("|")[0])}</span></nav>
<h1>{esc(sv["h1"])}</h1>
<p class="lead">{esc(sv["lead"])}</p>
{secs}
<h2>Where to go</h2>
<p>Walk into any of our three Maryland shops. No reservation is needed.</p><ul class="plain">{shops}</ul>
<p class="btns"><a class="btn p" href="/#locations">Find a shop</a></p>
{faq_html(sv["faq"])}
</article>'''
    write(sv['slug'] + '.html', head(sv['title'], sv['desc'], path, ld) + body + foot())
    urls.append((path, '0.8'))
urls.append(('/returns', '0.3'))

# ---- sitemap
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
    f'  <url><loc>{BASE}{p}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority></url>\n' for p, pr in urls) + '</urlset>\n'
write('sitemap.xml', sm)
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: {BASE}/sitemap.xml\n')

# ---- the structured data block for the home page (injected by tools/build-home-seo.py)
home = {'@context': 'https://schema.org', '@graph': [ld_org(), {'@type': 'WebSite', '@id': f'{BASE}/#site', 'url': BASE + '/', 'name': NAME, 'publisher': {'@id': f'{BASE}/#org'}}] + [ld_store(s, False) for s in SHOPS]}
open('tools/home-ld.json', 'w').write(json.dumps(home, ensure_ascii=False))
print('pages:', len(urls), [u for u, _ in urls])
