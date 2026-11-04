#!/usr/bin/env python3
"""Build public HTML manuscripts, figures, PDFs and supplements from reviewed data.

Run from any directory. No robot access, network requests or source-repo reads.
The committed manuscripts and curated evidence are the complete build inputs.
"""
from __future__ import annotations
import csv, hashlib, html, json, os, re
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from PIL import Image as PILImage
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether, Table, TableStyle, Image
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'static/whitepapers'
FIG=OUT/'figures'
BASE='https://www.orbitusrobotics.com/'
INK='#102c3e'; TEAL='#087f8c'; MUTED='#49616f'; LIGHT='#edf5f7'; ORANGE='#bd582e'
rl_config.invariant=1
plt.rcParams.update({'font.family':'DejaVu Sans','svg.fonttype':'none','svg.hashsalt':'orbitus-whitepapers-v1','font.size':11,'axes.spines.top':False,'axes.spines.right':False})


def read(path): return json.loads(path.read_text())
def dump(path,obj): path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def norm(text): return text.translate(str.maketrans({'\u2011':'-','\u2013':'-','\u2014':' - ','\u2018':"'",'\u2019':"'",'\u201c':'"','\u201d':'"','\u00a0':' '}))
def esc(text): return html.escape(norm(str(text)))


def savefig(fig,name):
 fig.savefig(FIG/(name+'.png'),dpi=210,bbox_inches='tight',facecolor='white',metadata={'Software':'Orbitus Robotics white-paper builder'})
 fig.savefig(FIG/(name+'.svg'),bbox_inches='tight',facecolor='white',metadata={'Date':None,'Creator':'Orbitus Robotics'})
 svg=FIG/(name+'.svg')
 svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
 plt.close(fig)


def box(ax,x,y,w,h,label,fill=LIGHT,color=INK,fontsize=11):
 ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.02,rounding_size=0.045',linewidth=1,edgecolor='#b9d2d9',facecolor=fill))
 ax.text(x+w/2,y+h/2,label,ha='center',va='center',fontsize=fontsize,color=color,linespacing=1.55)


def arrow(ax,a,b):
 ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=14,color=TEAL,linewidth=1.6))


def flow(name,labels,caption):
 fig,ax=plt.subplots(figsize=(8.2,2.4));ax.set_xlim(-.1,8.1);ax.set_ylim(-.12,2.1);ax.axis('off')
 n=len(labels);gap=.22;w=(8-gap*(n-1))/n
 for i,label in enumerate(labels):
  x=i*(w+gap);box(ax,x,.75,w,1.1,label,fontsize=10.5)
  if i<n-1:arrow(ax,(x+w,.75+.55),(x+w+gap,.75+.55))
 ax.text(4,.25,caption,ha='center',va='center',fontsize=10,color=MUTED)
 savefig(fig,name)


