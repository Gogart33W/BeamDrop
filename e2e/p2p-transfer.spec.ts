import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('BeamDrop Live E2E P2P Transfer & Live Clipboard', () => {
  test('connects two tabs via 4-character code, transfers text and file, verifies integrity and takes screenshots', async ({ browser }) => {
    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // 1. Create two isolated browser contexts for Sender and Receiver
    const senderContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const receiverContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true
    });

    const senderPage = await senderContext.newPage();
    const receiverPage = await receiverContext.newPage();

    // Track unhandled page crashes and JS exceptions
    const unhandledErrors: string[] = [];

    senderPage.on('pageerror', (err) => {
      unhandledErrors.push(`Sender page error: ${err.message}`);
    });

    receiverPage.on('pageerror', (err) => {
      unhandledErrors.push(`Receiver page error: ${err.message}`);
    });

    senderPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('AudioContext') && !text.includes('STUN')) {
          console.log(`[Sender Console ${msg.type()}]:`, text);
        }
      }
    });

    receiverPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('AudioContext') && !text.includes('STUN')) {
          console.log(`[Receiver Console ${msg.type()}]:`, text);
        }
      }
    });

    // 2. Open Sender Page
    await senderPage.goto('http://localhost:4000');
    await senderPage.waitForLoadState('networkidle');

    // Wait for room code to be generated (4 characters)
    const roomCodeElement = senderPage.locator('[data-testid="room-code-display"]');
    await expect(roomCodeElement).toBeVisible({ timeout: 10000 });
    const rawRoomCode = await roomCodeElement.innerText();
    const roomCode = rawRoomCode.trim();

    expect(roomCode).toHaveLength(4);
    console.log(`Generated Sender Room Code: [${roomCode}]`);

    // 3. Open Receiver Page
    await receiverPage.goto('http://localhost:4000');
    await receiverPage.waitForLoadState('networkidle');

    // Receiver clicks "Ввести код"
    const openJoinBtn = receiverPage.locator('[data-testid="open-join-button"]');
    await openJoinBtn.click();

    // Enter room code in modal
    const joinInput = receiverPage.locator('[data-testid="join-room-input"]');
    await expect(joinInput).toBeVisible();
    await joinInput.fill(roomCode);

    const submitJoinBtn = receiverPage.locator('[data-testid="submit-join-room-button"]');
    await submitJoinBtn.click();

    // 4. Verify both pages indicate connection established
    await expect(senderPage.locator('[data-testid="connection-status-text"]')).toContainText(
      "З'єднано з пристроєм",
      { timeout: 15000 }
    );
    await expect(receiverPage.locator('[data-testid="connection-status-text"]')).toContainText(
      "З'єднано з пристроєм",
      { timeout: 15000 }
    );

    // 5. Test Live Clipboard (Drop Text / Code sharing)
    const testSecretMessage = 'BeamDrop Test Payload: 🚀 WebRTC Direct Tunnel #42\nconst speed = "100MB/s";';
    const clipboardInput = senderPage.locator('[data-testid="clipboard-input"]');
    await clipboardInput.fill(testSecretMessage);

    const sendClipboardBtn = senderPage.locator('[data-testid="send-clipboard-button"]');
    await sendClipboardBtn.click();

    // Verify message appears on Receiver page
    const receiverSharedList = receiverPage.locator('[data-testid="shared-texts-list"]');
    await expect(receiverSharedList).toContainText(testSecretMessage, { timeout: 10000 });

    // 6. Test File Transfer (P2P chunk stream)
    const testFileName = 'beamdrop-verification-report.txt';
    const testFileContent = 'BEAMDROP_INTEGRITY_VERIFICATION_' + 'A'.repeat(1024 * 128); // 128 KB
    const tempFilePath = path.resolve(process.cwd(), testFileName);
    fs.writeFileSync(tempFilePath, testFileContent, 'utf-8');

    // Set up download listener on receiver before sender triggers upload
    const downloadPromise = receiverPage.waitForEvent('download', { timeout: 20000 });

    // Sender uploads file
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles(tempFilePath);

    // Receiver catches the downloaded file
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();

    if (downloadedPath) {
      const receivedContent = fs.readFileSync(downloadedPath, 'utf-8');
      expect(receivedContent).toBe(testFileContent);
      console.log(`✅ File transfer integrity verified! (${receivedContent.length} bytes matched perfectly)`);
    }

    // Wait for transfer UI to show complete
    await expect(senderPage.locator('[data-testid="file-transfer-list"]')).toContainText('Завершено', {
      timeout: 10000
    });
    await expect(receiverPage.locator('[data-testid="file-transfer-list"]')).toContainText('Завершено', {
      timeout: 10000
    });

    // 7. Capture visual proof screenshots
    await senderPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-sender.png'),
      fullPage: true
    });
    await receiverPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-receiver.png'),
      fullPage: true
    });

    // Mobile viewport screenshot
    await receiverPage.setViewportSize({ width: 390, height: 844 });
    await receiverPage.waitForTimeout(500);
    await receiverPage.screenshot({
      path: path.join(screenshotsDir, 'mobile-receiver.png'),
      fullPage: true
    });

    console.log('📸 Polished screenshots captured in /screenshots directory.');

    // 8. Verify no unhandled page crashes or runtime errors
    expect(unhandledErrors).toHaveLength(0);

    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    await senderContext.close();
    await receiverContext.close();
  });
});
