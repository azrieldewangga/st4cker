# Deploy Hybrid AI Message Generation

## Quick Start

### 1. Copy Files ke VPS
```bash
# Dari local machine
scp openclaw/message_gen.py tekka-bot:~/st4cker/openclaw/
scp docker-compose.yml tekka-bot:~/st4cker/
scp .env tekka-bot:~/st4cker/
```

### 2. Setup Moonshot API Key
```bash
# SSH ke VPS
ssh tekka-bot

# Edit .env
nano ~/st4cker/.env

# Tambahkan:
MOONSHOT_API_KEY=sk-your-api-key-here
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1

# Save (Ctrl+X, Y, Enter)
```

### 3. Deploy
```bash
cd ~/st4cker

# Rebuild openclaw dengan message_gen.py baru
docker-compose build openclaw

# Restart openclaw
docker-compose up -d openclaw

# Verify running
docker ps | grep openclaw

# Check logs
docker logs openclaw -f --tail 50
```

### 4. Test

#### Test Template Mode
```bash
# Normal reminder (urgency < 7)
# Seharusnya dapat pesan pendek dengan ✌🏻
```

#### Test AI Mode  
```bash
# Create task dengan deadline H-1 atau stuck >24h
# Seharusnya dapat pesan urgent dengan tone bold
```

---

## Persona Checklist (MUST VERIFY)

Setelah deploy, verifikasi pesan mengikuti aturan:

- [ ] **No emoji** kecuali ✌🏻
- [ ] **Single asterisk** untuk emphasis (`*text*` bukan `**text**`)
- [ ] **Brevity** - max 2 kalimat
- [ ] **Indonesian** language only
- [ ] **Self-reference** "aku" (bukan "tek")
- [ ] **Repeated letters**: "okee", "iyaa", "siapp"
- [ ] **Call user**: "zril" atau "azriel"
- [ ] **No feminine terms**: no "bestie", "sayang"

---

## Troubleshooting

### Container tidak start
```bash
docker logs openclaw --tail 100
# Check error message
```

### AI tidak ter-trigger
```bash
# Check environment variable
docker exec openclaw env | grep MOONSHOT

# Check logs untuk urgency score
docker logs openclaw -f | grep "urgency\|AI\|template"
```

### API Key invalid
```bash
# Test API key
curl https://api.moonshot.cn/v1/models \
  -H "Authorization: Bearer sk-your-api-key"
```

---

## Rollback (jika ada masalah)

```bash
cd ~/st4cker

# Revert ke versi sebelumnya
git checkout HEAD -- openclaw/message_gen.py
git checkout HEAD -- docker-compose.yml
git checkout HEAD -- .env

# Restart
docker-compose up -d openclaw
```
