import { test, expect } from '@playwright/test';

for(const route of ['missions','dominoes']) {
  test(`deterministic ${route} answers distinct intents and embeds actual mission records`,async({page})=>{
    test.setTimeout(180000);
    await page.goto('/#/'+route);
    await page.getByRole('button',{name:'Open overview assistant',exact:true}).click();
    const panel=page.getByRole('region',{name:'Overview assistant'});
    await expect(panel.getByRole('button',{name:'New conversation'})).toBeEnabled();
    await panel.getByLabel('Deterministic only (bypass model and cached LLM)').check();
    await panel.getByLabel('Ask about this unit').fill('What is wrong with the HF transceiver?');
    await panel.getByRole('button',{name:'Send',exact:true}).click();
    await expect(panel.getByLabel('Assistant message')).toHaveCount(1,{timeout:90000});
    await expect(panel.getByText('Local evidence search + exact record matching.',{exact:true})).toBeVisible();
    await expect(panel.getByLabel('Assistant message')).toContainText('HF');
    await panel.getByLabel('Ask about this unit').fill('How many open jobs?');
    await panel.getByRole('button',{name:'Send',exact:true}).click();
    await expect(panel.getByLabel('Assistant message')).toHaveCount(2,{timeout:90000});
    await expect(panel.getByLabel('Assistant message').last()).toContainText('not mission blockers');
    await panel.getByRole('button',{name:'Citation 1',exact:true}).last().click();
    await panel.getByText('Calculation and filters',{exact:true}).click();
    await expect(panel.getByLabel('Citation evidence')).toContainText('contributing_keys');
  });
}

async function open(page:any) {
  await page.getByRole('button',{name:'Open overview assistant',exact:true}).click();
  const panel=page.getByRole('region',{name:'Overview assistant'});
  await expect(panel.getByRole('button',{name:/^Summarize this/})).toBeEnabled();
  return panel;
}

test('ship and shore chat shows inline citations, supports follow-ups and restores after close',async({page})=>{
  test.setTimeout(240000);
  await page.goto('/');
  let panel=await open(page);
  await panel.getByRole('button',{name:'Summarize this ship',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1,{timeout:90000});
  await panel.getByRole('button',{name:'Citation 1',exact:true}).first().click();
  await expect(panel.getByLabel('Citation evidence')).toBeVisible();
  await expect(panel.getByText('system_count_not_mission_probability',{exact:false})).toBeVisible();
  await panel.getByRole('button',{name:'Back to conversation'}).click();
  await panel.getByLabel('Ask about this unit').fill('Explain that concern');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(2,{timeout:90000});
  await page.getByRole('button',{name:'Close overview assistant',exact:true}).click();
  panel=await open(page);
  await expect(panel.getByLabel('Assistant message')).toHaveCount(2);
  await panel.getByRole('button',{name:'New conversation',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(0);
  await page.goto('/#/shore');
  panel=await open(page);
  await panel.getByRole('button',{name:'Summarize this installation',exact:true}).click();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1,{timeout:90000});
  await panel.getByLabel('Ask about this unit').fill('approve this fix');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await expect(panel.getByText(/cannot apply changes or run simulations/)).toBeVisible({timeout:90000});
  await panel.getByText('Uncertainty and data limitations').click();
  await expect(panel.getByText(/Mock installation/)).toBeVisible();
});

test('assistant stays collapsed, loads on demand, closes with Escape and fits mobile',async({page})=>{
  let requests=0;
  page.on('request',request=>{if(request.url().includes('/api/overview-assistant/conversations'))requests++;});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const launcher=page.getByRole('button',{name:'Open overview assistant',exact:true});
  await expect(launcher).toBeVisible();
  await expect(page.getByRole('dialog',{name:'Ask Davy'})).toHaveCount(0);
  expect(requests).toBe(0);
  await open(page);
  const dialog=page.getByRole('dialog',{name:'Ask Davy'});
  const box=await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(launcher).toBeFocused();
});

test('MiniLM is enabled by default and runs locally without external requests',async({page})=>{
  test.setTimeout(180000);
  const external:string[]=[];
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().includes('127.0.0.1'))external.push(request.url());});
  await page.goto('/#/shore');
  const panel=await open(page);
  await expect(panel.getByLabel('Use local semantic search')).toBeChecked();
  await panel.getByLabel('Ask about this unit').fill('show evidence for shore capability status');
  await panel.getByRole('button',{name:'Send',exact:true}).click();
  await expect(panel.getByText('Local evidence search + exact record matching.',{exact:true})).toBeVisible({timeout:90000});
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1);
  expect(external).toEqual([]);
});

test('Ask Davy respects main marking banners, theme and print layout',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('note',{name:'Marking: unclassified, synthetic exercise data'})).toBeVisible();
  await open(page);
  const dialog=page.getByRole('dialog',{name:'Ask Davy'});
  const top=await page.getByRole('note',{name:'Marking: unclassified, synthetic exercise data'}).boundingBox();
  const bounds=await dialog.boundingBox();
  expect(bounds!.y).toBeGreaterThan(top!.y+top!.height);
  const launcher=page.getByRole('button',{name:'Minimize overview assistant',exact:true});
  const button=await launcher.boundingBox();
  const chromeBottom=await page.evaluate(()=>Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-bottom')));
  expect(button!.y+button!.height).toBeLessThanOrEqual(1000-chromeBottom);
  await page.emulateMedia({media:'print'});
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeHidden();
});

test('missing local model falls back automatically without user setup',async({page})=>{
  await page.route('**/models/overview-manifest.json',route=>route.abort());
  await page.goto('/#/shore');
  const panel=await open(page);
  await panel.getByRole('button',{name:'Summarize this installation',exact:true}).click();
  await expect(panel.getByText('Using standard record search; no setup is needed.',{exact:true})).toBeVisible();
  await expect(panel.getByLabel('Assistant message')).toHaveCount(1);
  await expect(panel.getByRole('alert')).toHaveCount(0);
});