def figures(evidence):
 flow('owner-handoff',['New target\nsequence +\ngeneration','Latest mailbox\none pending\ndestination','Persistent owner\ncoherent\nposition / v / a','Serialized output\nsame barrier\nas Stop'], 'Design proposal: one owner of commanded motion, including replacement and Stop.')
 flow('recovery-chain',['Identify\noriginal disk','Verify\nwhole-disk\nimage','Verify\nindependent\ncopy','Restore\nto a spare','Boot test\nmotors off\nCAN detached'], 'Proposed recovery gates - completion requires recorded evidence at each step.')
 vals=evidence['arm-transition-fix-2026-11-01']['recorded_release']['legacy_comparison'][:3]
 fig,ax=plt.subplots(figsize=(8.2,3.0));ys=[2,1,0];colors_=[TEAL,ORANGE,TEAL]
 ax.barh(ys,[v['minimum_rad'] for v in vals],height=.5,color=colors_)
 ax.set_yticks(ys,['Coherent moving state','Constructed inconsistent state','Stationary handoff']);ax.set_xlim(-6.1,1.2)
 ax.axvline(0,color='#9baeb8',linewidth=1);ax.set_xlabel('Minimum calculated J6 position (rad)',color=INK)
 ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
 for y,v in zip(ys,vals):
  x=v['minimum_rad'];ax.text(x+.14 if x<0 else x+.12,y,f'{x:+.6f}',va='center',ha='left',fontsize=10,color='white' if x<0 else INK)
 ax.tick_params(axis='y',length=0);ax.spines['left'].set_visible(False)
 savefig(fig,'seed-comparison')
 fig,ax=plt.subplots(figsize=(8.2,3.2));ax.set_xlim(-.1,8.1);ax.set_ylim(-.15,3.1);ax.axis('off')
 box(ax,2.1,2.05,3.8,.85,'Amber host executable\ncommand ingress / workers\nshared commanded state',fill=INK,color='white',fontsize=11)
 labels=['Ruckig\ntrajectory math','Drake\nmodels / solvers','Drake LCM\nmessaging','C++ / system\nruntime (4)']
 for i,label in enumerate(labels):
  x=i*2.05;box(ax,x,.55,1.85,.9,label,fontsize=11);arrow(ax,(4,2.05),(x+.925,1.45))
 ax.text(4,.05,'Seven direct libraries; 42 mapped shared objects in the recorded snapshot.',ha='center',va='center',color=MUTED,fontsize=10)
 savefig(fig,'dependency-boundary')
 fig,ax=plt.subplots(figsize=(8.2,3.7));ax.set_xlim(-.1,8.1);ax.set_ylim(-.1,3.6);ax.axis('off')
 labels=['Planning /\nadmission','Latest target\n+ generation','Persistent owner\n+ Stop barrier','Exclusive\ntransport']
 for i,label in enumerate(labels):
  x=i*2.05;box(ax,x,2.1,1.85,1.0,label,fontsize=10.5)
  if i<3:arrow(ax,(x+1.85,2.6),(x+2.05,2.6))
 box(ax,6.15,.6,1.85,.85,'Unchanged\nactuators',fill=INK,color='white',fontsize=11);arrow(ax,(7.075,2.1),(7.075,1.45))
 box(ax,.4,.6,4.65,.85,'Measured feedback and supervision\nseparate from commanded position / v / a',fontsize=11)
 arrow(ax,(6.15,1.025),(5.05,1.025));arrow(ax,(2.725,1.45),(2.975,2.1))
 ax.text(4,.1,'Proposed host boundary; physical driver and stop commissioning are separate gates.',ha='center',color=MUTED,fontsize=10)
 savefig(fig,'controller-architecture')


def setup_fonts():
 candidates=[Path(os.environ.get('WHITEPAPER_FONT_DIR','/System/Library/Fonts/Supplemental')),Path('/usr/share/fonts/truetype/dejavu')]
 for d in candidates:
  if (d/'Arial.ttf').exists(): names=['Arial.ttf','Arial Bold.ttf','Arial Italic.ttf'];break
  if (d/'DejaVuSans.ttf').exists(): names=['DejaVuSans.ttf','DejaVuSans-Bold.ttf','DejaVuSans-Oblique.ttf'];break
 else: raise SystemExit('Install Arial or DejaVu Sans, or set WHITEPAPER_FONT_DIR.')
 for name,file in zip(['Paper','Paper-Bold','Paper-Italic'],names):pdfmetrics.registerFont(TTFont(name,str(d/file)))
 pdfmetrics.registerFontFamily('Paper',normal='Paper',bold='Paper-Bold',italic='Paper-Italic',boldItalic='Paper-Bold')


