# Hybrid AI Message Generation - Implementation Summary

## Overview
Sistem reminder sekarang menggunakan **Hybrid AI approach**:
- **Template Mode** → Untuk reminder normal (cepat, deterministic)
- **AI Mode (Moonshot kimi2.5)** → Untuk situasi urgent/crisis (personalized, contextual)

---

## Persona: kimi (OpenClaw)

### Identity
- **Name**: st4cker
- **Nickname**: kimi
- **Vibe**: Minimalist, friendly, bold, innovative

### Communication Rules (STRICT)
| Rule | Detail |
|------|--------|
| Emoji | ✌🏻 only (NO 😀, 🔥, ⚠️, dll) |
| Emphasis | *single asterisk* (NO **bold**) |
| Length | Brevity mandatory - max 2 kalimat |
| Language | Indonesian only |
| Self-reference | "aku" (bukan "tek") |
| Repeated letters | "siapp", "okee", "iyaa", "hmm" |
| Swearing | Allowed when appropriate |
| Feminine terms | NO "bestie", "sayang", dll |
| User | "zril" atau "azriel" |

### Examples
```
Template Normal:
- "zril, ada kelas jam 08:00 ✌🏻"
- "siapp, reminder aktif"
- "iyaa, aku catet"

Urgent/AI Mode:
- "shit zril, deadline besok dan task lu masih 3. *mau aku bantu prioritasin?*"
- "fuck, ini critical. ada 2 task H-1 yang belum kelar. *fokus ke yang mana dulu?*"
```

---

## How It Works

### Urgency Score Calculation
```
Base Score:
- crisis_check: +8
- schedule_15min/90min: +4
- night_preview: +3
- task_list: +2
- followup: +3

Task Modifiers:
- Overdue (days_left < 0): +4 per task
- Urgent (days_left <= 1): +3 per task
- Stuck (is_stuck=True): +2 per task

Schedule Modifiers:
- Conflict detected: +5
- Critical flag: +3

Max Score: 10
```

### Mode Selection
- **Score >= 7** → AI Mode (Moonshot kimi2.5)
- **Score < 7** → Template Mode

### Template Mode
- Variasi random dari template pools
- Persona-compliant (minimalist, ✌🏻, single asterisk, repeated letters)
- Fast (< 10ms generation)

### AI Mode
- Calls Moonshot API (kimi-k2-5 model)
- System prompt includes full persona rules
- Fallback to template jika API error/timeout
- Max 150 tokens, temperature 0.7

---

## Files Changed

### 1. `openclaw/message_gen.py` (NEW)
- `MessageGenerator` class
- Urgency calculation
- Template generation dengan persona kimi
- Moonshot API integration
- Fallback mechanism

### 2. `docker-compose.yml`
- Added `MOONSHOT_API_KEY` dan `MOONSHOT_BASE_URL` ke openclaw service

### 3. `.env`
- Added placeholder untuk `MOONSHOT_API_KEY` dan `MOONSHOT_BASE_URL`

### 4. `openclaw/PLAN_HYBRID_AI.md`
- Dokumentasi lengkap plan dan implementation

---

## Setup Instructions

### 1. Get Moonshot API Key
1. Login ke https://platform.moonshot.cn/
2. Buat API key baru
3. Copy key tersebut

### 2. Update Environment
```bash
# Edit .env file
nano .env

# Add your API key
MOONSHOT_API_KEY=sk-your-moonshot-api-key-here
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
```

### 3. Rebuild OpenClaw Container
```bash
# SSH ke VPS
cd ~/st4cker

# Rebuild openclaw dengan file baru
docker-compose build openclaw

# Restart service
docker-compose up -d openclaw

# Verify logs
docker logs openclaw -f
```

---

## Testing

### Test Template Mode (Normal)
```bash
# Trigger normal schedule reminder
# Should get: "zril, ada kelas jam 08:00 ✌🏻"
```

### Test AI Mode (Urgent)
```bash
# Create task with H-1 deadline
# Should get bold, contextual message like:
# "shit zril, deadline besok dan lu masih stuck. *prioritasin yang mana?*"
```

### Verify Persona Compliance
Checklist:
- [ ] No emoji kecuali ✌🏻
- [ ] Single asterisk untuk emphasis (bukan **bold**)
- [ ] Short messages (max 2 kalimat)
- [ ] Indonesian language
- [ ] Repeated letters: "okee", "iyaa", "siapp"
- [ ] Call user "zril" atau "azriel"
- [ ] Self-reference "aku"

---

## Troubleshooting

### AI Not Triggering
- Check urgency score (debug log akan print score)
- Verify MOONSHOT_API_KEY is set
- Check API key validity di Moonshot platform

### Message Too Long
- AI mode max_tokens: 150
- Template mode designed for brevity
- Check system prompt if AI generates long responses

### Wrong Persona
- Check system prompt di `message_gen.py`
- Verify no "**bold**" formatting
- Ensure no feminine terms

### Fallback Issues
- If AI fails, akan fallback ke template
- Check logs: "AI generation failed, falling back to template"

---

## Next Steps

1. **Deploy ke VPS**: Update .env dengan Moonshot API key
2. **Testing**: Verify template dan AI mode
3. **Fine-tuning**: Adjust urgency thresholds jika perlu
4. **Monitoring**: Watch logs untuk AI response times

---

## Architecture Flow

```
reminder-bot/followup-bot
         ↓
    POST /webhook/st4cker-reminder-trigger
         ↓
    OpenClaw (message_gen.py)
         ↓
    Calculate Urgency Score
         ↓
    ┌─────────────────┐
    │ Score >= 7?     │
    └─────────────────┘
         ↓
    Yes          No
    ↓             ↓
AI Mode      Template Mode
(Moonshot)   (Local)
    ↓             ↓
Generate     Generate
    ↓             ↓
    └─────────────┘
         ↓
    Send to WA Gateway
         ↓
    WhatsApp ke zril
```
