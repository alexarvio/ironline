// The muscle map's anatomy plate (2 Nov, Alex: docs/boards/muscle-map-v2.html, "opaque anatomy plates, front and back,
// greys and ink, fibres colour in purple by load"), the board's generator ported as pure functions: no DOM, no colour.
// Drawn for NorCoach (no third-party artwork or path data); proportions follow the classic eight-heads figure (chin at 1,
// nipples 2, navel ~2.8, crotch 4, knee 6), the muscles placed from standard anterior and posterior plates. Each muscle is
// a patch between its two borders; its fibres are interpolated between them, so they run origin to insertion (the
// pectoral heads fan to the humerus). The screen (MuscleMap.tsx) colours each patch by its key; styles `mm-` in draft.css.

/** A point; a third value 1 marks a sharp corner in a smoothed outline (between the fingers). */
type Pt = number[];
/** A cubic: [p0, c1, c2, p3]. */
type Cubic = Pt[];
/** A curve's control points, or a number (a bow), or nothing (straight). */
type Ctl = Pt[] | number | undefined;

type Opts = {
  c0?: Ctl;
  c1?: Ctl;
  ac?: Ctl;
  bc?: Ctl;
  /** tendon, bone or skin: drawn, never counted. */
  t?: "tendon" | "bone" | "skin";
  /** 1 = drawn once, on the centre line. */
  c?: 1;
  /** The share of its length that is tendon at the start / end. */
  ta?: number;
  tb?: number;
  /** Pennate fibres. */
  pen?: 1;
  /** Rides the arm. */
  arm?: 1;
};
type Def = Opts & { n: string; k: string; a: Pt[]; b: Pt[] };

export type AnatomyView = "front" | "back";
export type AnatomyBody = "male" | "female";

/** One drawn part, in drawing order. A muscle carries its load key ("" = drawn, not counted: neck, tibialis, serratus,
 *  tendons, bones) and its anatomical name; skin (the knees) is drawing alone. `inner` is the part's SVG markup. */
export type AnatomyPart = {
  kind: "muscle" | "tendon" | "bone" | "skin";
  key: string;
  name: string;
  /** Its outline, for a line drawn over everything (the muscle picked). */
  d: string;
  inner: string;
};
export type Anatomy = {
  viewBox: string;
  /** The body's outline, base, head, hands and feet: under the muscles. */
  under: string;
  parts: AnatomyPart[];
  /** The navel, the breast line and the hair: over the muscles, never coloured. */
  over: string;
};

/* ---------------- anatomy ----------------
   One figure on a 400 x 900 grid, centre line x = 200; only the viewer's left half is written,
   the right half is its mirror (c: 1 = drawn once, on the centre line).
   A muscle is a patch: a = [s0, s1] its start edge (origin), b = [e0, e1] its end edge (insertion),
   side 0 runs s0 -> e0, side 1 runs s1 -> e1. c0, c1, ac, bc: that curve's two control points,
   or a number (a bow), or nothing (straight). Fibres run start edge -> end edge.
   tb / ta: the share of its length that is tendon at the end / start. pen: pennate fibres.
   t: "tendon" | "bone". k: the load key ("" = drawn, not tracked). arm: rides the arm. */
const H = (n: string, k: string, a: Pt[], b: Pt[], o: Opts = {}): Def => ({ n, k, a, b, ...o });
/* a strip between two border curves, each [p0, c1, c2, p3] drawn origin to insertion; neighbours share a curve */
const S = (n: string, k: string, L: Cubic, R: Cubic, o: Opts = {}): Def => H(n, k, [L[0], R[0]], [L[3], R[3]], { c0: [L[1], L[2]], c1: [R[1], R[2]], ...o });
const lp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function part(Q: Cubic, t0: number, t1: number): Cubic {
  const sub = (Q: Cubic, t: number): [Cubic, Cubic] => {
    const a = lp(Q[0], Q[1], t), b = lp(Q[1], Q[2], t), c = lp(Q[2], Q[3], t), d = lp(a, b, t), e = lp(b, c, t), f = lp(d, e, t);
    return [[Q[0], a, d, f], [f, e, c, Q[3]]];
  };
  let R = t1 < 1 ? sub(Q, t1)[0] : Q;
  if (t0 > 0) R = sub(R, t0 / t1)[1];
  return R;
}

const HEAD: Pt[] = [[200,20],[184,22],[172,30],[165,44],[162,62],[163,82],[166,98],[171,110],[179,120],[189,127],[200,129]];
const EAR: Pt[] = [[163,70],[158,69],[155,76],[156,88],[159,97],[164,100]];
const HULL: Pt[] = [[200,108],[180,110],[176,124],[175,140],[166,152],[146,160],[126,167],[114,172],
  [126,200],[133,228],[135,255],[139,285],[140,310],[138,335],[133,358],[127,385],[122,415],[121,445],
  [120,480],[122,520],[126,565],[132,610],[139,645],[141,668],[141,690],[137,715],[136,742],[140,775],[147,808],[152,832],
  [179,834],[184,812],[191,778],[195,742],[194,712],[189,690],[189,668],[193,640],[196,600],[198,540],[199.5,480],[200,458]];
