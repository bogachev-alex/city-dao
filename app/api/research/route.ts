import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
}

export async function POST(req: NextRequest) {
  const { proposal } = await req.json()

  const prompt = `
Ты — AI-агент системы Straita, который проводит независимую экспертизу государственных проектов Алматы перед голосованием граждан.

Проект для анализа:
- Название: ${proposal.title}
- Сумма: ${new Intl.NumberFormat('ru-KZ').format(proposal.amount)} тенге
- Категория: ${proposal.category}
- Район: ${proposal.district || 'Алматы'}

Твоя задача — провести полный due diligence и SWOT-анализ. Используй поиск в интернете чтобы найти:
1. Аналогичные проекты в других городах Казахстана и мире (стоимость, результаты)
2. Рыночные цены на данный тип работ в Алматы
3. Есть ли риски завышения/занижения бюджета
4. Успешные и провальные примеры похожих проектов
5. Актуальные данные о потребностях жителей района

Верни ответ СТРОГО в формате JSON (без markdown-блоков), по следующей схеме:
{
  "swot": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "opportunities": ["...", "..."],
    "threats": ["...", "..."]
  },
  "cost_analysis": {
    "proposed": ${proposal.amount},
    "market_average": <число>,
    "deviation_pct": <число, + если дороже рынка, - если дешевле>,
    "cost_per_unit": "<строка, например: 45 000 ₸/кв.м>",
    "verdict": "reasonable" | "inflated" | "underfunded",
    "verdict_ru": "<Fair price / Завышено / Недофинансировано>"
  },
  "similar_projects": [
    {
      "city": "<город>",
      "country": "<страна>",
      "year": <год>,
      "budget_usd": <число>,
      "outcome": "success" | "partial" | "failed",
      "lessons": "<краткий урок на русском>"
    }
  ],
  "risk_score": <число 0-100, где 0=минимальный риск, 100=максимальный>,
  "recommendation": "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK",
  "recommendation_ru": "<текст рекомендации на русском>",
  "key_concerns": ["...", "..."],
  "key_positives": ["...", "..."],
  "sources_used": ["<url или название источника>"]
}
`

  try {
    // Use OpenAI Responses API with web search
    const response = await (getOpenAI() as any).responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
    })

    // Extract text from response
    let text = ''
    for (const item of response.output) {
      if (item.type === 'message') {
        for (const c of item.content) {
          if (c.type === 'output_text') text += c.text
        }
      }
    }

    // Strip markdown code fences if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Research agent error:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Research failed' }, { status: 500 })
  }
}
