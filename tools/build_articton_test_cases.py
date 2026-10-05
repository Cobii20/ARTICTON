from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\Cobi\Downloads\Form J1. Sample Test Case Result.docx")
OUT = ROOT / "docs" / "ARTICTON-Test-Case-Specification-Web-Mobile.docx"


def x(value):
    return escape(str(value), {"'": "&apos;", '"': "&quot;"})


def para(lines="", *, bold=False, size=16, align="left", keep=False):
    if isinstance(lines, str):
        lines = [lines]
    ppr = [f'<w:jc w:val="{align}"/>', '<w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="auto"/>']
    if keep:
        ppr.append('<w:keepNext/>')
    runs = []
    for index, line in enumerate(lines):
        if index:
            runs.append('<w:r><w:br/></w:r>')
        runs.append(
            '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
            + ('<w:b/>' if bold else '')
            + f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/></w:rPr>'
            + f'<w:t xml:space="preserve">{x(line)}</w:t></w:r>'
        )
    return f'<w:p><w:pPr>{"".join(ppr)}</w:pPr>{"".join(runs)}</w:p>'


def cell(text, width, *, bold=False, align="left", grid_span=None, valign="center", fill=None):
    props = [f'<w:tcW w:w="{width}" w:type="dxa"/>', f'<w:vAlign w:val="{valign}"/>']
    if grid_span:
        props.append(f'<w:gridSpan w:val="{grid_span}"/>')
    if fill:
        props.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{fill}"/>')
    props.append('<w:tcMar><w:top w:w="55" w:type="dxa"/><w:left w:w="65" w:type="dxa"/><w:bottom w:w="55" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tcMar>')
    lines = text if isinstance(text, list) else str(text).split('\n')
    return f'<w:tc><w:tcPr>{"".join(props)}</w:tcPr>{para(lines, bold=bold, size=15, align=align)}</w:tc>'


def row(cells, *, header=False, cant_split=True):
    props = []
    if header:
        props.append('<w:tblHeader/>')
    if cant_split:
        props.append('<w:cantSplit/>')
    return f'<w:tr><w:trPr>{"".join(props)}</w:trPr>{"".join(cells)}</w:tr>'


def table_xml(test_cases, *, spec_title, module, objectives, platform):
    widths = [650, 1720, 2650, 1750, 2500, 1050, 650, 1050]
    total = sum(widths)
    borders = ''.join(
        f'<w:{side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>'
        for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')
    )
    rows = [
        row([cell(spec_title, total, bold=True, align='center', grid_span=8)], cant_split=True),
        row([
            cell('Designed by:\nARTICTON Development Team', sum(widths[:4]), grid_span=4),
            cell(f'Module:\n{module}', sum(widths[4:]), grid_span=4),
        ]),
        row([
            cell(f'Objectives:\n{objectives}', sum(widths[:4]), grid_span=4),
            cell(f'Test Platform:\n{platform}', sum(widths[4:]), grid_span=4),
        ]),
        row([
            cell('Test Case #', widths[0], bold=True, align='center', fill='D9EAF7'),
            cell('Description', widths[1], bold=True, align='center', fill='D9EAF7'),
            cell('Test Steps', widths[2], bold=True, align='center', fill='D9EAF7'),
            cell('Test Data', widths[3], bold=True, align='center', fill='D9EAF7'),
            cell('Expected Results', widths[4], bold=True, align='center', fill='D9EAF7'),
            cell('Actual Results', widths[5], bold=True, align='center', fill='D9EAF7'),
            cell('Pass/ Fail', widths[6], bold=True, align='center', fill='D9EAF7'),
            cell('Performed by / Date', widths[7], bold=True, align='center', fill='D9EAF7'),
        ], header=True),
    ]
    for case in test_cases:
        rows.append(row([
            cell(case[0], widths[0], bold=True, align='center'),
            cell(case[1], widths[1]),
            cell(case[2], widths[2]),
            cell(case[3], widths[3]),
            cell(case[4], widths[4]),
            cell('', widths[5]),
            cell('', widths[6]),
            cell('', widths[7]),
        ]))
    return (
        '<w:tbl><w:tblPr><w:tblW w:w="12020" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
        f'<w:tblBorders>{borders}</w:tblBorders>'
        '<w:tblCellMar><w:top w:w="55" w:type="dxa"/><w:left w:w="65" w:type="dxa"/>'
        '<w:bottom w:w="55" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tblCellMar></w:tblPr>'
        '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths) + '</w:tblGrid>'
        + ''.join(rows) + '</w:tbl>'
    )


