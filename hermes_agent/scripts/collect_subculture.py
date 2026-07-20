#!/usr/bin/env python3
# サブカル（アニメ/マンガ・VTuber/配信・同人/創作ツール）に絞った情報収集スクリプト。
# 収集指標（バズ）を決定論的にスコアリングし、Markdownダイジェストを標準出力に吐く。
# この出力を cron の --script 注入モードでLLMに渡し、個人開発ネタへ変換させる想定。
#
# 依存: 標準ライブラリ + requests のみ（bs4/feedparser不要）。
# 各ソースは try/except でフェイルソフト（1ソース失敗でも全体は止めない）。

import sys
import datetime
import xml.etree.ElementTree as ET

import requests

TIMEOUT = 12
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")

# サブカル関心フィルタ。はてブのカテゴリRSSは範囲が広いため、この語群で該当性を判定する。
SUBCULTURE_KEYWORDS = [
    "アニメ", "anime", "マンガ", "漫画", "manga", "声優", "ラノベ", "ライトノベル",
    "vtuber", "ぶいちゅーば", "にじさんじ", "ホロライブ", "vsinger", "配信者",
    "同人", "コミケ", "コミック", "pixiv", "イラスト", "作画", "二次創作", "ファンアート",
    "ボカロ", "初音ミク", "live2d", "vroid", "vrm", "創作", "キャラクター", "原作", "galgame",
    "ノベルゲーム", "ビジュアルノベル", "美少女ゲーム", "コスプレ", "オタク", "推し",
]

# はてなブックマーク人気エントリのカテゴリRSS（bookmarkcount=バズ数を含む）
HATENA_CATEGORIES = ["entertainment", "game"]
HATENA_MIN_BOOKMARKS = 30  # バズ足切り（users数）

# GitHub Trending代替: topic検索をstars降順で。同人/創作/VTuber系ツールの実装ヒント源。
GITHUB_TOPICS = ["vtuber", "live2d", "vroid", "doujin", "visual-novel", "galgame"]

# アニメ/マンガ新着RSS（バズ指標なし=新規シグナルとして掲載）
NEWS_RSS = [
    ("ANN", "https://www.animenewsnetwork.com/all/rss.xml"),
    ("コミックナタリー", "https://natalie.mu/comic/feed/news"),
]

# 注: Reddit は当環境（データセンターIP）から全経路403でupvotes=バズを取得できないため、
#     誠実性を優先して収集対象から除外している。認証付きReddit APIを用意すれば復活可能。


def _local(tag):
    """名前空間付きタグからローカル名だけ取り出す。"""
    return tag.rsplit("}", 1)[-1]


def _text(elem, names):
    """子要素のうちローカル名が names のいずれかに一致する最初のテキストを返す。"""
    for child in elem.iter():
        if _local(child.tag) in names and child.text:
            return child.text.strip()
    return ""


def is_subculture(text):
    low = text.lower()
    return any(k.lower() in low for k in SUBCULTURE_KEYWORDS)


def fetch_hatena():
    """はてブ カテゴリRSSからサブカル該当かつバズ閾値以上のエントリを収集。"""
    items = []
    for cat in HATENA_CATEGORIES:
        try:
            url = f"https://b.hatena.ne.jp/hotentry/{cat}.rss"
            r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
            r.raise_for_status()
            root = ET.fromstring(r.content)
            for el in root.iter():
                if _local(el.tag) != "item":
                    continue
                title = _text(el, {"title"})
                link = _text(el, {"link"})
                count_s = _text(el, {"bookmarkcount"})
                try:
                    count = int(count_s)
                except ValueError:
                    count = 0
                if not title or count < HATENA_MIN_BOOKMARKS:
                    continue
                if not is_subculture(title):
                    continue
                items.append((count, title, link, cat))
        except Exception as e:  # フェイルソフト
            print(f"<!-- hatena {cat} 取得失敗: {e} -->")
    items.sort(reverse=True)
    return items[:10]


def fetch_github():
    """GitHub topic検索をstars降順で集約。直近pushのものを優先。"""
    since = (datetime.date.today() - datetime.timedelta(days=180)).isoformat()
    seen = {}
    for topic in GITHUB_TOPICS:
        try:
            q = f"topic:{topic} pushed:>={since}"
            url = "https://api.github.com/search/repositories"
            r = requests.get(
                url,
                params={"q": q, "sort": "stars", "order": "desc", "per_page": 5},
                headers={"User-Agent": UA, "Accept": "application/vnd.github+json"},
                timeout=TIMEOUT,
            )
            r.raise_for_status()
            for repo in r.json().get("items", []):
                name = repo["full_name"]
                if name in seen:
                    continue
                seen[name] = (
                    repo.get("stargazers_count", 0),
                    name,
                    repo.get("html_url", ""),
                    (repo.get("description") or "").strip(),
                    topic,
                )
        except Exception as e:
            print(f"<!-- github {topic} 取得失敗: {e} -->")
    repos = sorted(seen.values(), reverse=True)
    return repos[:8]


def fetch_news_rss():
    """アニメ/マンガ新着RSS（バズなし・新規シグナル）。"""
    out = []
    for label, url in NEWS_RSS:
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT,
                             allow_redirects=True)
            r.raise_for_status()
            root = ET.fromstring(r.content)
            n = 0
            for el in root.iter():
                if _local(el.tag) != "item":
                    continue
                title = _text(el, {"title"})
                link = _text(el, {"link"})
                if not title:
                    continue
                out.append((label, title, link))
                n += 1
                if n >= 6:
                    break
        except Exception as e:
            print(f"<!-- rss {label} 取得失敗: {e} -->")
    return out


def main():
    today = datetime.date.today().isoformat()
    print(f"# サブカル情報収集ダイジェスト（{today}）")
    print("対象: アニメ/マンガ・VTuber/配信・同人/創作ツール ／ バズ指標付き\n")

    hatena = fetch_hatena()
    print("## はてなブックマーク（users数=バズ, 閾値30+）")
    if hatena:
        for count, title, link, cat in hatena:
            print(f"- [{count}users][{cat}] {title} {link}")
    else:
        print("- (該当なし)")
    print()

    gh = fetch_github()
    print("## GitHub（stars=バズ, 同人/創作/VTuber系ツール）")
    if gh:
        for stars, name, url, desc, topic in gh:
            desc = (desc[:80] + "…") if len(desc) > 80 else desc
            print(f"- [{stars}★][{topic}] {name} — {desc} {url}")
    else:
        print("- (該当なし)")
    print()

    news = fetch_news_rss()
    print("## RSS新着（新規シグナル・バズなし）")
    if news:
        for label, title, link in news:
            print(f"- [{label}] {title} {link}")
    else:
        print("- (該当なし)")
    print()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"収集スクリプト全体エラー: {e}", file=sys.stderr)
        sys.exit(1)
