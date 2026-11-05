const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = 'E:\\minproj\\report-materials';

const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU4ODg5YWUwLTA5MGQtNGQ3Yy1hNDIwLTAyY2ZhNmU5N2RhMCIsImVtYWlsIjoiMjAyNGNpX2Frc2hhdGhhbF9hQG5pZS5hYy5pbiIsIm5hbWUiOiJBS1NIQVRIQSBMIDI0Q0lBIiwiaWF0IjoxNzkzODk1MzM2LCJleHAiOjE3OTQ1MDAxMzYsImlzcyI6ImxpZmVzeW5jaC1haSJ9.Wx3Wc8K0HwPRlcYzhO0hmPXSAWhLONMvXXtuns73iMI';

const CACHED_USER = {
  id: '58889ae0-090d-4d7c-a420-02cfa6e97da0',
  email: 'student@university.edu',
  name: 'Student User',
  picture: null,
  hasGmailAccess: true,
  hasCalendarAccess: true
};

async function anonymizePage(page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue) {
        node.nodeValue = node.nodeValue
          .replace(/[a-zA-Z0-9._%+-]+@nie\.ac\.in/gi, 'student@university.edu')
          .replace(/AKSHATHA\s*L\s*24CIA/gi, 'Student (Computer Science)')
          .replace(/AKSHATHA\s*L/gi, 'Student User')
          .replace(/2024ci_akshathal_a/gi, 'student_cs');
      }
    }
  });
}

