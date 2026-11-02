"""Independent AI-assisted audit of all 25 boundary-value question images.

Requires SymPy. Verifies PDE residuals, boundary data, modal initial values,
Fourier coefficient integrals and incompatibility witnesses. Infinite-series
claims use checked eigenmodes and coefficient identities, not a finite-sum
assertion of pointwise convergence. This is not human/instructor review.
"""
import json
from pathlib import Path
import sympy as S
ROOT=Path(__file__).resolve().parents[1]
x,t,y=S.symbols('x t y',real=True)
n=S.symbols('n',integer=True,positive=True)
m=S.symbols('m',integer=True,positive=True)
c,L,alpha=S.symbols('c L alpha',positive=True)
k=S.symbols('k',real=True)
pi,sin,cos,exp=S.pi,S.sin,S.cos,S.exp
R=S.Rational
checks=[]
def eq(q,label,left,right):
    residual=S.simplify(S.expand_trig(S.expand(left-right)))
    if residual!=0:residual=S.trigsimp(residual,method='fu')
    checks.append(dict(question=q,check=label,passed=residual==0,residual=str(residual)))
    if residual!=0:print(f'FAIL {q}: {label}: {residual}',flush=True)
def wave(q,u,speed,length,f=None,g=None,label='wave'):
    eq(q,label+' PDE',S.diff(u,t,2)-speed**2*S.diff(u,x,2),0)
    eq(q,label+' left boundary',u.subs(x,0),0)
    eq(q,label+' right boundary',u.subs(x,length),0)
    if f is not None:eq(q,label+' initial displacement',u.subs(t,0),f)
    if g is not None:eq(q,label+' initial velocity',S.diff(u,t).subs(t,0),g)
def heat(q,u,kappa,length,label='heat',drift=0):
    eq(q,label+' PDE',S.diff(u,t)-kappa*S.diff(u,x,2)-drift*S.diff(u,x),0)
    eq(q,label+' left boundary',u.subs(x,0),0)
    eq(q,label+' right boundary',u.subs(x,length),0)
def sine_coefficient(q,f,length,expected,indices=range(1,9),label='sine'):
    general=S.Rational(2)/length*S.integrate(f*sin(n*pi*x/length),(x,0,length))
    eq(q,label+' coefficient identity for all positive n',general,expected)
    for j in indices:
        actual=S.Rational(2)/length*S.integrate(f*sin(j*pi*x/length),(x,0,length))
        eq(q,f'{label} exact coefficient n={j}',actual,expected.subs(n,j))

# 1: velocity normalization includes c and the length 50.
u=225/(2*pi*c)*sin(pi*x/50)*sin(pi*c*t/50)-25/(2*pi*c)*sin(3*pi*x/50)*sin(3*pi*c*t/50)
wave(1,u,c,50,0,3*sin(pi*x/50)**3)

# 2: steady profile and homogeneous heat modes.
eq(2,'steady PDE',S.diff(100*x,x,2),0)
eq(2,'steady left value',(100*x).subs(x,0),0)
eq(2,'steady right value',(100*x).subs(x,1),100)
u=exp(-n*n*pi*pi*t)*sin(n*pi*x)
heat(2,u,1,1)
sine_coefficient(2,100*(1-x),1,200/(n*pi))
eq(2,'left corner incompatibility witness',S.Integer(100)-0,100)

# 3: beam modes and initial polynomial coefficients.
u=sin(n*pi*x)*cos(n*n*pi*pi*t)
eq(3,'beam PDE',S.diff(u,t,2)+S.diff(u,x,4),0)
for loc in [0,1]:
    eq(3,f'displacement boundary x={loc}',u.subs(x,loc),0)
    eq(3,f'moment boundary x={loc}',S.diff(u,x,2).subs(x,loc),0)
eq(3,'modal initial velocity',S.diff(u,t).subs(t,0),0)
sine_coefficient(3,x*(1-x),1,4*(1-(-1)**n)/(n**3*pi**3))
eq(3,'initial moment corner witness',S.diff(x*(1-x),x,2),-2)

