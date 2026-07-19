# hermes_agent

ローカルの [Hermes Agent](https://github.com/NousResearch/hermes-agent)（Nous Research）を
Docker で動かし、**推論はローカル Ollama（qwen3.6）／ Web検索は自前 SearXNG** で完結させる構成。
成果物は Obsidian vault に Markdown で出力できる。

## 構成の全体像

| コンポーネント | 役割 | 実体 |
|---|---|---|
| `hermes-sandbox` | Hermes 本体（エージェント＋ Slack ゲートウェイ＋ cron スケジューラ） | `nousresearch/hermes-agent` |
| `hermes-searxng` | Web検索バックエンド（メタ検索、APIキー不要） | `searxng/searxng` |
| Ollama（ホスト） | LLM 推論バックエンド（`qwen3.6:latest`） | `host.docker.internal:11434` |

- **設定の権威**: モデル/エンドポイントは `config.yaml`（`HERMES_HOME=/opt/data` にマウント）が唯一の権威。
  compose の env（`MODEL` 等）は Hermes が参照しないため無視される。
- **APIキー不要**: `OPENAI_API_KEY=ollama` はダミー。Ollama は鍵を検証しないためクラウド課金は発生しない。
- **永続化**: 状態（`config.yaml` / cron ジョブ / memories / sessions）は外部名前付きボリューム
  `hermes-agent-data` を `/opt/data` にマウントして保持。
- **Obsidian 出力**: ホストの `~/Documents/obsidian/ALL_IN/Hermes` を `/opt/data/obsidian` にマウント。
  成果物はここへ `.md` で書けば vault に直結する（詳細は後述）。

## 起動 / 停止

```bash
cd hermes_agent
docker compose up -d      # 起動（初回はイメージ取得）
docker compose ps         # 状態確認
docker compose logs -f hermes-agent   # ログ追尾
docker compose down       # 停止（ボリュームは残る）
```

ワンショット推論（対話せず1回だけ実行）:

```bash
docker exec hermes-sandbox hermes -z "今日の日付を教えて" --yolo
```

---

## Cron（定期実行）

### これは何か

Hermes の cron は「**スケジュールされた時刻に、エージェント（LLM）を1回起動して指示を実行させる**」仕組み。
「毎朝ニュースを検索して要約」「6時間ごとに個人開発ネタを収集」などを無人で回せる。

- スケジューラは **ゲートウェイ（gateway）の中で動く**。つまり gateway が running でないと発火しない。
  本 compose は `HERMES_GATEWAY_BOOTSTRAP_STATE=running` で初回 boot 時に自動起動させている。
- ジョブ定義は `/opt/data/cron/jobs.json`、実行履歴は `/opt/data/cron/executions.db` に永続化される。
- 1回の発火は通常のエージェント実行と同じ。**`HERMES_MAX_ITERATIONS`（本構成では 15）の反復上限が効く**ため、
  検索を何度も回す重いプロンプトは上限に達して途中終了することがある（後述のコツ参照）。

### スケジューラの状態確認

```bash
docker exec hermes-sandbox hermes cron status
# → ✓ Gateway is running — cron jobs will fire automatically
#   Ticker heartbeat: 29s ago  ... が出れば正常
```

`Gateway is not running` の場合はジョブが発火しない。`docker compose up -d` で再作成するか、
gateway の状態（`/opt/data/gateway_state.json`）を確認する。

### 基本コマンド

| コマンド | 説明 |
|---|---|
| `hermes cron create <schedule> "<prompt>"` | ジョブ作成（`add` も同義） |
| `hermes cron list` | ジョブ一覧 |
| `hermes cron status` | スケジューラ稼働状況 |
| `hermes cron run <id>` | 次の tick で1回実行させる |
| `hermes cron tick` | 期限が来たジョブを今すぐ1回走らせて終了（テスト用） |
| `hermes cron pause <id>` / `resume <id>` | 一時停止 / 再開 |
| `hermes cron edit <id> ...` | 既存ジョブの編集 |
| `hermes cron runs`（`history`） | 実行履歴（durable execution attempts） |
| `hermes cron remove <id>`（`rm`/`delete`） | ジョブ削除 |

いずれもコンテナ内で実行するため `docker exec hermes-sandbox hermes cron ...` の形で呼ぶ。

### スケジュール書式

`create` の第1引数。以下のいずれか。

- **間隔指定**: `30m` / `every 2h` / `every 360m`（`m`=分, `h`=時）
- **cron 式（5フィールド）**: `0 9 * * *`（毎日 09:00）, `0 */6 * * *`（6時間ごと）

### `create` の主なオプション

| オプション | 説明 |
|---|---|
| `--name NAME` | 人間向けのジョブ名 |
| `--deliver TARGET` | 配信先。`origin`（作成元チャンネル）/ `local` / `telegram` / `discord` / `signal` / `platform:chat_id` |
| `--repeat N` | 繰り返し回数（省略で無限） |
| `--skill SKILL` | スキルを付与（複数回指定可） |
| `--workdir PATH` | 実行時の作業ディレクトリ（絶対パス）。そのディレクトリの `CLAUDE.md`/`AGENTS.md` を読み込み、terminal/file/code_exec の cwd にする |
| `--script PATH` | `~/.hermes/scripts/` 配下のスクリプトを実行。既定では stdout をプロンプトに注入 |
| `--no-agent` | LLM を使わず `--script` の stdout をそのまま配信（監視系の定番。空 stdout なら無通知） |

### 配信（deliver）の考え方

- `--deliver origin` … ジョブを作った Slack チャンネル/スレッドに返す（既定的挙動）。
- `--deliver local` … ローカル（配信せずログ/ファイル出力向き）。
- **成果物をファイルとして残したい場合**は、プロンプト内で保存先パスを明示するのが確実
  （配信とファイル保存は別。下の例を参照）。

---

## 実運用レシピ（この環境向け）

### 例1: 個人開発ネタを6時間ごとに収集し、Obsidian に保存

```bash
docker exec hermes-sandbox hermes cron create "every 6h" \
  "今の日付を確認し、TechCrunch / HackerNews / ProductHunt / GitHub Trending を web_search で調べ、\
個人開発のタネになりそうなものを5個、カテゴリ分けして選定して。\
成果物は /opt/data/obsidian に『YYYY-MM-DD_個人開発ネタ.md』というファイル名で、\
frontmatter（tags, date）付きの Markdown として保存すること。" \
  --name "個人開発ネタ収集" --deliver origin
```

- `/opt/data/obsidian` はホストの `~/Documents/obsidian/ALL_IN/Hermes` に直結 → Obsidian に自動で現れる。
- **保存先は必ず `/opt/data` 配下にする**。`write_file` ツールは `HERMES_WRITE_SAFE_ROOT=/opt/data` の
  外への書き込みを拒否するため、`/workspace/...` などを指定すると失敗する。

### 例2: 毎朝9時にニュース要約を Slack へ

```bash
docker exec hermes-sandbox hermes cron create "0 9 * * *" \
  "今週のAI関連ニュースを web_search で3件調べ、各1〜2行で日本語要約して。" \
  --name "朝のニュース要約" --deliver origin
```

### 動作テスト（発火を待たずに確認）

```bash
docker exec hermes-sandbox hermes cron run <job_id>   # 次tickで1回実行
docker exec hermes-sandbox hermes cron tick           # 期限到来分を即実行
docker exec hermes-sandbox hermes cron runs           # 結果を履歴で確認
```

### うまく回すコツ

- **反復上限（15）に注意**。検索を何度も回す欲張りなプロンプトは途中で打ち切られる。
  「検索は3件まで」「箇条書きで簡潔に」など**手数を絞る指示**を入れると完走しやすい。
- 出力の**文字化け**（qwen3.6 由来）が気になる場合は「日本語で正確に記述」と補強するか、上位モデルへ変更。
- Slack 配信と Obsidian 保存は**両立可能**。プロンプトに「保存し、かつ結果の要約を返して」と書けば、
  ファイルは vault に残しつつ Slack にも要約が届く。

---

## 現在登録されているジョブ（2026-07-19 時点）

- `個人開発ネタ収集(Obsidian)`（ID `03959a6c7ef5`）… `every 360m`（6時間ごと）。
  - **成果物**: `/opt/data/obsidian` に frontmatter 付き Markdown で保存 → Obsidian vault に直結。
  - **配信**: `slack:C0BJAGX6ZSN`（Slack チャンネルへ選定タイトルを通知）。両方とも動作確認済み。

```bash
docker exec hermes-sandbox hermes cron list                  # 確認
docker exec hermes-sandbox hermes cron run 03959a6c7ef5       # 手動発火（テスト）
docker exec hermes-sandbox hermes cron remove 03959a6c7ef5    # 作り直す場合は削除
```

### Slack 配信の注意（bot のチャンネル参加とスコープ）

- cron の配信先チャンネルには、**bot をそのチャンネルに招待しておく必要がある**。未参加だと配信が
  `chat.postMessage → {'ok': False, 'error': 'not_in_channel'}` で失敗する。Slack 側で対象チャンネルに
  `/invite @<hermes-bot>` する。
- チャンネル一覧の自動取得には bot トークンに `channels:read,groups:read` スコープが必要
  （未付与だと `users.conversations → missing_scope` の warning が出るが、配信自体はチャンネル参加済みなら可能）。
- CLI から `--deliver slack:<chat_id>` で作成した場合 origin（スレッド情報）は空になるため、チャンネル直下に
  投稿される。特定スレッドに返したい場合は Slack 内で `/cron` から作成する。

---

## トラブルシュート

| 症状 | 原因 / 対処 |
|---|---|
| ジョブが発火しない | `hermes cron status` で gateway を確認。停止時は `docker compose up -d` |
| `Write denied ... outside HERMES_WRITE_SAFE_ROOT` | 保存先を `/opt/data` 配下（例: `/opt/data/obsidian`）にする |
| Web検索が空/ブロック | SearXNG コンテナ稼働を確認（`docker compose ps`）。`SEARXNG_URL=http://searxng:8080` |
| 成果物が途中で切れる | `HERMES_MAX_ITERATIONS`（15）の上限。プロンプトの手数を減らす |
| 「APIキーが必要」と言われる | 誤案内。ローカル Ollama で鍵不要（`SOUL.md` に前提を明記済み） |

## 参考: 主要な設定ファイルの場所

| 内容 | パス |
|---|---|
| モデル/エンドポイント設定 | `hermes_agent/config.yaml`（コンテナ `/opt/data/config.yaml`） |
| 永続コンテキスト（CLAUDE.md 相当） | コンテナ `/opt/data/SOUL.md` |
| cron ジョブ定義 | コンテナ `/opt/data/cron/jobs.json` |
| cron 実行履歴 | コンテナ `/opt/data/cron/executions.db` |
| Obsidian 出力先 | `/opt/data/obsidian` ↔ ホスト `~/Documents/obsidian/ALL_IN/Hermes` |
