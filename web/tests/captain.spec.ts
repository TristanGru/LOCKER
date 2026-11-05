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
  for(let i=0;i<5;i++){
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
  for(const name of ['TIDEWATCH','SEASHIELD','DEEP LANTERN','IRON HORIZON','PIER SUPPORT: TIDEWATCH','Standby E'])
    await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
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
  for(const name of ["Davy's Dominoes",'Fixes','Readiness Brief','Activity Log']){
    await page.getByRole('link',{name,exact:true}).click();
    await expect(page.getByRole('heading',{name,exact:true}).first()).toBeVisible();
    await expect(page.getByText("Couldn't load this",{exact:true})).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

async function openDavy(page:any,stale=false){
  await page.getByRole('button',{name:'Open overview assistant',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Ask Davy'});
  await expect(panel.getByRole('button',{name:'Send',exact:true})).toBeVisible();
  if(!stale)await expect(panel.getByRole('button',{name:/^(Summarize this mission|Explain this dependency)$/})).toBeEnabled();
  // Explicitly exercise lexical fallback here; embedding execution has separate coverage.
  await panel.getByText('Advanced search settings',{exact:true}).click();
  await panel.getByLabel('Use local semantic search').uncheck();
  return panel;
}

test('Ask Davy waits for submit, opens assessment citations and marks changed state stale',async({page,request})=>{
  test.setTimeout(120000);
  let asks=0;
  page.on('request',r=>{if(/\/conversations\/[^/]+\/messages$/.test(new URL(r.url()).pathname))asks++;});
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  const panel=await openDavy(page);
  expect(asks).toBe(0);
  await expect(panel.getByText('AI',{exact:true})).toHaveCount(0);
  await panel.getByRole('button',{name:'Summarize this mission',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1);
  await expect(panel.getByText(/Davy · Deterministic fallback/)).toBeVisible();
  expect(asks).toBe(1);
  await panel.getByRole('button',{name:'Citation 1',exact:true}).first().click();
  await expect(panel.getByLabel('Citation evidence')).toBeVisible();
  await expect(panel.getByText(/Partial lineage:/).first()).toBeVisible();
  await panel.getByRole('button',{name:'Back to conversation'}).click();
  const state=await (await request.get('/api/scenario/version')).json();
  await request.post('/api/events/play',{data:{base_version:state.version}});
  await page.reload();
  const restored=await openDavy(page,true);
  await expect(restored.getByText(/These messages are historical/)).toBeVisible();
  expect(asks).toBe(1);
});

test('Ask Davy keeps separate restorable clearable conversations on Mission and Dominoes',async({page})=>{
  test.setTimeout(120000);
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  let panel=await openDavy(page);
  await panel.getByLabel('Ask about this unit').fill('What threatens this mission?');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1);
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Ask Davy'})).toHaveCount(0);
  panel=await openDavy(page);
  await expect(panel.getByText('What threatens this mission?',{exact:true})).toHaveCount(0);
  await panel.getByLabel('Ask about this unit').fill('Which repair dependency should I verify?');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1);
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  panel=await openDavy(page);
  await expect(panel.getByText('What threatens this mission?',{exact:true})).toBeVisible();
  await expect(panel.getByText('Which repair dependency should I verify?',{exact:true})).toHaveCount(0);
  await panel.getByRole('button',{name:'New conversation',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(0);
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  panel=await openDavy(page);
  await expect(panel.getByText('Which repair dependency should I verify?',{exact:true})).toBeVisible();
});

async function proposals(page:any,request:any){
  for(let i=0;i<3;i++){
    const state=await (await request.get('/api/scenario/version')).json();
    await request.post('/api/events/play',{data:{base_version:state.version}});
  }
  await page.reload();
  await page.route('**/api/overview-assistant/conversations/*/messages',async(route:any)=>{
    const response=await route.fetch();const session=await response.json();
    const answer=session.messages.at(-1).domain_answer;
    const assist=answer.evidence.find((e:any)=>e.excerpt.includes('NSWC TECH REP'));
    expect(assist).toBeTruthy();
    const id=`proposal:${answer.answer_id}:nswc`;
    answer.proposed_nodes=[{id,kind:'support_team',label:'NSWC TECH REP',why:'The report requests assistance.',evidence_ids:[assist.id],verification:'Confirm availability.',tentative:true}];
    answer.proposed_links=[{id:`proposal-link:${answer.answer_id}:assist`,dependent_id:`${answer.event_id}|system:SPY1D|job:99101CF010042`,dependency_id:id,relation:'may_depend_on',why:'The repair may depend on assistance.',evidence_ids:[assist.id],tentative:true}];
    await route.fulfill({response,json:session});
  });
}

test('Mission Davy suggestion traces into Dominoes without sharing the conversation',async({page,request})=>{
  test.setTimeout(120000);await proposals(page,request);
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  let panel=await openDavy(page);
  await panel.getByLabel('Ask about this unit').fill('What repair support might this mission need?');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await expect(panel.getByText('Tentative graph suggestions · Needs verification')).toBeVisible();
  await panel.getByRole('button',{name:'Show in Dominoes',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Ask Davy'})).toHaveCount(0);
  const card=page.locator('.react-flow__node-proposed');
  await expect(card).toHaveCount(1,{timeout:60000});
  await expect(card).toContainText('NSWC TECH REP');
  panel=await openDavy(page);
  await expect(panel.getByText('What repair support might this mission need?',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Close overview assistant',exact:true}).click();
  await card.click();
  await expect(page.getByText('Traced from Mission Overview chat')).toBeVisible();
  await page.getByRole('button',{name:'Mark reviewed',exact:true}).click();
  await expect(card).toContainText('Reviewed');
});

test('Davy review and dismiss remain outside the readiness model',async({page,request})=>{
  test.setTimeout(120000);await proposals(page,request);
  const before=await (await request.get('/api/forecast')).json();
  const version=(await (await request.get('/api/scenario/version')).json()).version;
  await page.getByRole('link',{name:"Davy's Dominoes",exact:true}).click();
  const panel=await openDavy(page);
  await panel.getByLabel('Ask about this unit').fill('Which report-backed support should I verify?');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await panel.getByRole('button',{name:'NSWC TECH REP',exact:true}).click();
  const card=page.locator('.react-flow__node-proposed');
  await expect(card).toHaveCount(1);
  await panel.getByRole('button',{name:'Mark reviewed',exact:true}).click();
  await expect(card).toContainText('Reviewed');
  await panel.getByRole('button',{name:'Dismiss suggestion',exact:true}).click();
  await expect(card).toHaveCount(0);
  await panel.getByRole('button',{name:'Restore NSWC TECH REP',exact:true}).click();
  await expect(card).toHaveCount(1);
  expect((await (await request.get('/api/scenario/version')).json()).version).toBe(version);
  expect(await (await request.get('/api/forecast')).json()).toEqual(before);
});

test('every watch or at-risk system is pinned and labelled on the 3D ship',async({page})=>{
  test.setTimeout(120000);
  // Systems whose mount the hand-built hull lacks fall back to the dataset position, so none can vanish.
  for (const [ship,name,status] of [['VARNELL','Close-in weapon system','At risk'],['KESSLER','Surface-to-surface missile system (notional)','At risk'],['ASHBY','5-inch gun mount','Watch']]) {
    await page.getByLabel('Selected ship').selectOption(ship);
    const label=page.locator('.s3-lb').filter({hasText:name});
    await expect(label).toHaveCount(1,{timeout:60000});
    await expect(label).toContainText(status);
    await expect(page.getByRole('region',{name:'Systems not drawn on the model'})).toHaveCount(0);
  }
});
