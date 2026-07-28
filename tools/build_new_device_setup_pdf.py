from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin  # noqa: F401


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
PREVIEW_DIR = DOCS / "rendered-new-device-setup"
PDF = DOCS / "ARTICTON-New-Device-Setup-Guide.pdf"

PAGE_W, PAGE_H = 1650, 2138
MARGIN = 140
CONTENT_W = PAGE_W - (MARGIN * 2)
BLUE = (46, 116, 181)
DARK = (11, 37, 69)
TEXT = (38, 48, 66)
MUTED = (92, 108, 128)
GRID = (217, 226, 236)
FILL = (244, 246, 249)
HEADER_FILL = (232, 238, 245)
CODE_FILL = (247, 249, 252)


def font(name, size):
    candidates = [
        Path("C:/Windows/Fonts") / name,
        Path("C:/Windows/Fonts/calibri.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


REG = font("calibri.ttf", 30)
BOLD = font("calibrib.ttf", 30)
TITLE = font("calibrib.ttf", 54)
SUBTITLE = font("calibri.ttf", 33)
H1 = font("calibrib.ttf", 40)
H2 = font("calibrib.ttf", 34)
SMALL = font("calibri.ttf", 24)
SMALL_BOLD = font("calibrib.ttf", 24)
CODE = font("consola.ttf", 25)


class PdfBuilder:
    def __init__(self):
        self.pages = []
        self.new_page()

    def new_page(self):
        image = Image.new("RGB", (PAGE_W, PAGE_H), "white")
        self.draw = ImageDraw.Draw(image)
        self.page = image
        self.y = MARGIN
        self.draw.text((MARGIN, 58), "ARTICTON setup guide", fill=MUTED, font=SMALL)
        self.draw.line((MARGIN, 98, PAGE_W - MARGIN, 98), fill=GRID, width=2)
        self.pages.append(image)

    def ensure(self, needed):
        if self.y + needed > PAGE_H - MARGIN:
            self.new_page()

    def text_height(self, lines, fnt, line_gap):
        return len(lines) * (fnt.size + line_gap)

    def wrap(self, text, fnt, width):
        words = text.split()
        lines = []
        current = ""
        for word in words:
            test = word if not current else f"{current} {word}"
            if self.draw.textlength(test, font=fnt) <= width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines or [""]

    def paragraph(self, text, fnt=REG, fill=TEXT, before=0, after=18, line_gap=8):
        lines = self.wrap(text, fnt, CONTENT_W)
        self.ensure(before + self.text_height(lines, fnt, line_gap) + after)
        self.y += before
        for line in lines:
            self.draw.text((MARGIN, self.y), line, fill=fill, font=fnt)
            self.y += fnt.size + line_gap
        self.y += after

    def heading(self, text, level=1):
        fnt = H1 if level == 1 else H2
        self.paragraph(text, fnt=fnt, fill=BLUE, before=30 if level == 1 else 22, after=12)

    def title_block(self):
        self.ensure(250)
        self.draw.text((MARGIN, self.y), "ARTICTON New Device Setup Guide", fill=DARK, font=TITLE)
        self.y += 72
        self.paragraph(
            "GitHub pull, local environment recreation, Firebase setup, and local testing",
            fnt=SUBTITLE,
            fill=MUTED,
            after=10,
        )
        self.paragraph(
            "Use this when moving the project to a new laptop or PC and the local .env files are missing.",
            after=28,
        )

    def bullet(self, text):
        lines = self.wrap(text, REG, CONTENT_W - 45)
        self.ensure(self.text_height(lines, REG, 8) + 12)
        self.draw.ellipse((MARGIN + 8, self.y + 12, MARGIN + 20, self.y + 24), fill=BLUE)
        for i, line in enumerate(lines):
            self.draw.text((MARGIN + 45, self.y), line, fill=TEXT, font=REG)
            self.y += REG.size + 8
        self.y += 8

    def step(self, number, text):
        lines = self.wrap(text, REG, CONTENT_W - 70)
        self.ensure(self.text_height(lines, REG, 8) + 12)
        self.draw.text((MARGIN, self.y), f"{number}.", fill=BLUE, font=BOLD)
        for line in lines:
            self.draw.text((MARGIN + 70, self.y), line, fill=TEXT, font=REG)
            self.y += REG.size + 8
        self.y += 8

    def code(self, text):
        lines = self.wrap(text, CODE, CONTENT_W - 50)
        height = self.text_height(lines, CODE, 9) + 34
        self.ensure(height + 10)
        self.draw.rounded_rectangle(
            (MARGIN, self.y, PAGE_W - MARGIN, self.y + height),
            radius=10,
            fill=CODE_FILL,
            outline=GRID,
            width=2,
        )
        cy = self.y + 17
        for line in lines:
            self.draw.text((MARGIN + 25, cy), line, fill=DARK, font=CODE)
            cy += CODE.size + 9
        self.y += height + 14

    def table(self, rows, widths=(420, 860), header=False):
        row_blocks = []
        for idx, row in enumerate(rows):
            fnts = [SMALL_BOLD, SMALL] if not (header and idx == 0) else [SMALL_BOLD, SMALL_BOLD]
            left = self.wrap(row[0], fnts[0], widths[0] - 34)
            right = self.wrap(row[1], fnts[1], widths[1] - 34)
            height = max(self.text_height(left, fnts[0], 6), self.text_height(right, fnts[1], 6)) + 28
            row_blocks.append((left, right, fnts, height))
        total = sum(block[3] for block in row_blocks)
        self.ensure(total + 20)
        x0 = MARGIN
        y0 = self.y
        for idx, (left, right, fnts, height) in enumerate(row_blocks):
            fill = HEADER_FILL if header and idx == 0 else "white"
            self.draw.rectangle((x0, self.y, x0 + sum(widths), self.y + height), fill=fill, outline=GRID, width=2)
            self.draw.line((x0 + widths[0], self.y, x0 + widths[0], self.y + height), fill=GRID, width=2)
            ly = self.y + 14
            for line in left:
                self.draw.text((x0 + 17, ly), line, fill=DARK, font=fnts[0])
                ly += fnts[0].size + 6
            ry = self.y + 14
            for line in right:
                self.draw.text((x0 + widths[0] + 17, ry), line, fill=TEXT, font=fnts[1])
                ry += fnts[1].size + 6
            self.y += height
        self.y += 22
        self.draw.line((x0, y0, x0 + sum(widths), y0), fill=GRID, width=2)

    def footer_numbers(self):
        for i, page in enumerate(self.pages, start=1):
            draw = ImageDraw.Draw(page)
            draw.text((PAGE_W - MARGIN - 90, PAGE_H - 90), f"Page {i}", fill=MUTED, font=SMALL)


def build():
    b = PdfBuilder()
    b.title_block()
    b.table([
        ("Project ID", "articton-57fd8"),
        ("Frontend", "React + Vite"),
        ("Backend", "Firebase Cloud Functions"),
        ("Local AI behavior", "Uses the improved fallback tutor unless Gemini billing/key is available."),
        ("Important", "Do not commit .env, .env.local, API keys, app passwords, or Firebase secret values."),
    ])

    b.heading("1. Save the Current Device Changes")
    b.paragraph("Run these from the current project folder before moving to the new device.")
    for i, text in enumerate(["Check what changed.", "Commit the updates.", "Push the branch to GitHub."], start=1):
        b.step(i, text)
    for cmd in [
        "git status",
        "git add .",
        'git commit -m "Update tutor fallback and voice over"',
        "git push origin main",
    ]:
        b.code(cmd)

    b.heading("2. New Device Setup")
    b.bullet("Install Git, Node.js LTS, and VS Code.")
    b.bullet("Use Firebase CLI through npx so it does not need a global install.")
    b.bullet("Sign in to the Google account that has Firebase project access.")
    b.code("git clone <your-github-repo-url>")
    b.code("cd ARTICTON")
    b.paragraph("If the project already exists on the new device, use this instead:")
    b.code("git pull origin main")

    b.heading("3. Install Dependencies")
    b.code("npm install")
    b.code("cd functions")
    b.code("npm install")
    b.code("cd ..")

    b.heading("4. Recreate Frontend Env Files")
    b.paragraph("The real env files are intentionally ignored by Git, so create fresh local copies.")
    b.code("copy .env.example .env")
    b.code("VITE_FIREBASE_API_KEY=<your Firebase web api key>")
    b.code("VITE_DEV_BYPASS_LOGIN=false")
    b.paragraph("Create .env.local for local function routing:")
    b.code("VITE_USE_FUNCTIONS_EMULATOR=false")
    b.paragraph("Use false when npm run dev should call the deployed Firebase Functions. Use true only when the Functions emulator is running.")

    b.heading("5. Recreate Functions Env")
    b.paragraph("This file is only for local Functions emulator testing. Deployed Functions should use Firebase secrets.")
    b.code("copy functions\\.env.example functions\\.env")
    for line in [
        "GMAIL_USER=<sender Gmail address>",
        "GMAIL_APP_PASSWORD=<Gmail app password>",
        "OTP_HASH_SECRET=<random long secret for OTP hashing>",
    ]:
        b.code(line)

    b.heading("6. Connect Firebase CLI")
    b.code("npx -y firebase-tools@latest login")
    b.code("npx -y firebase-tools@latest use")
    b.paragraph("If articton-57fd8 is not selected, run:")
    b.code("npx -y firebase-tools@latest use articton-57fd8")

    b.heading("7. Run Local Tests")
    b.paragraph("Start the frontend and test login, OTP, module scenes, fallback tutor, and voice-over.")
    b.code("npm run dev")
    b.paragraph("Run a production build check before deployment:")
    b.code("npm run build")

    b.heading("8. Optional Functions Emulator")
    b.paragraph("Only use this if you want local function execution instead of deployed functions.")
    b.code("npx -y firebase-tools@latest emulators:start --only functions")
    b.code("VITE_USE_FUNCTIONS_EMULATOR=true")

    b.heading("9. Gemini and AI Notes")
    b.table([
        ("Without Gemini billing", "The app can still use the improved fallback tutor and browser voice-over for testing."),
        ("With Gemini later", "Set the Gemini key/secret, enable the Gemini API, and turn on the tutor flag when billing is ready."),
        ("Avoid charges now", "Keep Gemini disabled and rely on fallback tutor responses during local testing."),
        ("Deleted server folder", "The old server folder is no longer needed if Firebase Functions handles backend work."),
    ])

    b.heading("Quick Troubleshooting")
    b.table([
        ("Login says invalid account", "Confirm the account exists in the app's expected Firebase collection/Auth flow, and test OTP using the latest email only."),
        ("OTP required error", "Make sure the email value is preserved when moving from the email step to the OTP step."),
        ("AI repeats fallback text", "Expected while Gemini is disabled or rejected. Test the fallback tutor and voice-over locally."),
        ("Firebase permission issue", "Use the account with project access, billing access, and payment profile permissions as needed."),
        ("Do not deploy secrets", "Never push .env files. Use Firebase secrets for production-only sensitive values."),
    ])

    b.footer_numbers()
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for i, page in enumerate(b.pages, start=1):
        page.save(PREVIEW_DIR / f"setup-guide-page-{i}.png")
    b.pages[0].save(PDF, save_all=True, append_images=b.pages[1:], resolution=160.0)
    print(PDF)


if __name__ == "__main__":
    build()
