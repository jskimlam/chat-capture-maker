const DEFAULT_MODEL = 'gpt-5.6-luna';

function doGet() {
  return json_({
    ok: true,
    service: 'chat-capture-maker',
    model: PropertiesService.getScriptProperties().getProperty('OPENAI_MODEL') || DEFAULT_MODEL,
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'transform') throw new Error('Unsupported action');
    if (!Array.isArray(body.messages) || !body.messages.length) throw new Error('messages is required');
    if (body.messages.length > 120) throw new Error('Too many messages. Maximum is 120.');

    const result = transformMessages_(body);
    return json_({ ok: true, model: result.model, messages: result.messages });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function transformMessages_(body) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('OPENAI_API_KEY');
  const model = props.getProperty('OPENAI_MODEL') || DEFAULT_MODEL;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in Script Properties.');

  const mode = body.mode === 'naturalize' ? 'naturalize' : 'translate';
  const targetLang = ['ko','en','ja'].includes(body.targetLang) ? body.targetLang : 'en';
  const tone = body.tone || 'natural-business';
  const platform = body.platform || 'messenger';
  const contextHint = String(body.contextHint || '').slice(0, 500);
  const participants = body.participants || {};

  const languageName = { ko:'Korean', en:'English', ja:'Japanese' }[targetLang];
  const toneRule = {
    'natural-business': 'Natural professional messenger conversation: concise, fluent, and not overly formal.',
    'casual': 'Natural casual messenger conversation between familiar contacts.',
    'faithful': 'Stay very close to the source meaning and wording while remaining grammatical.'
  }[tone] || 'Natural professional messenger conversation.';

  const instruction = [
    'You edit messenger dialogue for a chat mockup tool.',
    mode === 'translate'
      ? `Translate every message into ${languageName}.`
      : `Polish every message in its current language so it reads like a real ${platform} chat.`,
    toneRule,
    'Preserve the exact number and order of messages.',
    'Preserve speaker A/B and each numeric id exactly.',
    'Do not add facts, prices, names, promises, or claims that are not present in the source.',
    'Keep established business abbreviations and petrochemical/trading terminology natural when present (for example SM, BD, ACN, CFR, FOB, prompt cargo, short covering, floating formula).',
    'Do not add A: or B: inside the returned text.',
    'Do not add quotation marks around message text merely for style.',
    contextHint ? `Domain/context hint: ${contextHint}` : '',
    `Participant A: ${String(participants.A || 'A').slice(0,80)}; Participant B: ${String(participants.B || 'B').slice(0,80)}.`
  ].filter(Boolean).join('\n');

  const inputMessages = body.messages.map((m, i) => ({
    id: Number.isFinite(Number(m.id)) ? Number(m.id) : i,
    speaker: m.speaker === 'A' ? 'A' : 'B',
    text: String(m.text || '').slice(0, 5000)
  }));

  const payload = {
    model: model,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: instruction }] },
      { role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ messages: inputMessages }) }] }
    ],
    max_output_tokens: 6000,
    text: {
      format: {
        type: 'json_schema',
        name: 'chat_transform',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'integer' },
                  speaker: { type: 'string', enum: ['A','B'] },
                  text: { type: 'string' }
                },
                required: ['id','speaker','text']
              }
            }
          },
          required: ['messages']
        }
      }
    }
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const raw = response.getContentText();
  let data;
  try { data = JSON.parse(raw); } catch (_) { throw new Error('OpenAI returned a non-JSON response.'); }
  if (status < 200 || status >= 300) {
    const msg = data && data.error && data.error.message ? data.error.message : `OpenAI HTTP ${status}`;
    throw new Error(msg);
  }

  const outputText = extractOutputText_(data);
  if (!outputText) throw new Error('OpenAI response did not contain output text.');

  let parsed;
  try { parsed = JSON.parse(outputText); }
  catch (_) { throw new Error('Could not parse structured OpenAI output.'); }
  if (!parsed || !Array.isArray(parsed.messages)) throw new Error('Invalid OpenAI output format.');
  if (parsed.messages.length !== inputMessages.length) throw new Error('OpenAI changed the number of messages.');

  return { model: model, messages: parsed.messages };
}

function extractOutputText_(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  (data.output || []).forEach(item => {
    (item.content || []).forEach(content => {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    });
  });
  return parts.join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
