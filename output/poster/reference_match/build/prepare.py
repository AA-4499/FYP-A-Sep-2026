from pathlib import Path
from copy import deepcopy
import zipfile, re, json, io
from lxml import etree as E
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
POSTER = ROOT.parent
SOURCE = POSTER/'editable/FYP_Poster_Editable.pptx'
LAYOUT = POSTER/'revision2/FYP_Poster_Research_Aligned.pptx'
REFERENCE = Path('C:/Users/USER/Downloads/Smart Diabetes Digital Twin poster.png')
NS = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main', 'a':'http://schemas.openxmlformats.org/drawingml/2006/main', 'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
P, A, R = (NS[k] for k in ('p','a','r'))
REL='http://schemas.openxmlformats.org/package/2006/relationships'
EMU=12700
def xml(b): return E.fromstring(b)
def dump(x): return E.tostring(x,xml_declaration=True,encoding='UTF-8',standalone=True)
src=zipfile.ZipFile(SOURCE)
lay=zipfile.ZipFile(LAYOUT)
entries={n:src.read(n) for n in src.namelist()}
slide=xml(lay.read('ppt/slides/slide1.xml'))
tree=slide.find('p:cSld/p:spTree',NS)
def name(s):
    c=s.find('.//p:cNvPr',NS)
    return c.get('name','') if c is not None else ''
def shape(n): return next(s for s in tree if name(s)==n)
def geom(s,x=None,y=None,w=None,h=None):
    t=s.find('p:spPr/a:xfrm',NS)
    if t is None: t=s.find('p:xfrm',NS)
    off=t.find('a:off',NS); ext=t.find('a:ext',NS)
    for el,k,v in ((off,'x',x),(off,'y',y),(ext,'cx',w),(ext,'cy',h)):
        if v is not None: el.set(k,str(round(v*EMU)))
def text(s,t,size=None):
    body=s.find('p:txBody',NS)
    proto=deepcopy(body.find('a:p',NS))
    for p in list(body.findall('a:p',NS)): body.remove(p)
    for line in t.split('\n'):
        p=deepcopy(proto)
        runs=p.findall('a:r',NS)
        for r in runs[1:]: p.remove(r)
        if not runs:
            r=E.SubElement(p,f'{{{A}}}r'); E.SubElement(r,f'{{{A}}}rPr');E.SubElement(r,f'{{{A}}}t')
        r=p.find('a:r',NS); r.find('a:t',NS).text=line
        if size:
            for rp in p.findall('.//a:rPr',NS)+p.findall('a:endParaRPr',NS):rp.set('sz',str(round(size*100)))
        body.append(p)

# Reuse the user's package, masters, university marks, and original image assets.
# The existing research version supplies native editable content for the supplied reference.
for s in list(tree):
    n=name(s)
    if n.startswith('References') or n in ('Poster status footer','Recommendations text'):
        tree.remove(s)
        continue
    for t in s.findall('.//a:t',NS):
        if t.text:t.text=re.sub(r'\s*\[\d[^\]]*\]','',t.text)

geom(shape('Recommendations panel'),x=60,w=1563)
geom(shape('Recommendations accent'),x=60)
geom(shape('Recommendations heading'),x=82,w=1519)
geom(shape('Recommendations heading rule'),x=82,w=1519)

# Reference uses a continuous bottom panel with two columns of native bullets.
proto=shape('Objectives')
bullet_texts=[
    ('Recommendations left',96,['Evaluate forecasts on patients excluded from training.','Investigate inconsistent meal and insulin responses.']),
    ('Recommendations right',886,['Review graph evidence; develop risk and SHAP modules.','Complete scenario, access-control and usability validation.'])]
next_id=max(int(e.get('id')) for e in slide.findall('.//p:cNvPr',NS))+1
for n,x,lines in bullet_texts:
    s=deepcopy(proto); c=s.find('p:nvSpPr/p:cNvPr',NS);c.set('id',str(next_id));next_id+=1;c.set('name',n)
    text(s,'\n'.join(lines),30)
    geom(s,x=x,y=2163,w=700 if x==96 else 715,h=160)
    for p in s.findall('p:txBody/a:p',NS):
        pp=p.find('a:pPr',NS)
        if pp is None:pp=E.Element(f'{{{A}}}pPr');p.insert(0,pp)
        pp.set('marL',str(36*EMU));pp.set('indent',str(-32*EMU))
        for el in list(pp):
            if el.tag.split('}')[-1].startswith('bu') or el.tag.split('}')[-1] in ('spcAft','spcBef'):pp.remove(el)
        sp=E.SubElement(pp,f'{{{A}}}spcAft');E.SubElement(sp,f'{{{A}}}spcPts',val='1000')
        E.SubElement(pp,f'{{{A}}}buFont',typeface='Arial')
        E.SubElement(pp,f'{{{A}}}buChar',char='•')
    tree.append(s)

