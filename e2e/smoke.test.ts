import { expect, test } from '@playwright/test'

test('landing page renders for logged-out user', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Respawn Social' })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
})

test('login page renders the handle form', async ({ page }) => {
	await page.goto('/login')
	await expect(page.getByLabel('Handle or DID')).toBeVisible()
})
