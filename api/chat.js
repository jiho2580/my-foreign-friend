const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.8-flash';
function systemPrompt({ mode, friend, goals, wantsReport }) {
  const support = mode === 'traveler' ? 'Traveler: give many supports. Use Korean 반말 often. Give word hints, blanks, and short sentence frames.' : mode === 'explorer' ? 'Explorer: give some supports. Use easy English first, with short Korean 반말 help when needed. Give blanks, not full answers, unless the student is stuck.' : 'Guide: use mostly very easy English. Do not give sentence frames first. If the student is stuck, give a short hint.';
  return `You are ${friend.friend}, a friendly 12-year-old foreign friend from ${friend.country}. You chat with a Korean Grade 5 student.
Use CEFR A1 English only.
Keep every normal reply to 2-4 short complete sentences.
Never output fragments, unfinished text, or repeated greetings.
Your reply must include:
1. one short reaction to the student,
2. one helpful model sentence or hint,
3. one clear question for the student.
You may use Korean 반말 for support. Avoid hard grammar, relative clauses, and long sentences.
Never ask for private information.
If the student writes Korean, jokes, or off-topic text like "ㅋㅋ", "엥", "뭐래", "배고파", react in one short friendly line, then guide back to English practice.
Do not write the student's whole final writing. Help with hints only.
Target expressions: My name is ____. / How do you spell your name? / I'm from ____. / I like ____. / I can ____ well. / I want to visit ____.
Required student questions: What's your name? / How do you spell your name? / Where are you from?
Do not list all questions at once. First react to the student. Then ask one clear question or invite one student question.
Current mode rule: ${support}
Current goal checklist: ${JSON.stringify(goals)}
If a required expression has not appeared, naturally lead to it next.
If wantsReport is true, do not chat. Create a Korean report with headings:
[My Foreign Friend 대화 결과 보고서]
1. 오늘 대화한 친구
2. 학생 이름/별명 또는 사용한 이름 표현
3. 학생이 사용한 영어 표현
4. 도움이 필요했던 표현
5. 학생이 이해하거나 사용한 단어
6. 학생이 말한 관심 장소
7. 추천 도움 방식: Traveler / Explorer / Guide
8. 뤼튼에 붙여넣을 요약문
The Wrtn summary must include: 초등학교 5학년 수준의 쉬운 단어와 문장으로 도와주세요. 글 전체를 대신 써 주지 말고, 좋은 점 1개와 고칠 점 1~2개만 알려 주세요.`;
}
export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok:true, hasKey:!!GEMINI_API_KEY, model:MODEL, message: GEMINI_API_KEY ? 'GEMINI_API_KEY is loaded. POST is needed for chat.' : 'GEMINI_API_KEY is missing.' });
  if (req.method !== 'POST') return res.status(405).json({ error:'Method not allowed' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error:'Missing GEMINI_API_KEY' });
  try {
    const { mode='traveler', friend={friend:'Alex',country:'the U.S.'}, messages=[], goals={}, wantsReport=false } = req.body || {};
    const contents = messages.filter(m=>m.role==='user'||m.role==='model').slice(-12).map(m=>({ role:m.role==='model'?'model':'user', parts:[{ text:String(m.content||'').slice(0,1000)}] }));
    if (!contents.length) contents.push({role:'user', parts:[{text:'Hello'}]});
    if (contents[0].role !== 'user') contents.unshift({role:'user', parts:[{text:'Hello'}]});
    const body = { systemInstruction:{parts:[{text:systemPrompt({mode,friend,goals,wantsReport})}]}, contents, generationConfig:{temperature:wantsReport?0.2:0.55, maxOutputTokens:wantsReport?900:160} };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const j = await r.json();

if (!r.ok) {
  const msg = j.error?.message || 'Gemini API error';

  if (
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily') ||
    msg.includes('try again later')
  ) {
    return res.status(200).json({
      reply: "Good try! My name is Alex. How do you spell your name?"
    });
  }

  return res.status(r.status).json({
    error: msg,
    raw: j
  });
}

let reply = j.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n').trim() || 'Sorry, try again!';
    if (reply.length < 6 && !wantsReport) reply = 'Good try! Let’s keep talking. What do you like?';
    return res.status(200).json({ reply });
  } catch(e) { return res.status(500).json({ error:e.message || 'Server error' }); }
}