GENERAL_CASES = [
    ('G-01', 'Authenticate shared user accounts',
     '1. Attempt login on web and mobile using the same valid account.\n2. Repeat with an incorrect password and an unknown account.',
     'Registered account\nCorrect password\nIncorrect password',
     'Both clients accept the valid credentials and reject invalid credentials without creating a session. Error messages remain clear and consistent.'),
    ('G-02', 'Apply role-based access across both clients',
     '1. Sign in as student, faculty/staff, and administrator on each supported client.\n2. Review the landing view and available actions.',
     'Student, faculty/staff, and administrator accounts',
     'Each role reaches only its authorized dashboard and tools. Restricted actions are hidden or denied on both platforms.'),
    ('G-03', 'Restore and terminate sessions safely',
     '1. Sign in on each client.\n2. Restart/refresh the client and verify session restoration.\n3. Sign out and attempt to reopen a protected view.',
     'Any valid account',
     'An active valid session is restored. Signing out clears access, returns to authentication, and prevents protected data from reopening.'),
    ('G-04', 'Synchronize profile information',
     '1. Update an allowed profile field.\n2. Save the change.\n3. Open the same account on the other client.',
     'Valid first name, last name, and supported profile values',
     'The saved profile belongs only to the current user and the same authoritative value appears on web and mobile.'),
    ('G-05', 'Synchronize assessment and progress records',
     '1. Complete a supported assessment on one client.\n2. Open the progress/dashboard view on the other client.\n3. Compare score, status, and completion.',
     'Shared student account\nSupported module assessment',
     'The server stores one authoritative result and both clients show matching score, pass/fail state, and progress without duplicate credit.'),
    ('G-06', 'Publish approved learning content to both clients',
     '1. Submit a module or question change as faculty.\n2. Approve it as administrator.\n3. Open the affected content on web and mobile.',
     'Valid change request and administrator approval',
     'Only approved content is published, and both clients load the same current revision while rejected/stale requests do not publish.'),
    ('G-07', 'Protect private and administrative data',
     '1. Attempt to read or modify another user\'s private data as a student.\n2. Attempt an admin-only operation.\n3. Repeat the intended operation with an authorized role.',
     'Student and administrator accounts',
     'Unauthorized reads/writes are denied on both platforms; authorized operations succeed and expose only the fields required for the workflow.'),
    ('G-08', 'Submit and manage shared support requests',
     '1. Submit a valid support request from an available student client.\n2. Open the admin support queue on web.\n3. Change its status.',
     'Name, email, subject, message, optional screenshot',
     'One ticket is created through the approved workflow, appears in the admin queue, and moves from Open to In progress to Resolved.'),
]