divider=deepcopy(shape('Introduction heading rule'))
c=divider.find('p:nvCxnSpPr/p:cNvPr',NS);c.set('id',str(next_id));next_id+=1;c.set('name','Recommendations column divider')
geom(divider,x=841.5,y=2162,w=0,h=151)
tree.append(divider)

# Extract only the supplied artwork from the local copy of the reference.
# Dark artwork is separated from the pale background; no replacement icon is drawn.
ref=Image.open(REFERENCE).convert('RGB')
icons={1:(650,373,45,43),2:(816,373,38,44),3:(965,377,44,42),
       4:(971,464,38,42),5:(815,463,40,44),6:(654,463,41,42),
       7:(654,550,41,44),8:(805,550,51,43),9:(978,550,32,44)}
pos={1:(877,617),2:(1123,617),3:(1369,617),4:(1369,761),5:(1123,761),6:(877,761),7:(877,905),8:(1123,905),9:(1369,905)}
rels=xml(entries['ppt/slides/_rels/slide1.xml.rels'])
assets=ROOT/'build/assets';assets.mkdir(parents=True,exist_ok=True)
for n,(x,y,w,h) in icons.items():
    im=ref.crop((x,y,x+w,y+h)).convert('RGBA')
    pixels=[]
    for rr,gg,bb,aa in im.getdata():
        value=min(rr,gg,bb)
        alpha=255-value if max(rr,gg,bb)-value<65 and value<190 else 0
        pixels.append((0,0,0,alpha))
    im.putdata(pixels)
    bounds=im.getbbox()
    if bounds:im=im.crop(bounds)
    bio=io.BytesIO();im.save(bio,format='PNG');data=bio.getvalue()
    (assets/f'workflow-{n}.png').write_bytes(data)
    media=f'workflow{n}.png';entries[f'ppt/media/{media}']=data
    rid=f'rId{20+n}'
    E.SubElement(rels,f'{{{REL}}}Relationship',Id=rid,Type=R+'/image',Target='../media/'+media)
    sx,sy=pos[n];ih=61;iw=ih*im.width/im.height
    ix=sx+222-iw+7;iy=sy-20
    pic=E.Element(f'{{{P}}}pic')
    nv=E.SubElement(pic,f'{{{P}}}nvPicPr');E.SubElement(nv,f'{{{P}}}cNvPr',id=str(next_id),name=f'Workflow icon {n}',descr=f'Reference artwork for workflow step {n}');next_id+=1
    E.SubElement(nv,f'{{{P}}}cNvPicPr');E.SubElement(nv,f'{{{P}}}nvPr')
    fill=E.SubElement(pic,f'{{{P}}}blipFill');E.SubElement(fill,f'{{{A}}}blip',attrib={f'{{{R}}}embed':rid});stretch=E.SubElement(fill,f'{{{A}}}stretch');E.SubElement(stretch,f'{{{A}}}fillRect')
    sp=E.SubElement(pic,f'{{{P}}}spPr');xf=E.SubElement(sp,f'{{{A}}}xfrm');E.SubElement(xf,f'{{{A}}}off',x=str(round(ix*EMU)),y=str(round(iy*EMU)));E.SubElement(xf,f'{{{A}}}ext',cx=str(round(iw*EMU)),cy=str(round(ih*EMU)));g=E.SubElement(sp,f'{{{A}}}prstGeom',prst='rect');E.SubElement(g,f'{{{A}}}avLst')
    tree.append(pic)

# Preserve the supplied line breaks and the reference's visual hierarchy.
text(shape('Authors'),'Andy Wei Jian CHU  |  Fa Zhen NG  |  Jit Heng BOON\nElijah Benjamin Sing Cheng TAN  |  Jody LAW',21)
entries['ppt/slides/slide1.xml']=dump(slide)
entries['ppt/slides/_rels/slide1.xml.rels']=dump(rels)
notes=xml(lay.read('ppt/notesSlides/notesSlide1.xml'))
for sp in notes.findall('.//p:sp',NS):
    ph=sp.find('p:nvSpPr/p:nvPr/p:ph',NS)
    if ph is not None and ph.get('type')=='body':
        text(sp,'Sources: User-supplied visual reference, Smart Diabetes Digital Twin poster.png. Research content and numeric tables retained from the existing FYP_Poster_Research_Aligned.pptx. Original editable file provides the physical canvas, masters, university marks and medical background. The target workflow includes planned stages. Forecasting results and knowledge-graph review limitations are retained exactly as supplied.\nResearch sources retained from the existing revision: COS40005 Team and Project Plan, 27 September 2026, Part 2. Sprint Report 1, updated 30 October 2026, sections 2.1–2.6 and 3.3–3.4. Source code: https://github.com/AA-4499/FYP-A-Sep-2026')
entries['ppt/notesSlides/notesSlide1.xml']=dump(notes)
dest=ROOT/'build/reference-layout.pptx'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in entries.items():z.writestr(n,b)
print(dest)
print('Editable shapes:',len(tree),'Native tables:',len(slide.findall('.//a:tbl',NS)),'Icons:',len(icons))