async function captureAll() {
  console.log('--- Starting LifeSynch Screenshot Generation ---');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    // ==========================================
    // 1. LOGIN PAGE
    // ==========================================
    console.log('[1/8] Capturing Login Page...');
    await page.goto(`${BASE_URL}/?view=login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/?view=login`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-01-login.png'), type: 'png' });
    console.log('✓ screenshot-01-login.png saved.');

    // Authenticate user in localStorage
    await page.evaluate((token, user) => {
      localStorage.setItem('lifesynch_auth_token', token);
      localStorage.setItem('lifesynch_cached_user', JSON.stringify(user));
    }, USER_TOKEN, CACHED_USER);

    // ==========================================
    // 2. HOME DASHBOARD
    // ==========================================
    console.log('[2/8] Capturing Home Dashboard...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000)); // wait for tasks and calendar to load
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-02-home-dashboard.png'), type: 'png' });
    console.log('✓ screenshot-02-home-dashboard.png saved.');

    // ==========================================
    // 3. RESPONSIBILITIES PAGE
    // ==========================================
    console.log('[3/8] Capturing Responsibilities Page...');
    // Click navigation item for Responsibilities
    const clickedNav = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const respBtn = buttons.find(b => b.textContent && b.textContent.includes('Responsibilities'));
      if (respBtn) {
        respBtn.click();
        return true;
      }
      return false;
    });
    console.log('Navigated to Responsibilities tab:', clickedNav);
    await new Promise(r => setTimeout(r, 2000));
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-03-responsibilities.png'), type: 'png' });
    console.log('✓ screenshot-03-responsibilities.png saved.');

    // ==========================================
    // 4. RESPONSIBILITY DETAILS MODAL
    // ==========================================
    console.log('[4/8] Capturing Responsibility Details Modal...');
    const clickedItem = await page.evaluate(() => {
      // Find a clickable responsibility row/card
      const items = Array.from(document.querySelectorAll('div[class*="cursor-pointer"], tr[class*="cursor-pointer"]'));
      const actionable = items.find(el => el.textContent && (el.textContent.includes('Project') || el.textContent.includes('Assignment') || el.textContent.includes('Registration') || el.textContent.includes('Challenge') || el.textContent.includes('Report')));
      if (actionable) {
        actionable.click();
        return true;
      }
      if (items.length > 0) {
        items[0].click();
        return true;
      }
      return false;
    });
    console.log('Clicked responsibility card:', clickedItem);
    await new Promise(r => setTimeout(r, 1500));
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-04-responsibility-details.png'), type: 'png' });
    console.log('✓ screenshot-04-responsibility-details.png saved.');

    // Close responsibility modal if open
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close"], button:has(svg.lucide-x), .fixed button');
      if (closeBtn) (closeBtn).click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // ==========================================
    // 5. WORTH KNOWING SECTION & DETAILS
    // ==========================================
    console.log('[5/8] Capturing Worth Knowing Section & Details...');
    // Return to dashboard first
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const homeBtn = buttons.find(b => b.textContent && (b.textContent.includes('Dashboard') || b.textContent.includes('Home')));
      if (homeBtn) homeBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Find and click on a Worth Knowing discovery card
    const openedDiscovery = await page.evaluate(() => {
      // Look for Worth Knowing heading or cards
      const headings = Array.from(document.querySelectorAll('h2, h3'));
      const wkHeading = headings.find(h => h.textContent && h.textContent.includes('Worth Knowing'));
      if (wkHeading) {
        wkHeading.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const cards = Array.from(document.querySelectorAll('div[class*="cursor-pointer"]'));
      const discoveryCard = cards.find(c => c.textContent && (c.textContent.includes('Challenge') || c.textContent.includes('Opportunity') || c.textContent.includes('Internship') || c.textContent.includes('PPO') || c.textContent.includes('Drive') || c.textContent.includes('Worth Knowing')));
      if (discoveryCard) {
        discoveryCard.click();
        return true;
      }
      return false;
    });
    console.log('Opened Worth Knowing discovery detail:', openedDiscovery);
    await new Promise(r => setTimeout(r, 1500));
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-05-worth-knowing-details.png'), type: 'png' });
    console.log('✓ screenshot-05-worth-knowing-details.png saved.');

    // Close any open modal
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Close"], .fixed button');
      if (closeBtn) (closeBtn).click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // ==========================================
    // 6. CALENDAR PAGE
    // ==========================================
    console.log('[6/8] Capturing Calendar Page...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const calBtn = buttons.find(b => b.textContent && b.textContent.includes('Calendar'));
      if (calBtn) calBtn.click();
    });
    await new Promise(r => setTimeout(r, 2500));
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-06-calendar.png'), type: 'png' });
    console.log('✓ screenshot-06-calendar.png saved.');

    // ==========================================
    // 7. ASK LIFESYNCH AI CHATBOT
    // ==========================================
    console.log('[7/8] Capturing Ask LifeSynch AI Chatbot...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const botBtn = buttons.find(b => b.textContent && (b.textContent.includes('Assistant') || b.textContent.includes('Ask LifeSynch') || b.textContent.includes('AI Assistant')));
      if (botBtn) botBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Type a realistic query into the chatbot textarea/input and submit
    await page.evaluate(async () => {
      const input = document.querySelector('textarea, input[placeholder*="Ask"], input[placeholder*="query"], input[type="text"]');
      if (input) {
        input.value = "What is my highest priority responsibility due today?";
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const sendBtn = document.querySelector('button:has(svg.lucide-send), button:has(svg.lucide-arrow-right), form button[type="submit"]');
        if (sendBtn) {
          sendBtn.click();
        }
      }
    });
    // Wait 5 seconds for assistant response to render
    await new Promise(r => setTimeout(r, 5000));
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-07-ask-lifesynch-assistant.png'), type: 'png' });
    console.log('✓ screenshot-07-ask-lifesynch-assistant.png saved.');

    // ==========================================
    // 8. NOTIFICATIONS PANEL
    // ==========================================
    console.log('[8/8] Capturing Notifications Panel...');
    // Return to dashboard
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const homeBtn = buttons.find(b => b.textContent && (b.textContent.includes('Dashboard') || b.textContent.includes('Home')));
      if (homeBtn) homeBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Click the notification bell in the Navbar
    const clickedBell = await page.evaluate(() => {
      const bellBtn = document.querySelector('button[title*="Notification"], button:has(svg.lucide-bell)');
      if (bellBtn) {
        bellBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked Notification bell:', clickedBell);
    await new Promise(r => setTimeout(r, 1500));
    await anonymizePage(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'screenshot-08-notifications.png'), type: 'png' });
    console.log('✓ screenshot-08-notifications.png saved.');

    console.log('\n--- All 8 screenshots captured successfully! ---');
  } finally {
    await browser.close();
  }
}

captureAll().catch(err => {
  console.error('Screenshot capture failed:', err);
});
