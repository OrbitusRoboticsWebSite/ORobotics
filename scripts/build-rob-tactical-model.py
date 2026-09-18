"""Original display geometry, shared by Three.js and RealityKit; never URDF geometry."""
import json, math, argparse
from pathlib import Path
parts=[]
def part(group,name,shape,size,pos,color,rotation=None):
    parts.append(dict(group=group,name=name,shape=shape,size=size,position=pos,color=color,rotation=rotation or [0,0,0,1]))
def box(g,n,s,p,c): part(g,n,'box',s,p,c)
def cyl(g,n,r,h,p,c): part(g,n,'cylinder',[r,h,r],p,c)
def rod(g,n,a,b,r,c):
    d=[y-x for x,y in zip(a,b)]; length=math.sqrt(sum(x*x for x in d)); v=[x/length for x in d]
    q=[v[2],0,-v[0],1+v[1]]; norm=math.sqrt(sum(x*x for x in q)); q=[x/norm for x in q] if norm>.00001 else [1,0,0,0]
    part(g,n,'cylinder',[r,length,r],[(x+y)/2 for x,y in zip(a,b)],c,q)
olive=0x626944; dark=0x20262d; metal=0xa9b8c8; blue=0x347db7; orange=0xff9b35
# Jammer clips to the outside face of the white router backpack, above the booster nozzles.
box('jammer','White router mounting cradle',[.235,.235,.044],[0,.79,.187],0xf1f0e7)
box('jammer','JM010 olive housing',[.19,.22,.056],[0,.80,.237],olive)
box('jammer','Side controls',[.021,.12,.007],[-.073,.8,.269],dark)
rod('jammer','Cooling fan',[.035,.85,.266],[.035,.85,.275],.027,dark)
for i in range(5): box('jammer',f'Heat sink fin {i}',[.16,.006,.012],[0,.723+i*.014,.27],0x414a39)
for row in range(2):
    for col in range(8):
        x=(col-3.5)*.022; z=.219+row*.027; h=.23+(col%3)*.012
        cyl('jammer',f'Upright antenna {row*8+col+1}',.0055,h,[x,.91+h/2,z],dark)
        cyl('jammer',f'Antenna base {row*8+col+1}',.0075,.023,[x,.92,z],0x383e30)
box('jammer','Jammer status light',[.019,.009,.006],[.06,.892,.268],0x46dfb2)
# StrikeForce silhouette: L stock, short handguard, slotted rail, removable magazine.
x=.14
box('blaster','StrikeForce receiver',[.056,.087,.19],[x,.835,-.17],dark)
box('blaster','Buffer tube',[.03,.03,.15],[x,.85,.005],dark)
box('blaster','L stock heel',[.045,.13,.023],[x,.81,.085],dark)
box('blaster','L stock brace',[.037,.022,.115],[x,.754,.039],dark)
box('blaster','Rear grip',[.036,.108,.04],[x,.768,-.122],dark)
box('blaster','Magazine',[.044,.135,.064],[x,.736,-.223],dark)
box('blaster','Short slotted handguard',[.062,.062,.178],[x,.849,-.353],0x303943)
for z in [-.295,-.326,-.357,-.388,-.419]:
    box('blaster',f'Rail tooth {z}',[.075,.01,.014],[x,.889,z],metal)
    for side in [-1,1]: box('blaster',f'Handguard slot {side} {z}',[.003,.015,.019],[x+side*.032,.845,z],0x05090d)
rod('blaster','Short barrel',[x,.846,-.443],[x,.846,-.51],.014,dark)
rod('blaster','Orange gel muzzle',[x,.846,-.505],[x,.846,-.535],.021,orange)
for z in [-.09,-.405]: box('blaster',f'Flip sight {z}',[.023,.028,.01],[x,.913,z],dark)
box('blaster','Trigger guard base',[.026,.01,.057],[x,.773,-.17],metal)
# ACTIONUNION PEQ-15-style display module: three distinct front apertures and selector.
box('blaster','ACTIONUNION PEQ-15 Pro housing',[.079,.038,.095],[x+.032,.916,-.329],0xb09b71)
cyl('blaster','PEQ selector',.013,.009,[x+.041,.94,-.308],dark)
for dx,c,n in [(-.016,0x238dff,'Blue laser'),(.01,0x7537a9,'Infrared laser'),(.036,0xffffff,'Flashlight')]:
    rod('blaster',f'PEQ {n} lens',[x+.02+dx,.917,-.377],[x+.02+dx,.917,-.383],.008,c)
# The temporary two-hand B1 presentation uses two fixed-length links and seven joint housings.
# It substitutes for the unsplit scanned arm surfaces only while the game tool is drawn.
def elbow(a,b,pole,l1=.265,l2=.28):
    delta=[y-x for x,y in zip(a,b)]; d=math.sqrt(sum(x*x for x in delta)); u=[x/d for x in delta]
    t=(l1*l1-l2*l2+d*d)/(2*d); h=math.sqrt(max(0,l1*l1-t*t))
    projection=sum(x*y for x,y in zip(pole,u)); v=[x-projection*y for x,y in zip(pole,u)]; mag=math.sqrt(sum(x*x for x in v))
    return [a[i]+t*u[i]+h*v[i]/mag for i in range(3)]
for side,hand in [(-1,[x,.81,-.32]),(1,[x,.773,-.125])]:
    name='Left' if side<0 else 'Right'; shoulder=[side*.208,.962,.018]; bend=elbow(shoulder,hand,[side*.6,-1,.05]); points=[shoulder,bend,hand]
    for k,(a,b) in enumerate(zip(points,points[1:])):
        for offset in [-.021,.021]: rod('blaster',f'{name} B1 link {k} {offset}',[a[0]+offset,*a[1:]],[b[0]+offset,*b[1:]],.009,metal)
    joints=[shoulder]+[[shoulder[i]*(1-t)+bend[i]*t for i in range(3)] for t in [.16,.80]]+[bend]+[[bend[i]*(1-t)+hand[i]*t for i in range(3)] for t in [.25,.80]]+[hand]
    for i,p in enumerate(joints):
        part('blaster',f'{name} B1 joint {i+1}','sphere',[.027,.027,.027],p,metal)
        rod('blaster',f'{name} blue servo cap {i+1}',[p[0],p[1],p[2]-.027],[p[0],p[1],p[2]-.033],.022,blue)
    box('blaster',f'{name} gripping palm',[.067,.027,.052],hand,dark)
    for dx in [-.033,.033]: box('blaster',f'{name} gripping finger {dx}',[.012,.054,.045],[hand[0]+dx,hand[1]+.02,hand[2]],metal)
doc=dict(version='2026.09.17.3',purpose='Fictional game equipment; display approximation only',muzzle=[x,.846,-.535],parts=parts)
Path('assets/js/rob-tactical-model.mjs').write_text('export default '+json.dumps(doc,separators=(',',':'))+';\n')
parser = argparse.ArgumentParser()
parser.add_argument('--native-resources', type=Path, help='Optional ROBTrainingGames/Shared/Resources destination')
args = parser.parse_args()
if args.native_resources:
    (args.native_resources / 'rob-tactical-model.json').write_text(json.dumps(doc,separators=(',',':'))+'\n')
print(f'{len(parts)} shared tactical parts')
