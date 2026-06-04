# RoutineCheck

実施項目を縦に並べ、横に日付を表示して、セルクリックでチェックを保存するシンプルなWebアプリです。

## 構成

- Vite + React + TypeScript
- Supabase 新規プロジェクト
- Cloudflare Pages デプロイ想定

## 1. Supabase設定

1. Supabaseで新規プロジェクトを作成します。
   - 推奨プロジェクト名: `routinecheck`
2. SQL Editorを開きます。
3. `supabase/schema.sql` の中身を貼り付けて実行します。
4. Project Settings > API から以下を控えます。
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
VITE_SUPABASE_ANON_KEY=your-anon-key
```

任意で簡易ログイン画面を出す場合だけ、以下も設定します。

```env
VITE_LOGIN_QUESTION=秘密の質問
VITE_LOGIN_ANSWER=秘密の答え
```

注意: `VITE_` 環境変数はブラウザ側に公開されます。厳密なセキュリティ用途ではなく、MVP用の簡易ゲートです。

## 3. Cloudflare Pages デプロイ

Cloudflare PagesでGitHubリポジトリを連携し、以下で設定します。

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`

Environment variables に以下を設定します。

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

必要なら以下も設定します。

```env
VITE_LOGIN_QUESTION=秘密の質問
VITE_LOGIN_ANSWER=秘密の答え
```

## 4. 最初に入っている機能

- 月間チェック表
- 前月 / 翌月 / 今日へ移動
- 今日列の強調
- セルクリックでチェックON/OFF
- Supabaseへ即保存
- 項目追加
- 項目名変更
- 項目の非表示
- 月間達成率、チェック数、日別達成数

## 5. セキュリティについて

この初期版は、ブラウザからSupabaseに直接読み書きします。
そのため `supabase/schema.sql` ではanonロールに読み書きを許可しています。

社内利用でURLを限定的に共有するMVPとしては動かしやすいですが、厳密に保護したい場合は次の構成に変更してください。

- Cloudflare Worker / Pages FunctionsをAPI化
- Supabase Service Role KeyはWorker側のsecretに保存
- ブラウザはWorker APIだけを叩く
- Supabase側のanon書き込み権限は閉じる

