import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const local=await readFile('.env.test.local','utf8');
const password=process.env.TEST_DEMO_PASSWORD||local.match(/^TEST_DEMO_PASSWORD=(.+)$/m)?.[1];
if(!password)throw new Error('Senha fictícia ausente de .env.test.local');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try{
  const page=await browser.newPage();
  await page.goto('http://localhost:3000/entrar');
  await page.getByLabel('E-mail').fill('candidata.demo@example.test');
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await page.waitForURL('**/candidato',{timeout:15000});

  await page.goto('http://localhost:3000/candidato/perfil?etapa=dados');
  await page.getByLabel('Telefone com DDD').fill('(47) 99999-9999');
  await page.getByLabel(/Resumo profissional/).fill('Profissional fictícia de qualidade, com formação em processos e melhoria contínua.');
  await page.getByRole('button',{name:'Salvar dados do currículo'}).click();
  await page.getByRole('status').waitFor({timeout:15000});

  await page.goto('http://localhost:3000/candidato/perfil?etapa=trajetoria');
  if(!await page.getByText('Graduação em Qualidade Fictícia').count()){
    const section=page.getByRole('region',{name:'Histórico Acadêmico',exact:true});
    await section.getByText('Adicionar formação',{exact:true}).click();
    const form=section.locator('form').filter({has:page.locator('input[name="op"][value="entry"]')});
    await form.getByLabel('Curso ou formação').fill('Graduação em Qualidade Fictícia');
    await form.getByLabel('Empresa ou instituição').fill('Instituição Exemplo');
    await form.getByRole('button',{name:'Adicionar ao currículo'}).click();
    await form.getByRole('status').waitFor({timeout:15000});
  }

  await page.goto('http://localhost:3000/candidato/perfil?etapa=revisao');
  await page.getByText('Seu currículo contém os dados essenciais').waitFor();
  const downloading=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar currículo em PDF',exact:true}).click();
  const pdf=await downloading;
  assert.equal((await readFile(await pdf.path())).subarray(0,4).toString(),'%PDF');

  await page.goto('http://localhost:3000/vagas/assistente-de-logistica-local-003/candidatar');
  if(await page.getByRole('button',{name:'Enviar candidatura'}).count()){
    await page.locator('input[name=acknowledge]').check();
    await page.getByRole('button',{name:'Enviar candidatura'}).click();
    try{await page.waitForURL('**/candidato/candidaturas',{timeout:15000});}
    catch{throw new Error(`Candidatura não avançou: ${await page.locator('[role=alert]').allTextContents()}`);}
  }
  const legacy=await page.request.post('http://localhost:3000/api/uploads',{headers:{'Content-Type':'application/json'},data:{}});
  assert.equal(legacy.status(),410);
  console.log('Jornada de currículo estruturado, PDF, candidatura e upload antigo desativado: OK.');
}finally{await browser.close();}
