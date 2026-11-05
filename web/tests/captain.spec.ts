import { expect, test } from '@playwright/test';

test.beforeEach(async ({request,page})=>{
  const state=await (await request.get('/api/scenario/version')).json();
  await request.post('/api/reset',{data:{base_version:state.version}});
  await page.goto('/');
  await expect(page.getByLabel('Selected ship')).toBeVisible();
});

test('shore is a separate tab with its own units, layout and support events',async({page})=>{
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
  await expect(page.getByText('Helo deck',{exact:true}).filter({visible:true}).first()).toBeVisible();
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
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('heading',{name:'Ship Overview',exact:true})).toBeVisible();
  await expect(page.getByText('Hull type',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Helo deck',{exact:true}).filter({visible:true}).first()).toBeVisible();
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await expect(page.getByText('TIDEWATCH',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('SEASHIELD',{exact:true}).first()).toBeVisible();
  await page.getByLabel('Selected ship').selectOption('ASHBY');
  await page.getByRole('link',{name:'Mission Overview',exact:true}).click();
  await expect(page.getByText('IRON HORIZON',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('TIDEWATCH',{exact:true})).toHaveCount(0);
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
