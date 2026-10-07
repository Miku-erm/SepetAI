import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("browse, filter, inspect, add, update and remove a real database product", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bir laptop değil, sana uyan laptop." }),
  ).toBeVisible();
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tüm laptopları gör" }).click();
  await page.getByLabel("Üst bütçe").fill("30000");
  await page
    .getByRole("combobox", { name: "RAM", exact: true })
    .selectOption("16");
  await page.getByLabel("Kullanım").selectOption("gaming");
  await page.getByLabel("Yalnızca stokta").check();
  await expect(page.locator(".product-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Artemis Pulse G15 detayları" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("NVIDIA RTX 4050", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Detayları kapat" }).click();
  await page
    .getByRole("button", { name: "Artemis Pulse G15 sepete ekle" })
    .click();
  await page.getByRole("button", { name: "Sepetim, 1 ürün" }).click();
  await expect(page.locator(".cart-total")).toContainText("26.900");
  await page.getByRole("button", { name: "Pulse G15 adedi artır" }).click();
  await expect(page.locator(".cart-total")).toContainText("53.800");
  await page.reload();
  await expect(page.locator(".cart-total")).toContainText("53.800");
  await page.getByRole("button", { name: "Pulse G15 sepetten çıkar" }).click();
  await expect(page.getByText("Yeni favorine yer açtık.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("manual comparison displays exact facts from the API", async ({
  page,
}) => {
  await page.goto("/products");
  await page
    .getByRole("button", { name: "Student 14 karşılaştırma için seç" })
    .click();
  await page
    .getByRole("button", { name: "Daily 15 karşılaştırma için seç" })
    .click();
  await page
    .locator(".compare-bar")
    .getByRole("button", { name: "Karşılaştır" })
    .click();
  await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("15.900", { exact: false }),
  ).toBeVisible();
});
test("assistant gracefully handles an unavailable Ollama model", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page
    .getByRole("textbox", { name: "Asistana mesaj" })
    .fill("30 bin TL altında oyun için laptop arıyorum.");
  await page.getByRole("button", { name: "Mesajı gönder" }).click();
  await expect(
    page.getByText(/Yerel AI modeli şu anda kullanılamıyor/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mesajı gönder" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "docs/screenshots/assistant-offline.png",
    fullPage: true,
  });
});
test("mobile landing and catalog fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bir laptop değil, sana uyan laptop." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Tüm laptopları gör" }).click();
  await expect(page.locator(".product-card")).toHaveCount(24);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await expect(
    page.getByRole("button", { name: "AI asistan AI", exact: true }),
  ).toBeVisible();
});
