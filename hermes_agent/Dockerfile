# Hermes Agent にブラウザ抽出能力（agent-browser + Chromium）を焼き込んだカスタムイメージ。
#
# 背景: 素の nousresearch/hermes-agent には Chromium が無く、note/はてな等の
# JSレンダリングページの本文を読めない（web_searchはURL＋要約止まり）。
# ブラウザツールを常時使えるようにするため、以下をイメージ層に永続化する:
#   - system Chromium（apt）
#   - agent-browser（hermes postinstall が /opt/hermes/node_modules に導入）
#   - Chromium実行パスの環境変数（gateway/cron プロセスが参照）
# これらは /opt/data 永続ボリュームの外なので、Dockerfileで焼かないと再作成で消える。
FROM nousresearch/hermes-agent:latest

USER root

# system Chromium 本体（実行に必要な共有ライブラリは base イメージに同梱済み）
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium \
 && rm -rf /var/lib/apt/lists/*

# agent-browser（Node製ブラウザツール）を導入。
# postinstall内のChromium自動DLは失敗するが、system Chromium＋下記ENVで代替するため無視する。
RUN hermes postinstall || true

# ブラウザツールが system Chromium を使うよう実行パスを明示（agent-browser/playwright/puppeteer系）
ENV CHROME_PATH=/usr/bin/chromium \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
