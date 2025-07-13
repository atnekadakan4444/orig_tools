/**
 * GeminiAPIに画像、プロンプトを含めてリクエストを送信
 */
function callGeminiApi(apiKey, sendPrompt, itemImages) {
  // 全ての画像をBase64形式の配列に変換
  const imageBase64Array = itemImages.map((file) =>
    Utilities.base64Encode(file.getBlob().getBytes())
  );

  // プロンプトと複数枚の画像を格納
  const parts = [{ text: sendPrompt }];
  for (const b64 of imageBase64Array) {
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: b64,
      },
    });
  }

  // リクエスト先とリクエスト内容の指定
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: parts }] };
  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  // リクエスト送信
  const response = UrlFetchApp.fetch(url, options);

  // 正常にレスポンスが返ってきたか判定
  if (response.getResponseCode() === 200) {
    const data = JSON.parse(response);
    // 応答からテキスト部分だけを抽出
    const content = data["candidates"][0]["content"]["parts"][0]["text"];
    return content;
  } else {
    throw new Error("正常にレスポンスが返って来ていません。");
  }
}