const ARM: Pt[] = [[122,172],[111,177],[102,184],[96,195],[93,212],[93,232],[96,252],[95,276],[94,300],[95,322],[93,338],[87,358],[85,386],[87,414],[90,440],[92,448],
  [110,447],[115,424],[121,396],[127,366],[130,340],[131,316],[132,286],[133,256],[133,232],[130,214]];
/* the hand hangs palm forward; a third 1 = a sharp corner (between the fingers) */
const HAND: Pt[] = [[90,446],[110,446],[114,455],[117,468],[118,484],[118,500],[117,514],[116,523],[113,529],[110.5,527],[109.5,522,1],[109,532],[106,537],[103,535],
  [102.5,529,1],[102,538],[99,542],[96,540],[95.5,531,1],[94.5,537],[91.5,538],[88.5,534],[87.5,524],[87,508],[87.5,492],[88,476],[88,460]];
const THUMB: Pt[] = [[89,452],[85,458],[81,467],[78,478],[76,489],[76,497],[78,501],[81,500],[83,494],[85,485],[87,476],[89,468]];
const HAND_LINES: Pt[][] = [[[109.5,522],[110,504]], [[102.5,529],[103,503]], [[95.5,531],[95.5,505]]];
const FOOT_F: Pt[] = [[152,818],[149,836],[146,848],[143,860],[142,868],[144,875],[149,878.5],[154,879.5],[159,881],[164,881.5],[170,882],[176,882.5],[182,882.5],[187,880],[190,875],[190,866],[188,856],[185,846],[182,836],[180,818]];
/* the tendons over the top of the foot */
const FOOT_LINES: Pt[][] = [[[165,830],[176,852],[182,872]], [[159,831],[163,852],[166,874]], [[155,832],[155,852],[155,873]]];
const FOOT_B: Pt[] = [[156,824],[153,846],[153,862],[158,875],[168,881],[178,880],[185,872],[187,858],[184,840],[182,824]];
const TOES: Pt[][] = [[[152,873],[153,879]], [[158,874.5],[158.5,881]], [[164,875],[164.5,881.5]], [[171,875],[171.5,882]], [[178,875],[178.5,882.5]]];

/* shared borders, front thigh and leg (left leg, lateral to medial) */
const K0: Pt[] = [[122,415],[117,500],[123,590],[139,645]];
const K1: Pt[] = [[126,417],[121,500],[127,590],[142,645]];
const K2: Pt[] = [[148,392],[146,470],[150,570],[157,634]];
const K3: Pt[] = [[160,388],[174,450],[175,560],[170,634]];
const B0: Pt[] = [[141,688],[135,725],[139,790],[150,830]];
const B1: Pt[] = [[146,690],[141,730],[145,790],[154,830]];
const B2: Pt[] = [[151,694],[147,730],[151,790],[158,830]];
const B3: Pt[] = [[165,698],[167,740],[166,790],[165,830]];
const B4: Pt[] = [[176,696],[178,740],[176,790],[173,832]];
const B5: Pt[] = [[189,690],[199,722],[195,782],[179,833]];
/* forearm, front (lateral to medial) */
const G0: Pt[] = [[96,300],[85,350],[84,395],[91,440]];
const G1: Pt[] = [[102,298],[107,345],[100,398],[95,438]];
const G2: Pt[] = [[119,336],[112,376],[105,410],[102,442]];
const G3: Pt[] = [[124,337],[117,378],[109,412],[106,443]];
const G5: Pt[] = [[130,336],[128,372],[120,410],[110,446]];
/* forearm, back */
const F0: Pt[] = [[96,300],[85,350],[84,395],[91,440]];
const F1: Pt[] = [[101,300],[95,352],[93,400],[95,438]];
const F2: Pt[] = [[106,330],[103,370],[100,405],[99,440]];
const F3: Pt[] = [[114,342],[111,380],[106,415],[104,442]];
const F4: Pt[] = [[121,346],[118,385],[112,420],[108,444]];
const F5: Pt[] = [[130,338],[128,372],[120,410],[110,446]];
/* back thigh */
const BK2: Pt[] = [[134,450],[131,530],[136,600],[146,642]];
const BK3: Pt[] = [[160,456],[166,530],[160,600],[152,650]];

