---
name: tech-news-ideas
description: "TechCrunch/HackerNews/ProductHunt/GitHub Trendingなどの最新テックニュースをweb検索で調べ、個人開発のタネになりそうなものをカテゴリ分けして選定し、Obsidianに保存する。"
version: 1.0.0
metadata:
  hermes:
    tags: [tech-news, indie-dev, obsidian, web-search]
---

# テックニュース → 個人開発ネタ

最新のテックニュースから「個人開発のタネ」を拾い、Obsidian に蓄積する。

## 手順

1. 今の日付を確認する。
2. TechCrunch / HackerNews / ProductHunt / GitHub Trending のいずれかを `web_search` で調べる
   （**検索は 3〜4 回まで**。手数を絞らないと反復上限に達して途中で打ち切られる）。
3. 個人開発のタネになりそうなものを **5 個**、カテゴリ分けして選定する。

## 厳守事項

- 検索で実際に確認できた内容だけを使う。**事実・数値・出典 URL を創作しない。**
- 出典を示せるものは実在 URL を添える。プレースホルダ（`xxxx` 等）は禁止。
- 検索が空振りしてネタが集まらなかった場合は、**推測で埋めず**、その旨を正直に報告する。

## 出力

`/opt/data/obsidian/tech/<本日日付>_個人開発ネタ.md` に `write_file` で保存する。

frontmatter:

```
tags: [hermes, 個人開発]
date: <本日日付>
source: web_search
```

保存後、選んだ 5 個のタイトルだけを箇条書きで簡潔に返す。

## 注意

- 無人実行（cron）では `execute_code` がブロックされるため、保存は必ず `write_file` を使う。
- web_search が辞書・用語解説ページばかり返す場合は SearXNG のエンジン劣化を疑う
  （`hermes_agent/searxng/settings.yml` を確認。CAPTCHA 常習エンジンは無効化済み、Bing 主軸）。
