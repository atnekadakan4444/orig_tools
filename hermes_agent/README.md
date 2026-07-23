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

## 運用方針: Skill による手動実行（cron は廃止）

**2026-07-20 に cron ジョブは全廃し、指示テンプレートを Skill 化して手動実行する運用に移行した。**

理由: 手動実行が主体なら、指示が `jobs.json` に閉じ込められる cron より、Skill の方が扱いやすい。
Skill は SKILL.md を編集するだけで即反映され、対象を呼び出し時に指定でき、Git 管理が実効を持つ。

### 現在の Skill（`hermes_agent/skills/` = 唯一のソース）

| Skill | 用途 | 出力先 |
|---|---|---|
| `deep-research` | **任意テーマ**を fact（現状・論点・事実）と pain（困りごと・非効率）の 2 サブエージェントで **`delegate_task` 並列調査**。browser 精読・調査専任、集約はしない。**対象テーマは呼び出し時に指定** | `deep-research/<テーマ>/`（`_fact.md` / `_pain.md` の 2 ファイル） |
| `subculture-research` | サブカル領域の困りごとを **browser で実ページ精読**して調査（調査専任・企画案は書かない）。**対象領域は呼び出し時に指定** | `deep-research/<領域>/` |
| `subculture-digest` | 収集スクリプトのバズ指標データから個人開発ネタを選定 | `subculture/` |
| `tech-news-ideas` | テックニュースから個人開発ネタを選定 | `tech/` |

`./skills` を `/opt/data/skills/custom` に bind mount しているため、**SKILL.md を編集すれば即反映**される
（`SOUL.md` と同じ方針。死んだコピーにならない）。

### 使い方

Slack で自然に頼むか、CLI ワンショットで実行する。

```
# Slack（主インターフェース）
「subculture-research で 推し活 を調査して」
「同じ手順でコスプレ領域も調べて」      ← 新領域もその場で指定できる
```

```bash
# CLI ワンショット
docker exec hermes-sandbox hermes -z "subculture-research スキルで同人活動を調査して" --yolo
```

```bash
# Skill の確認
docker exec hermes-sandbox hermes skills list
```

> 旧 cron ジョブ 7 本の定義は `hermes_agent/cron/jobs.json` にバックアップとして残してある（復元用）。
> 再び定期実行したくなった場合は `hermes cron create ... --skill <スキル名>` で Skill を cron に紐付けられる。

<details>
<summary>旧 cron ジョブ構成（2026-07-20 廃止・参考）</summary>

## 旧: 登録されていたジョブ

| ジョブ名 | ID | スケジュール | 出力先サブフォルダ | 方式 |
|---|---|---|---|---|
| 個人開発ネタ収集(Obsidian) | `03959a6c7ef5` | `every 360m` | `tech/` | web_search |
| サブカル個人開発ネタ収集 | `99b86793e172` | `every 360m` | `subculture/` | `--script` 注入 |
| VTuber困りごと発アプリ案 | `4607f73e1a4b` | `0 0 * * *`（JST 9時） | `vtuber-painpoints/` | web_search |
| 調査:推し活 | `68ac36a46e9c` | `0 20 * * *`（JST 5時） | `deep-research/oshikatsu/` | browser 精読 |
| 調査:同人活動 | `1485678190f2` | `0 21 * * *`（JST 6時） | `deep-research/doujin/` | browser 精読 |
| 調査:トレーディングカードゲーム | `04741e688528` | `0 22 * * *`（JST 7時） | `deep-research/tcg/` | browser 精読 |
| 調査:VTuber視聴・切り抜き制作 | `b8b89a5cc84f` | `0 23 * * *`（JST 8時） | `deep-research/vtuber/` | browser 精読 |

いずれも成果物は `/opt/data/obsidian/<サブフォルダ>` に frontmatter 付き Markdown 保存 → Obsidian vault
（`ALL_IN/Hermes/<サブフォルダ>`）に直結、配信は `slack:C0BJAGX6ZSN`。すべて動作確認済み。

### 「調査:*」ジョブの設計思想（Hermes=調査専任 / まとめは別担当）

