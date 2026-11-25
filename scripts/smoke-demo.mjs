import {createRequire} from 'node:module';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5186');await page.getByLabel('Email',{exact:true}).fill('manager@devsync.test');await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_PASSWORD||'DevSyncDemo123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
 await expect(page.locator('.stat').first()).toContainText('8');await page.screenshot({path:fileURLToPath(new URL('../artifacts/verification/demo-overview.png',import.meta.url)),fullPage:true});
 await page.getByRole('button',{name:'Board',exact:true}).click();await expect(page.getByRole('button',{name:'Build registration flow',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Login rejects valid passwords',exact:true}).click();await expect(page.getByText('CRITICAL severity · OTHER')).toBeVisible();await page.getByRole('button',{name:'Close dialog'}).click();
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(new URL('../artifacts/verification/production-smoke.json',import.meta.url),JSON.stringify({status:'PASS',at:new Date().toISOString(),login:true,seededItems:8,board:true,bugDetails:true,pageErrors:errors},null,2));console.log('Production frontend/API/database smoke PASS.');
}finally{await browser.close();}