const FRONT: Def[] = [
  /* neck */
  H("Sternocleidomastoid", "", [[163,104],[170,103]], [[182,161],[195,160]], {c0:[[165,126],[173,150]], c1:[[177,121],[190,146]]}),
  H("Trapezius, upper", "traps_upper", [[170,113],[176,112]], [[152,163],[118,173]], {c0:[[168,134],[162,152]], c1:[[176,140],[148,155]]}),
  /* trunk, deep to superficial */
  H("Linea alba", "", [[198,234],[202,234]], [[198.8,440],[201.2,440]], {t:"tendon", c:1}),
  H("Abdominal aponeurosis", "", [[174,262],[146,352]], [[191,440],[190,441]], {t:"tendon", ac:[[173,300],[166,338]], c0:[[173,330],[184,412]], c1:[[164,384],[178,416]]}),
  H("Rectus abdominis", "abs_upper", [[174,241],[198,237]], [[173,264],[198,264]], {c0:1.5, ac:-1.5, bc:1.2}),
  H("Rectus abdominis", "abs_upper", [[173,268],[198,268]], [[172,293],[198,293]], {c0:1.5, ac:-1.2, bc:1.2}),
  H("Rectus abdominis", "abs_lower", [[172,297],[198,297]], [[173,320],[198,320]], {c0:1.5, ac:-1.2, bc:1.2}),
  H("Rectus abdominis", "abs_lower", [[173,324],[198,324]], [[191,438],[198,438]], {c0:[[172,370],[183,414]], ac:-1.2}),
  H("Serratus anterior", "", [[141,244],[141,256]], [[157,253],[156,256]], {c0:-1.5, c1:1.5}),
  H("Serratus anterior", "", [[141,258],[141,270]], [[157,267],[155,270]], {c0:-1.5, c1:1.5}),
  H("Serratus anterior", "", [[141,272],[141,284]], [[156,281],[154,284]], {c0:-1.5, c1:1.5}),
  H("Serratus anterior", "", [[142,286],[143,298]], [[154,295],[152,298]], {c0:-1.5, c1:1.5}),
  H("External oblique", "obliques", [[156,254],[146,328]], [[174,264],[150,352]], {ac:[[150,278],[146,304]], bc:[[173,300],[169,338]], c0:2}),
  S("Latissimus dorsi", "lats", [[131,234],[133,262],[137,295],[140,320]], [[138,232],[142,260],[145,292],[147,318]]),
  H("Pectoralis major, clavicular head", "chest_upper", [[198,184],[153,168]], [[129,224],[127,213]], {ac:[[198,173],[176,167]], c0:[[178,190],[150,208]], c1:[[145,182],[134,200]]}),
  H("Pectoralis major, sternal head", "chest_mid", [[198,184],[198,230]], [[129,224],[131,235]], {c0:[[178,190],[150,208]], c1:[[178,240],[150,240]]}),
  H("Pectoralis major, abdominal head", "chest_lower", [[198,230],[195,244]], [[131,235],[133,240]], {c0:[[178,240],[150,240]], c1:[[174,258],[148,254]]}),
  /* arm, deep first */
  H("Coracobrachialis", "", [[127,212],[133,222]], [[126,262],[129,266]], {arm:1}),
  H("Triceps, medial head", "triceps", [[128,232],[133,236]], [[124,318],[130,321]], {arm:1, c0:[[127,262],[126,292]], c1:[[134,265],[133,295]]}),
  H("Brachialis", "biceps", [[96,262],[101,258]], [[106,330],[111,330]], {arm:1, c0:[[94,285],[96,312]], c1:[[102,285],[105,312]]}),
  H("Biceps brachii, long head", "biceps", [[110,246],[118,240]], [[114,322],[117,322]], {arm:1, c0:[[100,268],[102,302]], c1:[[117,268],[117,300]], tb:.1}),
  H("Biceps brachii, short head", "biceps", [[118,240],[127,236]], [[117,322],[120,322]], {arm:1, c0:[[117,268],[117,300]], c1:[[129,265],[127,300]], tb:.1}),
  H("Biceps tendon", "", [[114,320],[120,320]], [[115,338],[119,338]], {arm:1, t:"tendon"}),
  H("Flexor digitorum superficialis", "forearms", [[96,318],[130,334]], [[92,436],[110,443]], {arm:1, c0:[[86,360],[86,405]], c1:[[129,372],[118,412]], tb:.3}),
  S("Flexor carpi ulnaris", "forearms", G3, G5, {arm:1, tb:.3}),
  S("Palmaris longus", "forearms", G2, G3, {arm:1, tb:.45}),
  S("Flexor carpi radialis", "forearms", [[112,334],[104,372],[100,406],[98,440]], G2, {arm:1, tb:.35}),
  H("Pronator teres", "forearms", [[117,330],[128,336]], [[101,368],[100,380]], {arm:1, c0:1.5, c1:-1.5}),
  S("Brachioradialis", "forearms", G0, G1, {arm:1, tb:.3}),
  /* shoulder */
  H("Deltoid, anterior", "delt_front", [[153,168],[120,172]], [[113,258],[109,259]], {arm:1, ac:[[142,166],[130,168]], c0:[[140,190],[121,232]], c1:[[115,200],[110,235]]}),
  H("Deltoid, lateral", "delt_side", [[120,172],[108,177]], [[109,259],[104,257]], {arm:1, c0:[[115,200],[110,235]], c1:[[90,195],[90,236]], pen:1}),
  H("Clavicle", "", [[197,158.5],[197,161]], [[122,169.5],[122,172]], {t:"bone", c0:[[176,163.5],[146,158.5]], c1:[[176,166],[146,161]]}),
  /* hip and thigh, deep first */
  H("Iliopsoas", "", [[157,358],[180,414]], [[166,452],[171,458]], {ac:[[165,380],[172,400]], c0:[[158,400],[162,430]], c1:[[178,430],[174,446]]}),
  H("Pectineus", "adductors", [[180,414],[190,438]], [[171,458],[178,470]], {ac:[[184,424],[187,432]]}),
  H("Adductor magnus", "adductors", [[184,470],[198,468]], [[184,560],[196,560]]),
  H("Adductor longus", "adductors", [[190,440],[196,448]], [[176,516],[183,522]], {c0:[[184,468],[179,494]], c1:[[195,478],[189,504]]}),
  H("Gracilis", "adductors", [[196,450],[199.5,458]], [[193,566],[198,560]], {c0:[[193,490],[193,530]], c1:[[199.5,490],[199,525]]}),
  H("Vastus medialis", "quads", [[179,512],[186,658]], [[171,540],[176,652]], {ac:[[188,560],[192,620]], bc:[[174,580],[172,620]]}),
  S("Vastus lateralis", "quads", K1, K2),
  S("Rectus femoris", "quads", K2, K3, {pen:1, tb:.07}),
  H("Gluteus medius", "glute_med", [[133,352],[139,354]], [[123,404],[128,408]], {c0:[[128,368],[124,388]], c1:[[134,372],[129,392]]}),
  H("Tensor fasciae latae", "", [[138,354],[148,353]], [[127,418],[135,421]], {c0:[[134,372],[130,398]], c1:[[148,380],[141,404]]}),
  S("Iliotibial band", "", K0, K1, {t:"tendon"}),
  S("Sartorius", "", [[148,356],[160,440],[205,560],[184,672]], [[157,352],[169,436],[214,556],[192,672]]),
  /* knee and leg */
  H("Knee", "", [[143,646],[155,652]], [[143,690],[156,694]], {t:"skin", c0:-2}),
  H("Knee", "", [[172,654],[186,662]], [[168,694],[188,690]], {t:"skin", c1:2}),
  H("Patella", "", [[155,640],[171,640]], [[157,682],[168,682]], {t:"bone", c0:4, c1:-4, ac:-3, bc:3}),
  H("Patellar ligament", "", [[159,680],[167,680]], [[160,704],[166,704]], {t:"tendon"}),
  S("Peroneus longus", "", B0, B1, {tb:.3}),
  S("Extensor digitorum longus", "", B1, B2, {tb:.3}),
  S("Tibialis anterior", "", B2, B3, {tb:.3}),
  S("Tibia", "", B3, B4, {t:"bone"}),
  S("Soleus", "calves", part(B4,.55,1), part(B5,.55,1), {tb:.3}),
  S("Gastrocnemius, medial head", "calves", part(B4,0,.72), part(B5,0,.72), {bc:2})
];

