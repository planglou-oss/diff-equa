// Package studycontent contains authored study aids, not generated answers.
package studycontent

import (
	"fmt"
	"strings"
)

type Formula struct {
	Title string `json:"title"`
	Latex string `json:"latex"`
	Note  string `json:"note"`
}
type Guide struct {
	TopicID  int       `json:"topicId"`
	Title    string    `json:"title"`
	Tags     []string  `json:"tags"`
	Formulas []Formula `json:"formulas"`
	Hints    []string  `json:"hints"`
	Checks   []string  `json:"checks"`
	Mistakes []string  `json:"mistakes"`
	Source   string    `json:"source"`
}

const odeSource = "https://ocw.mit.edu/courses/18-03-differential-equations-spring-2010/pages/lecture-notes/"
const signalSource = "https://web.mit.edu/6.003/F11/www/handouts/lec05.pdf"

var Guides = []Guide{
	{1, "First-Order ODEs", []string{"ODE", "สมการเชิงอนุพันธ์", "อันดับหนึ่ง", "linear", "exact", "integrating factor"}, []Formula{
		{"สมการเชิงเส้น", `y'+p(x)y=q(x),\quad\mu=e^{\int p(x)dx}`, "จัดสัมประสิทธิ์ของ y' ให้เป็น 1 ก่อน"},
		{"คำตอบเชิงเส้น", `y=\mu^{-1}\left(\int\mu q\,dx+C\right)`, "ใช้ในช่วงที่สัมประสิทธิ์นิยามและต่อเนื่อง"},
		{"ตรวจ exact", `M\,dx+N\,dy=0,\quad M_y=N_x`, "ถ้ายังไม่ exact ให้พิจารณา integrating factor"}},
		[]string{"จำแนกว่าเป็น separable, linear หรือ exact", "Linear: จัดรูป y'+py=q; exact: เปรียบเทียบ M_y กับ N_x", "หาค่าคงที่แล้วแทนกลับในสมการและเงื่อนไขเริ่มต้น"},
		[]string{"อนุพันธ์ของคำตอบแทนในสมการเดิมได้", "เงื่อนไขเริ่มต้นเป็นจริง", "ระบุช่วงนิยามและจุดที่หารด้วยศูนย์ไม่ได้"}, []string{"หารด้วย y แล้วทำคำตอบ y=0 หาย", "ลืมค่าคงที่หรือใช้ integrating factor ผิดตัวแปร"}, odeSource},
	{2, "Second-Order ODEs", []string{"ODE", "สมการเชิงอนุพันธ์", "อันดับสอง", "characteristic", "initial conditions"}, []Formula{
		{"Characteristic", `ay''+by'+cy=0\Rightarrow ar^2+br+c=0`, "สัมประสิทธิ์คงที่ a≠0"},
		{"รากต่างกัน", `y_h=C_1e^{r_1x}+C_2e^{r_2x}`, "r1≠r2"},
		{"รากซ้ำ / เชิงซ้อน", `(C_1+C_2x)e^{rx};\quad e^{\alpha x}(C_1\cos\beta x+C_2\sin\beta x)`, "สำหรับรากซ้ำ r หรือ α±jβ ตามลำดับ"}},
		[]string{"แยก homogeneous กับ forcing และจดค่าเริ่มต้น", "หา y_h จาก characteristic roots แล้วเลือกวิธีหา y_p", "รวม y_h+y_p ก่อนใช้เงื่อนไขกับ y และ y'"},
		[]string{"แทน y,y',y'' กลับครบทุกพจน์", "ตรวจค่าเริ่มต้นทั้งสองข้อ", "ตรวจรากซ้ำและ resonance"}, []string{"ใช้ค่าเริ่มต้นกับ y_h เพียงส่วนเดียว", "ลืมคูณ x เมื่อ y_p ซ้ำกับ homogeneous"}, odeSource},
	{3, "Higher-Order ODEs", []string{"ODE", "สมการเชิงอนุพันธ์", "อันดับสูง", "superposition", "resonance"}, []Formula{
		{"สมการเชิงเส้น", `a_ny^{(n)}+\cdots+a_0y=f(x),\quad y=y_h+y_p`, "ใช้ characteristic polynomial เมื่อสัมประสิทธิ์คงที่"},
		{"รากซ้ำอันดับ m", `e^{rx},xe^{rx},\ldots,x^{m-1}e^{rx}`, "เป็นชุดคำตอบสำหรับราก r ที่ซ้ำ m ครั้ง"}},
		[]string{"ดูอันดับและชนิดสัมประสิทธิ์", "แยกรากและนับ multiplicity ให้ครบ", "ตั้ง particular ที่ไม่ซ้ำกับ y_h และใช้เงื่อนไขทั้งหมด"},
		[]string{"จำนวนค่าคงที่อิสระตรงกับอันดับ", "แทนอนุพันธ์ทุกอันดับกลับในสมการ", "ตรวจเงื่อนไขเริ่มต้นครบ"}, []string{"นับ multiplicity ไม่ครบ", "ตั้ง y_p ซ้ำกับ homogeneous"}, odeSource},
	{4, "Difference Equations", []string{"difference", "สมการผลต่าง", "recurrence", "discrete", "ผลต่าง"}, []Formula{
		{"Characteristic", `y[n+2]+ay[n+1]+by[n]=0\Rightarrow r^2+ar+b=0`, "สัมประสิทธิ์คงที่"},
		{"รากต่างกันที่ไม่เป็นศูนย์", `y_h[n]=C_1r_1^n+C_2r_2^n`, "กรณีรากศูนย์ให้ตรวจขอบเขตดัชนีและแทน recurrence โดยตรง"}},
		[]string{"จดดัชนีเริ่มต้นและค่าเริ่มต้น", "หา homogeneous จาก characteristic roots", "หา particular แล้วทดสอบ recurrence ที่ดัชนีเริ่มต้น"},
		[]string{"เลื่อนดัชนี y[n],y[n+1],y[n+2] ถูกต้อง", "ค่าเริ่มต้นครบและตรงโจทย์", "ทดสอบ recurrence อย่างน้อย 2–3 ค่า n"}, []string{"เลื่อนดัชนีของ forcing ไม่ครบ", "สับสน r^n กับ nr^n เมื่อรากซ้ำ"}, signalSource},
	{5, "Fourier Series", []string{"Fourier", "ฟูเรียร์", "อนุกรมฟูเรียร์", "periodic", "คาบ", "even", "odd"}, []Formula{
		{"อนุกรมตรีโกณมิติ", `f(t)\sim\frac{a_0}2+\sum_{n=1}^{\infty}[a_n\cos(n\omega_0t)+b_n\sin(n\omega_0t)]`, "ω0=2π/T; ที่จุดกระโดดอนุกรมอาจให้ค่าเฉลี่ยซ้าย–ขวา"},
		{"สัมประสิทธิ์", `a_n=\frac2T\int_{t_0}^{t_0+T}f(t)\cos(n\omega_0t)dt,\quad b_n=\frac2T\int_{t_0}^{t_0+T}f(t)\sin(n\omega_0t)dt`, "a0 ใช้สูตร a_n ที่ n=0; อินทิเกรตครบหนึ่งคาบ"}},
		[]string{"หาคาบ T และฟังก์ชันบนหนึ่งคาบ", "ตรวจ even/odd เพื่อลดสัมประสิทธิ์", "แบ่งอินทิกรัลตามช่วงแล้วตรวจ DC และรอยต่อ"},
		[]string{"T และ ω0=2π/T ถูกต้อง", "แบ่งอินทิกรัลครบหนึ่งคาบ", "แยก a0 จาก a0/2 และตรวจสมมาตร", "เทียบ partial sum กับค่าฟังก์ชันในจุดต่อเนื่อง"}, []string{"ใช้ π/T แทน 2π/T", "คาดให้ series เท่าค่าด้านเดียวที่จุดกระโดด"}, odeSource},
	{6, "Fourier Transforms", []string{"Fourier", "ฟูเรียร์", "แปลงฟูเรียร์", "transform", "convolution", "คอนโวลูชัน"}, []Formula{
		{"Convention ความถี่เชิงมุม", `F(\omega)=\int_{-\infty}^{\infty}f(t)e^{-j\omega t}dt,\quad f(t)=\frac1{2\pi}\int_{-\infty}^{\infty}F(\omega)e^{j\omega t}d\omega`, "ใช้ ω หน่วย rad/s; ตรวจ convention ของโจทย์ก่อน"},
		{"Time shift / convolution", `f(t-t_0)\leftrightarrow e^{-j\omega t_0}F(\omega),\quad f*g\leftrightarrow FG`, "ภายใต้เงื่อนไขที่ transform และ convolution นิยามได้"}},
		[]string{"ระบุ convention ω หรือ f และอ่านข้อความ/กราฟให้ครบ", "ลองใช้คู่แปลง shift/scaling/convolution ก่อนอินทิเกรตตรง", "ตรวจเครื่องหมาย exponent และตัวคูณ 2π"},
		[]string{"Normalization ของ forward/inverse สอดคล้องกัน", "ตรวจช่วงที่ฟังก์ชันไม่เป็นศูนย์", "ตรวจสมมาตรหรือ F(0)=∫f(t)dt เมื่อใช้ได้"}, []string{"ลืม factor ของ time scaling", "นำ convolution ไปคูณผิดโดเมน"}, "https://ocw.mit.edu/courses/res-18-009-learn-differential-equations-up-close-with-gilbert-strang-and-cleve-moler-fall-2015/pages/differential-equations-and-linear-algebra/fourier-and-laplace-transforms/"},
	{7, "Laplace Transforms", []string{"Laplace", "ลาปลาซ", "แปลงลาปลาซ", "partial fraction", "unit step", "shift"}, []Formula{
		{"อนุพันธ์ (unilateral)", `\mathcal L\{y'\}=sY-y(0^+),\quad\mathcal L\{y''\}=s^2Y-sy(0^+)-y'(0^+)`, "ใช้ค่าเริ่มต้นด้านขวาให้ตรงนิยามและโจทย์"},
		{"Time delay", `\mathcal L\{u(t-a)f(t-a)\}=e^{-as}F(s),\quad a\ge0`, "ภายใน f ต้องเป็น t-a"},
		{"คู่พื้นฐาน", `\mathcal L\{e^{at}\}=\frac1{s-a},\quad\mathcal L\{\sin bt\}=\frac b{s^2+b^2}`, "ตรวจขอบเขตลู่เข้า; คู่แรก Re(s)>Re(a)"}},
		[]string{"จด y(0),y'(0) และจัด forcing เป็น unit step หากจำเป็น", "แปลงสมการพร้อมค่าเริ่มต้นก่อนแยก Y(s)", "แยก partial fractions จัด square ให้ตรงคู่แปลง และตรวจ inverse shift"},
		[]string{"เทอมค่าเริ่มต้นถูกเครื่องหมาย", "รวม partial fractions กลับได้เศษส่วนเดิม", "แปลงกลับแล้วตรวจสมการกับค่าเริ่มต้น", "ตรวจช่วง unit step และความต่อเนื่องตาม forcing"}, []string{"ลืมเลื่อน f(t-a)", "ละเทอม repeated pole หรือทำเครื่องหมาย partial fraction ผิด"}, odeSource},
	{8, "Z-Transforms", []string{"Z-transform", "แซด", "ซีทรานส์ฟอร์ม", "ROC", "unilateral", "discrete"}, []Formula{
		{"นิยาม unilateral", `X(z)=\sum_{n=0}^{\infty}x[n]z^{-n}`, "สูตรด้านล่างใช้ unilateral ไม่ใช่ bilateral"},
		{"เลื่อนลำดับไปข้างหน้า", `\mathcal Z_+\{x[n+1]\}=z(X(z)-x[0])`, "ค่าเริ่มต้นเป็นส่วนหนึ่งของสูตร"},
		{"Exponential แบบ causal", `a^nu[n]\leftrightarrow\frac z{z-a},\quad |z|>|a|`, "ROC เป็นส่วนหนึ่งของคำตอบ"}},
		[]string{"ตรวจ unilateral/bilateral และจดค่าเริ่มต้น", "แปลงแต่ละพจน์โดยรักษา shift กับ initial terms", "ย้อนกลับพร้อม ROC แล้วตรวจ recurrence"},
		[]string{"นิยาม unilateral/bilateral ตรงตลอด", "ใส่ค่าเริ่มต้นครบทุก shift", "ระบุ ROC เมื่อต้องใช้และตรวจค่าแรกของลำดับ"}, []string{"ลืม z ที่เศษหรือ x[0] จาก shift", "ไม่มี ROC ทั้งที่ rational expression ให้ลำดับได้หลายแบบ"}, signalSource},
	{9, "Boundary-Value Problems", []string{"BVP", "เงื่อนไขขอบเขต", "boundary", "PDE", "wave", "heat", "eigenvalue"}, []Formula{
		{"แยกตัวแปร", `u(x,t)=X(x)T(t)`, "แทน PDE แล้วใช้ boundary conditions เลือก eigenfunctions"},
		{"Dirichlet บน 0<x<L", `X_n=\sin\frac{n\pi x}{L},\quad\lambda_n=(n\pi/L)^2,\quad n\ge1`, "เฉพาะ X(0)=X(L)=0; เงื่อนไขอื่นให้ eigenfunctions ต่างกัน"},
		{"สมการคลื่น ปลายตรึง", `u_{tt}=c^2u_{xx},\quad\omega_n=cn\pi/L`, "ช่วง [0,L] และ u(0,t)=u(L,t)=0"}},
		[]string{"แยก initial จาก boundary conditions และระบุ PDE", "แก้ spatial eigenvalue problem ตามขอบเขตจริง", "หาสัมประสิทธิ์จาก initial data และตรวจทุกเงื่อนไข"},
		[]string{"แทน PDE ได้และ separation constant สอดคล้องกัน", "ตรง boundary conditions ทุกด้าน", "ตรง initial displacement/velocity หรือ temperature", "ใช้ eigenfunctions ตรงเงื่อนไขขอบเขต"}, []string{"ใช้ sin โดยไม่ตรวจขอบเขต", "สับสน initial displacement กับ initial velocity"}, odeSource},
}
var QuestionHints = map[string][]string{
	"ee201-t01-q001": {"ตรวจ exact: กำหนด M=y²,N=3xy−4y³ แล้วหา M_y,N_x", "คำนวณ (N_x−M_y)/M ว่าเป็นฟังก์ชันของ y อย่างเดียวหรือไม่", "หา integrating factor จาก μ'/μ=(N_x−M_y)/M แล้วคูณทั้งสมการก่อนหาศักย์"},
	"ee201-t01-q002": {"หารสมการด้วย 4 เพื่อจัดเป็น linear ODE", "หา integrating factor จาก p(x)=5/4", "แบ่งอินทิกรัล forcing ที่ 0,π และตรวจการต่อคำตอบ"},
}

func Tags(id int) []string {
	for _, g := range Guides {
		if g.TopicID == id {
			return g.Tags
		}
	}
	return []string{}
}
func SearchSQL() string {
	var b strings.Builder
	b.WriteString("CASE q.topic_id ")
	for _, g := range Guides {
		fmt.Fprintf(&b, "WHEN %d THEN '%s' ", g.TopicID, strings.ReplaceAll(strings.Join(g.Tags, " "), "'", "''"))
	}
	b.WriteString("ELSE '' END")
	return b.String()
}
