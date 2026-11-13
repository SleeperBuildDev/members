# Member Registry · အဖွဲ့ဝင် မှတ်တမ်း

A free web app for recording and searching organisation members. It works on phones, tablets and computers, and installs like an app.

- **Groups → Organisations → Members**
- **Roles:** Admin (everything), Editor (add and edit in their orgs), Viewer (search and view only)
- **Member fields:** Burmese and English name, position, birth date (age shown automatically), NRC (structured picker with all 14 states and ~450 townships), address (state/region, township, street), phone, status, notes
- **Search** by name, NRC (Burmese or English, e.g. `12/OUKAMA(N)123456`), phone (`09…`, `+959…` or Burmese digits) or position
- **Filters:** group, organisation, position, township, status, age range
- **Zawgyi text is converted to Unicode automatically**
- **Duplicate warnings** for NRC and phone (checked across all organisations)
- **NRC hidden** until someone taps "Show", and every reveal is logged
- **Recycle bin** (30 days), **activity log**, **export to Excel**
- Burmese and English interface, light and dark mode

Costs nothing: **GitHub Pages** hosts the app and **Supabase** (free tier) stores the data.

---

## Try it right now (demo mode)

With no Supabase keys, the app runs in **demo mode**. Sample data is kept in your browser only.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

---

## Go live: one-time setup (about 15 minutes)

### 1. Create the database (Supabase)

1. Sign up at **https://supabase.com** (free) and click **New project**.
   - Choose a region close to your users (for Myanmar: **Singapore**).
   - Save the database password somewhere safe.
2. When the project is ready, open **SQL Editor → New query**. Paste the whole file [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It should say "Success".
3. Open **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email".
   Your admin approval replaces email confirmation. The free plan can only send a few emails per hour.
4. Open **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long text starting with `eyJ…`)

> The anon key is safe to put in a website. The database rules in `schema.sql` decide who can see what.
> **Never** put the `service_role` key anywhere in this app.

### 2. Put the app on GitHub

1. Create a free account at **https://github.com** and a **new repository**, for example `members`.
2. Upload this folder (everything except `node_modules` and `dist`). The easy way is GitHub Desktop; with git it's:
   ```bash
   git init
   git add .
   git commit -m "Member Registry"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/members.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Open **Settings → Pages**. Under **Source**, choose **GitHub Actions**.
5. Open the **Actions** tab, then **Deploy to GitHub Pages** → **Run workflow**. After 1–2 minutes your app is live at
   **`https://YOUR-NAME.github.io/members/`**

### 3. First login

1. Open your app link and tap **Request an account**.
   **The very first account becomes the Admin automatically.** Do this yourself first!
2. Go to **Organisations**. Create your groups, then add organisations inside them.
3. Send the link to your staff. They tap **Request an account**, and you'll see them under **Users → Pending**.
   Tap **Approve**, then give access:
   - **Whole group** = every organisation in that group, including ones added later
   - **One organisation** = only that one
   - **Editor** = can add and edit members. **Viewer** = can only search and view. Only the Admin can delete.

### 4. Install on phones and computers

- **Android (Chrome):** menu ⋮ → **Add to Home screen / Install app**
- **iPhone (Safari):** Share → **Add to Home Screen**
- **Windows/Mac (Chrome or Edge):** the install icon in the address bar

---

## Good to know

- **Keep-alive:** Supabase pauses free projects after 7 days without use. The `Keep Supabase awake` GitHub Action pings it every 3 days, so it never pauses.
  GitHub turns off scheduled actions after **60 days with no commits** in the repository. If that happens, re-enable it in the **Actions** tab, or open the Supabase dashboard and click **Restore**. Your data is never lost.
- **Free limits:** 500 MB of database, roughly 100,000+ members, and 50,000 monthly active users. That's plenty for most organisations.
- **Backups:** Use **Export to Excel** on the Members page regularly. Supabase also lets you download a full backup under **Database → Backups**.
- **Forgot your admin password?** In Supabase: **Authentication → Users** → your user → **Send password recovery**.
- **Changing the database rules later:** paste only the changed functions or policies into the SQL Editor. Don't run the whole `schema.sql` again on a live project.

## Local development with your real database

Copy `.env.example` to `.env`, fill in the two values, then run `npm run dev`.

## Credits

NRC township data comes from [mm-nrc](https://github.com/wai-lin/mm-nrc) (MIT, see `src/data/nrc-LICENSE.txt`). Zawgyi conversion uses [Rabbit](https://github.com/Rabbit-Converter/Rabbit-Node) (MIT).