# 4: both alpha cases, including the mixed derivative at alpha=1.
u=sin(n*pi*x)*cos(n*pi*t)
wave(4,u,1,1,g=0,label='alpha=0 mode')
sine_coefficient(4,x*(1-x),1,4*(1-(-1)**n)/(n**3*pi**3))
zero=S.Integer(0)
eq(4,'alpha=1 PDE',S.diff(zero,t,2)-S.diff(zero,x,2)+S.diff(zero,x,t),0)
eq(4,'alpha=1 initial displacement',x*(1-1)*(1-x),0)
eq(4,'alpha=1 initial velocity',S.diff(zero,t),0)
eq(4,'alpha=1 both left traces',zero+S.diff(zero,x),0)

# 5 and 6: length and amplitude scaling checked using exact integrals.
u=sin(n*pi*x)*cos(c*n*pi*t)
wave(5,u,c,1,g=0,label='mode')
sine_coefficient(5,2*x*(1-x),1,8*(1-(-1)**n)/(n**3*pi**3))
u=sin(n*pi*x/L)*cos(c*n*pi*t/L)
wave(6,u,c,L,g=0,label='general L mode')
sine_coefficient(6,k*x*(L-x),L,4*k*L*L*(1-(-1)**n)/(n**3*pi**3))

# 7: Laplace equation and all four boundaries.
u=S.sinh(x)/S.sinh(pi)*sin(y)+S.sinh(3*y)/S.sinh(6*pi)*sin(3*x)
eq(7,'Laplace PDE',S.diff(u,x,2)+S.diff(u,y,2),0)
eq(7,'left',u.subs(x,0),0);eq(7,'right',u.subs(x,pi),sin(y))
eq(7,'bottom',u.subs(y,0),0);eq(7,'top',u.subs(y,2*pi),sin(3*x))

# 8-12: finite wave solutions, including sin^3 versus sin(3x).
u=R(3,4)*sin(pi*x/5)*cos(pi*t/5)-R(1,4)*sin(3*pi*x/5)*cos(3*pi*t/5)
wave(8,u,1,5,sin(pi*x/5)**3,0)
u=sin(2*x)*cos(4*t)+R(3,8)*sin(x)*sin(2*t)-R(1,24)*sin(3*x)*sin(6*t)
for q in [9,12]:wave(q,u,2,pi,sin(2*x),sin(x)**3)
u=sin(pi*x)*cos(3*pi*t)+R(1,2)*sin(2*pi*x)*cos(6*pi*t)+sin(3*pi*x)*sin(9*pi*t)/(9*pi)
wave(10,u,3,1,(1+cos(pi*x))*sin(pi*x),sin(3*pi*x))
u=sin(x)*cos(2*t)+sin(2*x)*cos(4*t)+sin(3*x)*sin(6*t)/6
wave(11,u,2,pi,(1+2*cos(x))*sin(x),sin(3*x))

# 13: shifted Dirichlet-Neumann heat eigenbasis and coefficients.
qmode=2*n-1
u=exp(-qmode**2*t)*sin(qmode*x)
eq(13,'homogeneous heat PDE',S.diff(u,t)-S.diff(u,x,2),0)
eq(13,'left homogeneous boundary',u.subs(x,0),0)
eq(13,'right insulated boundary',S.diff(u,x).subs(x,pi/2),0)
for j in range(1,9):
    q=2*j-1
    coefficient=4/pi*S.integrate(-10*sin(x)**2*sin(q*x),(x,0,pi/2))
    eq(13,f'exact mixed coefficient n={j}',coefficient,80/(pi*q*(q*q-4)))
eq(13,'initial left boundary',(10*cos(x)**2).subs(x,0),10)
eq(13,'initial right derivative',S.diff(10*cos(x)**2,x).subs(x,pi/2),0)

