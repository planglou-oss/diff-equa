"""Independent symbolic checks transcribed from the 71 original question images.

Run with Python + SymPy. This is an AI-assisted algebra audit, not human review.
It checks final answers, initial data, time shifts, integral identities and selected
intermediate fractions. The content digest is bound separately by the review data.
"""
import json
from functools import lru_cache
from pathlib import Path
import sympy as S

t = S.symbols('t', positive=True)
s = S.symbols('s', positive=True)
E, sin, cos, pi, R = S.exp, S.sin, S.cos, S.pi, S.Rational
checks = []

def eq(n, label, actual, expected):
    residual = S.simplify(S.trigsimp((actual - expected).rewrite(S.exp)))
    ok = residual == 0
    checks.append(dict(question=n, check=label, passed=ok, residual=str(residual)))
    if not ok:
        print(f'FAIL {n}: {label}: {residual}', flush=True)

@lru_cache(maxsize=None)
def L(f):
    return S.laplace_transform(S.expand(f), t, s, noconds=True)

def window(f, a, b):
    return E(-a*s)*L(f.subs(t, t+a)) - E(-b*s)*L(f.subs(t, t+b))

def ode(n, label, y, coefficients, forcing, initials):
    order = len(coefficients)-1
    eq(n, label+' ODE', sum(c*S.diff(y,t,order-i) for i,c in enumerate(coefficients)), forcing)
    for k, value in enumerate(initials):
        eq(n, label+f' initial derivative {k}', S.diff(y,t,k).subs(t,0), value)

def inverse(n, label, f, F):
    eq(n, label+' forward transform', L(f), F)

