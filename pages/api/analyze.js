// pages/api/analyze.js
// Этот файл — бэкенд. Он запускается на сервере Vercel,
// поэтому может обращаться к Google Sheets и Anthropic без ограничений браузера.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'URL не передан' })
  }

  // Извлекаем ID таблицы из ссылки
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) {
    return res.status(400).json({ error: 'Неверная ссылка на Google Sheets' })
  }

  const sheetId = match[1]

  // Загружаем CSV с Google Sheets
  let csvText
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`
    const csvRes = await fetch(csvUrl)
    if (!csvRes.ok) {
      throw new Error('Не удалось загрузить таблицу. Убедитесь что она открыта для просмотра.')
    }
    csvText = await csvRes.text()
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }

  // Парсим CSV
  const lines = csvText.trim().split('\n')
  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(parseCSVLine)

  // Отправляем данные в Claude для анализа
  const preview = [headers.join(', '), ...rows.slice(0, 30).map(r => r.join(', '))].join('\n')

  let analysis = null
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: `Ты аналитик данных. Проанализируй таблицу и верни ТОЛЬКО валидный JSON без markdown:
{
  "summary": "2-3 предложения резюме на русском",
  "metrics": [
    {"label": "название метрики", "value": "значение", "sub": "подпись"}
  ],
  "insights": [
    {"type": "insight|anomaly|trend", "icon": "💡|⚠️|📈", "title": "заголовок", "text": "описание"}
  ]
}

Верни ровно 4 метрики и 3 инсайта. Данные таблицы (первые 30 строк):
${preview}`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || '{}'
    analysis = JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch (e) {
    // Если Claude недоступен — возвращаем базовую статистику
    analysis = {
      summary: `Таблица содержит ${rows.length} строк и ${headers.length} столбцов: ${headers.join(', ')}.`,
      metrics: [
        { label: 'Строк данных', value: rows.length.toString(), sub: 'записей' },
        { label: 'Столбцов', value: headers.length.toString(), sub: 'показателей' },
        { label: 'Первая запись', value: rows[0]?.[0] || '—', sub: '' },
        { label: 'Последняя запись', value: rows[rows.length - 1]?.[0] || '—', sub: '' },
      ],
      insights: [
        { type: 'insight', icon: '💡', title: 'Данные загружены', text: 'Таблица успешно загружена. Добавьте ANTHROPIC_API_KEY для AI-анализа.' }
      ]
    }
  }

  // Определяем числовые колонки для графиков
  const numericCols = headers
    .map((h, i) => ({ name: h, idx: i }))
    .filter(({ idx }) => idx > 0 && rows.some(r => !isNaN(parseFloat(r[idx]))))

  const chartLabels = rows.map(r => r[0])
  const chartSeries = numericCols.slice(0, 3).map(({ name, idx }) => ({
    name,
    data: rows.map(r => parseFloat(r[idx]) || 0)
  }))

  return res.status(200).json({
    headers,
    rowCount: rows.length,
    chartLabels,
    chartSeries,
    analysis,
  })
}

function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur.trim())
  return result
}
