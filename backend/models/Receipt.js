const mongoose=require('mongoose');

const snapshotProductSchema=new mongoose.Schema({
 nombre:String,
 cantidad:{type:Number,default:1},
 precio:{type:Number,default:0}
},{_id:false});

const snapshotSchema=new mongoose.Schema({
 fecha:{type:Date,default:Date.now},
 productos:{
  type:[snapshotProductSchema],
  default:[]
 },
 subtotal:{type:Number,default:0},
 descuento:{type:Number,default:0},
 total:{type:Number,default:0},
 saldo:{type:Number,default:0}
},{_id:false});

const receiptSchema=new mongoose.Schema({

 orderId:{
  type:mongoose.Schema.Types.ObjectId,
  ref:'Reserva',
  required:true,
  index:true
 },

 folio:{
  type:String,
  index:true
 },

 amount:{
  type:Number,
  required:true,
  min:0
 },

 paymentMethod:{
  type:String,
  enum:[
   'EFECTIVO',
   'TARJETA',
   'TRANSFERENCIA',
   'OTRO'
  ],
  default:'EFECTIVO'
 },

 currency:{
  type:String,
  default:'MXN'
 },

 concept:{
  type:String,
  default:''
 },

 customerName:{
  type:String,
  default:''
 },

 issuedAt:{
  type:Date,
  default:Date.now
 },

 notes:{
  type:String,
  default:''
 },

 issuedBy:{
  type:String,
  default:'sistema'
 },

 taxRate:{
  type:Number,
  default:0
 },

 snapshot:{
  type:snapshotSchema,
  default:null
 }

},{
 timestamps:true
});

module.exports=
mongoose.model(
'Receipt',
receiptSchema
);