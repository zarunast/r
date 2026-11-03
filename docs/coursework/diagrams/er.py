import os
os.environ['MPLCONFIGDIR']='/tmp/mpl-bgtu'
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
fig,ax=plt.subplots(figsize=(12,12));ax.set_xlim(0,12);ax.set_ylim(0,12);ax.axis('off')
boxes={
'applicants':(0.2,9.2,3.4,['PK number : VARCHAR(64)','surname, first_name : VARCHAR','patronymic : VARCHAR','profile : JSON']),
'applications':(0.2,5.6,4.4,['PK id : INTEGER','FK applicant_number : VARCHAR(64)','year, campaign, direction','study_form, quota, total_score','UK конкурс + applicant_number']),
'contracts':(0.2,2.7,3.8,['PK id : INTEGER','FK / UK application_id : INTEGER','UK number : VARCHAR','location, stage : VARCHAR','paid : BOOLEAN']),
'contract_events':(0.2,.1,3.8,['PK id : INTEGER','FK contract_id : INTEGER','at : DATETIME; actor : VARCHAR','changes : JSON']),
'calls':(5.1,3.4,3.7,['PK id : INTEGER','FK application_id : INTEGER','result, actor : VARCHAR','comment : VARCHAR']),
'seat_plans':(6.4,8.7,5.0,['PK id : INTEGER','year, campaign, direction','study_form, quota, seats','UK year + campaign + direction','+ study_form + quota']),
'users':(7.3,5.8,4.1,['PK id : INTEGER','UK login : VARCHAR','password_hash : VARCHAR','active : BOOLEAN']),
'activity_events':(7.1,.1,4.3,['PK id : INTEGER','at : DATETIME; actor : VARCHAR','action, object : VARCHAR','detail, status : VARCHAR'])}
heights={}
for name,(x,y,w,lines) in boxes.items():
 h=.43*(len(lines)+1);heights[name]=h
 ax.add_patch(Rectangle((x,y),w,h,facecolor='white',edgecolor='#334155',linewidth=1.1,zorder=3));ax.add_patch(Rectangle((x,y+h-.43),w,.43,facecolor='#dbeafe',edgecolor='#334155',zorder=3));ax.text(x+w/2,y+h-.215,name,fontsize=12,fontweight='bold',va='center',ha='center',zorder=4)
 for j,line in enumerate(lines):ax.text(x+.10,y+h-.43*(j+1.5),line,fontsize=9,va='center',zorder=4)
def line(points,label,at):
 xx,yy=zip(*points);ax.plot(xx,yy,color='#334155',lw=1.3,zorder=1);ax.text(*at,label,fontsize=10,ha='center',bbox=dict(facecolor='white',edgecolor='none',pad=2),zorder=5)
line([(1.8,9.2),(1.8,8.7)],'1 : 0..N',(2.5,8.95))
# Align applications top with its real header height.
ax.plot([1.8,1.8],[8.7,5.6+heights['applications']],color='#334155',lw=1.3)
line([(1.7,5.6),(1.7,2.7+heights['contracts'])],'1 : 0..1',(2.5,5.45))
line([(2,2.7),(2,.1+heights['contract_events'])],'1 : 0..N',(2.75,2.47))
line([(4.6,6.8),(5.45,6.8),(5.45,3.4+heights['calls'])],'1 : 0..N',(5.45,6.15))
# Logical matching has no FK.
ax.plot([6.4,5.8,5.8,4.6],[9.3,9.3,7.7,7.7],ls='--',color='#64748b',lw=1.2)
ax.text(5.9,8.45,'ключ\nконкурса\n(не FK)',fontsize=9,ha='center',bbox=dict(facecolor='white',edgecolor='none'))
ax.text(7.2,2.9,'actor хранит логин строкой;\nвнешних ключей к users нет.',fontsize=10,ha='left',va='top')
from pathlib import Path
fig.savefig(Path(__file__).with_name('er.png'),dpi=220,bbox_inches='tight',facecolor='white');plt.close(fig)