WEB_CASES = [
    ('W-01', 'Log in with valid and invalid credentials',
     '1. Open ARTICTON.\n2. Enter a registered student email and correct password.\n3. Select Login.\n4. Log out, then repeat with an incorrect password.',
     'Registered student account\nCorrect password\nIncorrect password',
     'Valid credentials open the student dashboard. Invalid credentials do not create a session and display a clear error message.'),
    ('W-02', 'Route users according to role',
     '1. Log in separately as student, faculty/staff, and administrator.\n2. Observe the first page and available navigation for each account.',
     'One active account for each supported role',
     'Student opens the learning dashboard; faculty/staff opens faculty tools; administrator opens the admin dashboard. Unauthorized tools are not shown.'),
    ('W-03', 'Sign out and protect the session',
     '1. Log in.\n2. Select Logout.\n3. Attempt to return to the previous protected view using browser navigation.',
     'Any valid user account',
     'The session ends, the landing/login view appears, and protected data cannot be used without signing in again.'),
    ('W-04', 'Open Module 1 and record learning progress',
     '1. From the student dashboard, open Module 1.\n2. Review hardware content and complete available parts.\n3. Return to the dashboard and reopen the module.',
     'Student account with Module 1 access',
     'Module 1 loads correctly, completed content is saved, dashboard progress updates, and the student can resume the latest visit.'),
    ('W-05', 'Use guided assembly for AMD and Intel',
     '1. Open Module 2.\n2. Select AMD and follow the ordered assembly steps.\n3. Repeat with Intel.\n4. Try advancing with a prerequisite incomplete.',
     'Student account\nAMD and Intel platform selections',
     'The correct 3D models and platform-specific sequence appear. Completed steps persist, and prerequisite rules prevent an invalid sequence.'),
    ('W-06', 'Use guided disassembly for AMD and Intel',
     '1. Open Module 3.\n2. Select each platform in turn.\n3. Follow the removal sequence and attempt one out-of-order action.',
     'Student account\nAMD and Intel platform selections',
     'The correct removal sequence is shown, valid actions advance progress, and an out-of-order action gives feedback without corrupting saved progress.'),
    ('W-07', 'Complete a module quiz and store the score',
     '1. Open an available module quiz.\n2. Answer all questions.\n3. Submit the quiz.\n4. Refresh the dashboard.',
     'Student account\nKnown correct and incorrect answers',
     'The quiz is scored once, the result and completion state are saved, and the dashboard/admin summary shows the same score.'),
    ('W-08', 'Complete an assembly practical in the correct order',
     '1. Open an AMD or Intel full assembly practical.\n2. Place all components in the required sequence.\n3. Finish the assessment.',
     'Student account\nCorrect shared assembly sequence',
     'The checklist advances, completion reaches 100%, deductions are zero, and a score of at least 75% is marked Passed and saved.'),
    ('W-09', 'Score sequence errors in an assembly practical',
     '1. Start a full assembly practical.\n2. Select a component before its prerequisite.\n3. Continue and finish the assessment.',
     'Student account\nAt least one intentional order error',
     'The system records an order mistake, applies the configured capped deduction, shows feedback, and determines Passed/Failed from the final unrounded score.'),
    ('W-10', 'Complete a disassembly practical',
     '1. Open an AMD or Intel full disassembly practical.\n2. Remove parts in the required order.\n3. Finish and return to the dashboard.',
     'Student account\nCorrect shared disassembly sequence',
     'The correct sequence is enforced, the final score and elapsed time are stored, and the completed practical appears on the dashboard.'),
    ('W-11', 'Display student progress to faculty/admin',
     '1. Sign in as faculty or administrator.\n2. Open the student monitoring area.\n3. Search/select a student with quiz and practical records.',
     'Faculty/admin account\nStudent with saved progress',
     'The authorized user can view the student\'s supported module, quiz, and practical summaries; private profile fields are not exposed unnecessarily.'),
    ('W-12', 'Submit and review a module content change',
     '1. Sign in as faculty.\n2. Edit supported module content and submit a summary.\n3. Sign in as administrator.\n4. Approve or reject the request.',
     'Faculty account\nAdministrator account\nValid change summary',
     'The request enters the admin approval queue. Approval updates published content; rejection preserves approved content and records the decision.'),
    ('W-13', 'Manage question-bank content with role restrictions',
     '1. Sign in as faculty/staff and create or edit a supported question.\n2. Confirm the saved item.\n3. Attempt the same operation as a student.',
     'Faculty/staff account\nStudent account\nValid question and choices',
     'Authorized staff can save valid question data. Student write attempts are denied and do not modify the question bank.'),
    ('W-14', 'Submit and process a support ticket',
     '1. As a student, submit a valid support request.\n2. As an administrator, locate it by search/filter.\n3. Change status from Open to In progress to Resolved.',
     'Name, email, subject, message\nOptional screenshot',
     'The ticket is created through the approved workflow, visible to the administrator, searchable, and its status updates without altering protected ticket content.'),
    ('W-15', 'Save user settings and profile changes',
     '1. Open Settings/Profile.\n2. Change allowed preferences and profile fields.\n3. Save, refresh, and sign in again.',
     'Valid display/profile values and user preferences',
     'Allowed values persist across refresh and sign-in, invalid values are rejected, and changes affect only the current user.'),
    ('W-16', 'Use the procedure assistant safely',
     '1. Open a supported module or practical.\n2. Ask a relevant procedural question.\n3. Ask an unrelated or unsafe question.\n4. Test voice-over when available.',
     'Relevant hardware question\nUnrelated/unsafe prompt',
     'The assistant gives contextual learning guidance, avoids enabling unsafe actions or revealing answers improperly, handles fallback mode, and voice-over reads the response when enabled.'),
]


