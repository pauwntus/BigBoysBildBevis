# Åre Olympiaden – Projektkontext

## Vad är det här?
Ett mobilanpassat party game för 3-4 killar under en skidvecka i Åre.
Inspirerat av Jackbox – dagliga fotoutmaningar, anonym röstning, poäng samlas under veckan.

## Hosting
- **GitHub Pages:** `https://pauwntus.github.io/BigBoysBildBevis`
- **Repo:** `BigBoysBildBevis`
- **Fil:** `index.html`

## Supabase
- **Project URL:** `https://qfopolrxfnilhxzknmkl.supabase.co`
- **Anon key:** `sb_publishable_G1axvniFKDW0xQt94bhLYQ_CImljqte`
- **Region:** Europe

### Tabeller
- `games` – spelinfo (kod, fas, current_day, total_days, challenges som jsonb)
- `players` – spelare (game_id, name, color, emoji, score, is_host)
- `submissions` – inlämnade foton (game_id, player_id, day, photo som base64)
- `votes` – röster (game_id, voter_id, voted_for_id, day)

### Storage
- Bucket: `photos` (public)
- OBS: Foton lagras just nu som base64 i databasen – ska migreras till Storage

### RLS
Alla tabeller har RLS aktiverat med "allow all"-policy (okej för privat användning).
Storage-policy behöver läggas till:
```sql
create policy "allow all storage" on storage.objects
for all using (bucket_id = 'photos') with check (bucket_id = 'photos');
```

## Spelflöde
1. En person skapar spel → får 4-siffrig kod
2. Alla joinear med koden på sin mobil
3. Varje dag slumpas en fotoutmaning
4. Alla fotar och laddar upp anonymt
5. Alla röstar på favoritfoto
6. Poäng: 1:a = 5p, 2:a = 3p, 3:a = 1p
7. Sista dagen → podium och vinnare

## Fas-system i games-tabellen
`lobby` → `challenge` → `voting` → `results` → (nästa dag eller) `final`

## Vad som ska byggas härnäst
- [ ] Migrera foton från base64 i DB till Supabase Storage
- [ ] Galleri – alla tävlingsbilder sparade per dag
- [ ] Bonusbilder – ladda upp spontana bilder utanför utmaningarna
- [ ] Ny visuell identitet (se design nedan)
- [ ] Uppdaterad utmaningslista (se nedan)

## Visuell Identitet
**Känsla:** Retro 80-tal skidposters + tävling & adrenalin

### Färger
```
--bg:      #0D1B2A   /* Midnattsmarine */
--bg2:     #111F30   /* Kortkortbakgrund */
--orange:  #FF6B35   /* Primär */
--yellow:  #FFE135   /* Accent/poäng */
--red:     #E63946   /* Sekundär */
--cream:   #F5F0E8   /* Text */
--muted:   #8A9BB0   /* Muted text */
```

### Typsnitt
- **Anton** (Google Fonts) – stora display-rubriker
- **Barlow Condensed Italic 900** – underrubriker, badges, knappar
- **DM Sans** – brödtext

### Formspråk
- Diagonala ränder i bakgrund
- Vinklade knappar med `clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)`
- Kornig grain-textur ovanpå bakgrund (SVG noise filter)
- Berg-silhuett som dekorativt element
- Gradient accent-linje (orange → gul → röd) under hero
- Ingen border-radius – raka kanter

### Komponenter
- Knappar: clip-path snedskurna, Barlow Condensed, versaler, letter-spacing
- Badges: rektangulära med border, ingen border-radius
- Leaderboard: border-left i guld/silver/brons-färg
- Utmaningskort: gradient top-border, stor emoji + versaltext

## Utmaningar (ska uppdateras)
Nuvarande lista är 25 st blandade. Ny riktning:
- Fotografitävling-stil (vackraste vyn, bästa stilleben, överraskande bild)
- "Alla mot alla"-stil (fota den i gruppen som...)
- Inspirerat av Bäst i Test / Alla mot alla
- ENDAST foto – ingen video, ingen text
- Roliga, moderna, lite elaka

### Utmaningar att behålla/inspireras av:
- Fota den mest överraskande bilden
- Fota den vackraste vyn
- Bästa matbilden
- Fota ett stilleben
- Bästa symmetriska bilden
- Fota något som ser ut som ett albumomslag
- Extrem närbild – gruppen gissar vad det är
- Fota den i gruppen som ser mest ut som en pappa på sin första skidsemester
- Fota den som ser ut som de precis insett att de bokat fel vecka
- Fota den som ser mest ut som en NPC i ett skidspel
- Fota dig själv och låtsas vara instruktör för en nybörjare du aldrig träffat

## Tekniska noter
- Realtid via Supabase Realtime (postgres_changes)
- Bildkomprimering på klienten innan uppladdning (canvas, max 600px, jpeg 0.7)
- localStorage för session (player_id, player_name, game_id)
- Single HTML-fil – ingen build-process
- Fungerar på mobil (viewport meta, touch-optimerad)
