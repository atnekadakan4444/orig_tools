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
