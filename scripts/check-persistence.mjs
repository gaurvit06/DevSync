import {createRequire} from 'node:module';import fs from 'node:fs';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));const {request}=require('@playwright/test');
const fixture=JSON.parse(fs.readFileSync(new URL('../artifacts/verification/persistence-fixture.json',import.meta.url),'utf8'));
const c=await request.newContext({baseURL:'http://127.0.0.1:5187'});const token=(await (await c.get('/api/auth/csrf')).json()).token;
const login=await c.post('/api/auth/login',{data:{email:fixture.email,password:fixture.password},headers:{'X-XSRF-TOKEN':token}});if(!login.ok())throw Error('Account lost after restart');
const data=await (await c.get(`/api/projects/${fixture.projectId}/work-items`)).json();if(data.total!==2)throw Error('Items lost');const task=data.items.find(w=>w.type==='TASK');
const comments=await (await c.get(`/api/work-items/${task.id}/comments`)).json();if(comments.length!==1)throw Error('Comment lost');
const notifications=await (await c.get('/api/notifications')).json();if(!notifications.some(n=>n.read))throw Error('Read state lost');
fs.writeFileSync(new URL('../artifacts/verification/persistence-result.json',import.meta.url),JSON.stringify({status:'PASS',checkedAt:new Date().toISOString(),accounts:true,items:2,comments:1,notificationReadState:true},null,2));await c.dispose();console.log('A09 PASS: account, items, comments, notification read state survived API and MySQL restart.');