def run():
    root3=S.sqrt(3)
    a,b=S.symbols('a b',positive=True)
    eq(1,'division by t / frequency shift derivative',S.diff(S.atan(b/(s+a)),s),-b/((s+a)**2+b**2))
    inverse(1,'b',E(t)/4-E(-t)/4-t*E(-t)/6-2*E(t/2)*sin(root3*t/2)/(3*root3),1/((s**2-1)*(s**3+1)))
    inverse(2,'a',-R(3,4)+t/2+E(-t)-E(-2*t)/4,1/(s**2*(s+1)*(s+2)))
    v=E(-t)/2-E(-2*t)/5-R(3,10)*cos(t)+sin(t)/10
    inverse(2,'b kernel',v,1/((s+1)*(s+2)*(s**2+1)))
    eq(2,'b forcing window',window(sin(t),0,pi),(1+E(-pi*s))/(s**2+1))
    A,B=S.symbols('A B',real=True)
    h=E(-3*t)*(A*cos(2*t)+(3*A+B)*sin(2*t)/2)
    ode(3,'a homogeneous',h,[1,6,13],0,[A,B])
    v=1-E(-3*t)*cos(2*t)-R(3,2)*E(-3*t)*sin(2*t)
    ode(3,'a step',v,[1,6,13],13,[0,0])
    inverse(3,'b',E(t)/2-E(-t)/6-t*E(-t)/3-E(t/2)*cos(root3*t/2)/3-E(t/2)*sin(root3*t/2)/(3*root3),(s**2+1)/((s**2-1)*(s**3+1)))
    ode(4,'homogeneous',(2*A+B)*E(-t)-(A+B)*E(-2*t),[1,3,2],0,[A,B])
    ode(4,'step',R(1,2)-E(-t)+E(-2*t)/2,[1,3,2],1,[0,0])
    eq(5,'a integrated sine-over-t derivative',S.diff(s*S.atan(3/(s+2))/s,s),-3/((s+2)**2+9))
    inverse(5,'b',E(-t)/2-E(t)/6+t*E(t)/3-E(-t/2)*cos(root3*t/2)/3+E(-t/2)*sin(root3*t/2)/(3*root3),(s**2+1)/((s**2-1)*(s**3-1)))
    eq(6,'graph windows',window(t,0,1)+window(S.Integer(1),1,2)+window(3-t,2,3),(1-E(-s)-E(-2*s)+E(-3*s))/s**2)
    inverse(7,'inverse',t*E(-t)-R(11,16)*E(-t)*sin(2*t)+R(3,8)*t*E(-t)*cos(2*t),(s**2+2*s+17)/((s+1)**2*(s**2+2*s+5)**2))
    eq(8,'graph windows',window(t,0,2)+window(S.Integer(2),2,3)+window(8-2*t,3,4),(1-E(-2*s)-2*E(-3*s)+2*E(-4*s))/s**2)
    inverse(9,'inverse',-(t-2)*E(-t)-(t-1)*E(-2*t)*sin(t)-2*(t+1)*E(-2*t)*cos(t),(4*s**2+8*s)/((s+1)**2*(s**2+4*s+5)**2))
    # Periodic absolute sine: integrate one nonnegative half wave.
    periodic=window(sin(t),0,pi)/(1-E(-pi*s))
    eq(10,'periodic transform',periodic,1/((s**2+1)*S.tanh(pi*s/2)))
    eq(10,'weighted integral',periodic.subs(s,1),S.coth(pi/2)/2)
    shared=(3*t+4)*E(-2*t)+(t-4)*E(-t)*cos(t)-t*E(-t)*sin(t)
    sharedF=2*(s**2+2)/((s+2)**2*(s**2+2*s+2)**2)
    inverse(11,'inverse',shared,sharedF)
    for q in (11,59,62):
        for k,expected in enumerate((0,0,0,2)):
            eq(q,f'near-zero derivative {k}',S.diff(shared,t,k).subs(t,0),expected)
    ode(12,'a',t**2*E(1-t),[t,t-1,1],0,[0])
    eq(12,'a condition at one',(t**2*E(1-t)).subs(t,1),1)
    F=1/(4*(s+2))+3/(4*(s+6))
    eq(12,'b integral equation',F,1/(s+2)-3*F/(s+3))
    for n in (1,2,3,4,7):
        y=sum((-1)**k*S.binomial(n,k)*t**k/S.factorial(k) for k in range(n+1))
        ode(13,f'Laguerre n={n}',y,[t,1-t,n],0,[1])
        inverse(13,f'Laguerre n={n}',y,(s-1)**n/s**(n+1))
    nn=S.symbols('n',integer=True,nonnegative=True)
    YY=(s-1)**nn/s**(nn+1)
    eq(13,'general n transform equation',(s**2-s)*S.diff(YY,s)+(s-nn-1)*YY,0)
    inverse(14,'inverse',(t-4)*E(-t)+4*E(-t)*cos(t)+(2*t-1)*E(-t)*sin(t),(s**2-2*s-2)/((s+1)**2*(s**2+2*s+2)**2))
    eq(15,'a delayed transform',E(-s-2)*L(E(-2*t)*(1+sin(t))),E(-s-2)*(s**2+5*s+7)/((s+2)*(s**2+4*s+5)))
    Y=2/(s*(s+2));eq(15,'b integral equation',Y,(2/s-Y)/(s+1))
    x=(t+2)*E(-t)+t-2;y=(3*t-1)*E(-t)
    eq(16,'system equation 1',4*S.diff(x,t,2)+S.diff(x,t)-y,1)
    eq(16,'system equation 2 derivative',S.diff(x,t,3)-2*S.diff(x,t,2)+y,0)
    eq(16,'integral equation at zero',S.diff(x,t,2).subs(t,0)-2*S.diff(x,t).subs(t,0),0)
    eq(16,'initial x',x.subs(t,0),0);eq(16,'initial x prime',S.diff(x,t).subs(t,0),0)
    inverse(17,'a',t**2*E(-t)*sin(t),(6*s**2+12*s+4)/(s**2+2*s+2)**3)
    inverse(17,'b',(1-t)*sin(t),(s-1)**2/(s**2+1)**2)
    v=t/6+R(5,36)-E(2*t)/4+E(3*t)/9
    inverse(18,'shift kernel',v,1/(s**2*(s-2)*(s-3)))
    y=R(1,6)+E(2*t)/2+E(3*t)/3
    ode(18,'before first switch',y,[1,-5,6],1,[1,2])
    eq(18,'kernel shifted constant at 2',S.expand((t/6+R(5,36)).subs(t,t-2)),t/6-R(7,36))
    v=(2-2*E(-t)*cos(2*t)-E(-t)*sin(2*t))/5
    ode(19,'pulse step response',v,[1,2,5],2,[0,0])
    inverse(20,'convolution step response',2*v,4/(s*(s**2+2*s+5)))
    periodic=(window(cos(t),0,pi/2)-window(cos(t),pi/2,pi))/(1-E(-pi*s))
    eq(21,'absolute cosine periodic',periodic,(s+2*E(-pi*s/2)-s*E(-pi*s))/((s**2+1)*(1-E(-pi*s))))
    f=(t**2+3*t+1)*E(-t)+(2*t/3-1)*E(-t/2)*cos(root3*t/2)-19*root3*E(-t/2)*sin(root3*t/2)/9
    inverse(22,'inverse',f,(s**2+s+2)/((s+1)**3*(s**2+s+1)**2))
    eq(23,'a sine-over-t derivative',S.diff(S.atan(1/(s+1)),s),-1/((s+1)**2+1))
    inverse(23,'b',(t+3)*sin(t)-t*cos(t),(2*s**2+2*s+4)/(s**2+1)**2)
    v=t-1+E(-t);inverse(24,'forced ramp kernel',v,1/(s**2*(s+1)))
    C=S.symbols('C',real=True)
    ode(24,'arbitrary homogeneous constant',C*E(-t),[1,1],0,[C])
    eq(24,'forcing window',window(t-1,1,2)+window(3-t,2,3),(E(-s)-2*E(-2*s)+E(-3*s))/s**2)
    # The two pulse shapes in q25, q26 recur as q48.
    Fminus=(E(-pi*s)*(1/s-s/(s**2+1))-E(-2*pi*s)*(1/s+s/(s**2+1)))/2
    Fplus=(E(-pi*s)*(1/s+s/(s**2+1))-E(-2*pi*s)*(1/s-s/(s**2+1)))/2
    Am=(1-cos(t))/2-t*sin(t)/4;Ap=(1-cos(t))/2+t*sin(t)/4
    for n in (25,26,48):
        eq(n,'a forcing window',window((1+cos(t))/2,pi,2*pi),Fminus)
        eq(n,'a shifted solution',E(-pi*s)*L(Am)-E(-2*pi*s)*L(Ap),Fminus/(s**2+1))
    eq(25,'b forcing window',window((1-cos(t))/2,pi,2*pi),Fplus)
    for n in (25,26):eq(n,'b shifted solution',E(-pi*s)*L(Ap)-E(-2*pi*s)*L(Am),Fplus/(s**2+1))
    for n in (26,48):ode(n,'homogeneous',A*cos(t)+B*sin(t),[1,0,1],0,[A,B])
    z=s+2
    eq(27,'a log derivative',S.diff(S.log((z**2+4)/(z**2+1))/2,s),-(z/(z**2+1)-z/(z**2+4)))
    inverse(27,'b',E(-2*t)*(2*t**2-4+4*cos(t)),4/((s+2)**3*(s**2+4*s+5)))
    y=-S.cosh(t)/4-3*cos(t)/4+t*sin(t)/4
    eq(28,'convolution ODE',s**2*L(y)+s-L(y)/s**2,s/(s**2+1))
    G=2*S.coth(pi*s/4)/(s**2+4)
    F=pi*S.csch(pi*s/4)**2/(2*(s**2+4))+4*s*S.coth(pi*s/4)/(s**2+4)**2
    eq(29,'t multiplication',-S.diff(G,s),F)
    eq(29,'weighted integral',F.subs(s,1),pi*S.csch(pi/4)**2/10+4*S.coth(pi/4)/25)
    inverse(30,'inverse',E(-t)+t*E(-t)/2-cos(t)+sin(t)-t*cos(t)/2-t*sin(t)/2,(s**2+2*s+3)/((s+1)**2*(s**2+1)**2))
    raw=-window(sin(pi*t),1,2)+window(sin(pi*t),2,3)
    eq(31,'a window transform',(raw.subs(s,s+1)),pi*E(-(s+1))*(1+E(-(s+1)))**2/((s+1)**2+pi**2))
    inverse(31,'b',8*t**3/3-8*t+5*sin(2*t)-2*t*cos(2*t),(16/(s**2*(s**2+4)))**2)
    y=E(-t)*(R(5,4)-t**2/2-R(5,4)*cos(2*t))
    eq(32,'integral ODE',(s+2+1/s)*L(y),L(2*E(-t)*(sin(t)**2+sin(2*t))))
    eq(32,'initial',y.subs(t,0),0)
    z=s+1
    F=S.log((z**2+9)/(z**2+49))/2
    eq(33,'log derivative',S.diff(F,s),-(z/(z**2+49)-z/(z**2+9)))
    eq(33,'integral',F.subs(s,0),S.log(S.Rational(1,5))/2)
    inverse(34,'inverse',2*(S.sinh(t)-sin(t)+t*cos(t)),(2*s**4+6)/((s**4-1)*(s**2+1)))
    inverse(35,'inverse',(t**3/6-t**2/2+2*t)*E(-t)-2*E(-t/2)*sin(root3*t/2)/root3,(s**4+s**3+s**2+s+1)/((s+1)**4*(s**2+s+1)))
    aa=(sin(t)-t*cos(t))/2;bb=(E(-t)-cos(t)+sin(t))/2
    forced=window(sin(t),2*pi,3*pi)+E(-3*pi*s)/(s+1)
    actual=E(-2*pi*s)*L(aa)+E(-3*pi*s)*L(aa+bb)
    eq(36,'shifted response',actual,forced/(s**2+1))
    ode(36,'homogeneous',sin(t),[1,0,1],0,[0,1])
    F=E(-s)/s**2+E(-2*s)*(2/s**3-3/s**2)-2*E(-3*s)/s**3
    eq(37,'piecewise input',window(t-1,1,2)+window((t-3)**2,2,3),F)
    eq(37,'scaling shift',E(-5*s/2)*F.subs(s,s/2)/2,2*(s*E(-3*s)-(3*s-4)*E(-7*s/2)-4*E(-4*s))/s**3)
    ode(38,'solution',E(-2*t)*(3*t**2+2*t-1-2*sin(3*t)/3),[1,4,4],6*E(-2*t)*(1+sin(3*t)),[-1,2])
    eq(39,'product to sum',E(-t)*cos(2*t)*sin(t),E(-t)*(sin(3*t)-sin(t))/2)
    F=(S.atan(s+1)-S.atan((s+1)/3))/2
    eq(39,'product transform derivative',S.diff(F,s),-((1/((s+1)**2+9)*3)-(1/((s+1)**2+1)))/2)
    eq(39,'convolution factors',(s+1)/((s+1)**2+4)*S.atan(1/s),(s+1)/(s**2+2*s+5)*S.atan(1/s))
    inverse(40,'inverse',E(-t)*(4*t**3/3+t**2-5*t-7)+E(-t/2)*(7*cos(root3*t/2)+root3*sin(root3*t/2)),(s**2-4*s+3)/((s+1)**4*(s**2+s+1)))
    eq(41,'first shift',E(-pi*(s+4))*(1/(s+4)+2/((s+4)**2+4)),E(-4*pi)*E(-pi*s)*L(E(-4*t)*(1+sin(2*t))))
    eq(41,'windowed scaling',window(1+sin(t/2),4*pi,5*pi),(1/s+2/(4*s**2+1))*E(-4*pi*s)-(1/s+4*s/(4*s**2+1))*E(-5*pi*s))
    F=window(sin(t),pi/2,3*pi/2)
    eq(42,'shifted response',(E(-pi*s/2)+E(-3*pi*s/2))*L(t*sin(t)/2),F/(s**2+1))
    ode(42,'homogeneous',A*cos(t)+B*sin(t),[1,0,1],0,[A,B])
    inverse(43,'convolution',E(-t)*(sin(t)+t*cos(t))/2,((s+1)/((s+1)**2+1))**2)
    k,w=S.symbols('k w',positive=True)
    eq(44,'triple angle simplification',k*(2*sin(w*t)**3/3+sin(3*w*t)/6+S.Abs(sin(w*t))/2),k*(sin(w*t)+S.Abs(sin(w*t)))/2)
    # General formula after cancelling one period factor.
    half=window(sin(w*t),0,pi/w)
    eq(44,'half-wave periodic',k*half/(1-E(-2*pi*s/w)),k*w/((s**2+w**2)*(1-E(-pi*s/w))))
    aa,dd=S.symbols('a d',nonzero=True,real=True)
    P=t**2/aa-(2+aa*dd)*t/aa**2+(2+aa*dd)*(1-E(-aa*t))/aa**3
    ode(45,'general switched kernel',P,[1,aa],t*(t-dd),[0])
    eq(45,'a=0 extension',S.diff(t**3/3-dd*t**2/2,t),t*(t-dd))
    left,right=S.symbols('b c',real=True)
    J=E(aa*t)*((t-left)*(t-right)/aa-(2*t-left-right)/aa**2+2/aa**3)
    eq(45,'general clipped-time primitive',S.diff(J,t),E(aa*t)*(t-left)*(t-right))
    Jzero=t**3/3-(left+right)*t**2/2+left*right*t
    eq(45,'general a=0 primitive',S.diff(Jzero,t),(t-left)*(t-right))
    inverse(46,'convolution ramp kernel',t-2+(t+2)*E(-t),1/(s**2*(s+1)**2))
    v=1-(1+t)*E(-t)
    ode(47,'step kernel',v,[1,2,1],1,[0,0])
    ode(47,'homogeneous',A*E(-t)+(A+B)*t*E(-t),[1,2,1],0,[A,B])
    inverse(49,'convolution ramp kernel',t-1+E(-t),1/(s**2*(s+1)))
    eq(49,'triangle input',window(t,0,1)+window(2-t,1,2),(1-2*E(-s)+E(-2*s))/s**2)
    eq(50,'convolution expansion',E(-2*s)*((1-2*E(-s)+E(-2*s))/s)**2,(E(-2*s)-4*E(-3*s)+6*E(-4*s)-4*E(-5*s)+E(-6*s))/s**2)
    for l,h,f in [(2,3,t-2),(3,4,10-3*t),(4,5,3*t-14),(5,6,6-t)]:
        # Piecewise slopes are the cumulative binomial ramp coefficients.
        ramp=sum(co*(t-j) for j,co in [(2,1),(3,-4),(4,6),(5,-4),(6,1)] if j<=l)
        eq(50,f'interval {l}-{h}',ramp,f)
    ode(51,'homogeneous',E(-t)*(A+B*t),[1,2,1],0,[A,B-A])
    for delay in (1,2):
        v=E(-delay)*E(-t)*(t**3/6+delay*t**2/2)
        eq(51,f'kernel {delay}',L(v),E(-delay)*(1/(s+1)**4+delay/(s+1)**3))
    for aa in (1,2):
        inverse(52,f'part a={aa}',E(-aa*t)*(t**3/6-2*t+5*sin(t)/2-t*cos(t)/2),1/((s+aa)**4*((s+aa)**2+1)**2))
    for n,initials,resp in [(1,[-2,1],(sin(t)-t*cos(t))/2),(2,[-1,2],t*sin(t)/2)]:
        forcing=sin(t) if n==1 else cos(t)
        ode(53,f'part {n} resonance',resp,[1,0,1],forcing,[0,0])
        ode(53,f'part {n} initial',initials[0]*cos(t)+initials[1]*sin(t),[1,0,1],0,initials)
    eq(54,'shift polynomial',4*(t+S.Rational(1,2))**2-sin(pi*(t+S.Rational(1,2))),4*t**2+4*t+1-cos(pi*t))
    F=E(-s/2)*((s**2+4*s+8)/s**3-s/(s**2+pi**2))
    eq(54,'integral via scaling',2*E(-3)*F.subs(s,2),E(-4)*(5-4/(4+pi**2)))
    x=E(-t)*(1+t+t**2/2-t**3/6);y=E(-t)*(1+t-3*t**2/2+t**3/6)
    eq(55,'system first',x+2*S.diff(x,t)-y,0)
    eq(55,'system second derivative',S.diff(x,t,2)+y,S.diff(t*E(-t),t))
    eq(55,'second equation constant',S.diff(x,t).subs(t,0),0);eq(55,'initial x',x.subs(t,0),1)
    for aa,m,n,q in [(1,2,3,56),(2,1,3,56),(1,3,4,60),(2,2,4,60),(3,1,4,60)]:
        F=(aa-aa*n*E(-m*s)/(n-m)+aa*m*E(-n*s)/(n-m))/s**2
        eq(q,f'triangle a={aa} m={m}',window(aa*t,0,m)+window(aa*m*(n-t)/(n-m),m,n),F)
        if q==56:
            scale,shift=(2,R(1,2)) if aa==1 else (R(1,2),2)
            expected=(2*E(-s/4)-6*E(-5*s/4)+4*E(-7*s/4))/s**2 if aa==1 else (2*E(-4*s)-3*E(-6*s)+E(-10*s))/(2*s**2)
            eq(q,f'time scaling a={aa}',E(-shift*s/scale)*F.subs(s,s/scale)/scale,expected)
        else:
            reflected=window(aa*m*t/(n-m),0,n-m)+window(aa*(n-t),n-m,n)
            eq(q,f'reflection a={aa}',reflected,E(-n*s)*F.subs(s,-s))
    for w in (2,3):
        y=6*cos(t)/(w**2-1)+(w**2-7)*cos(w*t)/(w**2-1)
        ode(57,f'omega {w}',y,[1,0,w**2],6*cos(t),[1,0])
    h=S.sinh(t)-2*sin(t)+t*cos(t)
    eq(58,'response kernel',L(h),4/((s**2+1)*(s**4-1)))
    ode(58,'initial solution',S.cosh(t),[1,0,0,0,-1],0,[1,0,1,0])
    for q in (59,62):inverse(q,'same rational as 2003',shared,sharedF)
    for w,a,c1,c2,y in [(2,6,-1,2,2*sin(t)-cos(2*t)),(3,8,-2,1,sin(t)-2*cos(3*t)),(4,15,-3,1,sin(t)-3*cos(4*t))]:
        ode(61,f'omega {w}',y,[1,0,w**2],a*sin(t),[c1,c2])
    for aa,bb,k1,k2 in [(2,3,2,3),(3,4,3,2),(4,5,1,4)]:
        ca=R(bb*k1+k2,bb-aa);cb=-R(aa*k1+k2,bb-aa)
        ode(63,f'initial a={aa}',ca*E(-aa*t)+cb*E(-bb*t),[1,aa+bb,aa*bb],0,[k1,k2])
        g=R(1,aa*bb)-E(-aa*t)/(aa*(bb-aa))+E(-bb*t)/(bb*(bb-aa))
        ode(63,f'step a={aa}',g,[1,aa+bb,aa*bb],1,[0,0])
    for n,a,b,c1,c2,scale in [(1,3,5,1,3,R(1,2)),(2,5,7,3,5,R(1,5))]:
        eq(64,f'part {n} product to sum',(sin(b*t)-sin(c1*t))*sin(a*t)/c2,(cos((a+c1)*t)-cos((b+a)*t))/(2*c2))
        F=S.log((s**2+(b+a)**2)/(s**2+(a+c1)**2))/(4*c2)
        expected=S.log(2)/3 if n==1 else S.log(R(3,2))/2
        eq(64,f'part {n} integral',F.subs(s,0)/scale,expected)
    # The original q65 IC are inconsistent with its first-order equation.
    # Verify the contradiction and the explicitly conditional correction x'(0)=1.
    for label,specified in [('a',2),('b',-1)]:
        eq(65,label+' initial-data contradiction',S.Integer(specified)-1,1 if label=='a' else -2)
    for label,old,actual in [('a',(t**2-6*t-9)*E(-3*t)+9*E(-2*t),3),('b',(t**2+5*t-8)*E(-2*t)+8*E(-3*t),-3)]:
        eq(65,label+' original answer derivative',S.diff(old,t).subs(t,0),actual)
    for label,x,rhs,coef,ycoef in [('a',(t**2-8*t-9)*E(-3*t)+9*E(-2*t),E(-3*t),[1,0,1],7),('b',(t**2+9*t-8)*E(-2*t)+8*E(-3*t),2*E(-2*t),[2,0,-1],5)]:
        X=L(x);Y=(1/(s+2)-(s+1)*X)/2 if label=='a' else 1/(s+3)-(s+1)*X
        eq(65,label+' conditional system first',(coef[0]*s**2+coef[2])*X-coef[0]+(s-ycoef)*Y,L(rhs))
        eq(65,label+' conditional y initial',S.limit(s*Y,s,S.oo),0)
        eq(65,label+' conditional x initial',x.subs(t,0),0)
        eq(65,label+' conditional x derivative',S.diff(x,t).subs(t,0),1)
    ode(66,'initial',sin(t)-cos(t),[1,0,1],0,[-1,1])
    ode(66,'step response',1-cos(t),[1,0,1],1,[0,0])
    inverse(67,'inverse',(t**3+t**2-1)*E(-2*t)+E(-t)*(cos(t)-sin(t)),2*(s**2+2)/((s+2)**4*(s**2+2*s+2)))
    for label,k,a,b in [('a',1,1,2),('b',2,2,3),('c',3,1,4),('d',1,3,4)]:
        G=pi/((s+k)**2+pi**2)
        sign_a=(-1)**a;sign_b=(-1)**b
        # Original pieces have alternating sign for odd delays.
        eq(68,label+' time-shift sign',sign_a*E(-a*s)*L(E(-k*t)*sin(pi*(t+a))),E(-a*s)*G)
        eq(68,label+' later shift sign',sign_b*E(-b*s)*L(E(-k*t)*sin(pi*(t+b))),E(-b*s)*G)
    for aa in (2,3,4,5):
        y=aa*E(-aa*t)-(aa-1)*E(-(aa+1)*t)
        ode(69,f'a={aa} initial',y,[1,2*aa+1,aa*(aa+1)],0,[1,-1])
        g=1-(aa+1)*E(-aa*t)+aa*E(-(aa+1)*t)
        ode(69,f'a={aa} pulse response',g,[1,2*aa+1,aa*(aa+1)],aa*(aa+1),[0,0])
    for aa in (1,-1,3,-3):inverse(70,f'parameter {aa}',(1-t+aa*t**2/2)*E(-t),(s**2+s+aa)/(s+1)**3)
    for w,c1,c2 in [(2,3*pi/2,1),(4,3*pi/4,2),(6,pi/2,4),(8,3*pi/8,1)]:
        ode(71,f'omega {w} initial',c1*cos(w*t)+c2*sin(w*t),[1,0,w**2],0,[c1,w*c2])
        h=sin(w*t)/(2*w)-t*cos(w*t)/2
        ode(71,f'omega {w} resonance kernel',h,[1,0,w**2],w*sin(w*t),[0,0])
        eq(71,f'omega {w} impulse jump',S.diff(sin(w*t),t).subs(t,0),w)
        last=c1*cos(w*t)+c2*sin(w*t)+sin(w*(t-2*pi/w))+h.subs(t,t-3*pi/w)
        correct=(c1+t/2-3*pi/(2*w))*cos(w*t)+(c2+1-R(1,2*w))*sin(w*t)
        eq(71,f'omega {w} final interval',last,correct)

if __name__=='__main__':
    run()
    report=Path(__file__).resolve().parents[1]/'.tools/laplace-math-results.json'
    report.write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    covered={x['question'] for x in checks}
    failures=[x for x in checks if not x['passed']]
    print(f'{len(checks)} symbolic checks; {len(covered)}/71 questions; {len(failures)} failures',flush=True)
    raise SystemExit(bool(failures) or covered!=set(range(1,72)))