`調査:*` の 4 本は **Hermes に調査だけを念入りにやらせ、最終的な分析・企画案は別（Claude 等）が担当する**
という分担で作られている。1 回の実行を **1 領域に限定**しているのが要点で、4 領域を 1 プロンプトに詰めると
qwen3.6 が破綻し、検索スニペットへの退行やプレースホルダ URL の捏造が起きることを実測で確認したため。

各ジョブのプロンプトに課している制約:

- **browser ツールで実ページを最低 3 件精読**し、本文の記述に基づいて困りごとを抽出する
- **プレースホルダ URL（`xxxx` 等）や「検索結果より」という記載を明示的に禁止**
- 読めなかったページの内容を推測で書かない／件数を水増ししない
- **企画案・MVP 案・解決策は書かない**（調査素材に徹する）
- 末尾に「実際に本文を読めたページ数」と「読めなかった/除外したページ」を正直に記載させる
- 実行時刻を 1 時間ずつずらし、同時実行の競合を回避（1 本あたり 20〜30 分かかる）

### Cron ごとの出力先フォルダ分け

出力先は **各ジョブのプロンプト内の保存パス**で決まる。`write_file` は親ディレクトリを自動生成するため、
プロンプトで `/opt/data/obsidian/<任意のフォルダ>/<ファイル名>.md` と指定するだけで、vault 側に
サブフォルダが自動で切られて振り分けられる（マウント追加や事前 mkdir は不要）。

- ジョブ追加時: プロンプトに好きなサブフォルダ付きパスを書くだけ。
- 既存ジョブの出力先変更: `hermes cron edit <id> --prompt "...保存先を /opt/data/obsidian/<新フォルダ>/... に..."`
  でプロンプトの保存パスを書き換える（`--prompt` はプロンプト全文を置換する点に注意）。

```bash
docker exec hermes-sandbox hermes cron list                  # 確認
docker exec hermes-sandbox hermes cron run <job_id>          # 手動発火（テスト）
docker exec hermes-sandbox hermes cron remove <job_id>       # 削除
```

</details>

---

## サブカル情報収集パイプライン（--script 注入方式）

「収集指標を決めて集める」部分を **決定論的なスクリプト**に切り出し、その出力（バズ順ダイジェスト）を
cron が LLM に注入して「個人開発ネタへの変換」を任せる 2 段構成。LLM の反復上限に依存せず安定する。

### 収集スクリプト

`hermes_agent/scripts/collect_subculture.py`（Git 管理）。標準ライブラリ + `requests` のみで動く。
対象ドメイン: **アニメ/マンガ・VTuber/配信・同人/創作ツール**。

| ソース | 収集指標（バズ） | 備考 |
|---|---|---|
| はてなブックマーク（entertainment/game カテゴリ RSS） | users 数（閾値 30+） | 日本のサブカル話題に強い。サブカル語のキーワードフィルタで該当判定 |
| GitHub（topic 検索を stars 降順） | stars | `vtuber/live2d/vroid/doujin/visual-novel/galgame` の直近 push リポジトリ |
| RSS 新着（ANN, コミックナタリー） | なし（新規シグナル） | アニメ/マンガの新着 |
| ~~Reddit~~ | ~~upvotes~~ | **当環境（データセンター IP）から全経路 403 で取得不可のため除外**。認証付き Reddit API を用意すれば復活可能 |

各ソースはフェイルソフト（1 つ失敗しても全体は止めない）。

### コンテナへの配置（再構築時の復元手順）

スクリプトは永続ボリューム内の **`/opt/data/scripts/`**（＝ `$HERMES_HOME/scripts`）に置く。
`--script` はこのディレクトリを基準に解決する（ヘルプの表記 `~/.hermes/scripts/` ではなく `$HERMES_HOME/scripts` が実際の解決先）。
Git 管理版からデプロイするには:

```bash
docker exec -u root hermes-sandbox mkdir -p /opt/data/scripts
docker cp hermes_agent/scripts/collect_subculture.py \
  hermes-sandbox:/opt/data/scripts/collect_subculture.py
docker exec -u root hermes-sandbox \
  chown hermes:hermes /opt/data/scripts/collect_subculture.py

# 単体動作テスト
docker exec -u hermes hermes-sandbox \
  python3 /opt/data/scripts/collect_subculture.py
```

### ジョブの作成

`--script` に **ファイル名のみ**（`/opt/data/scripts/` 配下として解決される）を渡す。

