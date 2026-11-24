// Dev utility: renders a contact sheet of simulated slices to a PNG (npx tsx scripts/render-test.ts out.png)
import { computeSlice } from '../src/lib/imaging/slice';
import { renderMRI, renderCT, renderPET } from '../src/lib/imaging/modalities';
import { emptyPathology } from '../src/lib/anatomy/model';
import { DISEASE_BY_ID } from '../src/data/diseases';
import zlib from 'zlib'; import fs from 'fs';
function png(w:number,h:number,rgb:Uint8Array){const crcT=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcT[n]=c;}
const crc=(b:Buffer)=>{let c=-1;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};
const chunk=(t:string,d:Buffer)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w*3;x++)raw[y*(w*3+1)+1+x]=rgb[y*w*3+x];}
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const A=process.argv[3]==='atlas'?(()=>{const g=(f:string)=>new Uint8Array(zlib.gunzipSync(fs.readFileSync('public/atlas/'+f)));return {meta:JSON.parse(fs.readFileSync('public/atlas/meta.json','utf8')),t1:g('t1.u8.gz'),seg:g('seg.u8.gz'),ctx:g('ctx.u8.gz')};})():undefined;
const computeSliceX=(ax:any,pos:number,p:any,n:number)=>computeSlice(ax,pos,p,n,A);
const n=192; const tiles:Float32Array[]=[]; const wl:[number,number][]=[];
const add=(img:{data:Float32Array},w:number,l:number)=>{tiles.push(img.data);wl.push([w,l]);};
const h=computeSliceX('axial',8,emptyPathology(),n);
add(renderMRI(h,'T1'),1.05,0.5);add(renderMRI(h,'T2'),1.05,0.5);add(renderMRI(h,'FLAIR'),1.05,0.5);add(renderCT(h),80,40);
const ms=computeSliceX('axial',20,DISEASE_BY_ID['ms'].model(1),n);add(renderMRI(ms,'FLAIR'),1.05,0.5);
const a=computeSliceX('coronal',-18,DISEASE_BY_ID['alzheimers'].model(1),n);add(renderMRI(a,'T1'),1.05,0.5);
const c=computeSliceX('coronal',-18,emptyPathology(),n);add(renderMRI(c,'T1'),1.05,0.5);
const sd=computeSliceX('axial',30,DISEASE_BY_ID['sdh'].model(0),n);add(renderCT(sd),80,40);
const sag=computeSliceX('sagittal',3,emptyPathology(),n);add(renderMRI(sag,'T1'),1.05,0.5);
const am=computeSliceX('axial',20,DISEASE_BY_ID['alzheimers'].model(1),n);add(renderPET(am,'AMY'),2.6,1.3);
const cols=5, rows=Math.ceil(tiles.length/cols); const W=cols*n,Hh=rows*n; const rgb=new Uint8Array(W*Hh*3);
tiles.forEach((d,t)=>{const [w,l]=wl[t];const ox=(t%cols)*n,oy=Math.floor(t/cols)*n;for(let j=0;j<n;j++)for(let i=0;i<n;i++){const v=Math.max(0,Math.min(255,((d[j*n+i]-(l-w/2))/w)*255));const o=((oy+j)*W+ox+i)*3;rgb[o]=rgb[o+1]=rgb[o+2]=v;}});
fs.writeFileSync(process.argv[2],png(W,Hh,rgb));