def pdf_styles():
 return {
 'body':ParagraphStyle('Body',fontName='Paper',fontSize=10.3,leading=14.7,textColor=colors.HexColor(INK),spaceAfter=9,splitLongWords=True),
 'h1':ParagraphStyle('Title',fontName='Paper-Bold',fontSize=27,leading=31.5,textColor=colors.HexColor(INK),spaceAfter=11),
 'h2':ParagraphStyle('Heading',fontName='Paper-Bold',fontSize=17,leading=21,textColor=colors.HexColor(INK),spaceAfter=15,keepWithNext=True),
 'subtitle':ParagraphStyle('Subtitle',fontName='Paper',fontSize=13,leading=18,textColor=colors.HexColor(MUTED),spaceAfter=14),
 'eyebrow':ParagraphStyle('Eyebrow',fontName='Paper-Bold',fontSize=9,leading=13,textColor=colors.HexColor(TEAL),spaceAfter=10),
 'caption':ParagraphStyle('Caption',fontName='Paper',fontSize=8.3,leading=11.5,textColor=colors.HexColor(MUTED),spaceAfter=12),
 'small':ParagraphStyle('Small',fontName='Paper',fontSize=8.5,leading=12.2,textColor=colors.HexColor(MUTED),spaceAfter=8,splitLongWords=True),
 'table':ParagraphStyle('Table',fontName='Paper',fontSize=9.0,leading=12.3,textColor=colors.HexColor(INK)),
 'th':ParagraphStyle('TableHeading',fontName='Paper-Bold',fontSize=9.1,leading=12.3,textColor=colors.white),
 'quote':ParagraphStyle('Callout',fontName='Paper',fontSize=10.3,leading=14.7,textColor=colors.HexColor(INK),spaceAfter=0),
 }


def pdf(p):
 styles=pdf_styles();width=504;story=[]
 def para(text,style='body'):return Paragraph(esc(text),styles[style])
 def page(canvas,doc):
  canvas.saveState();w,h=doc.pagesize
  canvas.setStrokeColor(colors.HexColor(TEAL));canvas.setLineWidth(1.1);canvas.line(54,h-33,w-54,h-33)
  if doc.page>1:
   canvas.setFont('Paper',8);canvas.setFillColor(colors.HexColor(MUTED));canvas.drawString(54,h-25,norm(p['short_title']))
  canvas.setFont('Paper',8);canvas.setFillColor(colors.HexColor(MUTED));canvas.drawString(54,28,p['id']+'  |  Orbitus Robotics  |  v'+p['version']);canvas.drawRightString(w-54,28,str(doc.page));canvas.restoreState()
 story += [para('ORBITUS ROBOTICS  /  WHITE PAPER','eyebrow'),para(p['title'],'h1'),para(p['subtitle'],'subtitle'),para(f"{p['id']}  |  Version {p['version']}  |  November 4, 2026",'small'),para(p['author']+'  ·  Project lead: '+p['project_lead'],'small'),Spacer(1,6),para('Abstract','eyebrow'),para(p['abstract']),Spacer(1,9)]
 im=PILImage.open(FIG/p['photo']);ih=260;iw=ih*im.width/im.height
 photo=Image(str(FIG/p['photo']),width=iw,height=ih)
 details=[para('RESEARCH RECORD','eyebrow'),para(p['summary']),para('Evidence originates in the '+p['source_date']+' report. '+p['publication_status']+'.','small'),para(p['photo_caption'],'caption'),para('Keywords: '+', '.join(p['keywords']),'small')]
 cover=Table([[photo,details]],colWidths=[iw+18,width-iw-18]);cover.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(0,0),0),('LEFTPADDING',(1,0),(1,0),12),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]));story.append(cover)
 for section in p['sections']:
  story += [PageBreak(),para(section['title'],'h2')]
  for b in section['blocks']:
   if b['kind']=='paragraph':story.append(para(b['text']))
   elif b['kind']=='callout':
    t=Table([[para(b['text'],'quote')]],colWidths=[width]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor(LIGHT)),('LINEBEFORE',(0,0),(-1,-1),3,colors.HexColor(TEAL)),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),11),('BOTTOMPADDING',(0,0),(-1,-1),11)]));story.extend([t,Spacer(1,12)])
   elif b['kind']=='list':
    for item in b['items']:story.append(Paragraph('• '+esc(item),styles['body']))
   elif b['kind']=='table':
    rows=[[para(v,'th') for v in b['headers']]]+[[para(v,'table') for v in row] for row in b['rows']]
    widths=b.get('widths',[1/len(b['headers'])]*len(b['headers']))
    t=Table(rows,colWidths=[width*v for v in widths],repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor(INK)),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor(LIGHT),colors.white]),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#d3e1e6'))]));story += [t,Spacer(1,13)]
   elif b['kind']=='figure':
    f=FIG/(b['name']+'.png');im=PILImage.open(f);image=Image(str(f),width=width,height=width*im.height/im.width)
    story.append(KeepTogether([image,Spacer(1,5),para(b['caption'],'caption')]))
   else:raise ValueError(b['kind'])
 if p['id']=='OR-WP-2026-003': story.append(PageBreak())
 story += [Spacer(1,9),para('References and supporting records','h2')]
 for r in p['references']:
  story.append(KeepTogether([Paragraph('<link href="'+html.escape(r['url'],quote=True)+'" color="'+TEAL+'">'+esc(r['label'])+'</link>',styles['small']),Paragraph(esc(r['url']),ParagraphStyle('URL',parent=styles['small'],fontSize=7.1,leading=9.6,spaceAfter=9))]))
 url=BASE+'whitepapers/'+p['slug']+'/'
 story += [Spacer(1,7),Paragraph('<b>Web edition and supplements:</b> <link href="'+url+'" color="'+TEAL+'">'+esc(url)+'</link>',styles['small']),para(p['disclosure'],'small'),para('Photography: Kierie, October 29, 2026. Diagrams: Orbitus Robotics. Correspondence: '+p['contact'],'small')]
 doc=SimpleDocTemplate(str(OUT/(p['slug']+'.pdf')),pagesize=(612,792),rightMargin=54,leftMargin=54,topMargin=51,bottomMargin=49,title=norm(p['title']),author=p['author'],subject=norm(p['subtitle']),keywords=', '.join(p['keywords']),pageCompression=1)
 doc.build(story,onFirstPage=page,onLaterPages=page)