# 14: original printed -1/4 velocity coefficient is incorrect.
u=sin(x)*(R(3,4)*cos(2*t)+R(5,4)*sin(2*t))+sin(3*x)*(-R(1,4)*cos(6*t)+R(1,12)*sin(6*t))
wave(14,u,2,pi,sin(x)**3,2*sin(x)*(1+cos(x)**2))
printed=sin(x)*(R(3,4)*cos(2*t)-R(1,4)*sin(2*t))+sin(3*x)*(-R(1,4)*cos(6*t)+R(1,12)*sin(6*t))
eq(14,'printed initial velocity error witness',S.diff(printed,t).subs(t,0)-2*sin(x)*(1+cos(x)**2),-3*sin(x))

# 15: corrected beam frequency and sine term; generalised solution only.
omega=(n-R(1,2))*pi
nu=2*omega**2
T=exp(-c*t)*(cos(nu*t)+c/nu*sin(nu*t))
X=cos(omega*x);u=T*X
eq(15,'corrected damped beam PDE',S.diff(u,t,2)+2*c*S.diff(u,t)+c*c*u+4*S.diff(u,x,4),0)
for loc,order in [(0,1),(0,3),(1,0),(1,2)]:
    eq(15,f'mode boundary x={loc} derivative={order}',S.diff(u,x,order).subs(x,loc),0)
eq(15,'modal displacement at zero',T.subs(t,0),1)
eq(15,'modal velocity at zero',S.diff(T,t).subs(t,0),0)
for j in range(1,9):
    om=(j-R(1,2))*pi
    actual=2*S.integrate(x*(1-x)*cos(om*x),(x,0,1))
    eq(15,f'exact cosine coefficient n={j}',actual,4*(-1)**(j+1)/om**3-2/om**2)
eq(15,'initial slope contradiction witness',S.diff(x*(1-x),x).subs(x,0),1)
eq(15,'initial curvature contradiction witness',S.diff(x*(1-x),x,2).subs(x,1),-2)

# 16: changed first displacement coefficient.
u=3*sin(x)*cos(2*t)+sin(2*x)*cos(4*t)+sin(3*x)*sin(6*t)/6
wave(16,u,2,pi,(3+2*cos(x))*sin(x),sin(3*x))

# 17: drift transform, piecewise polynomial coefficients and corner traces.
u=exp(-alpha*x-(n*n+alpha*alpha)*t)*sin(n*x)
heat(17,u,1,pi,drift=2*alpha,label='drift mode')
for j in range(1,9):
    actual=2/pi*(S.integrate((pi/2-x)*sin(j*x),(x,0,pi/2))+S.integrate((x-pi/2)*sin(j*x),(x,pi/2,pi)))
    expected=(1-(-1)**j)/S.Integer(j)-4*sin(j*pi/2)/(pi*j*j)
    eq(17,f'exact piecewise coefficient n={j}',actual,expected)
f17=exp(-alpha*x)*S.Abs(x-pi/2)
eq(17,'initial left value',f17.subs(x,0),pi/2)
eq(17,'initial right value',f17.subs(x,pi),pi*exp(-alpha*pi)/2)

# 18: mean is integral(f), not twice the integral; all four diffusivities.
fC=cos(pi*x/2);fS=sin(pi*x/2)
for profile,f in [('cos',fC),('sin',fS)]:
    eq(18,profile+' exact conserved mean',S.integrate(f,(x,0,1)),2/pi)
    for j in range(1,9):
        expected=4*(-1)**(j+1)/(pi*(4*j*j-1)) if profile=='cos' else -4/(pi*(4*j*j-1))
        eq(18,f'{profile} exact cosine coefficient n={j}',2*S.integrate(f*cos(j*pi*x),(x,0,1)),expected)
for case,kappa in [('a',S.Integer(4)),('b',S.Integer(4)),('c',R(1,4)),('d',R(1,4))]:
    u=exp(-kappa*n*n*pi*pi*t)*cos(n*pi*x)
    eq(18,case+' heat PDE',S.diff(u,t)-kappa*S.diff(u,x,2),0)
    eq(18,case+' left derivative',S.diff(u,x).subs(x,0),0)
    eq(18,case+' right derivative',S.diff(u,x).subs(x,1),0)
