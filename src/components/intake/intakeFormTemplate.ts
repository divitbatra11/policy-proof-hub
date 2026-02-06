export interface IntakeFormData {
  projectName: string;
  overviewBackground: string;
  objectives: string[];
  keyDates: {
    personRequesting: string;
    requestReceivedDate: string;
    targetEstimatedTime: string;
    targetCompletionDate: string;
  };
  leadContributors: { name: string; role: string }[];
  plannerBucket: string;
  dependenciesText: string;
  evaluationRows: { col1: string; col2: string }[];
}

export const EMPTY_INTAKE_FORM: IntakeFormData = {
  projectName: "",
  overviewBackground: "",
  objectives: ["", ""],
  keyDates: {
    personRequesting: "",
    requestReceivedDate: "",
    targetEstimatedTime: "",
    targetCompletionDate: "",
  },
  leadContributors: [{ name: "", role: "" }, { name: "", role: "" }],
  plannerBucket: "",
  dependenciesText: "",
  evaluationRows: [{ col1: "", col2: "" }, { col1: "", col2: "" }],
};

const HEADER_BG = "#D9D9D9";
const BORDER = "1px solid #000";
const CELL = `border: ${BORDER}; padding: 6px 8px; font-family: Calibri, sans-serif; font-size: 13pt; vertical-align: top;`;
const TH = `${CELL} background-color: ${HEADER_BG}; font-weight: bold;`;
const TABLE_OPEN = `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; width: 100%; table-layout: fixed; margin: 6px 0 16px 0;">`;

