import { expect, test } from '@playwright/test';

test('voice settings expose real dictation controls and runtime status', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const voiceRuntime = window as typeof window & {
      __birdcoderVoiceConstructCount: number;
      __birdcoderVoiceStartCount: number;
      __birdcoderVoiceStopCount: number;
    };
    voiceRuntime.__birdcoderVoiceConstructCount = 0;
    voiceRuntime.__birdcoderVoiceStartCount = 0;
    voiceRuntime.__birdcoderVoiceStopCount = 0;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;

      constructor() {
        voiceRuntime.__birdcoderVoiceConstructCount += 1;
      }

      start() {
        voiceRuntime.__birdcoderVoiceStartCount += 1;
      }

      stop() {
        voiceRuntime.__birdcoderVoiceStopCount += 1;
        this.onend?.();
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    });
  });
  await page.goto('/#/auth/login');

  await expect(page.locator('.sdkwork-birdcoder-auth-shell')).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole('textbox', { name: 'Account' }).fill('e2e@test.sdkwork.local');
  await page.locator('input[type="password"]').first().fill('e2e-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  const settingsTab = page.getByTitle('Settings').first();
  await expect(settingsTab).toBeVisible({ timeout: 60_000 });
  await settingsTab.click();

  const sidebar = page.getByRole('complementary', { name: 'Settings navigation' });
  await sidebar.getByRole('button', { name: 'Voice' }).click();

  await expect(page.getByRole('heading', { name: 'Voice', level: 1 })).toBeVisible();
  await expect(page.getByText('System default', { exact: true })).toBeVisible();
  await expect(page.getByText('Composer microphone', { exact: true })).toBeVisible();
  await expect(page.getByText('Runtime unavailable', { exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Recognition language' }).selectOption('Chinese');
  await expect(page.getByRole('combobox', { name: 'Recognition language' })).toHaveValue(
    'Chinese',
  );
  const continuousListening = page.getByRole('switch', { name: 'Continuous listening' });
  await continuousListening.click();
  await expect(continuousListening).toHaveAttribute('aria-checked', 'true');
  await expect(continuousListening).toHaveCSS('background-color', 'rgb(59, 130, 246)');
  await expect(continuousListening.locator('span')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 16, 0)',
  );

  await expect(page.getByText('In-app dictation shortcut', { exact: true })).toBeVisible();
  const inAppShortcut = page.getByRole('switch', { name: 'In-app dictation shortcut' });
  await expect(inAppShortcut).toHaveAttribute('aria-checked', 'false');
  await inAppShortcut.click();
  await expect(inAppShortcut).toHaveAttribute('aria-checked', 'true');
  await expect(inAppShortcut).toHaveCSS('background-color', 'rgb(59, 130, 246)');
  await expect(inAppShortcut.locator('span')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 16, 0)',
  );

  await page.screenshot({
    path: testInfo.outputPath('voice-settings.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Back to App' }).click();
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __birdcoderVoiceConstructCount: number })
      .__birdcoderVoiceConstructCount,
  )).toBeGreaterThan(1);
  await page.evaluate(() => {
    const voiceRuntime = window as typeof window & {
      __birdcoderVoiceStartCount: number;
      __birdcoderVoiceStopCount: number;
    };
    voiceRuntime.__birdcoderVoiceStartCount = 0;
    voiceRuntime.__birdcoderVoiceStopCount = 0;
  });
  await page.keyboard.press('Control+Shift+Space');
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __birdcoderVoiceStartCount: number })
      .__birdcoderVoiceStartCount,
  )).toBe(1);

  await page.keyboard.press('Control+Shift+Space');
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __birdcoderVoiceStopCount: number })
      .__birdcoderVoiceStopCount,
  )).toBe(1);
});