MOBILE_CASES = [
    ('M-01', 'Restore a mobile session from the splash screen',
     '1. Sign in and close the application.\n2. Reopen the application with the account still authenticated.\n3. Repeat after signing out.',
     'Android/iOS device or emulator\nValid student account',
     'The splash screen restores a valid server-backed profile and opens the correct account scope. After sign-out, it opens the login flow.'),
    ('M-02', 'Use responsive mobile navigation',
     '1. Open the student dashboard in portrait.\n2. Navigate through Dashboard, Modules, Exams, and Profile.\n3. Rotate to landscape or use a wide device.',
     'Phone and tablet/wide emulator',
     'Portrait uses the bottom navigation bar; wide/landscape uses the navigation rail. The selected page and readable layout remain stable.'),
    ('M-03', 'Open all four learning modules',
     '1. Open Modules.\n2. Visit Module 1: PC Parts, Module 2: Disassembly, Module 3: Assembly, and Module 4: Software & Networking.\n3. Review approved lesson cards.',
     'Authenticated student\nPublished or starter content',
     'Each module displays its correct title and content. Approved content is preferred, and the app remains usable when starter content is used.'),
    ('M-04', 'Start a supported pre-test or post-test',
     '1. Open a module pre-test or post-test.\n2. Start the assessment.\n3. Verify question text and two to four options.\n4. Attempt an unsupported assessment ID.',
     'One of the eight module assessment IDs\nUnsupported ID',
     'Supported assessments create a server attempt with valid questions. Unsupported IDs are rejected before a callable request is made.'),
    ('M-05', 'Submit assessment answers and calculate results',
     '1. Answer every question.\n2. Submit the attempt.\n3. Compare correct count, total, percentage, and pass state.\n4. Try an answer index outside 0-3.',
     'Valid attempt ID\nValid answer map\nInvalid answer index',
     'The server result is shown and clamped to 0-100. Invalid answer indexes are rejected. A module post-test reaches Passed at 70% or higher.'),
    ('M-06', 'Complete guided module content',
     '1. Finish the guided content for a module.\n2. Trigger completion.\n3. Return to the dashboard and reopen progress.',
     'Authenticated owner account\nSupported module ID',
     'Completion is sent through the protected completeGuidedModule callable and the dashboard reflects the saved content component for that user.'),
    ('M-07', 'Calculate module and overall progress',
     '1. Complete a pre-test, module content, and post-test.\n2. Open Dashboard and Profile.\n3. Compare displayed module and overall percentages.',
     'Student with saved module_scores records',
     'Progress uses 20% pre-test, 50% content completion, and 30% post-test percentage. The overall value is the rounded average of four modules.'),
    ('M-08', 'Open mobile practice exams under the configured gate',
     '1. Open Exams below and above 70% overall progress.\n2. Test Practice Exam 1 and Practice Exam 2.\n3. Repeat with the development bypass setting noted.',
     'Student progress below/above 70%\nDevelopment and production configurations',
     'Production configuration locks exams below 70% and unlocks them at 70%. The current development bypass permits testing and is clearly treated as non-production behavior.'),
    ('M-09', 'Edit profile, submit support, and sign out',
     '1. Open Profile.\n2. Save valid profile changes.\n3. Submit a support request.\n4. Sign out.',
     'Valid profile fields\nSupport subject and message',
     'Profile changes save for the current account, the support request is accepted, and sign-out clears navigation history and returns to login.'),
    ('M-10', 'Switch theme and preserve readable UI',
     '1. Switch between light and dark modes.\n2. Navigate across Dashboard, Modules, Exams, and Profile.\n3. Restart the app.',
     'Phone and tablet/wide emulator',
     'Theme selection applies consistently, text and controls remain readable, and the selected mode persists according to the theme controller.'),
    ('M-11', 'Use faculty mobile content and question editors',
     '1. Sign in as faculty/staff.\n2. Draft a supported module change.\n3. Edit valid question content.\n4. Submit both for approval.',
     'Faculty/staff account\nValid cards, summary, questions, options, answers, and explanations',
     'Valid requests are saved for admin review; incomplete or invalid assessment data is rejected and does not publish directly.'),
    ('M-12', 'Review mobile approval queues as administrator',
     '1. Sign in as administrator.\n2. Open module and question approvals.\n3. Approve one current request and reject another.',
     'Administrator account\nPending current requests',
     'Approved content becomes the published revision, rejected content remains unpublished, and stale/already-reviewed requests cannot overwrite newer data.'),
]


