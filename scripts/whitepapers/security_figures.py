"""Original conceptual diagrams for the Endpoint Security white paper."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch


def build_security_figures(out):
    ink, teal, light, muted = '#102c3e', '#087f8c', '#edf5f7', '#49616f'
    def box(ax, x, y, w, h, title, detail='', dark=False):
        ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle='round,pad=0.025,rounding_size=0.06',edgecolor='#b9d2d9',facecolor=ink if dark else light,linewidth=1))
        ax.text(x+w/2,y+h*.67,title,ha='center',va='center',fontsize=11,weight='bold',color='white' if dark else ink)
        ax.text(x+w/2,y+h*.30,detail,ha='center',va='center',fontsize=9,color='white' if dark else muted,linespacing=1.5)
    def arrow(ax, a, b, dash=False):
        ax.add_patch(FancyArrowPatch(a,b,arrowstyle='-|>',mutation_scale=13,color=teal,linewidth=1.5,linestyle='--' if dash else '-'))
    def save(fig, name):
        fig.savefig(out/(name+'.png'),dpi=220,bbox_inches='tight',facecolor='white',metadata={'Software':'Orbitus Robotics'})
        fig.savefig(out/(name+'.svg'),bbox_inches='tight',facecolor='white',metadata={'Date':None,'Creator':'Orbitus Robotics'})
        p=out/(name+'.svg');p.write_text('\n'.join(line.rstrip() for line in p.read_text().splitlines())+'\n');plt.close(fig)
    fig,ax=plt.subplots(figsize=(9,3.3));ax.set(xlim=(-.1,9.1),ylim=(-.1,3.2));ax.axis('off')
    for x,title,detail in [(0,'ENDPOINT','Process / file / publisher'),(3.15,'NETWORK','Device / service / packet'),(6.3,'CONTEXT','Inventory / posture / rules')]:
        box(ax,x,2.15,2.7,.8,title,detail);arrow(ax,(x+1.35,2.1),(4.5,1.7))
    box(ax,1.5,.8,6, .85,'TRACEABLE EVIDENCE GRAPH','Deterministic links + explicit uncertainty',True)
    arrow(ax,(4.5,.75),(4.5,.38));ax.text(4.5,.15,'ML prioritization  /  grounded LLM explanation  /  analyst decision',ha='center',fontsize=11,color=ink)
    save(fig,'security-evidence-cover')
    fig,ax=plt.subplots(figsize=(9,4.15));ax.set(xlim=(-.1,9.1),ylim=(-.1,4));ax.axis('off')
    box(ax,0,2.75,2.5,.85,'ES AUTH event','OS response deadline')
    box(ax,3.2,2.75,2.5,.85,'Local policy','Reviewed rules / cache',True)
    box(ax,6.4,2.75,2.5,.85,'OS response','Deterministic decision')
    arrow(ax,(2.52,3.17),(3.17,3.17));arrow(ax,(5.72,3.17),(6.37,3.17))
    ax.plot([0,9],[2.25,2.25],color='#b9d2d9',linestyle='--');ax.text(4.5,2.36,'Authorization path above; asynchronous investigation below',ha='center',fontsize=10,color=muted)
    box(ax,0,.8,2.5,.9,'Bounded queue','Copy / retain safely\nloss counters')
    box(ax,3.2,.8,2.5,.9,'Evidence store','ES + flows + packets\nimmutable source IDs')
    box(ax,6.4,.8,2.5,.9,'ML / LLM worker','Rank / explain\nreview proposals')
    arrow(ax,(1.25,2.72),(1.25,1.73));arrow(ax,(2.52,1.25),(3.17,1.25));arrow(ax,(5.72,1.25),(6.37,1.25))
    ax.text(4.5,.2,'No model or network wait is introduced into the authorization callback.',ha='center',fontsize=11,color=ink)
    save(fig,'security-two-path-architecture')
    fig,ax=plt.subplots(figsize=(9,3.55));ax.set(xlim=(-.1,9.1),ylim=(-.1,3.4));ax.axis('off')
    for x,title,detail in [(0,'Process instance','Host + boot + token'),(3.2,'Connection','Network tuple + time'),(6.4,'Packet evidence','Sensor + interface + time')]:
        box(ax,x,2.1,2.5,.9,title,detail)
    arrow(ax,(2.52,2.55),(3.17,2.55));arrow(ax,(5.72,2.55),(6.37,2.55))
    box(ax,0,.45,2.5,.9,'Publisher identity','Signature evidence',True)
    box(ax,3.2,.45,2.5,.9,'Asset candidate','Time-bounded IP / MAC')
    box(ax,6.4,.45,2.5,.9,'Service hypothesis','Probe or protocol source')
    arrow(ax,(1.25,2.07),(1.25,1.38));arrow(ax,(4.45,2.07),(4.45,1.38),True);arrow(ax,(7.65,2.07),(7.65,1.38),True)
    ax.text(4.5,.02,'Solid: direct evidence relationship. Dashed: inference requiring qualification.',ha='center',fontsize=10,color=muted)
    save(fig,'security-correlation-graph')