export function generateIntakeFormHtml(data: IntakeFormData): string {
  const objectivesHtml = data.objectives
    .map(
      (obj) =>
        `<p style="margin: 4px 0 4px 36px; font-family: Calibri, sans-serif; font-size: 13pt;">&#9633;&nbsp;&nbsp;${obj || "&nbsp;"}</p>`
    )
    .join("\n");

  const contributorsHtml = data.leadContributors
    .map(
      (c) => `
      <tr>
        <td style="${CELL}">${c.name || "&nbsp;"}</td>
        <td style="${CELL}">${c.role || "&nbsp;"}</td>
      </tr>`
    )
    .join("\n");

  const evaluationHtml = data.evaluationRows
    .map(
      (r) => `
      <tr>
        <td style="${CELL}">${r.col1 || "&nbsp;"}</td>
        <td style="${CELL}">${r.col2 || "&nbsp;"}</td>
      </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Project Intake Form - ${data.projectName || "Untitled"}</title>
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 13pt;
      line-height: 1.4;
      padding: 20px 60px;
      max-width: 850px;
      margin: 0 auto;
      color: #000;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
      margin: 6px 0 16px 0;
    }
    h1 {
      font-family: Calibri, sans-serif;
      font-size: 15pt;
      font-weight: bold;
      text-align: center;
      margin: 12px 0 16px 0;
    }
    h2 {
      font-family: Calibri, sans-serif;
      font-size: 15pt;
      font-weight: bold;
      margin: 16px 0 4px 0;
    }
    p {
      font-family: Calibri, sans-serif;
      font-size: 13pt;
      margin: 4px 0;
    }
    ol {
      margin: 4px 0;
      padding-left: 28px;
      font-family: Calibri, sans-serif;
      font-size: 13pt;
    }
    ol li {
      list-style-type: decimal;
      margin: 3px 0;
      font-family: Calibri, sans-serif;
      font-size: 13pt;
    }
  </style>
</head>
<body>

  <h1 style="text-align: center; font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Intake Form</h1>

  <!-- Project Name -->
  <p><h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Project Name:</h1> ${data.projectName || ""}</p>

  <!-- Overview / Background -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Overview / Background</h1>
  <p>${data.overviewBackground || ""}</p>

  <!-- Purpose / Deliverable -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Purpose / Deliverable (<em>Specific Objectives</em>):</h1>
  ${objectivesHtml}

  <!-- Key Dates -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Key Dates</h1>
  ${TABLE_OPEN}
    <colgroup>
      <col width="22%" />
      <col width="56%" />
      <col width="22%" />
    </colgroup>
    <tr>
      <th style="${TH}">Stage</th>
      <th style="${TH}">Update</th>
      <th style="${TH}">Date</th>
    </tr>
    <tr>
      <td style="${CELL}"><strong>Request Received</strong></td>
      <td style="${CELL}">Person(s) requesting: ${data.keyDates.personRequesting || ""}</td>
      <td style="${CELL}">${data.keyDates.requestReceivedDate || ""}</td>
    </tr>
    <tr>
      <td style="${CELL}"><strong>Assigned</strong></td>
      <td style="${CELL}">&nbsp;</td>
      <td style="${CELL}">&nbsp;</td>
    </tr>
    <tr>
      <td style="${CELL}"><strong>Target Completion</strong></td>
      <td style="${CELL}">Estimated time required (In days or weeks): ${data.keyDates.targetEstimatedTime || ""}</td>
      <td style="${CELL}">${data.keyDates.targetCompletionDate || ""}</td>
    </tr>
  </table>

  <!-- Lead Contributors -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Lead Contributors</h1>
  ${TABLE_OPEN}
    <colgroup>
      <col width="50%" />
      <col width="50%" />
    </colgroup>
    <tr>
      <th style="${TH}">Name</th>
      <th style="${TH}">Role</th>
    </tr>
    ${contributorsHtml}
  </table>

  <!-- Dependencies / Considerations -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Dependencies/ Considerations (if applicable)</h1>
  <p style="font-style: italic; font-size: 13pt; color: #444; margin-bottom: 8px;">List any barriers, competing priorities, or required decisions. (Example: &ldquo;Pending access to ORCA data; potential delay if unavailable by Wednesday.&rdquo;)</p>
  <p style="margin: 4px 0 4px 36px; font-family: Calibri, sans-serif; font-size: 13pt;">&#9633;&nbsp;&nbsp;Planner Bucket: ${data.plannerBucket || ""}</p>
  <p style="margin: 4px 0 4px 36px; font-family: Calibri, sans-serif; font-size: 13pt;">&#9633;&nbsp;&nbsp;${data.dependenciesText || ""}</p>

  <!-- Communications Plan/Roll-Out -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Communications Plan/Roll-Out</h1>
  <p style="font-weight: bold; font-size: 13pt; margin-bottom: 4px;">PPDU Change Management &amp; Communications Process</p>
  <ol>
    <li><strong>Early Engagement</strong> &ndash; Involve staff in the drafting of new policies or initiatives through toolkits, focus groups, or project teams.</li>
    <li><strong>Director Feedback</strong> &ndash; Present proposed changes at <em>Decisions and More</em> meetings for Director-level input.</li>
    <li><strong>Manager Feedback</strong> &ndash; Share updates at <em>Leadership Exchange</em> meetings to gather feedback from Managers.</li>
    <li><strong>Supervisor/Coach Feedback</strong> &ndash; Communicate changes at <em>Provincial Coaching Calls</em> to engage Supervisors and Peer Coaches.</li>
    <li><strong>Formal Publication</strong> &ndash; Issue finalized changes through memos and/or highlight them during <strong>Policy Week</strong> (three times annually).</li>
    <li><strong>Staff Engagement</strong> &ndash; Host <strong>Town Halls</strong> to inform all CCB staff, ensuring recordings are available on SharePoint for later access.</li>
    <li><strong>Deeper Dialogue</strong> &ndash; Provide <strong>virtual open houses</strong> for Leadership and staff on key topics to allow time for discussion, reflection, and addressing emerging questions.</li>
  </ol>

  <!-- Evaluation/Monitor & Control -->
  <h1 style="font-family: Calibri, sans-serif; font-size: 15pt; font-weight: bold; margin: 12px 0 16px 0;">Evaluation/Monitor &amp; Control</h1>
  ${TABLE_OPEN}
    <colgroup>
      <col width="50%" />
      <col width="50%" />
    </colgroup>
    ${evaluationHtml}
  </table>

</body>
</html>`;
}
