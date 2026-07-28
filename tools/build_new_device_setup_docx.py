from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "ARTICTON-New-Device-Setup-Guide.docx"


def x(text):
    return escape(text, {"'": "&apos;", '"': "&quot;"})


def run(text, bold=False, color=None, font="Calibri", size=22):
    props = []
    if bold:
        props.append("<w:b/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    props.append(f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}"/>')
    props.append(f'<w:sz w:val="{size}"/>')
    return f"<w:r><w:rPr>{''.join(props)}</w:rPr><w:t>{x(text)}</w:t></w:r>"


def para(text="", style=None, num=None, code=False, before=None, after=None):
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if num:
        ppr.append(
            f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{num}"/></w:numPr>'
        )
    spacing = []
    if before is not None:
        spacing.append(f'w:before="{before}"')
    if after is not None:
        spacing.append(f'w:after="{after}"')
    if spacing:
        spacing.append('w:line="300" w:lineRule="auto"')
        ppr.append(f"<w:spacing {' '.join(spacing)}/>")
    if code:
        ppr.append(
            '<w:shd w:val="clear" w:color="auto" w:fill="F4F6F9"/>'
            '<w:ind w:left="180" w:right="180"/>'
        )
        return (
            f"<w:p><w:pPr>{''.join(ppr)}</w:pPr>"
            f'{run(text, font="Consolas", size=19)}</w:p>'
        )
    return f"<w:p><w:pPr>{''.join(ppr)}</w:pPr>{run(text)}</w:p>"


def heading(text, level=1):
    return para(text, style=f"Heading{level}")


def bullet(text):
    return para(text, num="2")


def step(text):
    return para(text, num="1")


def cell(text, width, bold=False, fill=None):
    shade = f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>' if fill else ""
    return (
        "<w:tc>"
        f'<w:tcPr><w:tcW w:w="{width}" w:type="dxa"/>{shade}'
        '<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>'
        '<w:start w:w="120" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar>'
        "</w:tcPr>"
        f"<w:p><w:pPr><w:spacing w:after=\"60\" w:line=\"300\" w:lineRule=\"auto\"/></w:pPr>"
        f"{run(text, bold=bold)}</w:p>"
        "</w:tc>"
    )


def table(rows, widths=(2700, 6660), header=False):
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    trs = []
    for idx, row in enumerate(rows):
        fill = "E8EEF5" if header and idx == 0 else None
        trs.append(
            "<w:tr>"
            + "".join(cell(value, widths[i], bold=(header and idx == 0) or i == 0, fill=fill) for i, value in enumerate(row))
            + "</w:tr>"
        )
    return (
        '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>'
        '<w:tblW w:w="9360" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblLayout w:type="fixed"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/>'
        '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/>'
        '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/></w:tblBorders>'
        '</w:tblPr><w:tblGrid>'
        + grid
        + "</w:tblGrid>"
        + "".join(trs)
        + "</w:tbl>"
    )


def page_break():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


body = []
body.append(para("ARTICTON New Device Setup Guide", style="Title", after=80))
body.append(para("GitHub pull, local environment recreation, Firebase setup, and local testing", style="Subtitle"))
body.append(para("Prepared for moving the project to a new device when local .env files are missing.", after=120))
body.append(table([
    ("Project ID", "articton-57fd8"),
    ("Frontend", "React + Vite"),
    ("Backend", "Firebase Cloud Functions"),
    ("Local AI behavior", "Uses the improved fallback tutor unless Gemini billing/key is available."),
    ("Important", "Do not commit .env, .env.local, API keys, app passwords, or Firebase secret values."),
]))

body.append(heading("1. Save the Current Device Changes", 1))
body.append(para("Run these from the project folder before moving to the new device. This makes GitHub the clean handoff point."))
for item in [
    "Check what changed.",
    "Commit the updates.",
    "Push the branch to GitHub.",
]:
    body.append(step(item))
for cmd in [
    "git status",
    "git add .",
    'git commit -m "Update tutor fallback and voice over"',
    "git push origin main",
]:
    body.append(para(cmd, code=True, after=80))

body.append(heading("2. Install Tools on the New Device", 1))
body.append(bullet("Install Git, Node.js LTS, and VS Code."))
body.append(bullet("Use Firebase CLI through npx so it does not need a global install."))
body.append(bullet("Sign in to the same Google account that has access to the Firebase project."))

body.append(heading("3. Clone or Pull the Project", 1))
body.append(para("If the project is not on the new device yet:"))
body.append(para("git clone <your-github-repo-url>", code=True, after=80))
body.append(para("cd ARTICTON", code=True, after=80))
body.append(para("If the project already exists on the new device:"))
body.append(para("git pull origin main", code=True, after=80))

body.append(heading("4. Install Dependencies", 1))
body.append(para("Install the frontend packages first, then the Cloud Functions packages."))
body.append(para("npm install", code=True, after=80))
body.append(para("cd functions", code=True, after=80))
body.append(para("npm install", code=True, after=80))
body.append(para("cd ..", code=True, after=80))

body.append(page_break())
body.append(heading("5. Recreate the Frontend Environment Files", 1))
body.append(para("The real env files are intentionally ignored by Git, so make fresh ones from the examples."))
body.append(para("copy .env.example .env", code=True, after=80))
body.append(para("Open .env and fill in the Firebase Web API key:"))
body.append(para("VITE_FIREBASE_API_KEY=<your Firebase web api key>", code=True, after=80))
body.append(para("VITE_DEV_BYPASS_LOGIN=false", code=True, after=80))
body.append(para("Create .env.local for local behavior:"))
body.append(para("VITE_USE_FUNCTIONS_EMULATOR=false", code=True, after=80))
body.append(para("Use false when you want npm run dev to call the deployed Firebase Functions. Use true only when the Functions emulator is running."))

body.append(heading("6. Recreate the Functions Environment File", 1))
body.append(para("This file is only for local Functions emulator testing. Deployed Functions should use Firebase secrets."))
body.append(para("copy functions\\.env.example functions\\.env", code=True, after=80))
body.append(para("Fill these values only on your machine:"))
for line in [
    "GMAIL_USER=<sender Gmail address>",
    "GMAIL_APP_PASSWORD=<Gmail app password>",
    "OTP_HASH_SECRET=<random long secret for OTP hashing>",
]:
    body.append(para(line, code=True, after=60))

body.append(heading("7. Connect Firebase CLI", 1))
body.append(para("Log in and confirm the project alias points to ARTICTION."))
body.append(para("npx -y firebase-tools@latest login", code=True, after=80))
body.append(para("npx -y firebase-tools@latest use", code=True, after=80))
body.append(para("If articton-57fd8 is not selected, run:"))
body.append(para("npx -y firebase-tools@latest use articton-57fd8", code=True, after=80))

body.append(heading("8. Run Local Tests", 1))
body.append(para("Start the frontend and test login, OTP, module scenes, fallback tutor, and voice-over."))
body.append(para("npm run dev", code=True, after=80))
body.append(para("Then run a production build check before deployment:"))
body.append(para("npm run build", code=True, after=80))

body.append(heading("9. Optional: Functions Emulator", 1))
body.append(para("Only use this if you want local function execution instead of deployed functions."))
body.append(para("npx -y firebase-tools@latest emulators:start --only functions", code=True, after=80))
body.append(para("Then set this in .env.local while the emulator is running:"))
body.append(para("VITE_USE_FUNCTIONS_EMULATOR=true", code=True, after=80))

body.append(heading("10. Gemini and AI Notes", 1))
body.append(table([
    ("Without Gemini billing", "The app can still use the improved fallback tutor and browser voice-over for testing."),
    ("With Gemini later", "Set the Gemini key/secret, enable the Gemini API, and turn on the tutor flag when billing is ready."),
    ("Avoid charges now", "Keep Gemini disabled and rely on fallback tutor responses during local testing."),
    ("Deleted server folder", "The old server folder is no longer needed if Firebase Functions now handles backend work."),
]))

body.append(heading("Quick Troubleshooting", 1))
body.append(table([
    ("Login says invalid account", "Confirm the account exists in the app's expected Firebase collection/Auth flow, and test OTP using the latest email only."),
    ("OTP required error", "Make sure the email value is preserved when moving from the email step to the OTP step."),
    ("AI repeats fallback text", "That is expected while Gemini is disabled or rejected. Test the fallback tutor and voice-over locally."),
    ("Firebase permission issue", "Use the account with project access, billing access, and payment profile permissions as needed."),
    ("Do not deploy secrets", "Never push .env files. Use Firebase secrets for production-only sensitive values."),
], widths=(2600, 6760)))

document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
{''.join(body)}
<w:sectPr>
<w:headerReference w:type="default" r:id="rId1"/>
<w:footerReference w:type="default" r:id="rId2"/>
<w:pgSz w:w="12240" w:h="15840"/>
<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
<w:cols w:space="720"/>
</w:sectPr>
</w:body>
</w:document>'''

styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="0" w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="0B2545"/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="666666"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="360" w:after="200" w:line="300" w:lineRule="auto"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="140" w:line="300" w:lineRule="auto"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="100" w:line="300" w:lineRule="auto"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="1F4D78"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="D9E2EC"/></w:tblBorders></w:tblPr></w:style>
</w:styles>'''

numbering_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="270"/><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>'''

header_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="D9E2EC"/></w:pBdr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr><w:t>ARTICTON setup guide</w:t></w:r></w:p></w:hdr>'''

footer_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr><w:t>Page </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>'''

rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

doc_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>'''

content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>'''

OUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUT, "w", ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types_xml)
    z.writestr("_rels/.rels", rels_xml)
    z.writestr("word/document.xml", document_xml)
    z.writestr("word/styles.xml", styles_xml)
    z.writestr("word/numbering.xml", numbering_xml)
    z.writestr("word/header1.xml", header_xml)
    z.writestr("word/footer1.xml", footer_xml)
    z.writestr("word/_rels/document.xml.rels", doc_rels_xml)

print(OUT)
