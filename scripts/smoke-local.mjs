import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

let password=process.env.TEST_DEMO_PASSWORD;
let testEnv='';
try{testEnv=await readFile('.env.test.local','utf8');}catch{}
if(!password)password=testEnv.match(/^TEST_DEMO_PASSWORD=(.+)$/m)?.[1];
let totpSecret=testEnv.match(/^TEST_RH_TOTP_SECRET=(.+)$/m)?.[1];
if(!password)throw new Error('Defina TEST_DEMO_PASSWORD ou .env.test.local com a senha de npm run local:setup.');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const errors=[];
function totp(secret){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const char of secret.toUpperCase().replace(/[^A-Z2-7]/g,''))bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
  const key=Buffer.from(bits.match(/.{8}/g)?.map(byte=>parseInt(byte,2))||[]);
  const count=Buffer.alloc(8);count.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac('sha1',key).update(count).digest();const offset=digest[digest.length-1]&15;
  const code=(digest.readUInt32BE(offset)&0x7fffffff)%1000000;return String(code).padStart(6,'0');
}
try {
  await mkdir('artifacts',{recursive:true});
  const guest=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await guest.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});
  assert.match(await page.title(),/Herbamed/);
  await page.screenshot({path:'artifacts/home-desktop.png',fullPage:true});
  await page.goto('http://localhost:3000/vagas');
  assert.equal(await page.locator('.job-card').count(),3);
  await page.goto('http://localhost:3000/vagas/desenvolvedor-full-stack-local-002');
  assert.match(await page.locator('h1').innerText(),/Desenvolvedor/);
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
  const mobilePage=await mobile.newPage();await mobilePage.goto('http://localhost:3000/',{waitUntil:'networkidle'});
  await mobilePage.locator('h1').waitFor();
  await mobilePage.screenshot({path:'artifacts/home-mobile.png',fullPage:true});
  assert.equal(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Home mobile sem overflow horizontal');

  await page.goto('http://localhost:3000/entrar');
  await page.getByLabel('E-mail').fill('candidata.demo@example.test');
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.waitForURL('**/candidato',{timeout:15000});
  assert.match(await page.locator('h1').innerText(),/Marina/);
  await page.goto('http://localhost:3000/candidato/perfil');
  assert.match(await page.locator('h1').innerText(),/história profissional/);
  await page.goto('http://localhost:3000/candidato/perfil?etapa=arquivos');
  const pdf=await PDFDocument.create();pdf.addPage();
  await page.locator('input[type=file]').first().setInputFiles({name:'curriculo-ficticio.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.getByText('Arquivo recebido.').first().waitFor({timeout:15000}).catch(()=>{});
  let approved=false;
  for(let attempt=0;attempt<12;attempt++){
    await page.reload();
    if(await page.locator('.file-row .badge.clean').count()){approved=true;break;}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.equal(approved,true,'Currículo precisa passar por antivírus e validação estrutural');
  const download=await page.request.get('http://localhost:3000'+await page.locator('.file-row a').first().getAttribute('href'),{maxRedirects:0});
  assert.equal(download.status(),307,'Download deve produzir URL assinada após autorização');
  await page.goto('http://localhost:3000/vagas/desenvolvedor-full-stack-local-002/candidatar');
  if(await page.getByRole('button',{name:'Enviar candidatura'}).count()){
    await page.getByLabel(/Conte brevemente/).fill('Experiência fictícia com TypeScript e PostgreSQL para validação do fluxo local.');
    await page.locator('input[name=acknowledge]').check();
    await page.getByRole('button',{name:'Enviar candidatura'}).click();
    await page.waitForURL('**/candidato/candidaturas',{timeout:15000});
  }
  const forbidden=await page.request.get('http://localhost:3000/api/rh/export-candidates');
  assert.equal(forbidden.status(),403);
  await page.goto('http://localhost:3000/rh');
  await page.waitForURL('**/acesso-negado',{timeout:10000});

  const rh=await browser.newContext({viewport:{width:1440,height:900}});
  const rhPage=await rh.newPage();rhPage.on('pageerror',error=>errors.push(error.message));
  await rhPage.goto('http://localhost:3000/entrar');
  await rhPage.getByLabel('E-mail').fill('rh.demo@herbamed.test');
  await rhPage.getByLabel('Senha').fill(password);
  await rhPage.getByRole('button',{name:'Entrar',exact:true}).click();
  await rhPage.waitForURL('**/acesso-negado',{timeout:15000});
  await rhPage.goto('http://localhost:3000/seguranca');
  if(await rhPage.getByRole('button',{name:'Configurar autenticador'}).count()){
    await rhPage.getByRole('button',{name:'Configurar autenticador'}).click();
    await rhPage.locator('.qr').waitFor();
    totpSecret=(await rhPage.locator('code').innerText()).trim();
    await writeFile('.env.test.local',`TEST_DEMO_PASSWORD=${password}\nTEST_RH_TOTP_SECRET=${totpSecret}\n`);
  }
  if(!totpSecret)throw new Error('MFA existente sem chave de teste. Rode npm run local:setup e atualize .env.test.local.');
  await rhPage.getByLabel('Código de seis dígitos').fill(totp(totpSecret));
  await rhPage.getByRole('button',{name:'Confirmar código'}).click();
  await rhPage.waitForURL('**/rh',{timeout:15000});
  assert.match(await rhPage.locator('h1').innerText(),/Visão geral/);
  await rhPage.screenshot({path:'artifacts/rh-dashboard.png',fullPage:true});
  await rhPage.goto('http://localhost:3000/rh/vagas');
  assert.equal(await rhPage.locator('tbody tr').count(),3);
  if(errors.length)throw new Error('Erros no navegador: '+errors.join('; '));
  console.log('Smoke E2E passou: portal, mobile, candidato, upload/scan, candidatura, bloqueio RH, MFA e dashboard.');
}finally{await browser.close();}
