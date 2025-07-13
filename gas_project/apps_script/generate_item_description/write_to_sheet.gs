/**
 * 生成された商品情報をスプレッドシートに書き込む
 */
function writeToSheet(generatedText, folderName, googleSpreadSheetId) {
  const sheet = SpreadsheetApp.openById(googleSpreadSheetId).getSheets()[0];

  // APIの応答(Markdown形式)からJSON部分のみを抽出
  const match = generatedText.match(/{[\s\S]*}/);
  const itemDescription = JSON.parse(match);

  // 最終行に追加
  sheet.appendRow([
    new Date(), // 日付
    folderName, // 画像のフォルダー名
    itemDescription.title, // 商品名
    itemDescription.description, // 商品説明
  ]);
}
