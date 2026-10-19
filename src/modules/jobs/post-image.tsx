import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import type { CSSProperties } from 'react';
import type { JobPostModel } from './post-model';
import { postExcerpt } from './post-model';

const green = '#00853e';
const lime = '#7dff42';
const flex: CSSProperties = { display: 'flex' };
let assets: ReturnType<typeof loadAssets> | undefined;
async function loadAssets() {
  const [regular, bold, logo] = await Promise.all([
    readFile(join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff')),
    readFile(join(process.cwd(), 'node_modules/@fontsource/inter/files/inter-latin-800-normal.woff')),
    readFile(join(process.cwd(), 'public/brand/herbamed.png')),
  ]);
  const whiteLogo = await sharp(logo).ensureAlpha().linear([0, 0, 0, 1], [255, 255, 255, 0]).png().toBuffer();
  return { regular, bold, logo: `data:image/png;base64,${logo.toString('base64')}`, whiteLogo: `data:image/png;base64,${whiteLogo.toString('base64')}` };
}

function PostSection({ section, width }: { section: JobPostModel['primary']; width: number }) {
  return <div style={{ ...flex, flexDirection: 'column', width }}>
    <div style={{ fontSize: section.title.length > 15 ? 30 : 38, fontWeight: 800, color: lime, marginBottom: 24 }}>{section.title}</div>
    {section.items.map((item, index) => <div key={index} style={{ ...flex, gap: 14, marginBottom: 22, alignItems: 'flex-start' }}>
      <div style={{ width: 12, height: 12, borderRadius: 6, background: '#00d968', marginTop: 10, flexShrink: 0 }} />
      <div style={{ display: 'block', fontSize: width < 400 ? 23 : 25, lineHeight: 1.3, lineClamp: section.title === 'Sobre a vaga' ? 8 : section.title === 'Benefícios' ? 2 : 3, overflow: 'hidden', wordBreak: 'break-word', flex: 1 }}>{item}</div>
    </div>)}
  </div>;
}

/** Fixed artwork in memory: no remote images, browser binary, AI calls or uploaded files. */
export async function jobPostPng(post: JobPostModel) {
  const media = await (assets ??= loadAssets().catch(error => { assets = undefined; throw error; }));
  const title = post.title.toLocaleUpperCase('pt-BR');
  // Conservative glyph widths leave room for line breaks in long job titles.
  const titleUnits = [...title].reduce((total, letter) => total + (/\s/.test(letter) ? 0.35 : /[MW@]/.test(letter) ? 1.05 : /[I1L.,]/.test(letter) ? 0.5 : 0.8), 0);
  let titleSize = 44;
  while (titleSize > 18 && Math.ceil(titleUnits * titleSize / 850) * titleSize * 1.12 > 100) titleSize--;
  const response = new ImageResponse(<div style={{ ...flex, position: 'relative', width: 1080, height: 1350, color: 'white', background: green, fontFamily: 'Inter', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', left: -60, top: -85, fontSize: 255, fontWeight: 800, color: '#007b38' }}>talentos</div>
    <div style={{ position: 'absolute', left: -40, bottom: -45, fontSize: 285, fontWeight: 800, color: '#007b38' }}>vagas</div>
    {/* The supplied composition is recreated as vectors, without importing other vacancies. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={media.whiteLogo} alt="Herbamed" width={285} height={60} style={{ position: 'absolute', top: 54, left: 398 }} />
    <div style={{ position: 'absolute', left: 94, top: 142, fontSize: 161, fontWeight: 800, letterSpacing: -9 }}>temos</div>
    <div style={{ position: 'absolute', left: 288, top: 274, fontSize: 161, fontWeight: 800, letterSpacing: -9 }}>vagas</div>
    <div style={{ ...flex, flexDirection: 'column', position: 'absolute', left: 98, top: 361, width: 185, color: lime, fontSize: 23, fontWeight: 800, lineHeight: 1.15 }}>
      <span>{post.workModel.toLocaleUpperCase('pt-BR')}</span>
      <span style={{ fontSize: post.location.length > 28 ? 16 : 21, marginTop: 5 }}>{postExcerpt(post.location,64).toLocaleUpperCase('pt-BR')}</span>
    </div>
    <div style={{ ...flex, flexDirection: 'column', alignItems: 'center', position: 'absolute', right: 24, top: 95, width: 198, height: 340, borderRadius: 20, background: 'linear-gradient(160deg, #ffffff 0%, #e7f4eb 46%, #006631 47%, #005c2d 100%)', transform: 'rotate(6deg)', boxShadow: '0px 7px 0px #00652f', paddingTop: 58 }}>
      <div style={{ position: 'absolute', top: -96, width: 48, height: 124, background: '#00ad63', border: '6px solid #005c36', borderRadius: 10 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.logo} alt="" width={151} height={32} />
      <svg width="105" height="105" viewBox="0 0 105 105" style={{ marginTop: 16 }}><circle cx="52" cy="52" r="51" fill="#007640"/><circle cx="52" cy="36" r="19" fill="#00b775"/><path d="M17 88v-7c0-22 70-22 70 0v7" fill="#00b775"/></svg>
      <div style={{ ...flex, flexDirection: 'column', fontSize: 23, lineHeight: 1.05, fontWeight: 800, textAlign: 'center', marginTop: 12 }}><span>venha</span><span>trabalhar</span><span>com a gente!</span></div>
      <div style={{ width: 72, height: 4, background: '#dac137', marginTop: 15 }} />
    </div>
    <div style={{ ...flex, alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 80, top: 484, width: 920, height: 126, borderRadius: 42, background: '#009c49', padding: '12px 28px', fontSize: titleSize, fontWeight: 800, textAlign: 'center', lineHeight: 1.12, wordBreak: 'break-word' }}>{title}</div>
    <div style={{ ...flex, position: 'absolute', left: 88, top: 631, fontSize: 22, color: '#e1ffeb' }}>{post.contract}</div>
    <div style={{ ...flex, justifyContent: 'space-between', position: 'absolute', left: 88, top: 692, width: 904 }}>
      <PostSection section={post.primary} width={post.secondary.items.length ? 522 : 904} />
      {post.secondary.items.length > 0 && <PostSection section={post.secondary} width={330} />}
    </div>
    <div style={{ position: 'absolute', left: 88, top: 1134, fontSize: 25, color: lime, fontWeight: 800 }}>Confira os detalhes e candidate-se:</div>
    <div style={{ ...flex, alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 80, top: 1181, width: 920, height: 104, padding: '12px 25px', borderRadius: 24, background: '#00a953', textAlign: 'center', wordBreak: 'break-all', fontSize: post.url.length > 140 ? 18 : post.url.length > 80 ? 21 : 25, lineHeight: 1.25, fontWeight: 800 }}>{post.url}</div>
    <div style={{ position: 'absolute', left: 88, bottom: 27, fontSize: 15, letterSpacing: 3, color: '#c4f0d4' }}>VENHA TRABALHAR COM A GENTE!</div>
  </div>, {
    width: 1080, height: 1350,
    fonts: [
      { name: 'Inter', data: Uint8Array.from(media.regular).buffer, weight: 400, style: 'normal' },
      { name: 'Inter', data: Uint8Array.from(media.bold).buffer, weight: 800, style: 'normal' },
    ],
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 4 * 1024 * 1024) throw Error('post_too_large');
  return bytes;
}
