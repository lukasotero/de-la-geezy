import { expect, type Locator, type Page } from '@playwright/test'

export async function chooseSelect(
  page: Page,
  label: string,
  option: string | RegExp,
  scope: Page | Locator = page,
) {
  const trigger = scope.getByRole('combobox', { name: label, exact: true })
  await trigger.click()

  const choice = page.getByRole('option', { name: option, exact: typeof option === 'string' })
  await expect(choice).toBeVisible()
  await choice.press('Enter')

  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(trigger).toContainText(option)
}
