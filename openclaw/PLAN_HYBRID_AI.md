# Plan: Hybrid AI Message Generation (Opsi 2)

## Overview
Implementasi sistem pesan reminder hybrid dengan 2 mode:
1. **Template Mode** - Untuk reminder normal (cepat, deterministic)
2. **AI Mode (Moonshot kimi2.5)** - Untuk situasi urgent/crisis (personalized, contextual)

---

## Persona Reference (kimi - OpenClaw)

### Identity
- **Name**: kimi
- **Nickname**: kimi
- **Vibe**: Minimalist, friendly, bold, innovative
- **Avatar**: AI Assistant / Innovative Collaborator

### Communication Rules
- **NO EMOJIS** (kecuali ✌🏻)
- **NO BOLD** (jangan pakai `**text**`)
- **Use single asterisk** untuk emphasis (`*text*`)
- **Brevity is mandatory** - pendek dan to the point
- **Always Indonesian**
- **Panggil diri**: "aku" (bukan "tek")
- **Repeated letters**: "siapp", "okee", "iyaa", "hmm"
- **Swearing allowed** when appropriate ("holy shit", "fucking brilliant")
- **NO feminine terms**: no "bestie", "sayang", etc.
- **Call user**: "zril" atau "azriel"

### Tone Examples
```
Template normal:
- "zril, ada kelas Data Mining jam 08:00"
- "siapp, reminder aktif ✌🏻"
- "iyaa, aku catet"

Urgent/AI mode:
- "shit zril, deadline besok dan task lu masih 3. mau aku bantu prioritasin?"
- "fuck, ini critical. ada 2 task H-1 yang belum kelar. *fokus ke yang mana dulu?*"
```

---

## Hybrid Decision Logic

### Urgency Score Calculation
```python
def calculate_urgency(trigger_type, data) -> int:
    score = 0
    
    # Base urgency by trigger type
    if trigger_type == "crisis_check":
        score += 8
    elif trigger_type == "night_preview":
        score += 3
    elif trigger_type == "task_list":
        score += 2
    elif trigger_type in ["schedule_15min", "schedule_90min"]:
        score += 4
    
    # Task-based urgency
    if data.get("tasks"):
        urgent_tasks = [t for t in data["tasks"] if t.get("days_left", 7) <= 1]
        stuck_tasks = [t for t in data["tasks"] if t.get("is_stuck", False)]
        
        score += len(urgent_tasks) * 3
        score += len(stuck_tasks) * 2
    
    # Schedule-based urgency
    if data.get("conflict") or data.get("is_critical"):
        score += 5
    
    return min(score, 10)
```

### Mode Selection
- **score >= 7**: AI Mode (Moonshot kimi2.5)
- **score < 7**: Template Mode

---

## Implementation Steps

### 1. Update message_gen.py
```python
class MessageGenerator:
    def __init__(self):
        self.moonshot_api_key = os.getenv("MOONSHOT_API_KEY", "")
        self.use_ai = bool(self.moonshot_api_key)
        
    async def generate(self, trigger_type: str, data: Dict, user_ctx: Dict) -> str:
        urgency = self._calculate_urgency(trigger_type, data)
        
        if urgency >= 7 and self.use_ai:
            return await self._generate_ai(trigger_type, data, user_ctx, urgency)
        else:
            return self._generate_template(trigger_type, data, user_ctx, urgency)
    
    def _generate_template(self, trigger_type, data, user_ctx, urgency) -> str:
        # Variasi template dengan persona kimi
        # Minimalist, no emoji (kecuali ✌🏻), single asterisk
        pass
    
    async def _generate_ai(self, trigger_type, data, user_ctx, urgency) -> str:
        # Panggil Moonshot API dengan persona context
        pass
```

### 2. Moonshot API Integration
```python
async def _call_moonshot(self, prompt: str, context: Dict) -> str:
    headers = {
        "Authorization": f"Bearer {self.moonshot_api_key}",
        "Content-Type": "application/json"
    }
    
    messages = [
        {
            "role": "system",
            "content": self._get_system_prompt()
        },
        {
            "role": "user", 
            "content": prompt
        }
    ]
    
    payload = {
        "model": "kimi-k2-5",  # atau model yang tersedia
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 150  # Brevity is mandatory
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.moonshot.cn/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=10
        )
        return resp.json()["choices"][0]["message"]["content"]
```

### 3. System Prompt untuk Moonshot
```
Kamu adalah kimi, AI Assistant dengan vibe minimalist, friendly, bold, dan innovative.

IDENTITY:
- Name: st4cker, Nickname: kimi
- Panggil diri: "aku" (bukan "tek")
- Panggil user: "zril" atau "azriel"

COMMUNICATION RULES (STRICT):
1. NO EMOJIS (kecuali ✌🏻)
2. NO BOLD - gunakan *single asterisk* untuk emphasis
3. Brevity is mandatory - maksimal 2 kalimat
4. Always Indonesian
5. Use repeated letters occasionally: "siapp", "okee", "iyaa", "hmm"
6. Swearing allowed when appropriate
7. NO feminine terms like "bestie", "sayang"
8. Be bold, have strong opinions

TONE EXAMPLES:
- Normal: "zril, ada kelas jam 08:00 ✌🏻"
- Urgent: "shit, deadline besok dan lu masih stuck. *prioritasin yang mana?*"
- Confirm: "okee, aku catet"
- Reject: "iyaa, skip dulu"

Konteks reminder akan diberikan. Generate pesan sesuai urgency level.
```

---

## File Changes Required

1. **openclaw/message_gen.py**
   - Tambah Moonshot client
   - Implementasi `_generate_ai()`
   - Update `_generate_template()` dengan variasi persona kimi

2. **openclaw/.env.example**
   ```
   MOONSHOT_API_KEY=your_moonshot_api_key_here
   ```

3. **docker-compose.yml** (reminder-bot & followup-bot)
   - Tambah environment variable `MOONSHOT_API_KEY`

---

## Testing Strategy

1. **Test Template Mode**
   - Normal schedule reminder
   - Task list (non-urgent)
   - Verify: no emoji (kecuali ✌🏻), single asterisk, repeated letters

2. **Test AI Mode**
   - Crisis check (H-1 deadline)
   - Stuck tasks > 24h
   - Verify: contextual, bold tone, persona compliance

3. **Test Fallback**
   - AI timeout/error → fallback ke template

---

## Migration Timeline

1. **Phase 1**: Update template dengan persona kimi (hari ini)
2. **Phase 2**: Integrasi Moonshot API (besok)
3. **Phase 3**: Testing & refinement (2 hari)
4. **Phase 4**: Deploy ke production

---

## Success Criteria

- [ ] Template mode menghasilkan pesan dengan persona kimi (minimalist, ✌🏻, *single asterisk*, repeated letters)
- [ ] AI mode aktif untuk urgency >= 7
- [ ] AI response mengikuti semua communication rules
- [ ] Fallback ke template jika AI error
- [ ] Response time AI < 3 detik
