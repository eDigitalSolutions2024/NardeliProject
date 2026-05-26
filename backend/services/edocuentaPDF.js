const PDFDocument=require('pdfkit');
const path=require('path');
const fs=require('fs');

const Reserva=require('../models/Reservas');
const Receipt=require('../models/Receipt');


const COLORS={
primary:'#7c3aed',
primaryDark:'#5b21b6',
card:'#fff',
border:'#e2e8f0',
text:'#1e293b',
muted:'#64748b'
};

function money(v){
return Number(v||0).toLocaleString(
'es-MX',
{
style:'currency',
currency:'MXN'
});
}

function date(v){

if(!v)
return '—';

return new Intl.DateTimeFormat(
'es-MX',
{
timeZone:'America/Ciudad_Juarez',
day:'2-digit',
month:'short',
year:'numeric',
hour:'2-digit',
minute:'2-digit',
hour12:true
}
)
.format(
new Date(v)
);

}

function card(doc,x,y,w,h){

doc
.roundedRect(
x+2,
y+2,
w,
h,
10
)
.fill('#00000010');

doc
.roundedRect(
x,
y,
w,
h,
10
)
.fillAndStroke(
COLORS.card,
COLORS.border
);

}

function title(doc,text,y){

doc
.fillColor(
COLORS.primary
)
.font(
'Helvetica-Bold'
)
.fontSize(
18
)
.text(
text,
45,
y
);

doc
.moveTo(
45,
y+24
)
.lineTo(
220,
y+24
)
.strokeColor(
COLORS.primary
)
.lineWidth(2)
.stroke();

}

function resolveLogo(){

const files=[

path.join(
__dirname,
'..',
'uploads',
'logos',
'nardeli_logo.png'
),

path.join(
__dirname,
'..',
'uploads',
'N12.png'
),

path.join(
__dirname,
'..',
'uploads',
'logo.png'
)

];

return files.find(
f=>fs.existsSync(f)
);

}

