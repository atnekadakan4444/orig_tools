/**
 * GeminiAPIに画像、プロンプトを含めてリクエストを送信
 */
function callGeminiApi(apiKey, sendPrompt, itemImages) {
  // プロンプトと、各画像のデータをまとめる
  const textPart = { text: sendPrompt };
  const imageParts = itemImages.map((file) => ({
    inline_data: {
      mime_type: file.getBlob().getContentType(), // file.getMimeType() でも可
      data: Utilities.base64Encode(file.getBlob().getBytes()),
    },
  }));

  // リクエスト先とリクエスト内容の指定
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [textPart, ...imageParts] }],
  };
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