/* the female hair, front and back (a bun at the crown) */
const HAIR_F: Pt[] = [[200,14],[183,16],[169,25],[161,41],[158,58],[160,70],[163,71],[165,58],[171,46],[184,40],[200,39]];
const HAIR_B: Pt[] = [[200,13],[182,15],[167,25],[159,44],[157,64],[159,86],[165,100],[177,108],[190,111],[200,112]];
const BREAST: Pt[] = [[197,238],[188,252],[174,262],[159,259],[147,250],[141,240]];

const BACK: Def[] = [
  /* deep first */
  H("Thoracolumbar fascia", "", [[200,232],[200,382]], [[190,262],[150,346]], {t:"tendon", bc:[[186,300],[170,330]], c1:[[180,374],[160,352]]}),
  H("Erector spinae", "lower_back", [[186,262],[198,258]], [[190,384],[198,392]], {c0:[[180,300],[180,350]]}),
  H("Rhomboid major", "mid_back", [[200,170],[200,244]], [[158,204],[150,264]], {bc:[[156,224],[153,244]]}),
  H("Infraspinatus", "mid_back", [[159,203],[154,252]], [[124,190],[125,202]], {c0:[[148,198],[134,192]], c1:[[146,236],[134,214]]}),
  H("Teres minor", "mid_back", [[152,248],[147,256]], [[125,202],[126,210]], {c0:[[146,236],[134,214]], c1:[[140,240],[131,220]]}),
  H("Teres major", "lats", [[150,256],[152,268]], [[127,212],[131,230]], {c0:[[140,240],[131,220]], c1:[[144,256],[136,240]]}),
  H("External oblique", "obliques", [[139,296],[143,296]], [[146,346],[151,344]], {c0:[[140,315],[141,332]]}),
  H("Latissimus dorsi", "lats", [[190,256],[152,342]], [[130,232],[134,242]], {ac:[[186,296],[170,330]], c0:[[168,258],[146,258]], c1:[[144,305],[137,270]]}),
  H("Trapezius, lower", "mid_back", [[200,206],[200,300]], [[156,194],[161,201]], {c0:[[186,204],[168,198]], c1:[[188,265],[170,226]]}),
  H("Trapezius, middle", "mid_back", [[200,162],[200,206]], [[120,174],[156,194]], {c0:[[176,160],[148,166]], c1:[[186,204],[168,198]], bc:[[132,182],[146,190]]}),
  H("Trapezius, upper", "traps_upper", [[200,96],[200,162]], [[181,104],[120,174]], {c1:[[176,160],[148,166]], bc:[[176,140],[150,158]]}),
  H("Trapezius aponeurosis", "", [[200,152],[200,152]], [[200,190],[200,190]], {t:"tendon", c:1, c0:[[195,164],[195,178]], c1:[[205,164],[205,178]]}),
  H("Spine of scapula", "", [[158,195.5],[159,198.5]], [[121,177.5],[121,180.5]], {t:"bone", c0:[[146,191],[132,183.5]], c1:[[146,194],[132,186.5]]}),
  /* shoulder */
  H("Deltoid, posterior", "delt_rear", [[142,196],[120,180]], [[112,256],[108,258]], {arm:1, ac:[[134,191],[127,185]], c0:[[131,220],[117,244]], c1:[[113,205],[109,235]]}),
  H("Deltoid, lateral", "delt_side", [[120,180],[108,178]], [[108,258],[104,257]], {arm:1, c0:[[113,205],[109,235]], c1:[[90,195],[90,236]], pen:1}),
  /* arm */
  H("Forearm extensors", "forearms", [[96,318],[130,336]], [[92,436],[110,443]], {arm:1, c0:[[86,360],[86,405]], c1:[[129,372],[118,412]], tb:.3}),
  H("Triceps, lateral head", "triceps", [[102,256],[118,244]], [[106,304],[116,300]], {arm:1, c0:[[94,272],[96,292]], c1:[[120,262],[118,285]]}),
  H("Triceps, long head", "triceps", [[122,226],[133,230]], [[118,300],[127,304]], {arm:1, c0:[[120,256],[118,282]], c1:[[136,262],[132,288]]}),
  H("Triceps tendon", "", [[108,302],[125,304]], [[114,334],[121,334]], {arm:1, t:"tendon", ac:[[112,296],[120,297]], c0:[[107,314],[110,326]], c1:[[126,316],[124,328]]}),
  S("Brachioradialis", "forearms", F0, F1, {arm:1, tb:.25}),
  S("Extensor carpi radialis", "forearms", F1, F2, {arm:1, tb:.35}),
  S("Extensor digitorum", "forearms", F2, F3, {arm:1, tb:.3}),
  S("Extensor carpi ulnaris", "forearms", F3, F4, {arm:1, tb:.25}),
  S("Flexor carpi ulnaris", "forearms", F4, F5, {arm:1, tb:.25}),
  H("Anconeus", "forearms", [[108,334],[116,340]], [[110,358],[115,360]], {arm:1}),
  H("Olecranon", "", [[115.5,336],[121.5,336]], [[116.5,345],[120.5,345]], {arm:1, t:"bone", c0:1.5, c1:-1.5, bc:1.5}),
  H("Abductor pollicis longus", "forearms", [[100,392],[101,401]], [[91,424],[93,430]], {arm:1, tb:.3}),
  /* leg */
  S("Soleus", "calves", [[139,716],[134,765],[146,805],[159,830]], [[195,724],[197,775],[188,810],[177,832]], {tb:.25}),
  H("Calcaneal tendon", "", [[150,768],[188,784]], [[166,852],[175,852]], {t:"tendon", c0:[[157,800],[164,832]], c1:[[182,815],[176,836]]}),
  S("Gastrocnemius, lateral head", "calves", [[146,650],[129,690],[133,748],[161,778]], [[168,648],[171,690],[170,742],[167,777]], {ac:-3}),
  S("Gastrocnemius, medial head", "calves", [[169,648],[172,690],[172,752],[170,797]], [[187,652],[201,700],[198,768],[173,800]], {ac:-3}),
  /* hip and thigh */
  H("Gluteus medius", "glute_med", [[132,354],[176,352]], [[126,404],[134,412]], {ac:[[142,340],[162,338]], c0:[[127,370],[125,390]], c1:[[160,380],[140,400]]}),
  S("Iliotibial band", "", K0, K1, {t:"tendon"}),
  S("Vastus lateralis", "quads", part(K1,.15,1), BK2),
  S("Adductor magnus", "adductors", [[176,460],[181,500],[186,530],[188,560]], [[199.5,456],[199.5,490],[199,525],[197,560]]),
  S("Gracilis", "adductors", [[193,466],[194,520],[193,590],[189,642]], [[199.5,460],[199.5,520],[198,590],[193,642]], {tb:.2}),
  S("Semimembranosus", "hamstrings", [[166,500],[156,570],[152,620],[156,650]], [[184,490],[198,570],[195,625],[188,654]], {tb:.15}),
  S("Biceps femoris", "hamstrings", BK2, BK3, {tb:.12}),
  S("Semitendinosus", "hamstrings", [[160,456],[168,530],[174,590],[178,642]], [[177,460],[187,520],[189,580],[184,644]], {tb:.3}),
  H("Gluteus maximus", "glutes", [[180,362],[199,448]], [[130,401],[144,476]], {ac:[[191,374],[199,412]], bc:[[125,424],[132,457]], c0:[[164,365],[144,378]], c1:[[183,462],[163,472]]}),
];