def build():
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    page_break = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    body = table_xml(
        GENERAL_CASES,
        spec_title='Test Specification - 01: General Modules (Web and Mobile)',
        module='Shared Authentication, Accounts, Content, Progress, Security, and Support',
        objectives='Verify workflows and authoritative data shared by the ARTICTON web and mobile systems.',
        platform='Google Chrome / Microsoft Edge and Android / iOS devices or emulators',
    )
    body += page_break
    body += table_xml(
        WEB_CASES,
        spec_title='Test Specification - 02: Web Application Test Cases',
        module='ARTICTON Web Learning and 3D Practical Assessment System',
        objectives='Verify web-specific learning, 3D simulation, practical scoring, administration, and faculty workflows.',
        platform='Google Chrome and Microsoft Edge (current desktop versions)',
    )
    body += page_break
    body += table_xml(
        MOBILE_CASES,
        spec_title='Test Specification - 03: Mobile Application Test Cases',
        module='ARTICTON Flutter Mobile Learning and Assessment Application',
        objectives='Verify mobile navigation, four learning modules, server-backed assessments, progress, practice exams, and role tools.',
        platform='Android and iOS phone/tablet devices or emulators',
    )
    body += para('Execution note: Complete the final three columns during the formal test run. Record evidence or defect IDs in Actual Results when a case fails.', size=14)
    section = ('<w:sectPr><w:pgSz w:w="16839" w:h="11907" w:orient="landscape" w:code="9"/>'
               '<w:pgMar w:top="851" w:right="720" w:bottom="794" w:left="720" w:header="709" w:footer="709" w:gutter="0"/>'
               '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>')
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                f'<w:body>{body}{section}</w:body></w:document>')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(SOURCE, 'r') as src, ZipFile(OUT, 'w', ZIP_DEFLATED) as dst:
        for item in src.infolist():
            if item.filename == 'word/document.xml':
                dst.writestr(item, document.encode('utf-8'))
            else:
                dst.writestr(item, src.read(item.filename))
    print(OUT)


if __name__ == '__main__':
    build()
