import { expect, test } from '@playwright/test';

test.beforeEach(async ({request,page})=>{
  const state=await (await request.get('/api/scenario/version')).json();
  await request.post('/api/reset',{data:{base_version:state.version}});
  await page.goto('/');
  await expect(page.getByLabel('Selected ship')).toBeVisible();
});

test('shore is a separate tab with its own units, layout and support events',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByLabel('Selected ship').locator('option')).toHaveText(['USS KESSLER','USS VARNELL','USS ASHBY']);
  await page.getByRole('link',{name:'Shore Overview',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Installation Overview',exact:true})).toBeVisible();
  await expect(page.getByLabel('Selected installation').locator('option')).toHaveText(['NAVAL STATION NORFOLK (MOCK)','NSA HAMPTON ROADS (MOCK)']);
  await expect(page.getByText('Pier 12 shore power',{exact:true}).filter({visible:true}).first()).toBeVisible();
  const stage=page.getByTestId('base-canvas');
  const box=await stage.boundingBox();
  const canvas=await stage.locator('canvas').boundingBox();
  expect(canvas?.width).toBeCloseTo(box!.width,0);
  expect(canvas?.height).toBeCloseTo(box!.height,0);
  await expect(page.getByText('Helo deck',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/Not a site plan/).first()).toBeVisible();
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await expect(page.getByText('PIER SUPPORT: TIDEWATCH',{exact:true}).first()).toBeVisible();
  await page.getByRole('link',{name:'Shore Overview',exact:true}).click();
  // Wait for the screen as on the first visit; selecting before it renders races the route change.
  await expect(page.getByRole('heading',{name:'Installation Overview',exact:true})).toBeVisible();
  await page.getByLabel('Selected installation').selectOption('NSAHR');
  await expect(page.getByText('Mobile substation',{exact:true}).filter({visible:true}).first()).toBeVisible();
  await page.getByRole('link',{name:'Ship Overview',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Ship Overview',exact:true})).toBeVisible();
  await expect(page.getByLabel('Selected ship')).toHaveValue('KESSLER');
  await expect(page.getByText('Helo deck',{exact:true}).filter({visible:true}).first()).toBeVisible({timeout:60000});
  await page.getByRole('link',{name:'Shore Overview',exact:true}).click();
  await expect(page.getByLabel('Selected installation')).toHaveValue('NSAHR');
  expect(errors).toEqual([]);
});

test('pier failure reaches the ship event and its dependency chain',async({page,request})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  for (let i=0;i<5;i++) {
    const state=await (await request.get('/api/scenario/version')).json();
    expect((await request.post('/api/events/play',{data:{base_version:state.version}})).status()).toBe(200);
  }
  const data=await (await request.get('/api/forecast')).json();
  const mission=data.missions.find((m:any)=>m.event_id==='EVT-KESSLER-01');
  expect(mission.gates.find((g:any)=>g.gate_id==='prereq:EVT-NSNORFOLK-01').p_ok).toBeLessThan(.1);
  await page.reload();
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await expect(page.getByText(/NAVAL STATION NORFOLK \(MOCK\) pre-sail services ready/).first()).toBeVisible();
  await expect(page.getByText("Couldn't load this",{exact:true})).toHaveCount(0);
  await page.getByRole('link',{name:'Shore Overview',exact:true}).click();
  await expect(page.getByRole('button',{name:/Pier 12 shore power: At risk/}).filter({visible:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/Pier 10 shore power: Ready/}).filter({visible:true}).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('captain DDG layout uses live ships and named canonical missions',async({page})=>{
  test.setTimeout(150000);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('heading',{name:'Ship Overview',exact:true})).toBeVisible();
  await expect(page.getByText('Hull type',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Helo deck',{exact:true}).filter({visible:true}).first()).toBeVisible({timeout:60000});
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  for (const name of ['TIDEWATCH','SEASHIELD','DEEP LANTERN','IRON HORIZON','PIER SUPPORT: TIDEWATCH','Standby E'])
    await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
  // The overview is fleet-wide: selecting another ship does not hide the other units' events.
  await page.getByLabel('Selected ship').selectOption('ASHBY');
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await expect(page.getByText('IRON HORIZON',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('TIDEWATCH',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:/^Shore/}).click();
  await expect(page.getByText('TIDEWATCH',{exact:true})).toHaveCount(0);
  await expect(page.getByText('PIER SUPPORT: TIDEWATCH',{exact:true}).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('opening another unit\'s event from the overview selects that unit',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await expect(page.getByLabel('Selected ship')).toHaveValue('KESSLER');
  await page.locator('article').filter({hasText:'Standby E'}).getByRole('button',{name:/^(Open dominoes|Review fixes|View|Inspect evidence)/}).click();
  await expect(page.getByLabel('Selected installation')).toHaveValue('NSAHR');
  await expect(page.getByText("Couldn't load this",{exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('captain event replay and what-if use the backend',async({page,request})=>{
  await page.getByRole('link',{name:'Change Feed',exact:true}).click();
  await page.getByRole('button',{name:/^Next event/}).click();
  await expect.poll(async()=> (await (await request.get('/api/state')).json()).changes).toBe(1);
  await page.getByRole('link',{name:'What-If',exact:true}).click();
  const before=await (await request.get('/api/scenario/version')).json();
  await page.getByRole('button',{name:'TIDEWATCH: one day later',exact:true}).click();
  await expect(page.getByText(/Isolated backend preview/)).toBeVisible();
  expect((await (await request.get('/api/scenario/version')).json()).version).toBe(before.version);
});

test('captain connected screens load without mock endpoint fallbacks',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const name of ["Davy's Dominoes",'Fixes','Readiness Brief','Activity Log']) {
    await page.getByRole('link',{name,exact:true}).click();
    await expect(page.getByRole('heading',{name,exact:true}).first()).toBeVisible();
    await expect(page.getByText("Couldn't load this",{exact:true})).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('Ask Davey waits for a question, opens evidence, and marks old answers stale',async({page,request})=>{
  test.setTimeout(90000);
  for(let i=0;i<2;i++){
    const current=await (await request.get('/api/scenario/version')).json();
    expect((await request.post('/api/events/play',{data:{base_version:current.version}})).status()).toBe(200);
  }
  const answeredVersion=(await (await request.get('/api/scenario/version')).json()).version;
  await page.reload();
  const askRequests:string[]=[];
  page.on('request',req=>{if(new URL(req.url()).pathname==='/api/davey/ask')askRequests.push(req.postData()||'');});
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Ask Davey'});
  await expect(drawer).toBeVisible();
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await expect(drawer).toHaveCount(0);
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Davy's Dominoes chat")).toBeVisible();
  expect(askRequests).toHaveLength(0);
  await drawer.getByRole('button',{name:'What parts or repair issues threaten this mission?'}).click();
  expect(askRequests).toHaveLength(0);
  await drawer.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(drawer.getByText('Rules-based fallback')).toBeVisible();
  expect(askRequests).toHaveLength(1);
  await drawer.getByRole('button',{name:/View evidence/}).first().click();
  await expect(drawer.getByText(/Known at/)).toBeVisible();
  await drawer.getByRole('button',{name:'Back to answer'}).click();
  await drawer.getByRole('combobox',{name:'Davey mission scope'}).selectOption('EVT-KESSLER-02');
  await drawer.getByLabel('Ask Davey a question').fill('What could affect SEASHIELD repairs?');
  await drawer.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(drawer.getByText('You asked: What could affect SEASHIELD repairs?')).toBeVisible();
  await drawer.getByRole('combobox',{name:'Davey mission scope'}).selectOption('all');
  await expect(drawer.getByText(/earlier mission or exercise state/)).toBeVisible();
  await page.getByRole('link',{name:'Change Feed',exact:true}).click();
  await page.getByRole('button',{name:/^Next event/}).click();
  await expect.poll(async()=>(await (await request.get('/api/scenario/version')).json()).version).toBe(answeredVersion+1);
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Ask Davey'}).getByText(/earlier mission or exercise state/)).toBeVisible();
  expect(askRequests).toHaveLength(2);
});

test('Ask Davey keeps a separate clearable chat on each tab',async({page})=>{
  test.setTimeout(120000);
  const asks:any[]=[];
  page.on('request',req=>{if(new URL(req.url()).pathname==='/api/davey/ask')asks.push(JSON.parse(req.postData()||'{}'));});
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  const popup=page.getByRole('dialog',{name:'Ask Davey'});
  await expect(popup.getByText('Mission Overview chat')).toBeVisible();
  await popup.getByLabel('Ask Davey a question').fill('What threatens TIDEWATCH?');
  await popup.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(popup.getByText('You asked: What threatens TIDEWATCH?')).toBeVisible();

  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole('application')).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(popup.getByText("Davy's Dominoes chat")).toBeVisible();
  await expect(popup.getByText('What threatens TIDEWATCH?')).toHaveCount(0);
  await popup.getByLabel('Ask Davey a question').fill('Which repair dependency should I verify?');
  await popup.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(popup.getByText('You asked: Which repair dependency should I verify?')).toBeVisible();
  expect(asks).toHaveLength(2);
  expect(asks[1].previous_answer_id).toBeNull();

  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(popup.getByText('You asked: What threatens TIDEWATCH?')).toBeVisible();
  await expect(popup.getByText('Which repair dependency should I verify?')).toHaveCount(0);
  await popup.getByRole('button',{name:'Clear Mission Overview chat'}).click();
  await expect(popup.getByText('What should Davey check?')).toBeVisible();
  await expect(popup.getByText('What threatens TIDEWATCH?')).toHaveCount(0);

  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(popup.getByText('You asked: Which repair dependency should I verify?')).toBeVisible();
  await popup.getByRole('button',{name:"Clear Davy's Dominoes chat"}).click();
  await expect(popup.getByText('What should Davey check?')).toBeVisible();
  expect(asks).toHaveLength(2);
});

test('Mission Davey suggestion traces into Dominoes without sharing the chat',async({page,request})=>{
  test.setTimeout(120000);
  for(let i=0;i<3;i++){
    const current=await (await request.get('/api/scenario/version')).json();
    expect((await request.post('/api/events/play',{data:{base_version:current.version}})).status()).toBe(200);
  }
  await page.reload();
  await page.route('**/api/davey/ask',async route=>{
    const response=await route.fetch();
    const answer=await response.json();
    const assist=answer.evidence.find((item:any)=>item.excerpt.startsWith('ASSIST/')&&item.excerpt.includes('NSWC TECH REP'));
    expect(assist).toBeTruthy();
    const nodeId=`proposal:${answer.answer_id}:nswc`;
    answer.proposed_nodes=[{id:nodeId,kind:'support_team',label:'NSWC TECH REP',why:'The CASREP requests NSWC TECH REP assistance.',evidence_ids:[assist.id],verification:'Confirm availability.',tentative:true}];
    answer.proposed_links=[{id:`proposal-link:${answer.answer_id}:repair-assist`,dependent_id:`${answer.event_id}|system:SPY1D|job:99101CF010042`,dependency_id:nodeId,relation:'may_depend_on',why:'The repair may depend on this representative.',evidence_ids:[assist.id],tentative:true}];
    await route.fulfill({response,json:answer});
  });

  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  const popup=page.getByRole('dialog',{name:'Ask Davey'});
  await popup.getByLabel('Ask Davey a question').fill('What repair support might this mission need?');
  await popup.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(popup.getByText('AI-proposed graph additions')).toBeVisible();
  await popup.getByRole('button',{name:'Show in Dominoes'}).click();
  await expect(popup).toHaveCount(0);
  const card=page.locator('.react-flow__node-proposed');
  await expect(card).toHaveCount(1,{timeout:60000});
  await expect(card).toContainText('NSWC TECH REP');

  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(popup.getByText("Davy's Dominoes chat")).toBeVisible();
  await expect(popup.getByText('What repair support might this mission need?')).toHaveCount(0);
  await popup.getByRole('button',{name:'Close Ask Davey'}).click();
  await card.click();
  await expect(popup.getByText('Traced from Mission Overview chat')).toBeVisible();
  await popup.getByRole('button',{name:'Mark reviewed'}).click();
  await expect(card).toContainText('Reviewed');
  await popup.getByRole('button',{name:'Back to Dominoes chat'}).click();
  await expect(popup.getByText('What should Davey check?')).toBeVisible();

  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  await expect(popup.getByText('You asked: What repair support might this mission need?')).toBeVisible();
  await expect(popup.getByText('Reviewed')).toBeVisible();
});

test('Ask Davey reviewable graph overlay stays outside the readiness model',async({page,request})=>{
  test.setTimeout(120000);
  for(let i=0;i<3;i++){
    const current=await (await request.get('/api/scenario/version')).json();
    expect((await request.post('/api/events/play',{data:{base_version:current.version}})).status()).toBe(200);
  }
  await page.reload();
  const before=(await (await request.get('/api/forecast')).json());
  const beforeVersion=(await (await request.get('/api/scenario/version')).json()).version;
  await page.route('**/api/davey/ask',async route=>{
    const response=await route.fetch();
    const answer=await response.json();
    const assist=answer.evidence.find((item:any)=>item.excerpt.startsWith('ASSIST/')&&item.excerpt.includes('NSWC TECH REP'));
    expect(assist).toBeTruthy();
    const nodeId=`proposal:${answer.answer_id}:nswc`;
    answer.generation={...answer.generation,mode:'llm',label:'Live LLM',reason:''};
    answer.proposed_nodes=[{id:nodeId,kind:'support_team',label:'NSWC TECH REP',why:'The CASREP requests NSWC TECH REP assistance.',evidence_ids:[assist.id],verification:'Confirm availability.',tentative:true}];
    answer.proposed_links=[{id:`proposal-link:${answer.answer_id}:repair-assist`,dependent_id:`${answer.event_id}|system:SPY1D|job:99101CF010042`,dependency_id:nodeId,relation:'may_depend_on',why:'The repair may depend on this representative.',evidence_ids:[assist.id],tentative:true}];
    await route.fulfill({response,json:answer});
  });
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await expect(page.getByRole('application')).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'Ask Davey',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Ask Davey'});
  await drawer.getByLabel('Ask Davey a question').fill('What repair support might this mission need?');
  await drawer.getByRole('button',{name:'Ask',exact:true}).click();
  await expect(drawer.getByText('AI-proposed graph additions')).toBeVisible();
  await drawer.getByRole('button',{name:'Show in Dominoes'}).click();
  const card=page.locator('.react-flow__node-proposed');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('NSWC TECH REP');
  await expect(card.locator('> div')).toHaveClass(/border-accent shadow-focus/);
  await drawer.getByText('NSWC TECH REP',{exact:true}).locator('..').getByRole('button',{name:'Review'}).click();
  await drawer.getByRole('button',{name:'Mark reviewed'}).click();
  await expect(card).toContainText('Reviewed');
  await drawer.getByRole('button',{name:'Dismiss suggestion'}).click();
  await expect(card).toHaveCount(0);
  await drawer.getByText(/NSWC TECH REP/).locator('..').getByRole('button',{name:'Restore'}).click();
  await expect(page.locator('.react-flow__node-proposed')).toHaveCount(1);
  await drawer.getByText('Proposed connection').locator('..').getByRole('button',{name:'Review'}).click();
  await expect(drawer.getByRole('heading',{name:'Proposed connection'})).toBeVisible();
  await expect(page.locator('.react-flow__node-proposed > div')).toHaveClass(/border-accent shadow-focus/);
  expect((await (await request.get('/api/scenario/version')).json()).version).toBe(beforeVersion);
  expect(await (await request.get('/api/forecast')).json()).toEqual(before);
});
