import { expect, test } from '@playwright/test';

test.beforeEach(async ({request,page})=>{
  const state=await (await request.get('/api/scenario/version')).json();
  await request.post('/api/reset',{data:{base_version:state.version}});
  await page.goto('/');
  await expect(page.getByLabel('Selected ship')).toBeVisible();
});

test('captain DDG layout uses live ships and named canonical missions',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('heading',{name:'Ship Overview',exact:true})).toBeVisible();
  await expect(page.getByText('Hull type',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Helo deck',{exact:true}).first()).toBeVisible();
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