```bash
docker exec hermes-sandbox hermes cron create "every 6h" \
  "<ダイジェストを踏まえ5個のネタを選定しObsidianに保存＋Slack通知するプロンプト>" \
  --name "サブカル個人開発ネタ収集" \
  --script collect_subculture.py \
  --deliver slack:C0BJAGX6ZSN
```

- プロンプトには **創作防止ガード**（「ダイジェストに無い項目・数値・ソースを創作しない」）を入れている。
  Reddit 等の未収集ソースを LLM が根拠として捏造するのを防ぐため。
- 収集指標を変えたい（閾値・ソース追加など）ときは Git 版スクリプトを編集 → 上記で再デプロイするだけ。

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
| 成果物が途中で切れる | `HERMES_MAX_ITERATIONS`（現在 40）の上限。プロンプトの手数を減らすか上限を上げる |
| 「APIキーが必要」と言われる | 誤案内。ローカル Ollama で鍵不要（`SOUL.md` に前提を明記済み） |
| 検索が辞書/用語解説ばかりで生の声に届かない | SearXNG のエンジン劣化。`searxng/settings.yml` を確認（CAPTCHA 常習エンジンは無効化済み、Bing 主軸） |
| レポートに `xxxx` 等のプレースホルダURLが混じる | LLM の捏造。プロンプトに「プレースホルダ禁止・実際に開いたURLのみ」を明記し、1 実行 1 領域に絞る |

## 設定ファイル構成 — どこを編集すると何が変わるか

Hermes の設定は **3 つの層**に分散している。ここを押さえないと「どこを直せばいいのか」が分からなくなる。

```
① ホスト側 hermes_agent/          ← Git管理下・編集の主戦場
   ├─ docker-compose.yml          （環境変数・マウント・実行制限）
   ├─ Dockerfile                  （使える"能力"そのもの: Chromium/agent-browser）
   ├─ config.yaml         ──┐bind mount（モデル・エージェント挙動）
   ├─ SOUL.md             ──┤bind mount（行動指針＝ここが唯一のソース）
   ├─ searxng/settings.yml   │     （検索エンジン構成）
   ├─ scripts/*.py           │     （収集ロジック／要手動デプロイ）
   └─ cron/jobs.json         │     （②のスナップショット・復元用）
                             │
② 永続ボリューム /opt/data ←─┘   ← 再作成で消えない・ただしGit管理外
   ├─ SOUL.md                     （恒久的な行動指針＝CLAUDE.md相当）
   ├─ config.yaml                 （①からマウントされた実体）
   ├─ cron/jobs.json              （ジョブごとの指示＝プロンプト）
   ├─ scripts/                    （cron --script の解決先）
   ├─ skills/ memories/ hooks/ profiles/
   └─ obsidian/                   （Obsidian vault へのマウント）

③ イメージ層（/opt/hermes 等）    ← 再作成で消える
   └─ 永続化したいものは①のDockerfileに書く
```

### 「行動指針を指示する」ならここ

| やりたいこと | 編集先 | 効き方 |
|---|---|---|
| **常に効く人格・方針**（例:「成果物はObsidianへ」「次の行動を提案せよ」） | `hermes_agent/SOUL.md`（bind mount で `/opt/data/SOUL.md` の実体） | システムプロンプトに注入。**新規セッションから**有効 |
| **タスク個別の指示** | cron ジョブの prompt（`hermes cron edit <id> --prompt "..."`） | そのジョブ実行時のみ |
| モデル/推論の性格 | `config.yaml` の `agent:`（`reasoning_effort`, `personalities`） | 再起動後 |
| 記憶の扱い | `config.yaml` の `memory:` ＋ `/opt/data/memories/` | 再起動後 |
| スキル追加 | `/opt/data/skills/`（`hermes skills` で管理） | — |

### 「制限する」ならここ

