const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const DB_DIR = path.join(__dirname,'data');
const DB_FILE = path.join(DB_DIR,'hekand-db.json');
fs.mkdirSync(DB_DIR,{recursive:true});
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex');
function initialState(){return {wos:[],inventory:[],sales:[],payroll:[],expenses:[],seq:{RP:1,PT:1,DT:1},currentUser:null,users:{owner:{username:'owner',role:'owner',passwordHash:hash('owner123')},admin:{username:'admin',role:'admin',passwordHash:hash('admin123')}},shareAllocations:{},shareHistory:[],shares:[{name:'Owner 1',amount:0},{name:'Owner 2',amount:0},{name:'Investor 1',amount:0},{name:'Investor 2',amount:0}]};}
function readDB(){try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{return {state:initialState()};}}
function writeDB(db){const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB_FILE);}
if(!fs.existsSync(DB_FILE)) writeDB({state:initialState()});
const sessions=new Map();
function json(res,status,obj){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(body);}
function auth(req){const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';return sessions.get(token)||null;}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>10*1024*1024) req.destroy();});req.on('end',()=>{try{resolve(JSON.parse(b||'{}'));}catch(e){reject(e);}});req.on('error',reject);});}
function serve(req,res){let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';const file=path.join(ROOT,u);if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='GET'&&req.url.startsWith('/api/state')){const db=readDB();return json(res,200,{state:db.state});}
  if(req.method==='POST'&&req.url==='/api/login'){const b=await readBody(req);const db=readDB();const user=db.state.users?.[String(b.username||'').toLowerCase()];if(!user||user.passwordHash!==hash(b.password||''))return json(res,401,{error:'Invalid credentials'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,user.username);return json(res,200,{token,state:db.state});}
  if(req.method==='PUT'&&req.url==='/api/state'){const user=auth(req);if(!user)return json(res,401,{error:'Unauthorized'});const b=await readBody(req);if(!b||typeof b!=='object')return json(res,400,{error:'Invalid state'});const db=readDB();b.currentUser=null;db.state=b;writeDB(db);return json(res,200,{ok:true});}
  if(req.method==='POST'&&req.url==='/api/logout'){const user=auth(req);const h=req.headers.authorization||'';if(h.startsWith('Bearer '))sessions.delete(h.slice(7));return json(res,200,{ok:true,user});}
  return serve(req,res);
 }catch(e){console.error(e);return json(res,500,{error:'Server error'});}
});
server.listen(PORT,()=>console.log(`HEKAND Auto Division online server: http://localhost:${PORT}`));