eq(18,'constant mode PDE',S.diff(2/pi,t)-4*S.diff(2/pi,x,2),0)
eq(18,'cos initial derivative corner',S.diff(fC,x).subs(x,1),-pi/2)
eq(18,'sin initial derivative corner',S.diff(fS,x).subs(x,0),pi/2)

# 19 and 25: same initial shape across two exam years.
u=sin(2*x)*cos(4*t)/2-sin(4*x)*cos(8*t)/4
for q in [19,25]:wave(q,u,2,pi,sin(x)**2*sin(2*x),0)

# 20 and 21: exact polynomial coefficients and shifted decay rate.
u=exp(-n*n*pi*pi*t)*sin(n*pi*x)
heat(20,u,1,1)
sine_coefficient(20,x-x**3,1,12*(-1)**(n+1)/(n**3*pi**3))
u=exp(-x-(1+n*n*pi*pi)*t)*sin(n*pi*x)
heat(21,u,1,1,drift=2,label='drift mode')
sine_coefficient(21,x*(1-x),1,4*(1-(-1)**n)/(n**3*pi**3))

# 22: no solution with all stated traces; check exact anti-periodic witness.
omega=(2*n-1)*pi
u=sin(omega*x)*cos(omega*t)
eq(22,'allowed mode PDE',S.diff(u,t,2)-S.diff(u,x,2),0)
eq(22,'allowed mode left',u.subs(x,0),0)
eq(22,'allowed mode right derivative',S.diff(u,x).subs(x,R(1,2)),0)
eq(22,'allowed mode initial velocity',S.diff(u,t).subs(t,0),0)
eq(22,'necessary anti-periodicity',u.subs({x:R(1,2),t:t+1})+u.subs(x,R(1,2)),0)
eq(22,'prescribed trace violates anti-periodicity',cos(2*pi*(t+1))+cos(2*pi*t),2*cos(2*pi*t))
eq(22,'nonzero contradiction at t=0',(cos(2*pi*(t+1))+cos(2*pi*t)).subs(t,0),2)
conditional=sin(pi*x)*cos(pi*t)
eq(22,'conditional corrected PDE',S.diff(conditional,t,2)-S.diff(conditional,x,2),0)
eq(22,'conditional left boundary',conditional.subs(x,0),0)
eq(22,'conditional initial velocity',S.diff(conditional,t).subs(t,0),0)
eq(22,'conditional right derivative',S.diff(conditional,x).subs(x,R(1,2)),0)
eq(22,'conditional right value',conditional.subs(x,R(1,2)),cos(pi*t))

# 23: all three lengths, with L^3 scaling and no dropped even terms.
for length in [2,3,4]:
    u=exp(-n*n*pi*pi*t/length**2)*sin(n*pi*x/length)
    heat(23,u,1,length,label=f'L={length} mode')
    sine_coefficient(23,x*x*(x-length),S.Integer(length),4*length**3*(1+2*(-1)**n)/(n**3*pi**3),label=f'L={length} sine')

# 24: odd modes plus the exceptional n=2 coefficient evaluated directly.
u=sin(n*x)*cos(n*t)
wave(24,u,1,pi,g=0,label='mode')
for j in range(1,11):
    coefficient=2/pi*S.integrate((1-cos(2*x))*sin(j*x),(x,0,pi))
    expected=-16/(pi*j*(j*j-4)) if j%2 else S.Integer(0)
    eq(24,f'exact initial sine coefficient n={j}',coefficient,expected)

coverage=sorted({item['question'] for item in checks})
result=dict(questionCount=len(coverage),checkCount=len(checks),passed=all(c['passed'] for c in checks),checks=checks)
output=ROOT/'.tools/bvp-math-results.json';output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"{sum(c['passed'] for c in checks)}/{len(checks)} passed; {len(coverage)}/25 questions covered",flush=True)
if not result['passed'] or coverage!=list(range(1,26)):raise SystemExit(1)