def citations(text):
 def replace(match):return '['+', '.join(f'<a href="#ref-{n}" aria-label="Reference {n}">{n}</a>' for n in match[1].split(','))+']'
 return re.sub(r'\[(\d+(?:,\d+)*)\]',replace,html.escape(text))


def manuscript(p,meta):
 front={'title':p['title'],'description':p['summary'],'date':p['date'],'type':'whitepapers','paper_id':p['id'],'paper_slug':p['slug'],'version':p['version'],'subtitle':p['subtitle'],'author':p['author'],'photo':p['photo'],'photo_alt':p['photo_alt'],'photo_caption':p['photo_caption'],'abstract':p['abstract'],'pdf':'whitepapers/'+p['slug']+'.pdf','pdf_pages':meta['pages'],'pdf_bytes':meta['bytes'],'weight':int(p['id'][-3:]),'keywords':p['keywords'],'toc':True}
 # JSON front matter is a Hugo-supported format, with a standalone object at the start.
 parts=[json.dumps(front,ensure_ascii=False,indent=2),'','<!-- Generated by scripts/whitepapers/build_whitepapers.py; edit data/whitepapers/*.json. -->','']
 for section in p['sections']:
  parts += ['## '+section['title'],'']
  for b in section['blocks']:
   if b['kind']=='paragraph':parts += [citations(b['text']),'']
   elif b['kind']=='callout':parts += ['> '+citations(b['text']),'']
   elif b['kind']=='list':parts += ['\n'.join('- '+citations(t) for t in b['items']),'']
   elif b['kind']=='table':
    table='<div class="wp-table" role="region" aria-label="'+html.escape(section['title'],quote=True)+' data" tabindex="0"><table><thead><tr>'
    table+=''.join('<th scope="col">'+html.escape(t)+'</th>' for t in b['headers'])+'</tr></thead><tbody>'
    table+=''.join('<tr>'+''.join('<td>'+citations(t)+'</td>' for t in row)+'</tr>' for row in b['rows'])+'</tbody></table></div>'
    parts += [table,'']
   elif b['kind']=='figure':
    args={'src':'whitepapers/figures/'+b['name']+'.svg','alt':b['alt'],'caption':b['caption']}
    parts += ['{{< paper-figure '+' '.join(k+'='+json.dumps(v,ensure_ascii=False) for k,v in args.items())+' >}}','']
 parts += ['## References','']
 for i,r in enumerate(p['references'],1):parts += [f'<p id="ref-{i}" class="wp-reference"><a href="{html.escape(r["url"],quote=True)}">{html.escape(r["label"])}</a></p>','']
 parts += ['## Publication record','',p['disclosure'],'','Photography: Kierie, October 29, 2026. Diagrams: Orbitus Robotics. Project lead: '+p['project_lead']+'.','']
 (ROOT/'content/whitepapers'/p['slug']).mkdir(parents=True,exist_ok=True)
 (ROOT/'content/whitepapers'/p['slug']/'index.md').write_text('\n'.join(parts))


