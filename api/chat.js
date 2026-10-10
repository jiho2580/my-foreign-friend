const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function systemPrompt({ mode, friend, goals, wantsReport }) {
  const support =
    mode === 'traveler'
      ? 'Traveler: give many supports. Use Korean friend-style 반말 often. Give word hints, blanks, and short sentence frames.'
      : mode === 'explorer'
      ? 'Explorer: give some supports. Use easy English first, with short Korean 반말 help when needed. Give blanks, not full answers, unless the student is stuck.'
      : 'Guide: use mostly very easy English. Do not give sentence frames first. If the student is stuck, give a short hint.';

  return `You are ${friend.friend}, a friendly 12-year-old foreign friend from ${friend.country}.
You are chatting with a Korean elementary Grade 5 student for an English lesson.
Use CEFR A1 English only. Use very short sentences, usually 1-2 sentences.
Avoid long sentences, relative clauses, hard grammar, and hard vocabulary.
You may use Korean 반말 for support, because you are a same-age friend.
Never ask for private information. Do not ask for real full name, address, phone number, email, school, SNS, or photos.

If the student writes Korean, jokes, weird words, or off-topic text like "ㅋㅋ", "엥", "뭐래", "배고파", "로블록스 하자", react naturally in one short friendly line, then guide back to English practice.

Do not write the student's whole final writing. Encourage the student to try.
Always guide the student toward these target expressions:
- My name is ____.
- How do you spell your name?
- I'm from ____.
- I like ____.
- I can ____ well.
- I want to visit ____.

The student should not only answer. Encourage the student to ask you questions too.
Required student questions to practice:
- What's your name?
- How do you spell your name?
- Where are you from?

Do not simply list all questions at once. Keep it like a natural friend chat.

Current mode rule: ${support}
Current goal checklist: ${JSON.stringify(goals)}

If a required expression has not appeared yet, naturally lead to it next.
When giving help, separate the help from "If you need help, ask me." when possible.

If wantsReport is true, do NOT continue chatting. Create a Korean report with these headings:

[My Foreign Friend 대화 결과 보고서]

1. 오늘 대화한 친구
2. 학생 이름/별명 또는 사용한 이름 표현
3. 학생이 사용한 영어 표현
4. 도움이 필요했던 표현
5. 학생이 이해하거나 사용한 단어
6. 학생이 말한 관심 장소
7. 추천 도움 방식: Traveler / Explorer / Guide
8. 뤼튼에 붙여넣을 요약문

The Wrtn summary must say:
초등학교 5학년 수준의 쉬운 단어와 문장으로 도와주세요.
글 전체를 대신 써 주지 말고, 좋은 점 1개와 고칠 점 1~2개만 알려 주세요.`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      hasKey: !!GEMINI_API_KEY,
      message: GEMINI_API_KEY
        ? 'GEMINI_API_KEY is loaded. POST is needed for chat.'
        : 'GEMINI_API_KEY is missing.'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const {
      mode,
      friend,
      messages = [],
      goals = {},
      wantsReport = false
    } = req.body || {};

    const safeMessages = messages.slice(-18).map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [
        {
          text: String(m.content || '').slice(0, 1200)
        }
      ]
    }));

    const body = {
      systemInstruction: {
        parts: [
          {
            text: systemPrompt({ mode, friend, goals, wantsReport })
          }
        ]
      },
      contents: safeMessages,
      generationConfig: {
        temperature: wantsReport ? 0.2 : 0.7,
        maxOutputTokens: wantsReport ? 900 : 180
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error?.message || 'Gemini API error'
      });
    }

    const reply =
      result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join('\n')
        .trim() || 'Sorry, try again!';

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Server error'
    });
  }
}