async function streamEstadoCuentaPdf(
res,
reservaId
){

const reserva=
await Reserva.findById(
reservaId
);

if(!reserva){

return res
.status(404)
.send(
'Reserva no encontrada'
);

}

const receipts=
await Receipt
.find({
orderId:reservaId
})
.sort({
issuedAt:1
});



const doc=
new PDFDocument({
size:'A4',
margin:0
});

res.setHeader(
'Content-Type',
'application/pdf'
);

doc.pipe(res);

let y=0;

////////////////////
// HEADER
////////////////////

const hx=20;
const hy=20;
const hw=555;
const hh=72;

// sombra
doc
.roundedRect(
hx+3,
hy+3,
hw,
hh,
16
)
.fill(
'#00000010'
);

// fondo
doc
.roundedRect(
hx,
hy,
hw,
hh,
16
)
.fill(
COLORS.primary
);

const logo=
resolveLogo();

if(
logo
){

try{

doc.image(
logo,
45,
38,
{
width:50
});

}catch{}

}

// marca
doc
.fillColor(
'#fff'
)
.font(
'Helvetica-Bold'
)
.fontSize(
24
)
.text(
'Nardeli',
115,
32
);

// subtitulo
doc
.font(
'Helvetica'
)
.fontSize(
10
)
.text(
'Estado de Cuenta',
117,
66
);

y=120;

////////////////////
// CLIENTE
////////////////////
card(doc,45,y,505,42);

doc
.fillColor(COLORS.text)
.font('Helvetica')
.fontSize(10);

doc.text('Cliente:',65,y+14);

doc
.font('Helvetica-Bold')
.text(
reserva.cliente||'—',
105,
y+14
);

doc
.font('Helvetica')
.text(
'Evento:',
235,
y+14
);

doc
.font('Helvetica-Bold')
.text(
reserva.tipoEvento||'—',
280,
y+14
);

doc
.font('Helvetica')
.text(
'Fecha:',
390,
y+14
);

doc
.font('Helvetica-Bold')
.text(
reserva.fecha
?
new Intl.DateTimeFormat(
'es-MX',
{
timeZone:
'America/Ciudad_Juarez'
}
).format(
new Date(
reserva.fecha
))
:
'—',
435,
y+14
);

y+=60;

////////////////////
// RESUMEN
////////////////////

const primerRecibo=receipts[0];

const totalOriginal=
primerRecibo?.snapshot?.total||
(
Number(
reserva?.precios?.subtotal||
reserva?.subTotal||
0
)
-
Number(
reserva?.descuentoCalculado||
0
)
);

const totalActual=
Number(
reserva?.precios?.subtotal||
reserva?.subTotal||
0
)
-
Number(
reserva?.descuentoCalculado||
0
);

const diferencia=
totalActual-
totalOriginal;

const pagado=
receipts.reduce(
(acc,r)=>
acc+
Number(
r.amount||
0
),
0
);

const saldo=
Math.max(
0,
totalActual-
pagado
);

title(doc,'RESUMEN',y);

y+=40;

[
[
'Saldo inicial',
money(totalOriginal)
],

[
diferencia>=0
?'Incremento'
:'Reducción',

(
diferencia>=0
?'+ '
:'- '
)+
money(
Math.abs(
diferencia
)
)
],

[
'Saldo actual',
money(saldo)
]

]

.forEach((v,i)=>{

card(
doc,
45+(i*170),
y,
145,
44
);

doc
.fillColor(
COLORS.muted
)
.fontSize(10)
.text(
v[0],
65+(i*165),
y+18
);

doc
.fillColor(
i===2
?COLORS.primary
:COLORS.text
)
.font(
'Helvetica-Bold'
)
.fontSize(10)
.text(
v[1],
65+(i*165),
y+26
);

});

y+=70;

////////////////////
// UTENSILIOS
////////////////////

title(doc,'UTENSILIOS',y);

y+=45;

const utensilios=
Array.isArray(
reserva.utensilios
)
?reserva.utensilios
:[];

const reciboAnterior=

receipts.length>1

?

receipts[
receipts.length-2
]

:

null;

const productosPrevios=

new Set(

(
reciboAnterior
?.snapshot
?.productos
||
[]
)

.map(
p=>
p.nombre
)

);

const alto=
Math.max(
55,
20+
(
utensilios.length*
13
)
);

card(
doc,
45,
y,
505,
alto
);

let uy=
y+20;

utensilios.forEach(u=>{

const nuevo=

receipts.length>1

&&

!

productosPrevios
.has(
u.nombre
);

if(nuevo){

doc
.roundedRect(
60,
uy-2,
470,
18,
4
)
.fill(
'#FFF6BF'
);

}

doc
.fillColor(
COLORS.text
)
.font(
nuevo
?
'Helvetica-Bold'
:
'Helvetica'
)
.fontSize(8);

doc.text(
`• ${u.nombre}${u.cantidad>1?` ×${u.cantidad}`:''}`,
70,
uy,
{
width:240
}
);

if(nuevo){

doc
.fillColor(
'#8a6d3b'
)
.fontSize(
7
)
.text(
`Nuevo ${date(
u.fechaAgregado
)}`,
320,
uy
);

}

uy+=12;

});

y+=
alto+
35;

////////////////////
// RECIBOS
////////////////////

title(doc,'RECIBOS',y);

y+=45;

doc
.fillColor(
COLORS.muted
)
.font(
'Helvetica-Bold'
)
.fontSize(
7
);

[
'Folio',
'Fecha',
'Abono',
'Método',
'Saldo'
]

.forEach(
(t,i)=>{

doc.text(
t,
60+
(
i*100
),
y
);

}
);

y+=14;

receipts.forEach(r=>{

const alto=28;

if(
y+alto>
760
){

doc.addPage();

y=60;

}

card(
doc,
45,
y,
505,
alto
);

doc
.fillColor(
COLORS.primary
)
.font(
'Helvetica-Bold'
)
.fontSize(
7
)
.text(
r.folio,
60,
y+10
);

doc
.fillColor(
COLORS.text
)
.font(
'Helvetica'
)
.fontSize(
6
);

doc.text(
date(
r.issuedAt
),
125,
y+10
);

doc.text(
money(
r.amount
),
260,
y+10
);

doc.text(
r.paymentMethod,
360,
y+10
);

doc.text(
money(
r.snapshot?.saldo||
0
),
450,
y+10
);

y+=34;

});



////////////////////
// RESUMEN FINAL
////////////////////

if(
y+180>
760
){

doc.addPage();

y=60;

}

title(
doc,
'RESUMEN FINAL',
y
);

y+=45;

card(
doc,
45,
y,
505,
50
);

doc
.fillColor(
COLORS.text
)
.fontSize(10)
.font(
'Helvetica'
);

doc.text(
`Total: ${money(totalActual)}    Pagado: ${money(pagado)}    Saldo: ${money(saldo)}`,
65,
y+18
);

y+=70;


////////////////////
// FOOTER
////////////////////

const fy=785;

// línea superior
doc
.moveTo(
40,
fy
)
.lineTo(
555,
fy
)
.strokeColor(
COLORS.primary
)
.lineWidth(
2
)
.stroke();

// nombre
doc
.fillColor(
COLORS.primary
)
.font(
'Helvetica-Bold'
)
.fontSize(
10
)
.text(
'Nardeli - Salón de Eventos',
45,
fy+12
);

// contacto
doc
.fillColor(
COLORS.muted
)
.font(
'Helvetica'
)
.fontSize(
8
)
.text(
'contacto@nardeli.mx · +52 656 105 6717',
45,
fy+28
);

// dirección
doc
.text(
'Av. Waterfill 431, Waterfill Río Bravo, 32550 Juárez, Chih.',
280,
fy+20,
{
width:250,
align:'left'
}
);

doc.end();

}

module.exports={
streamEstadoCuentaPdf
};