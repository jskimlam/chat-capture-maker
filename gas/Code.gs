const DEFAULT_MODEL = 'gpt-5.6-luna';
const SESSION_TTL_SECONDS = 21600; // 6 hours
const MAX_MESSAGES = 120;
const MAX_MESSAGE_CHARS = 5000;
const MAX_CONTEXT_CHARS = 500;
const MAX_CALLS_PER_MINUTE = 30;

function doGet() {
  const props = PropertiesService.getScriptProperties();
  return json_({
    ok: true,
    service: 'chat-capture-maker',
    authRequired: true,
    configured: Boolean(props.getProperty('OPENAI_API_KEY') && props.getProperty('APP_PASSWORD')),
    model: props.getProperty('OPENAI_MODEL') || DEFAULT_MODEL,
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (body.action === 'auth') {
      return json_(authenticate_(body));
    }

    if (body.action === 'transform') {
      assertSession_(body.token);
      rateLimit_(body.token);
      validateTransformRequest_(body);
      const result = transformMessages_(body);
      return json_({ ok: true, model: result.model, messages: result.messages });
    }

    throw codedError_('BAD_REQUEST', 'Unsupported action.');
  } catch (err) {
    console.error(err);
    return json_({
      ok: false,
      code: err && err.code ? err.code : 'SERVER_ERROR',
      error: err && err.message ? err.message : String(err)
    });
  }
}

function authenticate_(body) {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('APP_PASSWORD');
  const apiKey = props.getProperty('OPENAI_API_KEY');
  const supplied = String(body.password || '');

  if (!expected) throw codedError_('NOT_CONFIGURED', 'APP_PASSWORD is not set in Script Properties.');
  if (!apiKey) throw codedError_('NOT_CONFIGURED', 'OPENAI_API_KEY is not set in Script Properties.');
  if (!supplied || !secureEquals_(supplied, expected)) throw codedError_('AUTH_FAILED', '앱 비밀번호가 올바르지 않습니다.');

  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const cache = CacheService.getScriptCache();
  cache.put(sessionKey_(token), '1', SESSION_TTL_SECONDS);

  return {
    ok: true,
    token: token,
    expiresIn: SESSION_TTL_SECONDS,
    model: props.getProperty('OPENAI_MODEL') || DEFAULT_MODEL
  };
}

function assertSession_(token) {
  const clean = String(token || '');
  if (!clean) throw codedError_('AUTH_REQUIRED', 'AI 연결 인증이 필요합니다.');
  const cache = CacheService.getScriptCache();
  if (cache.get(sessionKey_(clean)) !== '1') throw codedError_('SESSION_EXPIRED', 'AI 인증 세션이 만료되었습니다. 다시 연결해 주세요.');
}

function rateLimit_(token) {
  const cache = CacheService.getScriptCache();
  const now = new Date();
  const minute = Utilities.formatDate(now, 'GMT', 'yyyyMMddHHmm');
  const key = 'rate:' + hash_(String(token || '')).slice(0, 32) + ':' + minute;
  const current = Number(cache.get(key) || 0);
  if (current >= MAX_CALLS_PER_MINUTE) throw codedError_('RATE_LIMIT', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  cache.put(key, String(current + 1), 90);
}

function validateTransformRequest_(body) {
  if (!Array.isArray(body.messages) || !body.messages.length) throw codedError_('BAD_REQUEST', 'messages is required.');
  if (body.messages.length > MAX_MESSAGES) throw codedError_('BAD_REQUEST', 'Too many messages. Maximum is ' + MAX_MESSAGES + '.');

  body.messages.forEach(function(m) {
    if (String(m.text || '').length > MAX_MESSAGE_CHARS) throw codedError_('BAD_REQUEST', 'A message is too long.');
  });
}

function transformMessages_(body) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('OPENAI_API_KEY');
  const model = props.getProperty('OPENAI_MODEL') || DEFAULT_MODEL;
  if (!apiKey) throw codedError_('NOT_CONFIGURED', 'OPENAI_API_KEY is not set in Script Properties.');

  const mode = body.mode === 'naturalize' ? 'naturalize' : 'translate';
  const targetLang = ['ko', 'en', 'ja', 'zh'].indexOf(body.targetLang) >= 0 ? body.targetLang : 'en';
  const tone = body.tone || 'natural-business';
  const platform = ['kakao', 'wechat', 'whatsapp', 'telegram'].indexOf(body.platform) >= 0 ? body.platform : 'messenger';
  const contextHint = String(body.contextHint || '').slice(0, MAX_CONTEXT_CHARS);
  const participants = body.participants || {};

  const languageName = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Simplified Chinese' }[targetLang];
  const toneRule = {
    'natural-business': 'Natural professional messenger conversation: concise, fluent, contemporary, and not overly formal.',
    'casual': 'Natural casual messenger conversation between familiar contacts.',
    'faithful': 'Stay very close to the source meaning and wording while remaining grammatical and natural.'
  }[tone] || 'Natural professional messenger conversation.';

  const platformRule = {
    kakao: 'Use the concise conversational rhythm common in one-to-one mobile messenger chats in Korea.',
    wechat: 'Use concise, natural one-to-one mobile messenger phrasing. For Chinese output, prefer natural Mainland Chinese chat wording.',
    whatsapp: 'Use natural international mobile messenger phrasing with short turns and contractions where appropriate.',
    telegram: 'Use clear, concise direct-message phrasing without unnecessary formality.'
  }[platform] || 'Use natural mobile messenger phrasing.';

  const instruction = [
    'You edit dialogue for a messenger mockup creation tool.',
    mode === 'translate'
      ? 'Translate every message into ' + languageName + '.'
      : 'Polish every message in its current language so it reads like a real mobile messenger chat.',
    toneRule,
    platformRule,
    'Preserve the exact number and order of messages.',
    'Preserve speaker A/B and each numeric id exactly.',
    'Do not add facts, prices, names, promises, dates, or claims that are not present in the source.',
    'Keep established business abbreviations and petrochemical/trading terminology natural when present, including terms such as SM, BD, ACN, CFR, FOB, prompt cargo, short covering, and floating formula.',
    'Preserve numbers, units, company names, product names, and commercial terms unless localization clearly requires spacing or punctuation changes.',
    'Do not add A: or B: inside the returned text.',
    'Do not add quotation marks merely for style.',
    'Keep each turn reasonably concise unless the source itself is long.',
    contextHint ? 'Domain/context hint: ' + contextHint : '',
    'Participant A: ' + String(participants.A || 'A').slice(0, 80) + '; Participant B: ' + String(participants.B || 'B').slice(0, 80) + '.'
  ].filter(Boolean).join('\n');

  const inputMessages = body.messages.map(function(m, i) {
    return {
      id: isFinite(Number(m.id)) ? Number(m.id) : i,
      speaker: m.speaker === 'A' ? 'A' : 'B',
      text: String(m.text || '').slice(0, MAX_MESSAGE_CHARS)
    };
  });

  const payload = {
    model: model,
    reasoning: { effort: 'none' },
    store: false,
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
                  speaker: { type: 'string', enum: ['A', 'B'] },
                  text: { type: 'string' }
                },
                required: ['id', 'speaker', 'text']
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
  try {
    data = JSON.parse(raw);
  } catch (_) {
    throw codedError_('OPENAI_ERROR', 'OpenAI returned a non-JSON response.');
  }

  if (status < 200 || status >= 300) {
    const msg = data && data.error && data.error.message ? data.error.message : 'OpenAI HTTP ' + status;
    throw codedError_('OPENAI_ERROR', msg);
  }

  const outputText = extractOutputText_(data);
  if (!outputText) throw codedError_('OPENAI_ERROR', 'OpenAI response did not contain output text.');

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (_) {
    throw codedError_('OPENAI_ERROR', 'Could not parse structured OpenAI output.');
  }

  if (!parsed || !Array.isArray(parsed.messages)) throw codedError_('OPENAI_ERROR', 'Invalid OpenAI output format.');
  if (parsed.messages.length !== inputMessages.length) throw codedError_('OPENAI_ERROR', 'OpenAI changed the number of messages.');

  parsed.messages.forEach(function(m, i) {
    if (Number(m.id) !== inputMessages[i].id || m.speaker !== inputMessages[i].speaker) {
      throw codedError_('OPENAI_ERROR', 'OpenAI changed message identifiers or speakers.');
    }
  });

  return { model: model, messages: parsed.messages };
}

function extractOutputText_(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  (data.output || []).forEach(function(item) {
    (item.content || []).forEach(function(content) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    });
  });
  return parts.join('');
}

function sessionKey_(token) {
  return 'session:' + hash_(token).slice(0, 48);
}

function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function secureEquals_(a, b) {
  const ha = hash_(a);
  const hb = hash_(b);
  if (ha.length !== hb.length) return false;
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

function codedError_(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
