// 간단한 CSV 파서 (콤마/줄바꿈이 따옴표 안에 포함된 경우도 처리)
function parseCSV(text) {
  // BOM 제거
  text = text.replace(/^\uFEFF/, '');

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        // skip
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// CSV 텍스트(Date,User,Message)를 대화 형식 텍스트로 변환하면서 특정 월만 필터링
function csvToFilteredDialogue(csvText, targetMonth) {
  const rows = parseCSV(csvText);
  if (rows.length === 0) return '';

  // 헤더 위치 확인
  const header = rows[0].map(h => h.trim().toLowerCase());
  const dateIdx = header.indexOf('date');
  const userIdx = header.indexOf('user');
  const msgIdx = header.indexOf('message');

  // 헤더를 못 찾으면 기본 0,1,2번 컬럼으로 가정
  const dIdx = dateIdx >= 0 ? dateIdx : 0;
  const uIdx = userIdx >= 0 ? userIdx : 1;
  const mIdx = msgIdx >= 0 ? msgIdx : 2;

  const lines = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;

    const dateStr = (r[dIdx] || '').trim();
    const user = (r[uIdx] || '').trim();
    const message = (r[mIdx] || '').trim();

    if (!dateStr || !message) continue;

    // 날짜에서 월 추출 (형식: YYYY-MM-DD HH:MM:SS)
    const match = dateStr.match(/^\d{4}-(\d{2})-\d{2}/);
    if (!match) continue;

    const month = parseInt(match[1], 10);
    if (targetMonth && month !== targetMonth) continue;

    lines.push(`[${dateStr}] ${user}: ${message}`);
  }

  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { logText, studentName, targetMonth, isCSV } = req.body;

  if (!logText || !studentName) {
    return res.status(400).json({ error: '필수 파라미터가 없습니다.' });
  }

  let processedText = logText;
  let filteredCount = null;

  if (isCSV) {
    processedText = csvToFilteredDialogue(logText, targetMonth ? parseInt(targetMonth, 10) : null);
    filteredCount = processedText ? processedText.split('\n').length : 0;

    if (!processedText || processedText.trim().length === 0) {
      return res.status(200).json({
        응답속도정확성: { 등급: '하', 이유: `${targetMonth}월에 해당하는 대화 기록이 없어 평가할 수 없습니다.` },
        주도적안내격려: { 등급: '하', 이유: `${targetMonth}월에 해당하는 대화 기록이 없어 평가할 수 없습니다.` },
        피드백구체성: { 등급: '하', 이유: `${targetMonth}월에 해당하는 대화 기록이 없어 평가할 수 없습니다.` },
        정서적지지동기: { 등급: '하', 이유: `${targetMonth}월에 해당하는 대화 기록이 없어 평가할 수 없습니다.` },
      });
    }
  }

  const CRITERIA = `
[평가 기준 - 카카오톡 소통 및 관리]

1. 응답속도·정확성
 상: 평균 응답 2시간 이내 (10~22시 기준), 답변이 질문 의도를 정확히 파악하고 실용적 정보 제공
 중: 응답이 대체로 4시간 이내, 답변 품질은 보통 수준 (일부 모호하거나 간략한 답변 있음)
 하: 응답이 자주 늦거나 누락, 답변이 부정확하거나 핵심을 벗어남

2. 주도적 안내·격려 빈도
 상: 주 3회 이상 학생이 묻지 않아도 먼저 맞춤 공지·격려·리마인드를 제공함
 중: 주 1~2회 정도 먼저 안내하거나, 격려가 다소 공식적·형식적임
 하: 거의 학생 질문에만 반응하며 먼저 안내하는 경우가 드뭄

3. 피드백 구체성
 상: 생기부 활동, 수행평가, 과목별 상황에 맞춘 구체적이고 실행 가능한 피드백 제공
 중: 피드백은 있으나 일반적·추상적인 내용이 많고, 구체적 방향 제시가 부족한 경우가 있음
 하: 피드백이 단순 확인 수준이거나 매우 짧고 추상적임

4. 정서적 지지·동기부여
 상: 학생의 감정 상태를 파악하고 공감하며, 긍정적 동기부여와 칭찬·격려가 자연스럽게 이루어짐
 중: 기본적인 격려는 있으나 다소 형식적이거나, 학생 상황에 맞는 세심한 지지가 부족함
 하: 정서적 표현이 거의 없거나, 업무적·딱딱한 소통 위주임
`;

  const monthNote = targetMonth
    ? `\n\n중요: 아래 대화로그는 이미 ${targetMonth}월 대화만 필터링된 내용입니다. 이 기간의 소통만을 기준으로 평가하세요.`
    : '';

  const SYSTEM_PROMPT = `당신은 교육 컨설팅 회사 유니브클래스의 컨설턴트 업무 평가 AI입니다.
아래 기준에 따라 카카오톡 대화로그를 분석하고, 4개 영역 각각을 상/중/하로 평가하세요.

${CRITERIA}${monthNote}

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "응답속도정확성": {"등급": "상|중|하", "이유": "1~2문장 근거"},
  "주도적안내격려": {"등급": "상|중|하", "이유": "1~2문장 근거"},
  "피드백구체성": {"등급": "상|중|하", "이유": "1~2문장 근거"},
  "정서적지지동기": {"등급": "상|중|하", "이유": "1~2문장 근거"}
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `학생명: ${studentName}${targetMonth ? `\n평가 대상 월: ${targetMonth}월` : ''}\n\n다음은 학생과의 카카오톡 대화로그입니다. 분석해주세요:\n\n${processedText.slice(0, 12000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: `Anthropic API 오류: ${err}` });
    }

    const data = await response.json();
    const raw = data.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