def main():
 OUT.mkdir(parents=True,exist_ok=True);FIG.mkdir(exist_ok=True);setup_fonts()
 evidence=read(ROOT/'data/whitepaper_evidence.json');ledger=read(ROOT/'data/whitepaper_library_ledger.json');figures(evidence)
 papers=sorted([read(p) for p in (ROOT/'data/whitepapers').glob('*.json')],key=lambda p:p['id']);manifest={'edition_date':'2026-11-04','publisher':'Orbitus Robotics','external_editorial_status':'Not submitted; no external acceptance claimed.','papers':[]};bib=[]
 dump(OUT/'amber-library-ledger.json',ledger)
 with (OUT/'amber-library-ledger.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(ledger['libraries'][0]),lineterminator='\n');w.writeheader();w.writerows(ledger['libraries'])
 for p in papers:
  pdf(p);path=OUT/(p['slug']+'.pdf');reader=PdfReader(path)
  meta={'id':p['id'],'slug':p['slug'],'title':p['title'],'version':p['version'],'canonical_url':BASE+'whitepapers/'+p['slug']+'/','pdf':path.name,'pages':len(reader.pages),'bytes':path.stat().st_size,'sha256':sha(path)}
  e=evidence[p['slug']].copy();e['source_references']=p['references'];dump(OUT/(p['slug']+'.evidence.json'),e)
  meta['evidence_sha256']=sha(OUT/(p['slug']+'.evidence.json'));manuscript(p,meta);manifest['papers'].append(meta)
  bib.append('@techreport{'+p['id'].replace('-','')+',\n  author = {{Orbitus Robotics}},\n  title = {'+p['title']+'},\n  institution = {Orbitus Robotics},\n  number = {'+p['id']+'},\n  year = {2026},\n  month = {November},\n  type = {Technical white paper},\n  note = {Version '+p['version']+'. Not peer reviewed.},\n  url = {'+meta['canonical_url']+'}\n}')
  print(p['id'],meta['pages'],'pages',meta['bytes'],'bytes',meta['sha256'])
 dump(OUT/'manifest.json',manifest)
 (OUT/'orbitus-robotics-whitepapers.bib').write_text('\n\n'.join(bib)+'\n')
 # Integrity covers PDFs, evidence, bibliography, figures, and the public ledger.
 manifest['artifacts']={str(f.relative_to(OUT)):sha(f) for f in sorted(OUT.rglob('*')) if f.is_file() and f.name!='manifest.json'}
 dump(OUT/'manifest.json',manifest)

if __name__=='__main__': main()
