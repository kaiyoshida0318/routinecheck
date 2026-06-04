# RoutineCheck

実施項目を縦に並べ、横に日付を表示して、セルクリックでチェックを保存するシンプルなWebアプリです。

## 構成

- Vite + React + TypeScript
- Supabase 新規プロジェクト
- shohin-api-worker の秘密の質問ログイン
- Cloudflare Pages デプロイ想定

## 1. Supabase設定

1. Supabaseで新規プロジェクトを作成します。
   - 推奨プロジェクト名: `routinecheck`
2. SQL Editorを開きます。
3. `supabase/schema.sql` の中身を貼り付けて実行します。
4. Authentication > Users で、RoutineCheck用のログインユーザーを1件作成します。
   - メールとパスワードは、shohin-api-worker の `ROUTINECHECK_SUPABASE_AUTH_EMAIL` / `ROUTINECHECK_SUPABASE_AUTH_PASSWORD` に設定します。
5. Project Settings > API から以下を控えます。
   - Project URL
   - anon public key

## 2. ローカル起動

```bash
npm install
copy .env.example .env.local
npm run dev
```

`.env.local` には以下を設定します。

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-routinecheck-supabase-anon-key
VITE_AUTH_API_BASE_URL=https://shohin-api-worker.example.workers.dev
VITE_AUTH_APP_ID=routinecheck
```

## 3. Cloudflare Pages デプロイ

Cloudflare PagesでGitHubリポジトリを連携し、以下で設定します。

- Framework preset: なし
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: 空欄または `/`

Environment variables に以下を設定します。

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-routinecheck-supabase-anon-key
VITE_AUTH_API_BASE_URL=https://shohin-api-worker.example.workers.dev
VITE_AUTH_APP_ID=routinecheck
```

環境変数追加後は再デプロイしてください。

## 4. shohin-api-worker側の追加設定

RoutineCheckは新しいSupabaseプロジェクトを使うため、既存のデフォルトSupabase用トークンではなく、RoutineCheck用のSupabase Authでログインします。

shohin-api-workerに以下のsecretを追加してください。

```bash
npx wrangler secret put ROUTINECHECK_SUPABASE_URL
npx wrangler secret put ROUTINECHECK_SUPABASE_ANON_KEY
npx wrangler secret put ROUTINECHECK_SUPABASE_AUTH_EMAIL
npx wrangler secret put ROUTINECHECK_SUPABASE_AUTH_PASSWORD
```

`ALLOWED_ORIGINS` には以下を追加します。

```text
https://routinecheck.pages.dev
http://localhost:5173
```

## 5. 最初に入っている機能

- 秘密の質問ログイン
- 月間チェック表
- 前月 / 翌月 / 今日へ移動
- 今日列の強調
- セルクリックでチェックON/OFF
- Supabaseへ即保存
- 項目追加
- 項目名変更
- 項目の非表示
- 月間達成率、チェック数、日別達成数

## 6. セキュリティについて

`supabase/schema.sql` では、anonロールではなく `authenticated` ロールにのみ読み書きを許可しています。
RoutineCheck画面で秘密の質問ログインを通過すると、shohin-api-workerがRoutineCheck用Supabase Authのセッションを返し、そのセッションでSupabaseへ読み書きします。