| 制限したいこと | 編集先 | 現在値 |
|---|---|---|
| **暴走防止（反復回数）** | `docker-compose.yml` → `HERMES_MAX_ITERATIONS` | 40 |
| 会話ターン上限 | `config.yaml` → `agent.max_turns` | 60 |
| **書き込み可能範囲** | env `HERMES_WRITE_SAFE_ROOT` | `/opt/data`（外は `write_file` 拒否） |
| ツールループの空回り検知 | `config.yaml` → `tool_loop_guardrails` | warn/hard_stop 閾値 |
| コード実行の制限 | `config.yaml` → `code_execution`（timeout, max_tool_calls） | 300s / 50回 |
| 委譲の上限 | `config.yaml` → `delegation.max_iterations` | 50 |
| ツール自体の禁止 | **ジョブの prompt で明示**（例「execute_code を使うな」） | cron では `execute_code` は自動ブロック |

### 落とし穴

1. **モデル指定は `config.yaml` が唯一の権威** — compose の `MODEL` 等の環境変数は参照されず無視される。
2. **`SOUL.md` は新規セッションからしか効かない** — 実行中の会話には反映されない。
3. **`/opt/data` は Git 管理外** — ただし `config.yaml` と `SOUL.md` は bind mount でホスト側（Git 管理下）が
   実体になっている。`cron/jobs.json` だけはスナップショット運用（理由は下記）。
4. **`scripts/` は自動同期されない** — ホストの `scripts/` は手動 `docker cp` が必要。
5. **cron `--prompt` はプロンプト全文を置換**（部分編集ではない）。

### SOUL.md は bind mount（リポジトリが唯一のソース）

行動指針の `SOUL.md` は `config.yaml` と同じく **ホスト側 `hermes_agent/SOUL.md` を bind mount** している。

```yaml
- ./SOUL.md:/opt/data/SOUL.md
```

- **リポジトリのファイルを編集すれば、それがそのまま実体**（`docker cp` 不要、コンテナ側に即反映）。
- 反映タイミングは **新規セッションから**（SOUL.md はセッション開始時にシステムプロンプトへ読み込まれるため、
  実行中の会話には効かない）。
- bind mount しないとリポジトリ側が「編集しても効かない死んだコピー」になり二重管理・ドリフトの原因になる。
  同じ理由で `config.yaml` も bind mount している。

### cron ジョブ定義のバックアップ（こちらはスナップショット運用）

`cron/jobs.json` は **bind mount していない**。Hermes が実行のたびに `next_run_at` / `last_run_at` /
`last_status` を書き換えるため、bind mount すると git diff が常時汚れ続けるから。
こちらは「ソースではなく純粋なバックアップ」と割り切り、必要な時にエクスポートする。

```bash
# 【エクスポート】コンテナ → リポジトリ（ジョブを増減したら実行）
docker cp hermes-sandbox:/opt/data/cron/jobs.json hermes_agent/cron/jobs.json

# 【復元】リポジトリ → コンテナ（ボリューム作り直し後など）
docker cp hermes_agent/cron/jobs.json hermes-sandbox:/opt/data/cron/jobs.json
docker compose restart hermes-agent      # cron スケジューラに再読込させる
```

> `/opt/data` は external な永続ボリュームなので `docker compose down -v` でも消えないが、
> `docker volume rm hermes-agent-data` や Docker Desktop の "Clean / Purge data" では失われる。
> その場合 `memories/` `sessions/` `state.db`（会話履歴）は復元できない点に注意。

### 参考: 主要な設定ファイルの場所

| 内容 | パス |
|---|---|
| モデル/エンドポイント設定 | `hermes_agent/config.yaml`（コンテナ `/opt/data/config.yaml`） |
| 永続コンテキスト（CLAUDE.md 相当） | コンテナ `/opt/data/SOUL.md`（Git: `hermes_agent/SOUL.md`） |
| cron ジョブ定義 | コンテナ `/opt/data/cron/jobs.json`（Git: `hermes_agent/cron/jobs.json`） |
| cron 実行履歴 | コンテナ `/opt/data/cron/executions.db` |
| 収集スクリプト（cron `--script`） | Git: `hermes_agent/scripts/` ↔ コンテナ `/opt/data/scripts/`（`$HERMES_HOME/scripts`） |
| ブラウザ能力（Chromium/agent-browser） | `hermes_agent/Dockerfile`（イメージに焼き込み） |
| 検索エンジン構成 | `hermes_agent/searxng/settings.yml` |
| Obsidian 出力先 | `/opt/data/obsidian` ↔ ホスト `~/Documents/obsidian/ALL_IN/Hermes` |
