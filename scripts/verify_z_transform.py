"""Independent Z-transform audit transcribed from the original 27 question images.

Requires SymPy. Rational transform identities, symbolic recurrences, initial
conditions and exact Laurent coefficients are checked. This is AI-assisted
verification, not instructor review. Run from any directory.
"""
import hashlib
import json
from pathlib import Path
import sympy as S

ROOT = Path(__file__).resolve().parents[1]
n = S.symbols('n', integer=True, nonnegative=True)
z, w = S.symbols('z w')
C1,C2,C3,C4,A = S.symbols('C1 C2 C3 C4 A', real=True)
R=S.Rational
sin,cos,pi,sqrt=S.sin,S.cos,S.pi,S.sqrt
checks=[]

def eq(q,label,left,right):
    residual=S.simplify(S.expand_trig(S.expand(left-right)))
    if residual != 0:
        residual=S.trigsimp(residual,method='fu')
    if residual != 0:
        residual=S.simplify(S.expand_complex(residual.rewrite(S.exp)))
    checks.append(dict(question=q,check=label,passed=residual==0,residual=str(residual)))
    if residual != 0: print(f'FAIL {q}: {label}: {residual}',flush=True)

def recurrence(q,y,coeffs,forcing,initials=()):
    eq(q,'symbolic recurrence (all n)',sum(c*y.subs(n,n+j) for j,c in enumerate(coeffs)),forcing)
    for j,value in enumerate(initials): eq(q,f'initial n={j}',y.subs(n,j),value)

def coeffs(q,F,f,count=12):
    series=S.series(F.subs(z,1/w),w,0,count).removeO().expand()
    for j in range(count): eq(q,f'Laurent coefficient n={j}',series.coeff(w,j),f.subs(n,j))

# 1: Z of n^3 and first-order forced recurrence.
D=lambda f:-z*S.diff(f,z)
eq(1,'n^3 transform',D(D(D(z/(z-1)))),z*(z*z+4*z+1)/(z-1)**4)
y=R(5,27)*4**n-n*n/3-2*n/9-R(5,27)
recurrence(1,y,[-4,1],n*n,[0])
Y=z*(z+1)/((z-1)**3*(z-4))
eq(1,'transformed equation',(z-4)*Y,z*(z+1)/(z-1)**3)
coeffs(1,Y,y)

# 2 and 3: resonance and index shift.
eq(2,'n^3+n^2 transform',D(D(D(z/(z-1))))+D(D(z/(z-1))),2*z*z*(z+2)/(z-1)**4)
y=(R(4,25)+n/10)*(-2)**n+R(21,25)*3**n
recurrence(2,y,[-6,-1,1],(-2)**n,[1,2])
Y=z*(z+1)/((z+2)*(z-3))+z/((z+2)**2*(z-3))
eq(2,'transformed equation',(z*z-z-6)*Y-z*z-z,z/(z+2))
coeffs(2,Y,y)
y=R(29,16)*3**n-2**(n+1)-n/4+R(3,16)*(-1)**n
recurrence(3,y,[-3,-2,1],n+6*2**n,[0,1])
eq(3,'original n=2',y.subs(n,2),8)
eq(3,'original n=3',y.subs(n,3),32)
Y=z*(R(29,16)/(z-3)-2/(z-2)-1/(4*(z-1)**2)+R(3,16)/(z+1))
eq(3,'transformed equation',(z*z-2*z-3)*Y-z,z/(z-1)**2+6*z/(z-2))
coeffs(3,Y,y)

