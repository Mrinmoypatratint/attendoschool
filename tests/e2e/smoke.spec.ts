import {test,expect} from '@playwright/test';
test('application loads',async({page})=>{await page.goto(process.env.BASE_URL||'http://localhost:5173');await expect(page.locator('body')).toContainText(/login|email|password|attendance/i);});
