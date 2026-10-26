"""Собирает www/index.html для приложения из исходника страницы (app2/index.html).
Запуск: python3 build_www.py ../app2/index.html
"""
import sys, pathlib, re

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "../app2/index.html").read_text(encoding="utf-8")

def rep(old, new, count=1):
    global src
    if old not in src:
        raise SystemExit("не найдено: " + old[:80])
    src = src.replace(old, new, count)

# 1. ИИ: сначала свой сервер, иначе — Claude (когда страница открыта в Claude)
rep('(async()=>{try{SAMPLE=await window.claude?.use?.("sample");',
    '(async()=>{try{if(await initServerAI())return;SAMPLE=await window.claude?.use?.("sample");')
rep('const ID_LIST=()=>',
    '''async function shrinkImg(blob){const url=URL.createObjectURL(blob);try{const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
  const k=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",0.8).split(",")[1]}finally{URL.revokeObjectURL(url)}}
async function initServerAI(){let base=(window.APP_CONFIG&&window.APP_CONFIG.API_BASE)||"";if(!base&&!window.NATIVE.on&&/^https?:/.test(location.protocol))base=location.origin;if(!base)return false;
  try{const h=await fetch(base+"/api/ai",{method:"GET"});const j=await h.json();if(!j.configured)return false}catch(e){return false}
  SAMPLE={json:async(prompt,o={})=>{let image=null;if(o.images){const f=Array.isArray(o.images)?o.images[0]:o.images[0]||o.images;if(f){try{image=await shrinkImg(f)}catch(e){throw{code:"image_rejected"}}}}
    let res;try{res=await fetch(base+"/api/ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,image,mediaType:"image/jpeg"})})}catch(e){throw{code:"upstream_error"}}
    if(res.status===429)throw{code:"rate_limited"};if(!res.ok)throw{code:"upstream_error"};return res.json()}};
  SAMPLE_OK=true;SAMPLE_IMG=true;render();return true}
const ID_LIST=()=>''')

# 2. Камера телефона вместо выбора файла
rep('case"snap":UI.photoMode="fridge";return $("#photo").click();', 'case"snap":UI.photoMode="fridge";return pickPhoto();')
rep('case"receipt":UI.photoMode="receipt";return $("#photo").click();', 'case"receipt":UI.photoMode="receipt";return pickPhoto();')
rep('// ===== События', '''async function pickPhoto(){if(window.NATIVE.on){try{const b=await window.NATIVE.photo();if(b&&SAMPLE)snap(b)}catch(e){}return}$("#photo").click()}
// ===== События''')

# 3. «Поделиться» системным меню
rep('<button class="btn g" id="copy">Скопировать</button>', '<button class="btn g" id="copy">${window.NATIVE.on?"Поделиться":"Скопировать"}</button>')
rep('case"copy":{const txt=listText();', 'case"copy":{const txt=listText();if(window.NATIVE.on){window.NATIVE.share(txt);return}')

# 4. Вибрация при отметке «съел»
rep('function ate(r,q=1){', 'function ate(r,q=1){window.NATIVE.tap();')

# 5. Экран не гаснет при готовке
rep('case"cook":cookStep=0;', 'case"cook":cookStep=0;window.NATIVE.awake(true);')
rep('function closeSheet(){$("#ov").hidden=true;cur=null;', 'function closeSheet(){$("#ov").hidden=true;cur=null;window.NATIVE.awake(false);')

# 6. Уведомления о сроках: пересчитываем при каждом сохранении
rep('function save(){', '''function scheduleExp(){const it=[];S.pantry.forEach(i=>{const s=SHELF[i],a=S.added[i];if(s&&a&&s<=10)it.push({name:ING[i].ru,at:a+(s-1)*DAY})});window.NATIVE.scheduleExpiry(it)}
function save(){scheduleExp();''')

# 7. Кнопка «назад» на Android
rep('render();\n</script>', '''window.NATIVE.onBack(()=>{if(!$("#ov").hidden)closeSheet();else if(UI.view!=="today")show("today")});
render();
</script>''')

# Страница для приложения: настоящий <head>
src = src.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
title_end = src.index("</title>") + len("</title>")
head_extra = '''
<meta name="theme-color" content="#2b6f48">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Из того, что есть">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<script src="config.js"></script>
<script src="native.js"></script>'''
page = src[:title_end] + head_extra + src[title_end:]
style_end = page.index("</style>") + len("</style>")
doc = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
       + page[:style_end] + '\n</head>\n<body>\n' + page[style_end:] + '\n</body>\n</html>\n')
out = pathlib.Path(__file__).parent / "www" / "index.html"
out.write_text(doc, encoding="utf-8")
print("ok", out, len(doc))