# 4: Integrate Chebyshev quotient exactly, not the singular-looking ratio.
c,x,theta=S.symbols('c x theta',real=True)
for j in range(13):
    quotient=S.cancel((S.chebyshevt(j,x)-S.chebyshevt(j,c))/(x-c)).expand()
    integral=0
    for (power,),value in S.Poly(quotient,x).terms():
        if power%2==0: integral+=value*pi*S.binomial(power,power//2)/2**power
    expected=0 if j==0 else pi*S.chebyshevu(j-1,c)
    eq(4,f'exact original integral n={j}',integral,expected)
eq(4,'trigonometric recurrence',sin((n+2)*theta)-2*cos(theta)*sin((n+1)*theta)+sin(n*theta),0)
eq(4,'A=-2 polynomial identity',(2*x*x-1)-2*c*x+1-((2*c*c-1)-2*c*c+1),2*(x-c)*x)

# 5: Both components and both equations.
a=1-2**(n+1)+3**n;b=-3-n+2**(n+2)-3**n
eq(5,'a system residual',a.subs(n,n+1)-4*a-b,n)
eq(5,'b system residual',b.subs(n,n+1)+2*a-b,1)
eq(5,'a0',a.subs(n,0),0);eq(5,'b0',b.subs(n,0),0)
AZ=2*z/((z-1)*(z-2)*(z-3));BZ=z*(z*z-5*z+2)/((z-1)**2*(z-2)*(z-3))
eq(5,'first transformed equation',(z-4)*AZ-BZ,z/(z-1)**2)
eq(5,'second transformed equation',2*AZ+(z-1)*BZ,z/(z-1))
coeffs(5,AZ,a,6);coeffs(5,BZ,b,6)

# 6: geometric sum and real part for all real x.
expr=2*S.exp(S.I*x)/(2-S.exp(2*S.I*x))
eq(6,'real geometric sum',S.re(S.expand_complex(expr)),2*cos(x)/(5-4*cos(2*x)))
eq(6,'x=0',2*cos(x).subs(x,0)/(5-4*cos(2*x).subs(x,0)),2)

# 7: sampled recurrence, not uniqueness between samples.
y=(1-n/(2*sqrt(3)))*cos(n*pi/3)+(sqrt(3)+R(2,3)-n/2)*sin(n*pi/3)
recurrence(7,y,[1,-1,1],sin(n*pi/3),[1,2])
P=z*z-z+1;Y=z*(z+1)/P+sqrt(3)*z/(2*P**2)
eq(7,'transformed equation',P*Y-z*z-z,sqrt(3)*z/(2*P))
coeffs(7,Y,y)

# 8-10: inverse/forward transforms and derivative rule.
f=3**n*(1+R(29,18)*n+R(13,18)*n*n)
F=z*(z*z+z+1)/(z-3)**3
coeffs(8,F,f)
eq(8,'partial fractions',F/z,1/(z-3)+7/(z-3)**2+13/(z-3)**3)
f=n*2**(-n)*cos(n*pi/4)
F=sqrt(2)*z*(4*z*z-4*sqrt(2)*z+1)/(4*z*z-2*sqrt(2)*z+1)**2
G=z*(z-sqrt(2)/4)/(z*z-z/sqrt(2)+R(1,4))
eq(9,'derivative rule',F,D(G));coeffs(9,F,f)
f=n*n*2**n*cos(n*pi/3)
F=z*(z**4-14*z**3+56*z-16)/(z*z-2*z+4)**3
G=z*(z-1)/(z*z-2*z+4)
eq(10,'second derivative rule',F,D(D(G)));coeffs(10,F,f)

# 11 and 13: finite impulses cannot be discarded at the initial indices.
for q in [11,13]:
    y=R(4,5)*(-3)**n+R(9,20)*2**n-R(1,4)*S.KroneckerDelta(n,0)+R(1,2)*S.KroneckerDelta(n,1)
    Y=-R(1,4)+1/(2*z)+R(4,5)*z/(z+3)+R(9,20)*z/(z-2)
    eq(q,'transformed equation',(z*z+z-6)*Y-z*z,2-3/z)
    coeffs(q,Y,y)
    for j in range(12):
        eq(q,f'original recurrence n={j}',y.subs(n,j+2)+y.subs(n,j+1)-6*y.subs(n,j),2 if j==0 else (-3 if j==1 else 0))
    eq(q,'initial n=0',y.subs(n,0),1);eq(q,'initial n=1',y.subs(n,1),-1)

# 12: exact exponential series and real-valued sum.
a=S.symbols('a')
eq(12,'factorial generating function',S.summation(a**n/S.factorial(n)/z**n,(n,0,S.oo)),S.exp(a/z))
eq(12,'real exponential sum',S.re(S.exp(2*(cos(x)+S.I*sin(x)))) ,S.exp(2*cos(x))*cos(2*sin(x)))

# 14-18: repeated poles, shifts and rational fractional coefficients.
y=R(3,16)+(C1-R(3,16)+(C2+R(1,4))*n+n*n/8)*(-1)**n
recurrence(14,y,[1,2,1],R(3,4)+R(1,4)*(-1)**n,[C1,-C1-C2])
eq(14,'trigonometric forcing identity',sin(n*pi/4)**4+cos(n*pi/4)**4,R(3,4)+cos(n*pi)/4)
Y=(C1*z*z+(C1-C2)*z+3*z/(4*(z-1))+z/(4*(z+1)))/(z+1)**2
coeffs(14,Y,y,8)
y=n-R(1,2)-R(1,2)*(-1)**n+cos(n*pi/2)-sin(n*pi/2)
recurrence(15,y,[-1,0,0,0,1],4,[0,0,0,4]);coeffs(15,4*z*z/((z-1)*(z**4-1)),y)
y=sqrt(2)**n*((A-1-n/2)*cos(n*pi/4)+(3-A+n/2)*sin(n*pi/4))+cos(n*pi/2)-2*sin(n*pi/2)
recurrence(16,y,[2,-2,1],sqrt(2)**(n+2)*sin((n+2)*pi/4)+5*cos(n*pi/2),[A,0])
P=z*z-2*z+2;Y=(A*z*(z-2)+2*z*(z-1)/P+5*z*z/(z*z+1))/P
coeffs(16,Y,y,8)
y=12*n-108+72*R(1,2)**n-396*R(2,3)**n+432*R(3,4)**n
recurrence(17,y,[-R(1,4),R(29,24),-R(23,12),1],n/2,[0,0,1])
Y=z*(z*z-2*z+R(3,2))/((z-1)**2*(z-R(1,2))*(z-R(2,3))*(z-R(3,4)))
coeffs(17,Y,y)
y=R(24,7)*R(1,2)**n+R(144,595)*(-R(2,3))**n-R(144,17)*R(3,4)**n+R(24,5)
recurrence(18,y,[R(1,4),-R(11,24),-R(7,12),1],1,[0,0,1])
Y=z*z/((z-1)*(z-R(1,2))*(z+R(2,3))*(z-R(3,4)))
coeffs(18,Y,y)

# 19: multiplication as coefficient convolution.
F=z*(z+1)**2/((z*z+1)*(z-1)**2);f=2*n-sin(n*pi/2)
coeffs(19,F,f)
series=S.series(F.subs(z,1/w),w,0,6).removeO()
eq(19,'g4',S.expand(series*(1-w*w/2+w**4/24)).coeff(w,4),6)
eq(19,'h5',S.expand(series*(w-w**3/6+w**5/120)).coeff(w,5),R(22,3))

# 20: unilateral transform uses the supplied y[-1] at n=0.
cases=[(-1,-2,2**n,R(1,2),R(1,18)*(-1)**n+(R(4,9)+n/3)*2**n,z/(z-2)),
       (-1,-2,(-1)**n,-1,-(R(5,9)+n/3)*(-1)**n-R(4,9)*2**n,z/(z+1)),
       (1,-2,2*(-2)**n,-1,-R(1,9)-(R(8,9)+2*n/3)*(-2)**n,2*z/(z+2)),
       (0,-1,(-1)**n,-1,-R(1,4)-(R(3,4)+n/2)*(-1)**n,z/(z+1))]
for idx,(a,b,forcing,y0,y,V) in enumerate(cases):
    label=chr(97+idx)
    eq(20,label+' recurrence n>=1',y.subs(n,n+2)+a*y.subs(n,n+1)+b*y,forcing.subs(n,n+1))
    eq(20,label+' initial n=0',y.subs(n,0),y0)
    eq(20,label+' original equation n=0, y[-1]=0',y.subs(n,1)+a*y0,forcing.subs(n,0))
    Y=S.cancel((V+z*y0)/(z+a+b/z))
    coeffs(20,Y,y,8)

# 21: unknown parameter first affects the coefficient n=5.
a=S.symbols('a')
G=(w*w+w**4+2*w**5)/(1+a*w**3+w**5)
series=S.series(G,w,0,6).removeO().expand()
eq(21,'g2',series.coeff(w,2),1);eq(21,'g4',series.coeff(w,4),1);eq(21,'g5',series.coeff(w,5),2-a)
F=z*(4*z*z-8*z+1)/(4*z*z-2*z+1)**2
G=z*(z-R(1,4))/(z*z-z/2+R(1,4))
eq(21,'inverse derivative pair',F,D(G));coeffs(21,F,n*2**(-n)*cos(n*pi/3))

# 22: real trigonometric answer and exact given initial values.
y=2**n*(C1*cos(n*pi/3)+C2*sin(n*pi/3))+(cos(n*pi/2)-5*sin(n*pi/2))/(13*sqrt(2))
recurrence(22,y,[4,-2,1],cos((2*n+1)*pi/4),[C1+1/(13*sqrt(2)),C1+sqrt(3)*C2-5/(13*sqrt(2))])
y0=C1+1/(13*sqrt(2));y1=C1+sqrt(3)*C2-5/(13*sqrt(2))
Y=(y0*z*z+(y1-2*y0)*z+(z*z-z)/(sqrt(2)*(z*z+1)))/(z*z-2*z+4)
coeffs(22,Y,y,8)

# 23: repeated positive real roots and unrestricted initial values.
coeff=[1,-3*sqrt(2),R(13,2),-3*sqrt(2),1]
P=sum(c*z**j for j,c in enumerate(coeff))
eq(23,'factorization',P,(z-sqrt(2))**2*(z-1/sqrt(2))**2)
y=(C1+C2*n)*sqrt(2)**n+(C3+C4*n)*(1/sqrt(2))**n-R(2,9)*cos(n*pi/2)
recurrence(23,y,coeff,cos(n*pi/2))
eq(23,'particular gain',P.subs(z,S.I),-R(9,2))

# 24: signed derivative combination.
G=2*z/(4*z*z+1);F=2*z*(4*z*z-1)*(4*z*z-3)/(4*z*z+1)**3
eq(24,'D^2-D+1 identity',F,D(D(G))-D(G)+G)
coeffs(24,F,(n*n-n+1)*2**(-n)*sin(n*pi/2))

# 25: all three resonant general solutions with four independent constants.
for a,b in [(3,2),(2,3),(2,4)]:
    P=(z*z-a*a)*(z*z+b*b)
    eq(25,f'a={a}, b={b}, resonance derivative',(z*S.diff(P,z)).subs(z,S.I*b),2*b*b*(a*a+b*b))
    y=C1*a**n+C2*(-a)**n+b**n*((C3+n/R(2*b*b*(a*a+b*b)))*cos(n*pi/2)+C4*sin(n*pi/2))
    recurrence(25,y,[-a*a*b*b,0,b*b-a*a,0,1],b**n*cos(n*pi/2))

# 26: verify the original centered equation directly.
y=C1+C2*(-1)**n+C3*cos(n*pi/2)+C4*sin(n*pi/2)+n*n+2*sin(n*pi/4)
eq(26,'original centered recurrence',y.subs(n,n+2)-y.subs(n,n-2),8*n+4*cos(n*pi/4))
recurrence(26,y,[-1,0,0,0,1],8*n+16-4*sin(n*pi/4))

# 27: each root equation and both initial values, plus expansion of actual X.
for k in [R(1,2),R(3,2),R(5,2),R(7,2)]:
    d=sqrt(1+4*k);rp=(1+d)/2;rm=(1-d)/2
    eq(27,f'k={k}, root plus',rp*rp-rp-k,0)
    eq(27,f'k={k}, root minus',rm*rm-rm-k,0)
    y=(rp**(n+1)-rm**(n+1))/d
    eq(27,f'k={k}, initial 0',y.subs(n,0),1)
    eq(27,f'k={k}, initial 1',y.subs(n,1),1)
    eq(27,f'k={k}, partial fractions',z*z/(z*z-z-k),rp*z/(d*(z-rp))-rm*z/(d*(z-rm)))
    coeffs(27,z*z/(z*z-z-k),y,6)

coverage=sorted({c['question'] for c in checks})
result=dict(questionCount=len(coverage),checkCount=len(checks),passed=all(c['passed'] for c in checks),checks=checks)
output=ROOT/'.tools/z-transform-math-results.json'
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"{sum(c['passed'] for c in checks)}/{len(checks)} passed; {len(coverage)}/27 questions covered",flush=True)
if not result['passed'] or coverage!=list(range(1,28)):raise SystemExit(1)
