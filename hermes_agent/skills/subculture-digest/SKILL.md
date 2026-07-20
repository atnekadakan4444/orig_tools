---
name: subculture-digest
description: "収集スクリプトではてブ/GitHub/RSSからサブカル関連のバズ情報（users数・stars等の指標付き）を集め、アニメ/マンガ・VTuber・同人/創作ツール領域の個人開発のタネを選定してObsidianに保存する。"
version: 1.0.0
metadata:
  hermes:
    tags: [subculture, digest, buzz, obsidian, indie-dev]
prerequisites:
  files: [/opt/data/scripts/collect_subculture.py]
---

# サブカル バズダイジェスト → 個人開発ネタ

決定論的な収集スクリプトで実データ（バズ指標付き）を集め、それだけを根拠に個人開発のタネを選定する。
検索の当たり外れに左右されないのが利点。

## 手順

1. 収集スクリプトを実行してダイジェストを取得する。

   ```bash
   python3 /opt/data/scripts/collect_subculture.py
   ```

   出力は Markdown 形式のダイジェスト。収集元と指標は以下:

   | ソース | 収集指標 |
   |---|---|
   | はてなブックマーク（entertainment/game カテゴリ） | users 数（閾値 30+） |
   | GitHub（vtuber/live2d/vroid/doujin/visual-novel/galgame トピック） | stars |
   | RSS 新着（ANN, コミックナタリー） | 新規シグナル（指標なし） |

   ※ Reddit は当環境から全経路 403 で取得できないため収集対象外。

2. 得られたダイジェストを踏まえ、**アニメ/マンガ・VTuber/配信・同人/創作ツール**の領域で
   「個人開発のタネ」になるアイデアを 5 個選定する。
3. 各アイデアに『元ネタ（ダイジェスト内のどの項目か）／なぜ今／実装案（技術スタック）／難易度(★1-5)』を付ける。

## 厳守事項

- **ダイジェストに存在しない項目・数値・ソースを創作してはならない。**
- 各アイデアの「元ネタ」は必ずダイジェスト内に実在する項目（記事タイトルやリポジトリ名）を指すこと。
- Reddit など収集されていないソースを根拠に挙げてはならない。
- スクリプトが失敗してダイジェストが得られなかった場合は、**推測でアイデアを作らず**、
  失敗した旨を正直に報告する。

## 出力

`/opt/data/obsidian/subculture/<本日日付>_サブカル個人開発ネタ.md` に `write_file` で保存する。

frontmatter:

```
tags: [hermes, サブカル, 個人開発]
date: <本日日付>
source: script
```

保存後、選んだ 5 個のタイトルだけを箇条書きで簡潔に返す。

## 注意

- 無人実行（cron）では `execute_code` がブロックされるため、cron から使う場合は
  `hermes cron create ... --script collect_subculture.py` でスクリプト出力を注入する方式を使うこと。
  手動実行（対話 / `hermes -z`）ではスクリプトを直接実行してよい。
- 収集指標（閾値・対象トピック等）を変えたい場合は `hermes_agent/scripts/collect_subculture.py` を
  編集し、`docker cp` でコンテナの `/opt/data/scripts/` に再デプロイする。