/* ---------------- geometry ---------------- */
const CX = 200;
const n1 = (v: number) => Math.round(v * 10) / 10;
const lerp = lp;
function bz(P: Cubic, t: number): Pt {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
}
function ctr(p: Pt, q: Pt, c: Ctl): Pt[] {
  if (Array.isArray(c)) return c;
  const bow = c || 0, dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * bow, ny = (dx / L) * bow;
  return [[p[0] + dx / 3 + nx, p[1] + dy / 3 + ny], [p[0] + (2 * dx) / 3 + nx, p[1] + (2 * dy) / 3 + ny]];
}
/** The part of a cubic between t0 and t1. */
function split(P: Cubic, t0: number, t1: number): Cubic {
  const sub = (Q: Cubic, t: number): [Cubic, Cubic] => {
    const a = lerp(Q[0], Q[1], t), b = lerp(Q[1], Q[2], t), c = lerp(Q[2], Q[3], t), d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
    return [[Q[0], a, d, f], [f, e, c, Q[3]]];
  };
  let R = sub(P, t1)[0];
  if (t0 > 0) R = sub(R, t0 / t1)[1];
  return R;
}

/* the female body: narrower shoulders and waist, wider hips; the arms ride with the shoulders */
const FW = [[0, 0.95], [128, 0.95], [150, 0.9], [175, 0.88], [235, 0.89], [285, 0.87], [312, 0.86], [340, 0.95], [380, 1.04], [425, 1.08], [470, 1.06], [540, 1.02], [660, 0.97], [900, 0.96]];
const ARMX = [[175, 114], [330, 112], [445, 100], [560, 99]];
const tab = (T: number[][], y: number) => {
  if (y <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++)
    if (y <= T[i][0]) {
      const a = T[i - 1], b = T[i];
      return a[1] + ((y - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    }
  return T[T.length - 1][1];
};
const PIV = [116, 185], ROT = (2.5 * Math.PI) / 180;
function warp(p: Pt, arm: 1 | 0 | undefined, g: AnatomyBody): Pt {
  let [x, y] = p;
  if (arm) {
    const dx = x - PIV[0], dy = y - PIV[1];
    if (dy > 0) {
      x = PIV[0] + dx * Math.cos(ROT) - dy * Math.sin(ROT);
      y = PIV[1] + dx * Math.sin(ROT) + dy * Math.cos(ROT);
    }
  }
  if (g !== "female") return [x, y, p[2]];
  if (!arm) return [CX + (x - CX) * tab(FW, y), y, p[2]];
  const ax = tab(ARMX, y), thin = Math.max(0, Math.min(1, (y - 175) / 55));
  x = ax + (x - ax) * (1 - 0.14 * thin);
  x += 10.5 - (Math.max(0, y - 190) / 250) * 13;
  return [x, y, p[2]];
}

const mir = (p: Pt): Pt => [2 * CX - p[0], p[1], p[2]];
function smooth(pts: Pt[], closed = true) {
  const n = pts.length, P = (i: number) => pts[(i + n) % n];
  let d = `M${n1(pts[0][0])},${n1(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = closed ? P(i - 1) : pts[Math.max(i - 1, 0)], p1 = P(i), p2 = P(i + 1), p3 = closed ? P(i + 2) : pts[Math.min(i + 2, n - 1)];
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n1(c1[0])},${n1(c1[1])} ${n1(c2[0])},${n1(c2[1])} ${n1(p2[0])},${n1(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}
const halfToFull = (h: Pt[]) => h.concat(h.slice(1, -1).reverse().map(mir));
const C = (P: Cubic) => `C${n1(P[1][0])},${n1(P[1][1])} ${n1(P[2][0])},${n1(P[2][1])} ${n1(P[3][0])},${n1(P[3][1])}`;
const M = (p: Pt) => `M${n1(p[0])},${n1(p[1])}`;
const rev = (P: Cubic): Cubic => [P[3], P[2], P[1], P[0]];

type Patch = { A: Cubic; B: Cubic; L: Cubic; R: Cubic };
/** One patch, on one side, in one body: its curves. */
function patch(m: Def, flip: boolean, g: AnatomyBody): Patch {
  const W = (p: Pt) => {
    const q = warp(p, m.arm, g);
    return flip ? mir(q) : q;
  };
  const [s0, s1] = m.a, [e0, e1] = m.b;
  const A = [s0, ...ctr(s0, s1, m.ac), s1].map(W), B = [e0, ...ctr(e0, e1, m.bc), e1].map(W);
  const L = [s0, ...ctr(s0, e0, m.c0), e0].map(W), R = [s1, ...ctr(s1, e1, m.c1), e1].map(W);
  return { A, B, L, R };
}
/** Coons-like blend: the fibre at s, as a cubic. */
function fibre(P: Patch, s: number): Cubic {
  const S0 = bz(P.A, s), E = bz(P.B, s);
  const mid = (k: number, t: number): Pt => {
    const l = P.L[k], r = P.R[k], ab = lerp(bz(P.A, s), bz(P.B, s), t), side = lerp(l, r, s), lin = lerp(lerp(P.L[0], P.R[0], s), lerp(P.L[3], P.R[3], s), t);
    return [side[0] + ab[0] - lin[0], side[1] + ab[1] - lin[1]];
  };
  return [S0, mid(1, 1 / 3), mid(2, 2 / 3), E];
}
const outline = (P: Patch) => M(P.L[0]) + C(P.L) + C(P.B) + C(rev(P.R)) + C(rev(P.A)) + "Z";
const len = (P: Cubic) => {
  let l = 0, q = P[0];
  for (let i = 1; i <= 8; i++) {
    const r = bz(P, i / 8);
    l += Math.hypot(r[0] - q[0], r[1] - q[1]);
    q = r;
  }
  return l;
};
/** The region s0..s1, t0..t1 of a patch as a polygon. */
function sampled(P: Patch, s0: number, s1: number, t0: number, t1: number) {
  const pts: Pt[] = [], N = 10;
  for (let i = 0; i <= N; i++) pts.push(bz(fibre(P, s0), t0 + ((t1 - t0) * i) / N));
  for (let i = 0; i <= N; i++) pts.push(bz(fibre(P, s0 + ((s1 - s0) * i) / N), t1));
  for (let i = N; i >= 0; i--) pts.push(bz(fibre(P, s1), t0 + ((t1 - t0) * i) / N));
  for (let i = N; i >= 0; i--) pts.push(bz(fibre(P, s0 + ((s1 - s0) * i) / N), t0));
  return "M" + pts.map((p) => `${n1(p[0])},${n1(p[1])}`).join("L") + "Z";
}

function drawMuscle(m: Def, flip: boolean, g: AnatomyBody, id: string): AnatomyPart {
  const P = patch(m, flip, g), d = outline(P);
  if (m.t === "skin") return { kind: "skin", key: "", name: m.n, d, inner: `<path class="mm-skin" d="${d}"/>` };
  const w = Math.max(len(P.A), len(P.B), Math.hypot(...[0, 1].map((i) => bz(P.L, 0.5)[i] - bz(P.R, 0.5)[i])));
  const tendon = m.t === "tendon", gap = tendon ? 3.4 : 2.3, n = Math.max(2, Math.round(w / gap));
  const t0 = m.ta || 0, t1 = 1 - (m.tb || 0);
  let fb = "", tf = "", td = "";
  if (m.t !== "bone") {
    if (m.pen) {
      const spine = fibre(P, 0.5), Ln = len(spine), steps = Math.max(6, Math.round(Ln / 2.6));
      for (let i = 0; i < steps; i++) {
        const t = t0 + ((t1 - t0) * (i + 0.3)) / steps, c = bz(spine, t), dt = 0.07;
        const a = bz(fibre(P, 0.02), Math.min(t1, t + dt)), b = bz(fibre(P, 0.98), Math.min(t1, t + dt));
        fb += `${M(c)}L${n1(a[0])},${n1(a[1])}${M(c)}L${n1(b[0])},${n1(b[1])}`;
      }
      fb += M(bz(spine, t0)) + C(split(spine, t0 || 1e-6, t1));
    } else {
      const wA = len(P.A), wB = len(P.B), MIN = 0.8;
      const tz = (i: number) => {
        let l = 0;
        while (i > 0 && i % 2 === 0 && l < 6) {
          i /= 2;
          l++;
        }
        return l;
      };
      for (let i = 0; i < n; i++) {
        const stride = 2 ** tz(i + 1), reach = (MIN * n) / stride;
        let a = t0, b = t1;
        if (wB < wA && reach > wB) b = Math.min(t1, Math.max(t0 + 0.05, (reach - wA) / (wB - wA)));
        if (wA < wB && reach > wA) a = Math.max(t0, Math.min(t1 - 0.05, 1 - (reach - wB) / (wA - wB)));
        const F = split(fibre(P, (i + 0.5) / n), a || 1e-6, b);
        fb += M(F[0]) + C(F);
      }
    }
    if (t1 < 1) {
      td += sampled(P, 0, 1, t1, 1);
      const k = Math.max(2, Math.round(n / 2));
      for (let i = 0; i < k; i++) {
        const F = split(fibre(P, (i + 0.5) / k), t1, 1);
        tf += M(F[0]) + C(F);
      }
    }
    if (t0 > 0) td += sampled(P, 0, 1, 0, t0);
  }
  const inner =
    `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
    `<path class="mm-mf" d="${d}"/>` +
    `<g clip-path="url(#${id})"><path class="mm-fb" d="${fb}"/>${td ? `<path class="mm-td" d="${td}"/><path class="mm-tf" d="${tf}"/>` : ""}<path class="mm-sh" d="${d}"/></g>` +
    `<path class="mm-ol" d="${d}"/>`;
  return { kind: m.t === "tendon" ? "tendon" : m.t === "bone" ? "bone" : "muscle", key: m.t ? "" : m.k || "", name: m.n, d, inner };
}

function hullPaths(g: AnatomyBody, view: AnatomyView) {
  const W = (pts: Pt[], arm: 0 | 1) => pts.map((p) => warp(p, arm, g));
  const body = smooth(halfToFull(W(HULL, 0)));
  const head = smooth(halfToFull(W(HEAD, 0)));
  const armL = smooth(W(ARM, 1)), armR = smooth(W(ARM, 1).map(mir));
  const hand = smooth(W(HAND, 1)), handR = smooth(W(HAND, 1).map(mir));
  const foot = view === "front" ? FOOT_F : FOOT_B;
  const footL = smooth(W(foot, 0)), footR = smooth(W(foot, 0).map(mir));
  const ear = smooth(W(EAR, 0)), earR = smooth(W(EAR, 0).map(mir));
  const thumb = smooth(W(THUMB, 1)), thumbR = smooth(W(THUMB, 1).map(mir));
  const line = (pts: Pt[], arm: 0 | 1, f: boolean) => {
    const q = W(pts, arm).map((p) => (f ? mir(p) : p));
    return M(q[0]) + q.slice(1).map((p) => `L${n1(p[0])},${n1(p[1])}`).join("");
  };
  const fingers = HAND_LINES.map((l) => line(l, 1, false) + line(l, 1, true)).join("");
  const toes = view === "front" ? TOES.concat(FOOT_LINES).map((l) => line(l, 0, false) + line(l, 0, true)).join("") : "";
  return { body, head, armL, armR, hand, handR, footL, footR, ear, earR, thumb, thumbR, fingers, toes };
}

/** The face, the hair and the breast line: grey drawing, never coloured. */
function face(view: AnatomyView, g: AnatomyBody) {
  const W = (p: Pt) => warp(p, 0, g), both = (f: (fl: boolean) => string) => f(false) + f(true);
  const pt = (p: Pt, fl: boolean) => {
    const q = W(p);
    return `${n1(fl ? 2 * CX - q[0] : q[0])},${n1(q[1])}`;
  };
  /* points: start, then control and end in pairs */
  const Q = (pts: Pt[], fl: boolean) => `M${pt(pts[0], fl)}` + pts.slice(1).reduce((a, p, i, r) => (i % 2 ? a : a + `Q${pt(p, fl)} ${pt(r[i + 1], fl)}`), "");
  let s = "";
  if (view === "front") {
    const nv = W([200, 318]);
    s += `<ellipse class="mm-skin" cx="200" cy="${n1(nv[1])}" rx="2.2" ry="3"/>`;
    if (g === "female") s += both((fl) => `<path class="mm-det mm-soft" d="${smooth(BREAST.map((p) => (fl ? mir(W(p)) : W(p))), false)}"/>`);
  }
  if (g === "female") {
    s += `<path class="mm-hair" d="${smooth(halfToFull((view === "front" ? HAIR_F : HAIR_B).map(W)))}"/>`;
    s +=
      view === "front"
        ? both((fl) => `<path class="mm-det mm-soft" d="${Q([[200, 17], [177, 22], [165, 50]], fl)}"/>`)
        : both((fl) => `<path class="mm-det mm-soft" d="${Q([[200, 17], [176, 32], [170, 66], [176, 98], [190, 108]], fl)}"/>`);
  }
  return s;
}

function build(view: AnatomyView, g: AnatomyBody): Anatomy {
  const Hp = hullPaths(g, view), list = view === "front" ? FRONT : BACK;
  const all = [Hp.body, Hp.armL, Hp.armR, Hp.head, Hp.hand, Hp.handR, Hp.thumb, Hp.thumbR, Hp.footL, Hp.footR, Hp.ear, Hp.earR];
  /* the outline of the whole body, once, then the base */
  let under = `<g class="mm-uo">${all.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  under += `<g class="mm-ub">${all.map((d) => `<path d="${d}"/>`).join("")}</g>`;
  /* ears, head, hands, feet */
  if (g === "female") {
    const b = warp([200, 22], 0, g);
    under += `<ellipse class="mm-hair" cx="200" cy="${n1(b[1])}" rx="15" ry="11"/>`;
  }
  under += `<path class="mm-skin" d="${Hp.ear}"/><path class="mm-skin" d="${Hp.earR}"/><path class="mm-skin" d="${Hp.head}"/>`;
  under += `<path class="mm-skin" d="${Hp.hand}"/><path class="mm-skin" d="${Hp.handR}"/><path class="mm-skin" d="${Hp.thumb}"/><path class="mm-skin" d="${Hp.thumbR}"/><path class="mm-det" d="${Hp.fingers}"/>`;
  under += `<path class="mm-skin" d="${Hp.footL}"/><path class="mm-skin" d="${Hp.footR}"/>`;
  if (Hp.toes) under += `<path class="mm-det" d="${Hp.toes}"/>`;
  const parts: AnatomyPart[] = [];
  const tag = `mm${view[0]}${g[0]}`;
  for (const m of list) {
    parts.push(drawMuscle(m, false, g, `${tag}${parts.length}`));
    if (!m.c) parts.push(drawMuscle(m, true, g, `${tag}${parts.length}`));
  }
  return { viewBox: "56 14 288 872", under, parts, over: face(view, g) };
}

const made = new Map<string, Anatomy>();
/** The plate for one view and body, made once and kept. */
export function anatomy(view: AnatomyView, body: AnatomyBody): Anatomy {
  const k = `${view}-${body}`;
  let a = made.get(k);
  if (!a) {
    a = build(view, body);
    made.set(k, a);
  }
  return a;
}
