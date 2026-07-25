# hermes_agent_proto

素の [Hermes Agent](https://github.com/NousResearch/hermes-agent) を検証するための**最小構成**。
推論はホストの Ollama（`qwen3.6:latest`）、やりとりは**ターミナルの CLI のみ**。

本番構成の [../hermes_agent](../hermes_agent) とは状態を完全に分離しているので、
両方を同時に起動しても干渉しない。

| | proto（これ） | 本番 hermes_agent |
|---|---|---|
| コンテナ名 | `hermes-proto` | `hermes-sandbox` |
| 状態の置き場 | `./data/`（bind mount） | 名前付きボリューム `hermes-agent-data` |
| インターフェース | CLI のみ | Slack ゲートウェイ + cron + CLI |
| Web 検索 | なし | SearXNG（自前ホスト） |
| その他 | — | Obsidian 連携 / カスタム skills / Chromium 焼き込み |

## 起動 / 停止

```bash
cd hermes_agent_proto
docker compose up -d      # 起動
docker compose ps         # 状態確認
docker compose down       # 停止（./data は残る）
```

## 使い方

```bash
# 対話 CLI（本命）
docker exec -it hermes-proto hermes

# ワンショット実行（対話せず1回だけ）
docker exec hermes-proto hermes -z "今日の日付を教えて" --yolo
```

## ファイル構成

```
hermes_agent_proto/
├── docker-compose.yml   （git 管理）
├── .gitignore
└── data/                → コンテナの /opt/data（HERMES_HOME）に丸ごと bind mount
    ├── config.yaml      （git 管理・設定の唯一の権威）
    ├── SOUL.md          （git 管理・行動指針。新規セッションから反映）
    ├── workspace/       （エージェントの作業ディレクトリ）
    └── memories/ sessions/ logs/ skills/ …  （実行時の状態・gitignore）
```

`/opt/data` を丸ごと bind しているため、**設定も記憶もログもホスト側から直接読める**のがこの構成の要点。
`docker exec` でコンテナに入って確認する必要がない。

### 設定の変え方

`data/config.yaml` を編集して `docker compose restart` するだけ。
compose の環境変数（`MODEL` 等）は Hermes が参照しないので効かない — **config.yaml が唯一の権威**。

状態をまっさらに戻したいときは `data/config.yaml` と `data/SOUL.md` を退避してから
`rm -rf data/` し、2ファイルを書き戻して再起動する。

## 挙動メモ

- **初回 boot でイメージが `data/` を自動生成する。** ディレクトリ一式と `SOUL.md` を作り、
  `config.yaml` は「既に存在すればスキップ」なので、リポジトリに置いたものが尊重される。
- **ただし `config.yaml` は初回 boot 時にスキーマ移行で書き換えられる**（`_config_version` の付与、
  既定値の補完、末尾への解説コメント追加）。元の内容は `config.yaml.bak-<timestamp>` に退避される。
  `model:` ブロックの指定は保持されるので実害はないが、**手書きのコメントは消える**。
- `HERMES_UID=501` / `HERMES_GID=20` をホストユーザーに合わせているため、
  `data/` 配下のファイルはホスト側から素のまま編集できる。
- **cron は動かない。** `HERMES_GATEWAY_BOOTSTRAP_STATE` を設定していないのでゲートウェイは
  停止したままで、これは CLI 専用構成として意図どおり（`hermes cron status` は
  `✗ Gateway is not running` を返す）。
- `write_file` は `HERMES_WRITE_SAFE_ROOT=/opt/data` の外に書けない。
  作業ディレクトリを `/opt/data/workspace` にしているのはこのため。
- 起動時に `⚠ tirith security scanner enabled but not available` が出るが、
  コマンド走査がパターンマッチにフォールバックするだけで動作に影響はない。

## 疎通確認

```bash
docker compose logs hermes-agent-proto   # 起動ログ
docker exec hermes-proto hermes -z "1+1は？数字だけ答えて" --yolo   # → 2

# Ollama に届かないときはここを切り分ける
docker exec hermes-proto curl -s http://host.docker.internal:11434/api/tags
```

---

## 会話内容と「学習」の変化を追う

**この構成の主目的。** 会話を送る前後で Hermes に何が蓄積されたかを、ホスト側の差分として観測する。

前提として、**Hermes はモデルの重みを更新しない**（ローカル Ollama の `qwen3.6` は不変）。
変化するのは次回以降のシステムプロンプトに注入される**コンテキスト**であり、その実体は
`data/memories/` 配下のプレーンな Markdown。つまり `git diff` で行単位に追える。

| ファイル | 中身 | 上限 |
|---|---|---|
| `data/memories/USER.md` | ユーザープロフィール | 1,375 字 |
| `data/memories/MEMORY.md` | 一般記憶 | 2,200 字 |

いずれも既定で有効（`memory_enabled` / `user_profile_enabled` がデフォルト `true`）。
無効化したい場合は `data/config.yaml` に `memory:` セクションを足す。

### 観測対象を3つに絞っている理由

`data/` 配下には 50MB 近い実行時ファイルが並ぶが、**観測対象にするのは次の3つだけ**。

| 対象 | 何が分かるか |
|---|---|
| `data/memories/*.md` | **学習の結果**。次回のシステムプロンプトに注入される内容そのもの |
| `data/session-exports/*.md` | **学習の原因**。どの発言のどのツール呼び出しが記憶を書いたか |
| `data/state.db` の `messages` / `sessions` | **一次ソース**。全会話の生ログ（上2つはここからの派生） |

この3つで「入力（会話）→ 契機（memory ツール呼び出し）→ 出力（注入される記憶）」の因果が閉じる。
残りを外しているのは手抜きではなく、**次の理由でいずれも「会話の前後で変化した学習内容」を含まないため**。

| 除外するもの | サイズ | 除外理由 |
|---|---|---|
| `data/skills/` | 6.4 MB | イメージ同梱の 18 カテゴリ・69 skill。**毎回の boot で `skills_sync.py` により同梱版から再同期される**ので、会話とは無関係に差分が出る。版管理するとベンダーのコードを丸ごと抱え込む |
| `data/home/` | 26 MB | コンテナ内 `hermes` ユーザーの HOME。シェル履歴や各種ドットファイルで、学習内容ではない |
| `data/bin/`, `data/lazy-packages/` | 19 MB | ツールが遅延インストールしたバイナリ・パッケージ。実行環境であって学習ではない |
| `data/*_cache.json`, `data/cache/` | 3.4 MB | モデル一覧やコンテキスト長のキャッシュ。外部 API の応答であり会話に依存しない |
| `data/logs/` | 36 KB | `agent.log` / `errors.log`。**タイムスタンプと内部トレースが毎回変わるため差分が常時汚れる**。会話の中身は state.db に構造化して入っており、こちらを読む理由がない |
| `data/state.db-wal`, `-shm` | 変動 | SQLite の WAL / 共有メモリ。`state.db` の内容が二重に現れるだけで、コンテナ稼働中は中身が不定 |
| `data/sessions/`, `cron/`, `hooks/`, `plans/`, `backups/` | 0 B | この構成では**常に空**。CLI 専用でゲートウェイも cron も動かさないため使われない |
| `data/config.yaml.bak-*` | 2 KB | 初回 boot のスキーマ移行で退避された旧 config。1度きりの生成物 |
| `data/.env` | — | 秘密情報の置き場（`chmod 600`）。Ollama 利用のため実キーは不要だが、**版管理に載せてはいけない**ため常に除外 |

**例外的に対象へ加える価値があるのは `data/skills/` だけ。** Hermes は会話中に skill を自作でき
（`hermes journey` の `stats.learned_skills` がその数を返す）、成果物はここに落ちる。
ただし同梱 69 件のノイズに埋もれるので、追うなら**自作分のサブディレクトリだけ**を
`.gitignore` の否定パターンで拾うこと。同梱分ごと版管理するのは避ける。

### 手順: 記憶を版管理して差分を見る

`.gitignore` に1行足して `data/memories/` を版管理対象に含める。

```
data/*
!data/config.yaml
!data/SOUL.md
!data/memories/          ← 追加
```

**版管理に載せるのは `data/memories/` だけでよい。** 3つの観測対象のうち残り2つを外すのは、
`data/state.db` がバイナリで `git diff` が効かない（SQLite で都度クエリする方が早い）ためと、
`data/session-exports/` が必要なときにコマンドで再生成できる派生物であり、
かつ `memories/` の差分を見た後に「原因」を掘るための道具だから。
`memories/` だけがテキストで、かつ会話ごとに確実に変化する。

あとは会話のたびにコミットして差分を取る。

```bash
git add data/memories && git commit -m "会話前"

docker exec -it hermes-proto hermes        # 会話する

git diff data/memories/                    # 何が学習されたかが行単位で見える
```

実測例 — 「私の名前はナカダです。普段は Ruby と TypeScript を書いていて、
インデントは2スペース派です。覚えておいてください」と送った結果:

```diff
+++ data/memories/USER.md
+Name: Nakada (名前：ナカダ)
```

**応答では「Ruby、TypeScript、2スペースを記憶しました」と言うが、実際に書かれたのは名前だけ。**
この種の「言っていることと保存されたものの乖離」を捕まえるのが、この差分観測の主眼。

### 会話ログそのものを見る

会話は `data/state.db`（SQLite）の `messages` / `sessions` テーブルに全量が残る。
bind mount しているのでホストから直接クエリできる。

```bash
sqlite3 data/state.db "select role, substr(content,1,80) from messages order by id;"
sqlite3 data/state.db "select id, message_count, tool_call_count from sessions;"
```

Markdown に書き出すこともできる。出力先の既定が `$HERMES_HOME/session-exports` なので、
そのまま `data/session-exports/` に落ちる。

```bash
docker exec hermes-proto hermes sessions list          # セッションIDを確認
docker exec hermes-proto hermes sessions export \
  --format md --session-id <SESSION_ID> --yes
```

このエクスポートには**ツール呼び出しの引数まで JSON で含まれる**ので、記憶が書き込まれた
瞬間そのものを読める。差分の原因を特定するにはこちらが早い。

```json
{ "name": "memory",
  "arguments": "{\"operations\":[{\"action\":\"add\",\"content\":\"Name: Nakada\"}],\"target\":\"user\"}" }
```

なお `--session-id` 等のフィルタなしの一括エクスポートは拒否される（`Refusing bulk export
without a filter.`）。全件出したいときは `--source cli` などを付ける。

### 学習の時系列を俯瞰する

`hermes journey`（別名 `learning` / `memory-graph`）が、学習した skill と記憶を時系列で返す。
`--json` で機械可読なので、前後比較のスクリプト化に使える。

```bash
docker exec hermes-proto hermes journey --json
# → nodes[].timestamp / memory[].title / stats.memory_nodes / stats.learned_skills
```

### 記憶をまっさらに戻す

```bash
rm -rf data/memories/*
docker compose restart
```

会話履歴ごと消す場合は `data/state.db*` も削除する（コンテナ停止中に行うこと）。
